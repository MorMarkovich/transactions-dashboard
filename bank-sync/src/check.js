// Post-sync sanity checks. Reads the latest Supabase snapshot (what the
// dashboard renders) and flags anything that looks off so you can trust the
// numbers. Read-only. Run: `npm run check`.
//
// Note: the dashboard applies a few more transforms when it loads this data
// (removes the bank's lump-sum credit-card payment, AI-categorizes leftover
// "שונות", applies your category rules). Those don't change counts/totals
// materially for these checks, but it's why a number here can differ slightly
// from the dashboard.
import { config, assertConfig } from './config.js'
import { getJSON, SUPABASE_AUTH_KEY } from './secrets.js'
import { signIn, getLatestSnapshot } from './supabaseClient.js'
import { txnKey } from './normalize.js'
import { SALARY_KEYWORDS, isSalary } from './income.js'

const ils = (n) =>
  `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₪`

const SALARY_MIN = Number(process.env.SALARY_MIN) || 4000

let warnings = 0
let problems = 0
const ok = (m) => console.log(`  ✓ ${m}`)
const warn = (m) => { warnings++; console.log(`  ⚠ ${m}`) }
const fail = (m) => { problems++; console.log(`  ✗ ${m}`) }
const section = (t) => console.log(`\n=== ${t} ===`)

function dayOf(ymd) { return Number(String(ymd).slice(8, 10)) }

async function main() {
  assertConfig()
  const auth = await getJSON(SUPABASE_AUTH_KEY)
  if (!auth?.email) throw new Error('No Supabase login stored. Run `npm run setup` first.')
  const { supabase, userId } = await signIn(config.supabaseUrl, config.supabaseAnonKey, auth.email, auth.password)
  const txns = await getLatestSnapshot(supabase, userId)
  const today = new Date().toISOString().slice(0, 10)

  console.log(`\nChecking latest snapshot: ${txns.length} transactions.\n`)
  if (!txns.length) { console.log('No transactions found — nothing to check.'); return }

  // 1. Accounts present + freshness
  section('Accounts & freshness')
  const byAccount = new Map()
  for (const t of txns) {
    const a = t['_source_file'] || '(untagged)'
    if (!byAccount.has(a)) byAccount.set(a, [])
    byAccount.get(a).push(t)
  }
  for (const [acct, list] of byAccount) {
    const latest = list.map((t) => t['תאריך']).filter(Boolean).sort().at(-1)
    const ageDays = latest ? Math.round((Date.parse(today) - Date.parse(latest)) / 86400000) : 999
    const msg = `${acct}: ${list.length} txns, latest ${latest} (${ageDays}d ago)`
    if (ageDays > 12) warn(`${msg} — no recent transactions; sync may have missed the latest, or the account is quiet`)
    else ok(msg)
  }
  if (byAccount.has('(untagged)')) warn('Some transactions have no account tag — run `npm run sync` once more to tag them.')

  // 2. Exact duplicates (should be none after dedup)
  section('Duplicates')
  const seen = new Map()
  let dupes = 0
  for (const t of txns) { const k = txnKey(t); seen.set(k, (seen.get(k) || 0) + 1) }
  for (const [k, c] of seen) if (c > 1) { dupes++; if (dupes <= 5) fail(`duplicate (${c}×): ${k}`) }
  if (dupes === 0) ok('No exact duplicates (date + amount + description).')
  else fail(`${dupes} duplicate key(s) found.`)

  // 3. Possible cross-account double counts (same |amount| same day, different account)
  section('Possible double counts (review)')
  const byAmtDay = new Map()
  for (const t of txns) {
    const key = `${t['תאריך']}|${Math.abs(Number(t['סכום']) || 0)}`
    if (!byAmtDay.has(key)) byAmtDay.set(key, [])
    byAmtDay.get(key).push(t)
  }
  let flagged = 0
  for (const [, list] of byAmtDay) {
    const accts = new Set(list.map((t) => t['_source_file']))
    if (list.length > 1 && accts.size > 1 && Math.abs(Number(list[0]['סכום'])) >= 100) {
      flagged++
      if (flagged <= 6) warn(`${list[0]['תאריך']} ${ils(Number(list[0]['סכום']))} appears in ${[...accts].join(' + ')} — same amount/day across accounts`)
    }
  }
  if (flagged === 0) ok('No same-amount/same-day matches across different accounts.')
  else warn(`${flagged} case(s) above — usually fine, but worth a glance for double counting.`)

  // 4. Sign sanity
  section('Sign sanity')
  const wrongSign = txns.filter((t) => Number(t['סכום']) < 0 && SALARY_KEYWORDS.some((k) => String(t['תיאור'] || '').toLowerCase().includes(k)))
  if (wrongSign.length === 0) ok('No salary-like rows with a negative (expense) sign.')
  else wrongSign.slice(0, 5).forEach((t) => fail(`salary-like but negative: ${t['תאריך']} ${ils(Number(t['סכום']))} ${t['תיאור']}`))

  // 5. Income / salary per month — the timing issue you flagged
  section('Income per month (salaries)')
  const salaries = txns.filter((t) => isSalary(t, SALARY_MIN))
  const months = [...new Set(txns.map((t) => t['חודש']).filter(Boolean))].sort((a, b) => {
    const [ma, ya] = a.split('/'); const [mb, yb] = b.split('/'); return (ya - yb) || (ma - mb)
  })
  const salByMonth = new Map()
  for (const t of salaries) {
    const m = t['חודש'] || '—'
    if (!salByMonth.has(m)) salByMonth.set(m, [])
    salByMonth.get(m).push(t)
  }
  for (const m of months) {
    const list = salByMonth.get(m) || []
    const lines = list.map((t) => `${t['תאריך']} ${ils(Number(t['סכום']))} (${t['תיאור']})`).join(' | ')
    if (list.length === 0) warn(`${m}: no salary detected`)
    else if (list.length === 2) ok(`${m}: ${list.length} salaries — ${lines}`)
    else warn(`${m}: ${list.length} salaries (expected 2) — ${lines}`)
    // Boundary salaries — may belong to an adjacent month (skip ones already
    // re-attributed by the income-month shift).
    for (const t of list) {
      if (t['_income_shifted']) continue
      const d = dayOf(t['תאריך'])
      if (d >= 25) warn(`   ↳ ${t['תאריך']} salary lands late in the month — may belong to the NEXT month`)
      else if (d <= 3) warn(`   ↳ ${t['תאריך']} salary lands at month start — may belong to the PREVIOUS month`)
    }
  }

  // 6. Outliers + future dates
  section('Outliers & dates')
  const OUTLIER = Number(process.env.OUTLIER_MIN) || 15000
  const big = txns.filter((t) => Math.abs(Number(t['סכום']) || 0) >= OUTLIER)
  if (big.length) big.slice(0, 10).forEach((t) => warn(`large (${ils(Number(t['סכום']))}): ${t['תאריך']} ${t['תיאור']} [${t['_source_file']}]`))
  else ok(`No transactions over ${ils(OUTLIER)}.`)
  const future = txns.filter((t) => t['תאריך'] > today)
  if (future.length) fail(`${future.length} transaction(s) dated in the future.`)
  else ok('No future-dated transactions.')

  // Summary
  section('Summary')
  console.log(`  ${problems} problem(s), ${warnings} warning(s).`)
  if (problems === 0 && warnings === 0) console.log('  Everything looks consistent. ✅')
  else console.log('  Review the ⚠/✗ lines above.')
}

main().catch((e) => { console.error('check failed:', e.message); process.exit(1) })
