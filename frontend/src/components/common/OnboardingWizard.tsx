import { type ReactNode, useEffect, useRef, useState } from 'react'
import { ChartNoAxesCombined, UploadCloud, FileSpreadsheet } from 'lucide-react'

export const UPLOAD_FILES_EVENT = 'orbit:upload-files'
export const UPLOAD_STATE_EVENT = 'orbit:upload-state'

export interface UploadState {
  uploading: boolean
  status: string
  error: string | null
}

interface Props {
  onLoadSample: () => Promise<void>
  bankSync?: ReactNode
}

const ACCEPT = /\.(xlsx|xls|csv|pdf)$/i

/** First-use guide for a signed-in user with no data: export, upload, done. */
export default function OnboardingWizard({ onLoadSample, bankSync }: Props) {
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
      setState({ uploading: false, status: '', error: 'הקובץ צריך להיות xlsx, xls, csv או pdf' })
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

  return (
    <section className="workspace-onboarding" aria-label="מדריך התחלה">
      <div className="workspace-onboarding-heading">
        <h1>הסקירה שלכם מתחילה כאן.</h1>
        <p>{bankSync ? 'רעננו את הנתונים מהבנקים, ייבאו דוח או פתחו דשבורד עם נתוני דוגמה.' : 'ייבאו את העסקאות שלכם כדי לראות הוצאות, הכנסות והשוואה בין חודשים.'}</p>
      </div>
      {bankSync && <div className="workspace-onboarding-sync">{bankSync}</div>}
      <div className="onboarding-options">
        <article
          className={`onboarding-option${dragging ? ' dragging' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) send(Array.from(event.dataTransfer.files)) }}
        >
          <span className="onboarding-option-icon"><FileSpreadsheet size={24} aria-hidden="true" /></span>
          <h2>ייבוא עסקאות</h2>
          <p>מייצאים קובץ תנועות מהבנק או מחברת האשראי ומעלים אותו לכאן. אפשר לייבא כמה קבצים יחד.</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".xlsx,.xls,.csv,.pdf"
            hidden
            data-testid="onboarding-file-input"
            onChange={(event) => { if (event.target.files?.length) send(Array.from(event.target.files)); event.target.value = '' }}
          />
          <button type="button" className="onboarding-upload-btn" disabled={busy} onClick={() => inputRef.current?.click()}>
            <UploadCloud size={18} aria-hidden="true" />
            {state.uploading ? state.status || 'מעלה…' : 'בחרו קובץ להעלאה'}
          </button>
          <small>Excel, CSV או PDF</small>
          {state.error && <p role="alert" className="onboarding-error">{state.error}</p>}
        </article>
        <article className="onboarding-option">
          <span className="onboarding-option-icon"><ChartNoAxesCombined size={24} aria-hidden="true" /></span>
          <h2>דשבורד לדוגמה</h2>
          <p>ראו איך הדשבורד נראה עם גרפים ועסקאות לדוגמה. הנתונים לא נשמרים בחשבון שלכם.</p>
          <button type="button" className="onboarding-sample-btn" disabled={busy} onClick={loadSample}>
            {sampleBusy ? 'טוען דוגמה…' : 'נסו עם נתוני דוגמה'}
          </button>
          {sampleError && <p role="alert" className="onboarding-error">{sampleError}</p>}
        </article>
      </div>
    </section>
  )
}
