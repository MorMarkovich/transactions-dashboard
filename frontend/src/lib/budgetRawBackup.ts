// Pending raw-backup registry for the budget goals store.
// A raw localStorage value whose backup could not be written yet blocks
// saving to its key: a repaired in-memory value must never overwrite a raw
// original that has no recoverable copy.

export const RAW_BACKUP_SUFFIX = '-corrupt-backup'
export const BUDGET_STORAGE_KEY_PREFIX = 'budget-goals'

let pendingRawBackup: { key: string; raw: string } | null = null

export function getPendingRawBackup(): { key: string; raw: string } | null {
  return pendingRawBackup
}

// First backup wins: an existing copy of THIS raw is proof enough. A backup
// of a DIFFERENT older raw stays untouched; the new raw gets the next free
// versioned key ("-corrupt-backup-2", "-3", ...). Returns false (and marks
// the raw pending) when the backup could not be written.
export function preserveRawCopy(key: string, raw: string): boolean {
  try {
    if (localStorage.getItem(`${key}${RAW_BACKUP_SUFFIX}`) === raw) {
      pendingRawBackup = null
      return true
    }
    let candidate = `${key}${RAW_BACKUP_SUFFIX}`
    let n = 1
    while (localStorage.getItem(candidate) !== null) {
      n += 1
      candidate = `${key}${RAW_BACKUP_SUFFIX}-${n}`
    }
    localStorage.setItem(candidate, raw)
    pendingRawBackup = null
    return true
  } catch {
    pendingRawBackup = { key, raw }
    return false
  }
}

// True when a pending raw blocks this key and the backup still cannot be
// written; clears the marker once the raw is safely backed up.
export function rawBackupStillBlocking(key: string): boolean {
  if (!pendingRawBackup || pendingRawBackup.key !== key) return false
  return !preserveRawCopy(pendingRawBackup.key, pendingRawBackup.raw)
}

export function forgetPendingRawBackup(userId: string): void {
  if (pendingRawBackup && pendingRawBackup.key === `${BUDGET_STORAGE_KEY_PREFIX}-user-${userId}`) {
    pendingRawBackup = null
  }
}
