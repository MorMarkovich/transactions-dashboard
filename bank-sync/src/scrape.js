// Runs israeli-bank-scrapers for one provider. Credentials are passed in by the
// caller (read from the OS keychain) and never logged.
import { existsSync } from 'node:fs'
import { assertSafeDebugEnvironment, runScraperSafely, safeError } from './safe-errors.js'

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
export async function scrapeProvider(provider, credentials, { monthsBack = 3, showBrowser = false, executablePath = '', keepBrowserOpen = false, failureScreenshotPath = '', timeout = 120000, navigationRetryCount = 2, combineInstallments = false, additionalTransactionInformation = false } = {}) {
  assertSafeDebugEnvironment()
  let dependency
  try { dependency = await import('israeli-bank-scrapers') } catch { throw safeError('BANK_SCRAPE_FAILED') }
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
    // Slow SPAs (Discount) need more than the 30s default; extend both the
    // navigation timeout and puppeteer's element-wait timeout, and retry.
    timeout,
    defaultTimeout: timeout,
    navigationRetryCount,
    ...(launchPath ? { executablePath: launchPath } : {}),
    ...(keepBrowserOpen ? { skipCloseBrowser: true } : {}),
    // Banking failure screenshots may contain financial/account data. Off.

  })

  const result = await runScraperSafely(scraper, credentials)

  const txns = []
  for (const account of result.accounts || []) {
    for (const t of account.txns || []) txns.push(t)
  }
  return txns
}
