// Orchestrates one sync run: scrape each configured provider locally, normalize
// + categorize, merge into the latest Supabase snapshot (dedup), and insert the
// merged snapshot. Exposed as a function (used by server.js) and runnable
// directly as a CLI (`npm run sync`).
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { config, assertConfig } from './config.js'
import { getJSON, credKey, getAccounts, SUPABASE_AUTH_KEY } from './secrets.js'
import { PROVIDER_LABELS } from './providers.js'
import { scrapeProvider } from './scrape.js'
import { normalizeTxn, mergeSnapshots } from './normalize.js'
import { applyIncomeMonthShift } from './income.js'
import { signIn, getLatestSnapshot, getCategoryRules, insertSnapshot, deleteOtherSnapshots } from './supabaseClient.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// The accounts to sync: the keychain registry if present, otherwise a legacy
// fallback derived from PROVIDERS (one account per provider, owner unknown).
// ACCOUNTS (env) narrows the run to specific account keys — e.g. pull only one
// Isracard card without re-logging into the other (avoids rate-limit blocks).
async function resolveAccounts() {
  const registry = await getAccounts()
  const all = registry.length ? registry : config.providers.map((provider) => ({
    key: provider,
    provider,
    owner: undefined,
    label: PROVIDER_LABELS[provider] || provider,
  }))
  if (config.accounts.length) return all.filter((a) => config.accounts.includes(a.key))
  return all
}

/**
 * @param {(msg:string)=>void} [log] progress callback
 * @param {{fresh?: boolean}} [opts] fresh = replace all data (ignore + delete old snapshots)
 */
