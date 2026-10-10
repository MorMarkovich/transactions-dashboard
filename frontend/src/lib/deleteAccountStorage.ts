// Remove this account's browser-only financial preferences after confirmed
// server deletion. Do not clear other accounts' keys or the whole origin.
export function clearDeletedAccountStorage(userId: string): void {
  try {
    const sessionId = localStorage.getItem('transactions-dashboard:last-session')
    if (sessionId) {
      localStorage.removeItem(`budget-goals-${sessionId}`)
      localStorage.removeItem(`savings-goals-${sessionId}`)
    }
    for (const key of [
      `budget-goals-user-${userId}`, `savings-goals-user-${userId}`,
      `customCats:${userId}`, `customSubs:${userId}`, `dashboard-views:${userId}`,
      'transactions-dashboard:last-session', 'transactions-dashboard:snapshot-seen', 'transactions-dashboard:filters:v1',
      'txn-filter-presets',
    ]) localStorage.removeItem(key)
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('dash-') || key.startsWith('tx-view:v1:') || key === 'transactions-dashboard:sample-session') sessionStorage.removeItem(key)
    }
  } catch { /* private browsing may disallow storage */ }
}
