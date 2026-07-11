// Turn raw israeli-bank-scrapers transactions into the dashboard's Hebrew-keyed
// shape (see backend/app/models/transaction.py + data_processor.py).
import { categorize, applyRules, subcategorize, categoryFromIssuer, isForeignExempt, VALID_CATEGORIES } from './categorize.js'
import { isBankProvider, PROVIDER_LABELS } from './providers.js'
import { detectOwner } from './owner.js'

function pad2(n) { return String(n).padStart(2, '0') }
function ymd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function mmYYYY(d) { return `${pad2(d.getMonth() + 1)}/${d.getFullYear()}` }

// pandas dayofweek: Monday=0 … Sunday=6. JS getDay(): Sunday=0 … Saturday=6.
function pandasDow(d) { return (d.getDay() + 6) % 7 }

/**
 * @param {object} raw   one scraper txn ({ date, processedDate, chargedAmount, originalAmount, description, memo })
 * @param {string|{provider:string,owner?:string,label?:string}} account  account (or a bare provider id)
 * @param {Map<string,string>} ruleMap merchant→category overrides
 * @param {object} [ownerKeywords]  owner → keywords map for joint-account attribution
 * @returns normalized txn, or null if it should be dropped (zero amount / bad date)
 */
export function normalizeTxn(raw, account, ruleMap, ownerKeywords) {
  // Accept a bare provider string for backward compatibility.
  const acct = typeof account === 'string'
    ? { provider: account, owner: undefined, label: PROVIDER_LABELS[account] || account }
    : account
  const provider = acct.provider
  const date = new Date(raw.date)
  if (isNaN(date.getTime())) return null

  // chargedAmount is already signed (expenses negative, credits positive) for
  // both bank accounts and credit cards; fall back to originalAmount.
  const amount = Number(raw.chargedAmount ?? raw.originalAmount ?? 0)
  if (!Number.isFinite(amount) || amount === 0) return null

  const baseDesc = (String(raw.description ?? '').trim()) || 'לא ידוע'
  const bankRow = isBankProvider(provider)

  // The card company's own sector for the merchant (MAX sends it with every
  // transaction; Isracard needs the opt-in extra-info fetch). Stored so the
  // dashboard/retag can use it later, and used below as a weak fallback.
  const issuerCategory = raw.category ? String(raw.category).trim() : ''

  // Categorize on the clean merchant name (before any installment suffix).
  // Precedence: catalog > user rules > issuer sector, so a rule can decide a
  // catalog-unknown merchant but never fight the catalog, and the issuer
  // only fills what both left uncategorized. Mirrors the backend restore.
  let category = applyRules(categorize(baseDesc), baseDesc, ruleMap)
  if (category === 'שונות') {
    category = categoryFromIssuer(issuerCategory) || category
  }
  // Subcategory (קטגוריה_משנה) derived from the finalized category. The
  // dashboard re-derives this on restore too, so this is parity-only.
  const subcategory = subcategorize(category, baseDesc)

  // When installments are split, each monthly charge shares the merchant, date
  // and amount — tag it with n/total so it stays a distinct row (survives dedup)
  // and reads clearly on the statement.
  let description = baseDesc
  const inst = raw.installments
  if (inst && Number(inst.total) > 1) {
    description = `${baseDesc} (תשלום ${inst.number}/${inst.total})`
  }

  const txn = {
    'תאריך': ymd(date),
    'תיאור': description,
    'קטגוריה': category,
    'קטגוריה_משנה': subcategory,
    'סכום': amount,
    'סכום_מוחלט': Math.abs(amount),
    'חודש': mmYYYY(date),
    'יום_בשבוע': pandasDow(date),
    'הערות': raw.memo ? String(raw.memo) : null,
    '_is_bank_row': bankRow,
    // Tag the account so you can filter/reconcile per card in the dashboard
    // (the existing "source" UI reads _source_file) and in `npm run verify`.
    '_source_file': acct.label || PROVIDER_LABELS[provider] || provider,
    '_provider': provider,
    // Issuer's own sector name (may be '') — kept so retag/restore can use it.
    'ענף_מקור': issuerCategory || null,
    // Owner attribution: personal account → its owner; joint → name-detected.
    '_owner': detectOwner(baseDesc, acct.owner, ownerKeywords),
  }

  // Billing date — credit cards only.
  if (!bankRow && raw.processedDate) {
    const pd = new Date(raw.processedDate)
    if (!isNaN(pd.getTime())) {
      txn['תאריך_חיוב'] = ymd(pd)
      txn['חודש_חיוב'] = mmYYYY(pd)
    }
  }

  return txn
}

