import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../lib/AuthContext'
import { canUseBankSync } from '../../lib/bankSyncAccess'
import { RefreshCw, Landmark, AlertCircle, CheckCircle2, X } from 'lucide-react'

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

type Progress = { percent: number | null; label: string }
type Status =
  | { kind: 'idle' }
  | { kind: 'syncing'; progress: Progress }
  | { kind: 'success' | 'warning' | 'error'; message: string; progress?: Progress }

type SyncResult = {
  success?: boolean
  error?: string
  added?: number
  inserted?: number
  new?: number
  total?: number
  count?: number
  errors?: Record<string, unknown>
  pendingStatuses?: Record<string, unknown>
}

type SyncEvent =
  | { type: 'progress'; stage: string; percent: number; account?: number; accounts?: number }
  | { type: 'result'; result: SyncResult }
  | { type: 'error'; error: string }

const STAGES: Record<string, string> = {
  connecting: 'מתחבר לכלי הסנכרון במק',
  loading: 'טוען עסקאות קיימות',
  collecting: 'אוסף עסקאות',
  waiting: 'ממתין לפני החיבור לחשבון הבא',
  merging: 'משווה ומאחד עסקאות',
  saving: 'מסיים את עדכון העסקאות',
}

function syncErrorMessage(error: string | undefined, status: number) {
  if (error === 'BANK_CLEANUP_REQUIRED') {
    return 'האיסוף נעצר. לא ניתן לוודא שתהליך הדפדפן נסגר; נדרשת בדיקה מקומית לפני ניסיון נוסף.'
  }
  if (error === 'SYNC_LOCAL_LOCKED') {
    return 'הסנכרון נעול בעקבות תהליך פעיל או ניסיון קודם שלא הסתיים. נדרשת בדיקה מקומית.'
  }
  if (status === 429) return 'כבר מתבצע סנכרון במק. אפשר לנסות שוב לאחר שיסתיים.'
  return `הסנכרון נכשל (${status}).`
}

async function readSyncStream(
  response: Response, onProgress: (progress: Progress) => void,
): Promise<SyncResult> {
  if (!response.body) throw new Error('Missing sync response')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffered = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) throw new Error('Sync response ended before the result')
      buffered += decoder.decode(value, { stream: true })
      const lines = buffered.split('\n')
      buffered = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        const event: SyncEvent = JSON.parse(line)
        if (event.type === 'result') return event.result
        if (event.type === 'error') return { success: false, error: event.error }
        if (event.type === 'progress' && Object.hasOwn(STAGES, event.stage) &&
          Number.isInteger(event.percent) && event.percent >= 0 && event.percent < 98) {
          const account = Number.isInteger(event.account) && Number.isInteger(event.accounts)
            ? ` · חשבון ${event.account} מתוך ${event.accounts}`
            : ''
          onProgress({ percent: event.percent, label: STAGES[event.stage] + account })
        }
      }
    }
  } finally {
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

function makeSyncRequest(token: string): Request {
  const url = `${SYNC_URL}/sync`
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sync-token': token },
    body: JSON.stringify({ progress: true }),
  }
  // Chromium uses the loopback address hint. Some WebKit versions reject
  // the enum value, so construct the request before making a network call.
  try {
    return new Request(url, { ...init, targetAddressSpace: 'loopback' } as RequestInit)
  } catch {
    return new Request(url, init)
  }
}