export async function runSync(log = () => {}, { fresh = false } = {}) {
  assertConfig()

  const auth = await getJSON(SUPABASE_AUTH_KEY)
  if (!auth?.email || !auth?.password) {
    throw new Error('No Supabase login stored. Run `npm run setup` first.')
  }

  log(fresh ? 'מתחבר ל-Supabase (רענון מלא)…' : 'מתחבר ל-Supabase…')
  const { supabase, userId } = await signIn(config.supabaseUrl, config.supabaseAnonKey, auth.email, auth.password)

  // Always read the existing snapshot. A normal sync merges into it; a fresh
  // resync uses it to PRESERVE rows from accounts that fail to scrape this run
  // (so a temporary block — e.g. Isracard anti-bot — can't wipe good data).
  const [existing, rules] = await Promise.all([
    getLatestSnapshot(supabase, userId),
    getCategoryRules(supabase, userId),
  ])
  const ruleMap = new Map((rules || []).map((r) => [r.merchant, r.category]))

  const freshTxns = []
  const byProvider = {}
  const errors = {}

  const accounts = await resolveAccounts()
  let prevProvider = null
  for (const acct of accounts) {
    const credentials = await getJSON(credKey(acct.key))
    if (!credentials) {
      log(`דילוג על ${acct.label || acct.key} (אין פרטי התחברות)`) // not set up — skip
      continue
    }
    // Pause between accounts so logins don't fire back-to-back (helps avoid
    // anti-bot blocks, e.g. Isracard's "Block Automation"). Wait longer when
    // hitting the SAME provider twice in a row (e.g. two Isracard cards).
    if (prevProvider !== null) {
      const ms = prevProvider === acct.provider ? config.sameProviderDelayMs : config.accountDelayMs
      if (ms > 0) { log(`ממתין ${Math.round(ms / 1000)} שניות לפני החשבון הבא…`); await sleep(ms) }
    }
    prevProvider = acct.provider
    try {
      log(`סורק ${acct.label || acct.key}…`)
      // Always save a screenshot of the failure screen for inspection (only
      // written on a GENERAL_ERROR; debug/ is gitignored).
      const debugDir = path.resolve(process.cwd(), 'debug')
      mkdirSync(debugDir, { recursive: true })
      const failureScreenshotPath = path.join(debugDir, `${acct.key}-failure.png`)
      const raw = await scrapeProvider(acct.provider, credentials, {
        monthsBack: config.monthsBack,
        showBrowser: config.showBrowser,
        executablePath: config.chromePath,
        keepBrowserOpen: config.keepBrowserOpen,
        failureScreenshotPath,
        timeout: config.scrapeTimeout,
        navigationRetryCount: config.navRetryCount,
        combineInstallments: config.combineInstallments,
      })
      let count = 0
      for (const t of raw) {
        const n = normalizeTxn(t, acct, ruleMap, config.ownerKeywords)
        if (n) { freshTxns.push(n); count++ }
      }
      byProvider[acct.key] = count
      log(`${acct.label || acct.key}: ${count} עסקאות`)
    } catch (err) {
      errors[acct.key] = err.message || String(err)
      log(`שגיאה ב-${acct.label || acct.key}: ${errors[acct.key]}`)
    }
  }

  // On a fresh resync, start from the existing rows of accounts that FAILED
  // this run (so they're kept), then layer the fresh data over them. Accounts
  // that succeeded get fully replaced by their fresh scrape. A normal sync just
  // merges into everything that already exists.
  let baseRows = existing
  if (fresh) {
    const failedLabels = new Set(
      accounts
        .filter((a) => errors[a.key])
        .map((a) => a.label || PROVIDER_LABELS[a.provider] || a.provider),
    )
    baseRows = (existing || []).filter((t) => failedLabels.has(t['_source_file']))
    if (baseRows.length) {
      log(`שומר ${baseRows.length} עסקאות קיימות מחשבונות שנכשלו (${[...failedLabels].join(', ')}) כדי לא למחוק אותן`)
    }
  }
  const { merged, added, enriched } = mergeSnapshots(baseRows, freshTxns)

  // Re-attribute boundary salaries to a consistent month (applies to existing
  // rows too, so historical months get corrected).
  const shifted = applyIncomeMonthShift(merged, {
    direction: config.incomeShiftDirection,
    cutoffDay: config.incomeShiftDay,
    salaryMin: config.salaryMin,
  })
  if (shifted) log(`התאמת חודש להכנסות: ${shifted} משכורות שויכו לחודש הנכון`)

  if (fresh) {
    // Replace everything: write the fresh snapshot, then delete the old ones.
    if (merged.length === 0) {
      log('לא נאספו עסקאות — לא בוצע רענון (כדי לא למחוק נתונים קיימים).')
    } else {
      log(`כותב snapshot חדש (${merged.length} עסקאות) ומוחק את הישנים…`)
      const newId = await insertSnapshot(supabase, userId, merged)
      await deleteOtherSnapshots(supabase, userId, newId)
    }
  } else if (added > 0 || enriched > 0 || shifted > 0) {
    log(`שומר snapshot (${merged.length} עסקאות, ${added} חדשות${enriched ? `, ${enriched} עודכנו` : ''})…`)
    await insertSnapshot(supabase, userId, merged)
  } else {
    log('אין שינויים — לא נשמר snapshot חדש.')
  }

  return { success: true, fresh, added, enriched, shifted, total: merged.length, byProvider, errors }
}

// Token check helper shared with the server (constant-time compare).
export function tokensMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// CLI entry: `npm run sync` (add --fresh to replace all data, e.g. via `npm run resync`)
if (import.meta.url === `file://${process.argv[1]}`) {
  const fresh = process.argv.includes('--fresh')
  runSync((m) => console.log('•', m), { fresh })
    .then((r) => {
      console.log('\n✓ Sync complete:', JSON.stringify(r, null, 2))
      if (config.keepBrowserOpen) {
        console.log('\n(KEEP_BROWSER_OPEN=true — the browser window is left open for inspection. Press Ctrl+C here when done.)')
      } else {
        process.exit(0)
      }
    })
    .catch((e) => {
      console.error('\n✗ Sync failed:', e.message)
      process.exit(1)
    })
}
