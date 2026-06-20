// Reconciliation report — prints exactly what's stored in Supabase (i.e. what
// the dashboard shows), broken down by account and by month, so you can compare
// against your bank/credit-card statements. Read-only. Run: `npm run verify`.
import { config, assertConfig } from './config.js'
import { getJSON, SUPABASE_AUTH_KEY } from './secrets.js'
import { signIn, getLatestSnapshot } from './supabaseClient.js'

const ils = (n) =>
  `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₪`

function group(txns, keyFn) {
  const m = new Map()
  for (const t of txns) {
    const k = keyFn(t) || '—'
    if (!m.has(k)) m.set(k, { count: 0, expenses: 0, income: 0 })
    const g = m.get(k)
    g.count++
    const amt = Number(t['סכום']) || 0
    if (amt < 0) g.expenses += amt
    else g.income += amt
  }
  return m
}

function printTable(title, map, sortKeys) {
  console.log(`\n=== ${title} ===`)
  console.log(
    '  ' + 'group'.padEnd(16) + 'count'.padStart(7) +
    'expenses'.padStart(16) + 'income'.padStart(16) + 'net'.padStart(16),
  )
  for (const k of [...map.keys()].sort(sortKeys)) {
    const g = map.get(k)
    console.log(
      '  ' + String(k).padEnd(16) + String(g.count).padStart(7) +
      ils(g.expenses).padStart(16) + ils(g.income).padStart(16) + ils(g.expenses + g.income).padStart(16),
    )
  }
}

const monthSort = (a, b) => {
  const [ma, ya] = String(a).split('/')
  const [mb, yb] = String(b).split('/')
  return (Number(ya) - Number(yb)) || (Number(ma) - Number(mb))
}

async function main() {
  assertConfig()
  const auth = await getJSON(SUPABASE_AUTH_KEY)
  if (!auth?.email) throw new Error('No Supabase login stored. Run `npm run setup` first.')

  const { supabase, userId } = await signIn(config.supabaseUrl, config.supabaseAnonKey, auth.email, auth.password)
  const txns = await getLatestSnapshot(supabase, userId)

  console.log(`\nLatest snapshot: ${txns.length} transactions — this is exactly the data the dashboard renders.`)
  const dates = txns.map((t) => t['תאריך']).filter(Boolean).sort()
  if (dates.length) console.log(`Transaction-date range: ${dates[0]} … ${dates[dates.length - 1]}`)

  const expenses = txns.reduce((s, t) => s + (Number(t['סכום']) < 0 ? Number(t['סכום']) : 0), 0)
  const income = txns.reduce((s, t) => s + (Number(t['סכום']) > 0 ? Number(t['סכום']) : 0), 0)
  console.log(`Total expenses: ${ils(expenses)}`)
  console.log(`Total income:   ${ils(income)}`)
  console.log(`Net:            ${ils(expenses + income)}`)

  if (txns.some((t) => t['_owner'])) {
    printTable('By owner (מי)', group(txns, (t) => t['_owner']), (a, b) => String(a).localeCompare(b))
  }
  if (txns.some((t) => t['_source_file'])) {
    printTable('By account / card', group(txns, (t) => t['_source_file']), (a, b) => String(a).localeCompare(b))
  } else {
    console.log('\n(No per-account tags yet — run `npm run sync` once more to tag each transaction, then re-run verify.)')
  }

  printTable('By BILLING month (חודש_חיוב) — compare to your card statements', group(txns, (t) => t['חודש_חיוב'] || t['חודש']), monthSort)
  printTable('By transaction month (חודש)', group(txns, (t) => t['חודש']), monthSort)

  console.log('\nHow to reconcile:')
  console.log('• Cards (MAX/Isracard): match "By account" + a BILLING month total to that card\'s statement for the same month.')
  console.log('• Bank (Discount): note that the lump-sum credit-card payment line is intentionally removed (the individual card charges are already counted), so the bank total here is lower than the raw statement by that amount.')
  console.log('• Only the last few months are synced (MONTHS_BACK in .env), so older statement months won\'t appear.')
}

main().catch((e) => { console.error('verify failed:', e.message); process.exit(1) })
