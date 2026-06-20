// Orchestrates one sync run: scrape each configured provider locally, normalize
// + categorize, merge into the latest Supabase snapshot (dedup), and insert the
// merged snapshot. Exposed as a function (used by server.js) and runnable
// directly as a CLI (`npm run sync`).
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { config, assertConfig } from './config.js'
import { getJSON, getSecret, credKey, SUPABASE_AUTH_KEY } from './secrets.js'
import { scrapeProvider } from './scrape.js'
import { normalizeTxn, mergeSnapshots } from './normalize.js'
import { applyIncomeMonthShift } from './income.js'
import { signIn, getLatestSnapshot, getCategoryRules, insertSnapshot } from './supabaseClient.js'

/**
 * @param {(msg:string)=>void} [log] progress callback
 * @returns {Promise<{success:true, added:number, total:number, byProvider:object, errors:object}>}
 */
export async function runSync(log = () => {}) {
  assertConfig()

  const auth = await getJSON(SUPABASE_AUTH_KEY)
  if (!auth?.email || !auth?.password) {
    throw new Error('No Supabase login stored. Run `npm run setup` first.')
  }

  log('מתחבר ל-Supabase…')
  const { supabase, userId } = await signIn(config.supabaseUrl, config.supabaseAnonKey, auth.email, auth.password)

  const [existing, rules] = await Promise.all([
    getLatestSnapshot(supabase, userId),
    getCategoryRules(supabase, userId),
  ])
  const ruleMap = new Map((rules || []).map((r) => [r.merchant, r.category]))

  const fresh = []
  const byProvider = {}
  const errors = {}

  for (const provider of config.providers) {
    const credentials = await getJSON(credKey(provider))
    if (!credentials) {
      log(`דילוג על ${provider} (אין פרטי התחברות)`) // not set up — skip
      continue
    }
    try {
      log(`סורק ${provider}…`)
      // Always save a screenshot of the failure screen for inspection (only
      // written on a GENERAL_ERROR; debug/ is gitignored).
      const debugDir = path.resolve(process.cwd(), 'debug')
      mkdirSync(debugDir, { recursive: true })
      const failureScreenshotPath = path.join(debugDir, `${provider}-failure.png`)
      const raw = await scrapeProvider(provider, credentials, {
        monthsBack: config.monthsBack,
        showBrowser: config.showBrowser,
        executablePath: config.chromePath,
        keepBrowserOpen: config.keepBrowserOpen,
        failureScreenshotPath,
        timeout: config.scrapeTimeout,
        navigationRetryCount: config.navRetryCount,
      })
      let count = 0
      for (const t of raw) {
        const n = normalizeTxn(t, provider, ruleMap)
        if (n) { fresh.push(n); count++ }
      }
      byProvider[provider] = count
      log(`${provider}: ${count} עסקאות`)
    } catch (err) {
      errors[provider] = err.message || String(err)
      log(`שגיאה ב-${provider}: ${errors[provider]}`)
    }
  }

  const { merged, added, enriched } = mergeSnapshots(existing, fresh)

  // Re-attribute boundary salaries to a consistent month (applies to existing
  // rows too, so historical months get corrected).
  const shifted = applyIncomeMonthShift(merged, {
    direction: config.incomeShiftDirection,
    cutoffDay: config.incomeShiftDay,
    salaryMin: config.salaryMin,
  })
  if (shifted) log(`התאמת חודש להכנסות: ${shifted} משכורות שויכו לחודש הנכון`)

  // Write if anything changed (new rows, backfilled fields, or shifted months).
  if (added > 0 || enriched > 0 || shifted > 0) {
    log(`שומר snapshot (${merged.length} עסקאות, ${added} חדשות${enriched ? `, ${enriched} עודכנו` : ''})…`)
    await insertSnapshot(supabase, userId, merged)
  } else {
    log('אין שינויים — לא נשמר snapshot חדש.')
  }

  return { success: true, added, enriched, shifted, total: merged.length, byProvider, errors }
}

// Token check helper shared with the server (constant-time compare).
export function tokensMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// CLI entry: `npm run sync`
if (import.meta.url === `file://${process.argv[1]}`) {
  runSync((m) => console.log('•', m))
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
