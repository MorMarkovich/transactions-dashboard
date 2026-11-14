import { useEffect, useState } from 'react'
import { transactionsApi, type BitImportPreview } from '../../services/api'
import { formatCurrency, formatDate, hebOwner } from '../../utils/formatting'
import Button from '../ui/Button'
import Card from '../ui/Card'
import './BitImport.css'

const OUTCOMES = {
  unmatched: 'לא נמצאה עסקה תואמת',
  ambiguous: 'יותר מהתאמה אפשרית אחת',
  unknown_reason: 'סיבה חסרה או לא חד משמעית',
  already_classified: 'עסקה שכבר סווגה',
  invalid: 'פרטי העברה חסרים או לא תקינים',
  not_completed: 'העברה שלא הושלמה',
} as const

function errorMessage(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: unknown }; status?: number } })?.response
  if (detail?.status === 404) return 'פג תוקף נתוני העסקאות. רעננו את הדף ונסו שוב.'
  return typeof detail?.data?.detail === 'string' ? detail.data.detail : 'ייבוא פירוט Bit נכשל. נסו שוב.'
}

export default function BitImport({ sessionId }: { sessionId: string }) {
  const [owners, setOwners] = useState<string[] | null>(null)
  const [owner, setOwner] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<BitImportPreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [ownerRetry, setOwnerRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    transactionsApi.getOwners(sessionId, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setOwners(result)
      if (result.length === 1) setOwner(result[0])
    }).catch(() => {
      if (!controller.signal.aborted) setError('לא ניתן לטעון את רשימת בעלי החשבונות.')
    })
    return () => controller.abort()
  }, [sessionId, ownerRetry])

  async function readFile() {
    if (!file) return
    setBusy(true)
    setError('')
    setMessage('')
    setPreview(null)
    try {
      const result = await transactionsApi.previewBitImport(sessionId, file, owner)
      setPreview(result)
      setSelected(new Set(result.proposals.map(row => row.txn_key)))
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    if (!file || !selected.size) return
    setBusy(true)
    setError('')
    try {
      const result = await transactionsApi.applyBitImport(sessionId, file, owner, [...selected])
      const updated = result.updated === 1 ? 'עסקה אחת סווגה.' : `${result.updated} עסקאות סווגו.`
      setMessage(result.skipped ? `${updated} ${result.skipped} כבר סווגו בינתיים.` : updated)
      setPreview(null)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  const counts = preview?.counts ?? {}
  return (
    <Card className="glass-card bit-import">
      <h2>ייבוא פירוט מ־Bit</h2>
      <p>בחרו CSV מרשימת התנועות של Bit. סיבת ההעברה תציע סיווג לעסקה קיימת.</p>
      <div className="bit-import-controls">
        {(owners?.length ?? 0) > 1 && (
          <label>
            בעל החשבון של Bit
            <select value={owner} disabled={busy} onChange={event => {
              setOwner(event.target.value)
              setPreview(null)
              setMessage('')
              setError('')
            }}>
              <option value="">בחרו בעל חשבון</option>
              {owners?.map(name => <option key={name} value={name}>{hebOwner(name)}</option>)}
            </select>
          </label>
        )}
        <label>
          קובץ CSV מ־Bit
          <input type="file" accept=".csv,text/csv" disabled={busy} onChange={event => {
            setFile(event.target.files?.[0] ?? null)
            setPreview(null)
            setMessage('')
            setError('')
          }} />
        </label>
        <Button type="button" size="sm" variant="secondary" loading={busy && !preview}
          disabled={busy || !file || !owners || (owners.length > 1 && !owner)} onClick={() => void readFile()}>
          הצג התאמות
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {error && !owners && <Button type="button" size="sm" variant="ghost" onClick={() => {
        setError('')
        setOwnerRetry(value => value + 1)
      }}>נסו שוב</Button>}
      {message && <p role="status">{message}</p>}
      {preview && (
        <>
          <p role="status">{preview.proposals.length} הצעות מתוך {counts.total ?? 0} שורות בקובץ</p>
          {Object.entries(OUTCOMES).some(([key]) => counts[key as keyof typeof OUTCOMES]) && (
            <ul className="bit-import-counts">
              {Object.entries(OUTCOMES).map(([key, label]) => {
                const count = counts[key as keyof typeof OUTCOMES]
                return count ? <li key={key}>{label} ({count})</li> : null
              })}
            </ul>
          )}
          {preview.proposals.length > 0 && (
            <>
              <label className="bit-import-pick-all">
                <input type="checkbox" checked={selected.size === preview.proposals.length} disabled={busy} onChange={event => {
                  setSelected(new Set(event.target.checked ? preview.proposals.map(row => row.txn_key) : []))
                }} />
                בחרו את כל ההצעות
              </label>
              <ul aria-label="סיווגים מוצעים" className="bit-import-matches">
                {preview.proposals.map(row => (
                  <li key={row.txn_key}>
                    <label>
                      <input type="checkbox" checked={selected.has(row.txn_key)} disabled={busy} onChange={event => {
                        const checked = event.target.checked
                        setSelected(previous => {
                          const next = new Set(previous)
                          if (checked) next.add(row.txn_key)
                          else next.delete(row.txn_key)
                          return next
                        })
                      }} />
                      <span>{row.reason}<small>{[row.category, row.subcategory].filter(Boolean).join(' / ')}</small></span>
                      <bdi>{formatCurrency(row.amount)} · {formatDate(row.transaction_date)}</bdi>
                    </label>
                  </li>
                ))}
              </ul>
              <Button type="button" size="sm" loading={busy} disabled={!selected.size} onClick={() => void apply()}>
                שמור את הסיווגים שנבחרו
              </Button>
            </>
          )}
        </>
      )}
    </Card>
  )
}
