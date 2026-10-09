// The local bank-sync tool is a personal tool that runs on the owner's own
// computer (127.0.0.1). It is meaningless, and confusing, for every other
// user, so the UI exposes it only to accounts on this allow-list (comma
// separated emails in VITE_BANK_SYNC_EMAILS), or to a browser where the sync
// token was already stored. Everyone else uploads files.
const DEFAULT_ALLOWED = ['markovich23@gmail.com']

export function canUseBankSync(email?: string | null): boolean {
  try {
    if (localStorage.getItem('bankSyncToken')) return true
  } catch {
    // storage unavailable: fall through to the email check
  }
  if (!email) return false
  const configured = String(import.meta.env.VITE_BANK_SYNC_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const allowed = configured.length ? configured : DEFAULT_ALLOWED
  return allowed.includes(email.trim().toLowerCase())
}
