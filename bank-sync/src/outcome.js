// Truthful sync outcome: a sync only counts as successful when at least one
// account actually scraped. All-accounts-failed used to report success: true
// (e.g. a broken Chrome path) and look healthy. No accounts configured at all
// (nothing attempted) is vacuously fine.
// Kept dependency-free so tests can import it without the scraper/keychain.
export function computeSyncOutcome(byProvider, errors) {
  const scraped = Object.keys(byProvider).length
  const failed = Object.keys(errors).length
  return { success: scraped > 0 || scraped + failed === 0, scraped, failed }
}

// CLI exit code for a finished sync run.
export const exitCodeForResult = (result) => (result.success ? 0 : 1)