function getToken(): string | null {
  const envToken = import.meta.env.VITE_SYNC_TOKEN as string | undefined
  if (envToken) return envToken
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

interface RefreshFromBanksProps {
  /** Called after a successful sync so the parent can reload transactions. */
  onSynced?: () => void | Promise<void>
  sidebarClosed?: boolean
}

export default function RefreshFromBanks({ onSynced, sidebarClosed = false }: RefreshFromBanksProps) {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const running = useRef(false)

  const ensureToken = (): string | null => {
    let token = getToken()
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

  const runSync = async () => {
    if (running.current) return
    const token = ensureToken()
    if (!token) {
      setStatus({ kind: 'error', message: 'נדרש אסימון סנכרון כדי להתחבר לשירות המקומי.' })
      return
    }

    running.current = true
    setStatus({ kind: 'syncing', progress: { percent: null, label: STAGES.connecting } })
    let connected = false
    try {
      const res = await fetch(makeSyncRequest(token))

      connected = true

      // Bad/expired token → drop it and let the user re-enter once.
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        setStatus({ kind: 'error', message: 'אסימון שגוי או שפג תוקפו. לחץ שוב כדי להזין מחדש.' })
        return
      }

      if (!res.ok) {
        const failure = await res.json().catch(() => ({}))
        setStatus({ kind: 'error', message: syncErrorMessage(failure.error, res.status) })
        return
      }

      const streamed = res.headers?.get('content-type')?.includes('application/x-ndjson')
      const payload: SyncResult = streamed
        ? await readSyncStream(res, (progress) => {
            setStatus((previous) => previous.kind === 'syncing' &&
              (previous.progress.percent ?? 0) <= (progress.percent ?? 0)
              ? { kind: 'syncing', progress }
              : previous)
          })
        : await res.json()
      if (payload.success === false) {
        setStatus({ kind: 'error', message: syncErrorMessage(payload.error, 500) })
        return
      }
      const added = Number(payload.added ?? payload.inserted ?? payload.new ?? NaN)
      const total = Number(payload.total ?? payload.count ?? NaN)
      const message = Number.isFinite(added)
        ? `סונכרנו ${added} עסקאות חדשות${Number.isFinite(total) ? ` (סה"כ ${total})` : ''}.`
        : 'הסנכרון הושלם.'

      const partial = Object.keys(payload.errors ?? {}).length > 0
      const pendingUnverified = Object.values(payload.pendingStatuses ?? {}).some(value => value !== 'pending_observed')
      window.dispatchEvent(new Event('bank-sync-completed'))
      if (onSynced) {
        setStatus({ kind: 'syncing', progress: { percent: streamed ? 98 : null, label: 'מעדכן את הדשבורד' } })
        try {
          await onSynced()
        } catch {
          setStatus({ kind: 'warning', message: message + ' טעינת העסקאות בדשבורד נכשלה. אפשר לטעון מחדש את הדף.' })
          return
        }
      }
      setStatus({
        kind: partial || pendingUnverified ? 'warning' : 'success',
        message: message +
          (partial ? ' חלק מהחשבונות לא עודכנו.' : '') +
          (pendingUnverified ? ' לא ניתן לאמת את עדכון העסקאות הממתינות.' : ''),
        progress: streamed ? { percent: 100, label: 'הרענון הסתיים' } : undefined,
      })
    } catch {
      setStatus({
        kind: 'error',
        message: connected
          ? 'התקשורת עם כלי הסנכרון נקטעה לפני שהתקבל אישור סיום.'
          : 'לא ניתן להתחבר לכלי הסנכרון במק. ודא שהמק פתוח ושהכלי פועל.',
      })
    } finally {
      running.current = false
    }
  }

  const syncing = status.kind === 'syncing'
  const progress = status.kind === 'idle' ? undefined : status.progress

  if (!canUseBankSync(user?.email)) return null

  const feedback = (
    <>
      {progress && (
        <div className="bank-sync-progress" dir="rtl">
          <div className="bank-sync-progress-header">
            <span aria-live="polite">{progress.label}</span>
            {progress.percent !== null && <bdi className="bank-sync-progress-value">{progress.percent}%</bdi>}
          </div>
          <div
            className="bank-sync-progress-track"
            role="progressbar"
            aria-label="התקדמות רענון מהבנקים"
            aria-valuenow={progress.percent ?? undefined}
            aria-valuetext={progress.percent === null ? progress.label : undefined}
          >
            <div
              className={progress.percent === null ? 'bank-sync-progress-fill is-indeterminate' : 'bank-sync-progress-fill'}
              style={progress.percent === null ? undefined : { inlineSize: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {status.kind === 'success' && (
        <div className="bank-sync-status bank-sync-status--ok" role="status">
          <CheckCircle2 size={13} />
          <span>{status.message}</span>
        </div>
      )}
      {(status.kind === 'error' || status.kind === 'warning') && (
        <div className="bank-sync-status bank-sync-status--err" role="alert">
          <AlertCircle size={13} />
          <span>{status.message}</span>
        </div>
      )}
    </>
  )

  return (
    <div className="bank-sync">
      <button
        type="button"
        className="bank-sync-btn"
        onClick={() => void runSync()}
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

      {sidebarClosed && status.kind !== 'idle' ? createPortal(
        <aside className="bank-sync-notice" dir="rtl" aria-label="רענון מהבנקים">
          <div className="bank-sync-notice-heading">
            <span><Landmark size={16} aria-hidden="true" /> רענון מהבנקים</span>
            {!syncing && (
              <button type="button" aria-label="סגור הודעת סנכרון" onClick={() => setStatus({ kind: 'idle' })}>
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          {feedback}
        </aside>, document.body,
      ) : feedback}
    </div>
  )
}
