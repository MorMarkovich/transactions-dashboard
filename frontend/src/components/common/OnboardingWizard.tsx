import { useEffect, useRef, useState } from 'react'
import { UploadCloud, Sparkles } from 'lucide-react'

export const UPLOAD_FILES_EVENT = 'orbit:upload-files'
export const UPLOAD_STATE_EVENT = 'orbit:upload-state'

export interface UploadState {
  uploading: boolean
  status: string
  error: string | null
}

interface Props {
  onLoadSample: () => Promise<void>
}

const ACCEPT = /\.(xlsx|xls|csv|pdf)$/i

/** First-use guide for a signed-in user with no data: export, upload, done. */
export default function OnboardingWizard({ onLoadSample }: Props) {
  const [state, setState] = useState<UploadState>({ uploading: false, status: '', error: null })
  const [sampleBusy, setSampleBusy] = useState(false)
  const [sampleError, setSampleError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: Event) => setState((e as CustomEvent<UploadState>).detail)
    window.addEventListener(UPLOAD_STATE_EVENT, handler)
    return () => window.removeEventListener(UPLOAD_STATE_EVENT, handler)
  }, [])

  const send = (files: File[]) => {
    const ok = files.filter((f) => ACCEPT.test(f.name))
    if (ok.length === 0) {
      setState({ uploading: false, status: '', error: 'הקובץ צריך להיות xlsx, csv או pdf' })
      return
    }
    window.dispatchEvent(new CustomEvent(UPLOAD_FILES_EVENT, { detail: ok }))
  }

  const busy = state.uploading || sampleBusy

  const loadSample = async () => {
    setSampleBusy(true)
    setSampleError(null)
    try {
      await onLoadSample()
    } catch {
      setSampleError('לא הצלחנו לטעון את נתוני הדוגמה. נסו שוב.')
    } finally {
      setSampleBusy(false)
    }
  }

  const step = (n: number, title: string, text: string) => (
    <div className="feature-card" style={{ textAlign: 'start' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center',
        background: 'var(--accent)', color: 'var(--bg-primary, #04111a)', fontWeight: 700,
        marginBottom: 'var(--space-md)',
      }} aria-hidden="true">{n}</div>
      <div className="feature-title">{title}</div>
      <div className="feature-desc">{text}</div>
    </div>
  )

  return (
    <section aria-label="מדריך התחלה" style={{ marginTop: 'var(--space-lg)' }}>
      <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-lg)' }}>
        {step(1, 'מייצאים קובץ', 'מאתר הבנק או מחברת האשראי: קובץ אקסל, CSV או PDF של התנועות')}
        {step(2, 'מעלים אותו כאן', 'אפשר להעלות כמה קבצים יחד, מכמה בנקים וכרטיסים')}
        {step(3, 'הדשבורד מוכן', 'קטגוריות, גרפים ותובנות נבנים לבד, והנתונים נשמרים בחשבון שלכם')}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) send(Array.from(e.dataTransfer.files)) }}
        style={{
          marginTop: 'var(--space-xl)', padding: 'var(--space-xl)', textAlign: 'center',
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-xl)', background: 'var(--bg-card)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv,.pdf"
          style={{ display: 'none' }}
          data-testid="onboarding-file-input"
          onChange={(e) => { if (e.target.files?.length) send(Array.from(e.target.files)); e.target.value = '' }}
        />
        <button
          type="button"
          className="onboarding-upload-btn"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '0 24px',
            borderRadius: 'var(--radius-lg)', border: 'none', cursor: busy ? 'default' : 'pointer',
            background: 'var(--gradient-primary, var(--accent))', color: '#04111a', fontWeight: 700,
            fontSize: 'var(--text-base)', opacity: busy ? 0.7 : 1, maxWidth: '100%',
          }}
        >
          <UploadCloud size={20} aria-hidden="true" />
          {state.uploading ? state.status || 'מעלה…' : 'בחרו קובץ להעלאה'}
        </button>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', margin: 0 }}>
          או גררו קבצים לכאן · xlsx, csv, pdf
        </p>
        <div role="status" aria-live="polite" style={{ minHeight: 0 }}>
          {state.error && (
            <p role="alert" style={{ color: 'var(--danger, #ff6b6b)', fontSize: 'var(--text-sm)', margin: 0 }}>{state.error}</p>
          )}
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 var(--space-sm)' }}>
          רוצים קודם להציץ? אפשר לנסות עם נתוני דוגמה. הם לא נשמרים בחשבון שלכם.
        </p>
        <button
          type="button"
          className="onboarding-sample-btn"
          disabled={busy}
          onClick={loadSample}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 20px',
            borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-primary)', cursor: busy ? 'default' : 'pointer', maxWidth: '100%',
          }}
        >
          <Sparkles size={18} aria-hidden="true" />
          {sampleBusy ? 'טוען דוגמה…' : 'נסו עם נתוני דוגמה'}
        </button>
        {sampleError && <p role="alert" style={{ color: 'var(--danger, #ff6b6b)', margin: 'var(--space-sm) 0 0' }}>{sampleError}</p>}
      </div>
    </section>
  )
}