// Dedup key — matches the backend's dedup columns [תאריך, סכום, תיאור].
export function txnKey(t) {
  return `${t['תאריך']}|${t['סכום']}|${t['תיאור']}`
}

/**
 * Merge freshly-scraped rows into the existing snapshot, dropping duplicates by
 * txnKey. Returns { merged, added }. Existing rows are kept as-is (they already
 * carry server-side categories); new rows are appended; ids are reassigned.
 */
export function mergeSnapshots(existing, fresh) {
  const merged = [...(existing || [])]
  const byKey = new Map(merged.map((t) => [txnKey(t), t]))
  let added = 0
  let enriched = 0
  for (const t of fresh) {
    const k = txnKey(t)
    const existingRow = byKey.get(k)
    if (existingRow) {
      // Same transaction — never double-count, but backfill any fields the
      // stored row is missing (e.g. account tags added in a later version).
      let changed = false
      for (const [field, val] of Object.entries(t)) {
        if (existingRow[field] === undefined || existingRow[field] === null) {
          existingRow[field] = val
          changed = true
        }
      }
      if (changed) enriched++
      continue
    }
    byKey.set(k, t)
    merged.push(t)
    added++
  }
  merged.forEach((t, i) => { t.id = i })
  return { merged, added, enriched }
}

/**
 * Re-run the keyword catalog over the stored snapshot (no bank login).
 * שונות / invalid rows are re-categorized as before; additionally, for
 * EXPENSE rows the catalog is the source of truth — a stored category that
 * contradicts a current keyword hit is stale (an old catalog version or an
 * old AI guess; mergeSnapshots never overwrites stored fields) and is
 * repaired. Rows the catalog has no opinion on keep their stored category,
 * income rows are never second-guessed, and user rules still win over
 * everything. Returns the number of rows re-categorized.
 */
export function refreshMiscCategories(txns, ruleMap) {
  let changed = 0
  for (const t of txns) {
    const stored = t['קטגוריה'] || 'שונות'
    const baseDesc = String(t['תיאור'] || '').replace(/\s*\(תשלום \d+\/\d+\)\s*$/, '').trim()
    // Stale-row repair: rows the PRE-exemption foreign rule tagged as travel
    // (NETFLIX.COM … NL etc.) carry a "real" category, so keeping the stored
    // value would leave them wrong forever. Re-categorize them like שונות.
    const staleExemptTravel = stored === 'טיסות ותיירות'
      && !/[֐-׿]/.test(baseDesc) && isForeignExempt(baseDesc)
    // Invalid stored categories ('אחר' from early AI runs) are junk — treat
    // them as שונות so the current catalog re-categorizes them.
    const isMisc = stored === 'שונות' || !VALID_CATEGORIES.has(stored) || staleExemptTravel
    const isExpense = Number(t['סכום']) < 0
    if (!isMisc && !isExpense) continue
    // Precedence: catalog > user rules > issuer sector > stored category.
    let category = applyRules(categorize(baseDesc), baseDesc, ruleMap)
    if (category === 'שונות') {
      if (isMisc) {
        // Same weak fallback as scrape time: the issuer's own sector, when the
        // row carries one, beats leaving it uncategorized.
        category = categoryFromIssuer(t['ענף_מקור']) || category
      } else {
        // The catalog and the rules have no opinion on this stored expense —
        // keep what's stored.
        category = stored
      }
    }
    // An invalid stored category must not survive even when nothing matches —
    // reset it to שונות so the dashboard/AI treat it as uncategorized.
    if (category === stored) continue
    t['קטגוריה'] = category
    // The old subcategory belonged to the old category — re-derive.
    t['קטגוריה_משנה'] = category !== 'שונות' ? subcategorize(category, baseDesc) : ''
    changed++
  }
  return changed
}
