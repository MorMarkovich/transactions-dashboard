// Turn raw israeli-bank-scrapers transactions into the dashboard's Hebrew-keyed
// shape (see backend/app/models/transaction.py + data_processor.py).
import { categorize, applyRules } from './categorize.js'
import { isBankProvider, PROVIDER_LABELS } from './providers.js'

function pad2(n) { return String(n).padStart(2, '0') }
function ymd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function mmYYYY(d) { return `${pad2(d.getMonth() + 1)}/${d.getFullYear()}` }

// pandas dayofweek: Monday=0 … Sunday=6. JS getDay(): Sunday=0 … Saturday=6.
function pandasDow(d) { return (d.getDay() + 6) % 7 }

/**
 * @param {object} raw   one scraper txn ({ date, processedDate, chargedAmount, originalAmount, description, memo })
 * @param {string} provider
 * @param {Map<string,string>} ruleMap merchant→category overrides
 * @returns normalized txn, or null if it should be dropped (zero amount / bad date)
 */
export function normalizeTxn(raw, provider, ruleMap) {
  const date = new Date(raw.date)
  if (isNaN(date.getTime())) return null

  // chargedAmount is already signed (expenses negative, credits positive) for
  // both bank accounts and credit cards; fall back to originalAmount.
  const amount = Number(raw.chargedAmount ?? raw.originalAmount ?? 0)
  if (!Number.isFinite(amount) || amount === 0) return null

  const description = (String(raw.description ?? '').trim()) || 'לא ידוע'
  const bankRow = isBankProvider(provider)

  let category = categorize(description)
  category = applyRules(category, description, ruleMap)

  const txn = {
    'תאריך': ymd(date),
    'תיאור': description,
    'קטגוריה': category,
    'סכום': amount,
    'סכום_מוחלט': Math.abs(amount),
    'חודש': mmYYYY(date),
    'יום_בשבוע': pandasDow(date),
    'הערות': raw.memo ? String(raw.memo) : null,
    '_is_bank_row': bankRow,
    // Tag the account so you can filter/reconcile per card in the dashboard
    // (the existing "source" UI reads _source_file) and in `npm run verify`.
    '_source_file': PROVIDER_LABELS[provider] || provider,
    '_provider': provider,
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
