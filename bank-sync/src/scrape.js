// Runs israeli-bank-scrapers for one provider. Credentials are passed in by the
// caller (read from the OS keychain) and never logged.
import { createScraper, CompanyTypes } from 'israeli-bank-scrapers'

// Map our provider ids to israeli-bank-scrapers CompanyTypes.
// NOTE: MAX was historically `leumiCard`; current versions expose `max`.
// We resolve defensively so a version bump doesn't silently break it.
function companyId(provider) {
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
export async function scrapeProvider(provider, credentials, { monthsBack = 3, showBrowser = false } = {}) {
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - monthsBack)
  startDate.setDate(1)

  const scraper = createScraper({
    companyId: companyId(provider),
    startDate,
    combineInstallments: true,
    showBrowser,
    verbose: false,
  })

  const result = await scraper.scrape(credentials)
  if (!result.success) {
    const reason = [result.errorType, result.errorMessage].filter(Boolean).join(': ')
    throw new Error(reason || 'scrape failed')
  }

  const txns = []
  for (const account of result.accounts || []) {
    for (const t of account.txns || []) txns.push(t)
  }
  return txns
}
