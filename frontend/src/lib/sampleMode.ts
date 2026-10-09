// Sample-data mode: an in-memory demo session that must never touch the
// signed-in user's saved data. The session id lives in sessionStorage (per
// tab), so a reload or a new tab drops back to the user's own data.
const KEY = 'transactions-dashboard:sample-session'

export function markSampleSession(sessionId: string): void {
  try { sessionStorage.setItem(KEY, sessionId) } catch { /* private mode */ }
}

export function clearSampleSession(): void {
  try { sessionStorage.removeItem(KEY) } catch { /* private mode */ }
}

export function getSampleSessionId(): string | null {
  try { return sessionStorage.getItem(KEY) } catch { return null }
}

/**
 * True while the sample session is the one on screen. A URL that carries a
 * different session id (a real upload or restore) is never sample, even if
 * the marker was left behind.
 */
export function isSampleActive(): boolean {
  const id = getSampleSessionId()
  if (!id) return false
  const fromUrl = new URLSearchParams(window.location.search).get('session_id')
  return fromUrl === null || fromUrl === id
}

/** Write-type API names that must be skipped while the sample is active. */
export const WRITE_PREFIX = /^(add|upsert|delete|save|update)/

export function guardSampleWrites<T extends Record<string, unknown>>(api: T): T {
  const out: Record<string, unknown> = {}
  for (const [name, fn] of Object.entries(api)) {
    if (typeof fn === 'function' && WRITE_PREFIX.test(name)) {
      out[name] = (...args: unknown[]) =>
        isSampleActive() ? Promise.resolve(undefined) : (fn as (...a: unknown[]) => unknown)(...args)
    } else {
      out[name] = fn
    }
  }
  return out as T
}
