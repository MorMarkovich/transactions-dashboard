// Re-attribute the owner (_owner) of every transaction in the latest snapshot
// using the CURRENT account registry — without re-scraping the banks. Use it
// after changing an account's owner in `npm run setup` (e.g. switching בנק
// דיסקונט from a person to משותף so salaries split by name), especially when a
// provider is temporarily blocked and a full `resync` isn't possible.
// Also re-runs the keyword catalog over rows still in שונות, so catalog
// updates (git pull) reach already-stored rows.
//
// Read+write only against Supabase; no bank logins. Run: `npm run retag`.
import { config, assertConfig } from './config.js'
import { getJSON, getAccounts, SUPABASE_AUTH_KEY } from './secrets.js'
import { signIn, getLatestSnapshot, getCategoryRules, insertSnapshot, deleteOtherSnapshots } from './supabaseClient.js'
import { detectOwner } from './owner.js'
import { refreshMiscCategories } from './normalize.js'

const ils = (n) =>
  `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₪`

// Categorize on the clean merchant name (installment suffix stripped), matching
// how normalize.js attributes the row at scrape time.
function baseDescription(desc) {
  return String(desc || '').replace(/\s*\(תשלום \d+\/\d+\)\s*$/, '').trim()
}

// Find the registry account a row came from: by provider when unique, otherwise
// (two cards of one provider, e.g. two Isracard) disambiguate by the stored
// account label / owner.
function resolveAccount(txn, accounts) {
  const candidates = accounts.filter((a) => a.provider === txn['_provider'])
  if (candidates.length <= 1) return candidates[0] || null
  return candidates.find((a) => a.label === txn['_source_file'])
    || candidates.find((a) => a.owner && String(txn['_source_file'] || '').includes(a.owner))
    || null
}

async function main() {
  assertConfig()
  const auth = await getJSON(SUPABASE_AUTH_KEY)
  if (!auth?.email) throw new Error('No Supabase login stored. Run `npm run setup` first.')
  const accounts = await getAccounts()
  if (!accounts.length) throw new Error('No accounts in the registry. Run `npm run setup` first.')

  console.log('\nAccount owners (from the registry):')
  for (const a of accounts) console.log(`  • ${a.label}  [${a.key}] → ${a.owner || '(unset)'}`)

  const { supabase, userId } = await signIn(config.supabaseUrl, config.supabaseAnonKey, auth.email, auth.password)
  const [txns, rules] = await Promise.all([
    getLatestSnapshot(supabase, userId),
    getCategoryRules(supabase, userId),
  ])
  if (!txns.length) { console.log('\nNo transactions to retag.'); return }
  const ruleMap = new Map((rules || []).map((r) => [r.merchant, r.category]))

  let changed = 0
  const before = {}
  const after = {}
  for (const t of txns) {
    const acct = resolveAccount(t, accounts)
    const prev = t['_owner'] || '(untagged)'
    before[prev] = (before[prev] || 0) + 1
    const newOwner = detectOwner(baseDescription(t['תיאור']), acct ? acct.owner : undefined, config.ownerKeywords)
    if (t['_owner'] !== newOwner) { t['_owner'] = newOwner; changed++ }
    if (acct && acct.label && t['_source_file'] !== acct.label) t['_source_file'] = acct.label
    after[newOwner] = (after[newOwner] || 0) + 1
  }

  // Show the per-owner expense/income totals after retagging.
  const totals = {}
  for (const t of txns) {
    const o = t['_owner'] || '(untagged)'
    if (!totals[o]) totals[o] = { count: 0, expense: 0, income: 0 }
    const amt = Number(t['סכום']) || 0
    totals[o].count += 1
    if (amt < 0) totals[o].expense += Math.abs(amt); else totals[o].income += amt
  }
  console.log(`\nRe-tagged ${changed} of ${txns.length} rows. Per-owner now:`)
  for (const [o, e] of Object.entries(totals)) {
    console.log(`  ${o}: ${e.count} txns — expenses ${ils(e.expense)}, income ${ils(e.income)}`)
  }

  const recategorized = refreshMiscCategories(txns, ruleMap)
  console.log(`Re-categorized ${recategorized} שונות row(s) via the current keyword catalog.`)

  if (changed === 0 && recategorized === 0) { console.log('\nNothing changed — snapshot left as-is.'); return }
  console.log('\nWriting updated snapshot…')
  const newId = await insertSnapshot(supabase, userId, txns)
  await deleteOtherSnapshots(supabase, userId, newId)
  console.log('✓ Done. Reload the dashboard with a clean URL (no ?session_id) to see it.')
}

main().catch((e) => { console.error('retag failed:', e.message); process.exit(1) })
