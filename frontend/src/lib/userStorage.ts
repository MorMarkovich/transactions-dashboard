// Per-user browser storage with one-time quarantine/validation of
// pre-isolation globals.
//
// Before per-user keys existed, several pieces of view state lived in global
// localStorage keys, so a second account signing in on the same browser
// inherited the first account's filter, remembered session pointer, and saved
// presets. Every live key is now suffixed with the owning user's id.
//
// Migration runs at the moment an authenticated user appears (initial session
// or sign-in), BEFORE the user is published to the tree. A legacy global's
// writer is unknowable, so NOTHING is auto-claimed:
//
// - filters / presets: moved to an unattributed quarantine key (recovery
//   stays possible, but no account inherits them by default) and the global
//   is deleted. The user's scoped key starts blank.
// - last-session / snapshot-seen: the legacy session id is validated against
//   the backend (the server binds every session to its owner) and only an
//   id confirmed to belong to THIS user is migrated — before, not after, the
//   value can be read. Foreign or dead ids are dropped, never inherited.
// - dismissed notification ids: re-derivable; dropped, not inherited.

import { transactionsApi } from '../services/api'

export const scoped = (base: string, userId: string): string => `${base}:${userId}`
export const quarantineKey = (base: string): string => `${base}:pre-isolation-quarantine`

export const LAST_SESSION_BASE = 'transactions-dashboard:last-session'
export const SNAPSHOT_SEEN_BASE = 'transactions-dashboard:snapshot-seen'
export const FILTERS_BASE = 'transactions-dashboard:filters:v1'
export const PRESETS_BASE = 'txn-filter-presets'

const QUARANTINE = [FILTERS_BASE, PRESETS_BASE]
const DROP_LEGACY = ['notification-dismissed-ids']

function quarantine(base: string): void {
  const legacy = localStorage.getItem(base)
  if (legacy === null) return
  if (localStorage.getItem(quarantineKey(base)) === null) {
    localStorage.setItem(quarantineKey(base), legacy)
  }
  localStorage.removeItem(base)
}

// The server owns session→user binding; a 200 proves the remembered session
// belongs to this user. 404 = foreign or already wiped (both get the same
// answer from the backend by design).
async function validateAndMigrateSession(userId: string, sessionId: string, snapshotSeen: string | null): Promise<void> {
  try {
    await transactionsApi.getMetrics(sessionId)
  } catch {
    return // foreign, expired, or backend-restarted: never inherit
  }
  if (localStorage.getItem(scoped(LAST_SESSION_BASE, userId)) !== null) return
  localStorage.setItem(scoped(LAST_SESSION_BASE, userId), sessionId)
  if (snapshotSeen !== null && localStorage.getItem(scoped(SNAPSHOT_SEEN_BASE, userId)) === null) {
    localStorage.setItem(scoped(SNAPSHOT_SEEN_BASE, userId), snapshotSeen)
  }
}

export function migrateUserState(userId: string): Promise<void> {
  let pending: Promise<void> = Promise.resolve()
  try {
    for (const base of QUARANTINE) quarantine(base)
    for (const base of DROP_LEGACY) localStorage.removeItem(base)

    const legacySession = localStorage.getItem(LAST_SESSION_BASE)
    const legacySnapshot = localStorage.getItem(SNAPSHOT_SEEN_BASE)
    localStorage.removeItem(LAST_SESSION_BASE)
    localStorage.removeItem(SNAPSHOT_SEEN_BASE)
    // Scoped views (…::owner=…) and sample sessions were never saved here, but
    // only plain base ids are worth validating. An already-set scoped key wins.
    if (
      legacySession &&
      !legacySession.includes('::') &&
      localStorage.getItem(scoped(LAST_SESSION_BASE, userId)) === null
    ) {
      pending = validateAndMigrateSession(userId, legacySession, legacySnapshot)
    }
  } catch {
    // Storage unavailable (private mode) — nothing to migrate.
  }
  return pending
}
