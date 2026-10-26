// Runs israeli-bank-scrapers for one provider. Credentials are passed in by the
// caller (read from the OS keychain) and never logged.
import { existsSync } from 'node:fs'
import { assertSafeDebugEnvironment, runScraperSafely, safeError } from './safe-errors.js'
import { attachPendingDiscoveryHook, attachPendingSessionHook } from './isracard-pending-session.js'
import { withScraperCleanup } from './scraper-lifecycle.js'
import { superviseScrape } from './scrape-supervisor.js'

// Map our provider ids to israeli-bank-scrapers CompanyTypes.
// NOTE: MAX was historically `leumiCard`; current versions expose `max`.
// We resolve defensively so a version bump doesn't silently break it.
function companyId(provider, CompanyTypes) {
  const direct = CompanyTypes[provider]
  if (direct) return direct
  if (provider === 'max') return CompanyTypes.max || CompanyTypes.leumiCard
  throw new Error(`Unknown provider "${provider}" — not found in CompanyTypes`)
}

/**
 * @param {string} provider  leumi | discount | max | isracard
 * @param {object} credentials  provider-specific login fields
 * @param {{ monthsBack:number, showBrowser:boolean }} opts
 * @returns {Promise<object[]>} raw scraper transactions (flattened across accounts)
 */
export function createProviderAdapter(loadDependency = () => import('israeli-bank-scrapers')) {
return async function scrapeProviderDetailed(provider, credentials, { monthsBack = 3, showBrowser = false, executablePath = '', keepBrowserOpen = false, timeout = 120000, navigationRetryCount = 2, combineInstallments = false, additionalTransactionInformation = false, pendingTarget = null, pendingDiscovery = false, onStage = () => {} } = {}) {
  assertSafeDebugEnvironment()
  let dependency
  try { dependency = await loadDependency() } catch { throw safeError('BANK_SCRAPE_FAILED') }
  const { createScraper, CompanyTypes } = dependency
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - monthsBack)
  startDate.setDate(1)

  // Prefer a real installed Chrome (avoids the bundled-Chromium EBADMACHO /
  // "spawn Unknown system error -88" launch failures on macOS).
  let launchPath
  if (executablePath) {
    if (!existsSync(executablePath)) {
      throw new Error(`Chrome not found at "${executablePath}". Set CHROME_PATH in .env to your browser's executable path.`)
    }
    launchPath = executablePath
  }

  if (keepBrowserOpen || ((pendingTarget||pendingDiscovery) && (provider !== 'isracard' || (pendingTarget&&pendingDiscovery)))) throw safeError('BANK_PENDING_OPTIONS_INVALID')
  let browser
  const scraper = createScraper({
    companyId: companyId(provider, CompanyTypes),
    startDate,
    combineInstallments,
    // Isracard/Amex only: fetch each transaction's extra details (incl. the
    // merchant's sector, exposed as txn.category). One extra request per
    // transaction — keep off unless explicitly enabled (anti-bot risk).
    additionalTransactionInformation,
    showBrowser,
    verbose: false,
    prepareBrowser: async value => { browser = value; onStage('browser_ready') },
    // Slow SPAs (Discount) need more than the 30s default; extend both the
    // navigation timeout and puppeteer's element-wait timeout, and retry.
    timeout,
    defaultTimeout: timeout,
    navigationRetryCount,
    ...(launchPath ? { executablePath: launchPath } : {}),
    ...(keepBrowserOpen ? { skipCloseBrowser: true } : {}),
    // Banking failure screenshots may contain financial/account data. Off.

  })

  let hook
  if(pendingDiscovery)hook=attachPendingDiscoveryHook(scraper)
  if (pendingTarget) {
    try {hook = attachPendingSessionHook(scraper, pendingTarget)}
    catch {throw safeError('BANK_PENDING_OPTIONS_INVALID')}
  }
  let result,pending=null
  try {
    result = await withScraperCleanup(scraper, () => runScraperSafely(scraper, credentials), onStage)
    if(hook) pending=hook.getResult()
  } finally {
    hook?.detach()
    // Cleanup errors are swallowed upstream. Verify the owned browser process
    // actually exited; otherwise the supervisor retains the local lock.
    const child = browser?.process()
    if (child && child.exitCode === null && child.signalCode === null) {
      try { await browser.close() } catch { throw safeError('BANK_CLEANUP_REQUIRED') }
      if (child.exitCode === null && child.signalCode === null) throw safeError('BANK_CLEANUP_REQUIRED')
    }
  }

  const txns = []
  for (const account of result.accounts || []) {
    for (const t of account.txns || []) txns.push(t)
  }
  return {transactions:txns,pending}
}
}
const defaultAdapter=superviseScrape
// Backward-compatible posted-only entry. Existing runSync calls this function.
// It cannot silently enable pending or insert it into legacy ledger snapshots.
export async function scrapeProvider(provider,credentials,options={}) {
  const {transactions}=await defaultAdapter(provider,credentials,{...options,pendingTarget:null,pendingDiscovery:false})
  return transactions
}
// Explicit separate-result entry for reviewed pending integration and dry-run.
// Binding activation is explicit; all normal calls now use a bounded worker.
export const scrapeProviderDetailed=(...args)=>defaultAdapter(...args)
