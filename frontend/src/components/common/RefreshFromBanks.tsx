import { useState } from 'react'
import { RefreshCw, Landmark, AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * "רענן מהבנקים" — triggers the LOCAL bank-sync tool (israeli-bank-scrapers).
 *
 * Security model (see bank-sync/SECURITY.md): bank credentials never leave the
 * user's machine. This button only calls a localhost-only server the user runs
 * themselves (`npm run serve` in the bank-sync tool), authenticated with a
 * one-time sync token. The tool scrapes the banks locally and writes the merged
 * snapshot to Supabase; `onSynced` then reloads it through the normal restore
 * path, so this component never touches credentials or money.
 *
 * Config:
 *   VITE_SYNC_URL   — base URL of the local sync server (default http://127.0.0.1:4000).
 *                     Must match the PORT set in the bank-sync tool's .env.
 *   VITE_SYNC_TOKEN — optional, dev convenience. In production the token is
 *                     prompted once and kept in localStorage on this machine only.
 */

const SYNC_URL = (import.meta.env.VITE_SYNC_URL || 'http://127.0.0.1:4000').replace(/\/$/, '')
const TOKEN_STORAGE_KEY = 'bankSyncToken'

type Status =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

function getToken(): string | null {
  const envToken = import.meta.env.VITE_SYNC_TOKEN as string | undefined
  if (envToken) return envToken
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

interface RefreshFromBanksProps {
  /** Called after a successful sync so the parent can reload transactions. */
  onSynced?: () => void | Promise<void>
}

export default function RefreshFromBanks({ onSynced }: RefreshFromBanksProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const ensureToken = (forcePrompt = false): string | null => {
    let token = forcePrompt ? null : getToken()
    if (!token) {
      const entered = window.prompt(
        'הדבק את אסימון הסנכרון (sync token) שהודפס בעת ההתקנה של כלי הסנכרון המקומי:',
      )?.trim()
      if (!entered) return null
      localStorage.setItem(TOKEN_STORAGE_KEY, entered)
      token = entered
    }
    return token
  }

  const runSync = async (forcePrompt = false) => {
    const token = ensureToken(forcePrompt)
    if (!token) {
      setStatus({ kind: 'error', message: 'נדרש אסימון סנכרון כדי להתחבר לשירות המקומי.' })
      return
    }

    setStatus({ kind: 'syncing' })
    try {
      const res = await fetch(`${SYNC_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-token': token },
        body: '{}',
      })

      // Bad/expired token → drop it and let the user re-enter once.
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        setStatus({ kind: 'error', message: 'אסימון שגוי או שפג תוקפו. לחץ שוב כדי להזין מחדש.' })
        return
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        setStatus({ kind: 'error', message: text?.slice(0, 140) || `הסנכרון נכשל (${res.status}).` })
        return
      }

      // Tolerate any 2xx response shape; surface counts if the server sent them.
      const payload = await res.json().catch(() => ({}) as Record<string, unknown>)
      const added = Number(payload.added ?? payload.inserted ?? payload.new ?? NaN)
      const total = Number(payload.total ?? payload.count ?? NaN)
      const message = Number.isFinite(added)
        ? `סונכרנו ${added} עסקאות חדשות${Number.isFinite(total) ? ` (סה"כ ${total})` : ''}.`
        : 'הסנכרון הושלם.'

      setStatus({ kind: 'success', message })
      await onSynced?.()
    } catch {
      // fetch() rejects on network failure / CORS / server down.
      setStatus({
        kind: 'error',
        message: 'לא ניתן להתחבר לשירות המקומי. ודא שהוא פועל (npm run serve) ושהכתובת נכונה.',
      })
    }
  }

  const syncing = status.kind === 'syncing'

  return (
    <div className="bank-sync">
      <button
        type="button"
        className="bank-sync-btn"
        onClick={() => runSync(false)}
        disabled={syncing}
        aria-busy={syncing}
        title="ייבוא אוטומטי של עסקאות ישירות מהבנקים (דרך הכלי המקומי)"
      >
        {syncing ? (
          <RefreshCw size={16} className="bank-sync-spin" />
        ) : (
          <Landmark size={16} />
        )}
        <span>{syncing ? 'מסנכרן מהבנקים…' : 'רענן מהבנקים'}</span>
      </button>

      {status.kind === 'success' && (
        <div className="bank-sync-status bank-sync-status--ok" role="status">
          <CheckCircle2 size={13} />
          <span>{status.message}</span>
        </div>
      )}
      {status.kind === 'error' && (
        <div className="bank-sync-status bank-sync-status--err" role="alert">
          <AlertCircle size={13} />
          <span>{status.message}</span>
        </div>
      )}
    </div>
  )
}
