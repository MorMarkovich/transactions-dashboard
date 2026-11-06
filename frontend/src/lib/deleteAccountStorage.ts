import { scoped, LAST_SESSION_BASE, SNAPSHOT_SEEN_BASE, FILTERS_BASE, PRESETS_BASE } from './userStorage'

// Remove this account's browser-only financial preferences after confirmed
// server deletion. Do not clear other accounts' keys or the whole origin.
import { forgetPendingRawBackup } from './budgetRawBackup'
export function clearDeletedAccountStorage(userId: string): void {
  try {
    forgetPendingRawBackup(userId)
    const sessionId = localStorage.getItem(scoped(LAST_SESSION_BASE, userId)) ?? localStorage.getItem(LAST_SESSION_BASE)
    if (sessionId) {
      localStorage.removeItem(`budget-goals-${sessionId}`)
      localStorage.removeItem(`savings-goals-${sessionId}`)
    }
    for (const key of [
      `budget-goals-user-${userId}`, `savings-goals-user-${userId}`,
      `customCats:${userId}`, `customSubs:${userId}`, `dashboard-views:${userId}`,
      scoped(LAST_SESSION_BASE, userId), scoped(SNAPSHOT_SEEN_BASE, userId),
      scoped(FILTERS_BASE, userId), scoped(PRESETS_BASE, userId),
      // Legacy pre-isolation globals, in case migration never ran on this device.
      LAST_SESSION_BASE, SNAPSHOT_SEEN_BASE, FILTERS_BASE, PRESETS_BASE,
    ]) localStorage.removeItem(key)
    // Versioned raw backups of repaired budget/savings goal stores:
    // "<base>-corrupt-backup", "-corrupt-backup-2", "-corrupt-backup-3", ...
    for (const key of Object.keys(localStorage)) {
      if (
        key.startsWith(`budget-goals-user-${userId}-corrupt-backup`) ||
        key.startsWith(`savings-goals-user-${userId}-corrupt-backup`)
      ) localStorage.removeItem(key)
    }
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('dash-') || key.startsWith('tx-view:v1:') || key === 'transactions-dashboard:sample-session') sessionStorage.removeItem(key)
    }
  } catch { /* private browsing may disallow storage */ }
}
