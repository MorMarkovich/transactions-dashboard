// Bootstrap/refresh the golden labeled set that `npm run check` uses to
// measure categorization accuracy. Writes bank-sync/golden.json (gitignored —
// it contains your merchant names):
//
//   [{ "merchant": "שופרסל דיל", "category": "מזון וצריכה" }, ...]
//
// New merchants are appended with their CURRENT snapshot category as the
// starting label; existing entries are NEVER overwritten — your manual
// corrections in this file are the ground truth. Workflow:
//   1. npm run golden          (seed / add newly-seen merchants)
//   2. edit golden.json        (fix any label that's wrong)
//   3. npm run check           (accuracy section compares pipeline vs labels)
// Read-only against Supabase; no bank logins. Run: `npm run golden`.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { config, assertConfig } from './config.js'
import { getJSON, SUPABASE_AUTH_KEY } from './secrets.js'
import { signIn, getLatestSnapshot } from './supabaseClient.js'
import { normalizeMerchant } from './categorize.js'

const GOLDEN_PATH = path.resolve(process.cwd(), 'golden.json')
// How many top-spend merchants to keep labeled. Override: GOLDEN_TOP=300
const TOP_N = Number(process.env.GOLDEN_TOP) || 150

function baseDescription(desc) {
  return String(desc || '').replace(/\s*\(תשלום \d+\/\d+\)\s*$/, '').trim()
}

async function main() {
  assertConfig()
  const auth = await getJSON(SUPABASE_AUTH_KEY)
  if (!auth?.email) throw new Error('No Supabase login stored. Run `npm run setup` first.')
  const { supabase, userId } = await signIn(config.supabaseUrl, config.supabaseAnonKey, auth.email, auth.password)
  const txns = await getLatestSnapshot(supabase, userId)
  if (!txns.length) { console.log('No transactions in the snapshot — nothing to sample.'); return }

  // Top expense merchants by total spend (installment variants grouped).
  const merchants = new Map() // canonical key → {name, category, count, total}
  for (const t of txns) {
    const amt = Number(t['סכום']) || 0
    if (amt >= 0) continue
    const name = baseDescription(t['תיאור'])
    if (!name) continue
    const key = normalizeMerchant(name)
    const e = merchants.get(key) || { name, category: t['קטגוריה'] || 'שונות', count: 0, total: 0 }
    e.count += 1
    e.total += Math.abs(amt)
    merchants.set(key, e)
  }
  const top = [...merchants.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, TOP_N)

  // Merge with the existing file — user labels are ground truth, never touched.
  let existing = []
  if (existsSync(GOLDEN_PATH)) {
    try {
      existing = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'))
      if (!Array.isArray(existing)) throw new Error('expected a JSON array')
    } catch (e) {
      throw new Error(`golden.json exists but is not readable (${e.message}) — fix or delete it first.`)
    }
  }
  const have = new Set(existing.map((g) => normalizeMerchant(g?.merchant)))
  let added = 0
  for (const [key, e] of top) {
    if (have.has(key)) continue
    existing.push({ merchant: e.name, category: e.category })
    have.add(key)
    added++
  }

  writeFileSync(GOLDEN_PATH, JSON.stringify(existing, null, 2) + '\n')
  console.log(`✓ golden.json: ${existing.length} labeled merchants (${added} added from the top ${TOP_N} by spend).`)
  if (added) {
    console.log('  New entries start with their CURRENT category — open golden.json and fix any wrong label.')
  }
  console.log('  Then run `npm run check` to see pipeline accuracy against your labels.')
}

main().catch((e) => { console.error('golden failed:', e.message); process.exit(1) })
