import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { transactionsApi } from '../../services/api'
import type { TransactionEditorChanges } from '../../services/transactionEdits'
import { isGenericBitTransaction } from '../../utils/bitTransactions'
import type { CategoryCatalog, Transaction } from '../../services/types'
import { ASSIGNABLE_CATEGORIES } from '../../utils/constants'
import Button from '../ui/Button'
import './TransactionClassificationEditor.css'

interface Props {
  transaction: Transaction
  sessionId: string | null
  userId?: string
  availableCategories?: string[]
  subcategoryCatalog?: Record<string, string[]>
  onSave: (changes: TransactionEditorChanges) => Promise<string | undefined>
  onClose: () => void
}

function localChoices<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}

const CUSTOM = '__create__'
const AUTOMATIC = '__automatic__'

export default function TransactionClassificationEditor({
  transaction, sessionId, userId, availableCategories = [], subcategoryCatalog,
  onSave, onClose,
}: Props) {
  const currentCategory = (transaction.קטגוריה ?? '').trim()
  const currentSubcategory = (transaction.קטגוריה_משנה ?? '').trim()
  const currentNote = (transaction.הערות ?? '').trim()
  const genericBit = isGenericBitTransaction(transaction)
  const [category, setCategory] = useState(currentCategory)
  const [subcategory, setSubcategory] = useState<string | null>(currentSubcategory)
  const [customCategory, setCustomCategory] = useState('')
  const [customSubcategory, setCustomSubcategory] = useState('')
  const [onlyThis, setOnlyThis] = useState(genericBit || !!transaction._locked)
  const [note, setNote] = useState(currentNote)
  const [catalog, setCatalog] = useState<CategoryCatalog>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (subcategoryCatalog || !sessionId) return
    const controller = new AbortController()
    transactionsApi.getCategoryCatalog(controller.signal, sessionId)
      .then(data => { if (!controller.signal.aborted) setCatalog(data) })
      .catch(() => { /* Built-in categories and custom inputs remain available. */ })
    return () => controller.abort()
  }, [sessionId, subcategoryCatalog])

  const nextCategory = category === CUSTOM ? customCategory.trim() : category
  const nextSubcategory = subcategory === CUSTOM ? customSubcategory.trim() : subcategory
  const categories = [...new Set([
    ...ASSIGNABLE_CATEGORIES, ...availableCategories, ...(catalog?.categories.map(c => c.name) ?? []),
    ...(userId ? localChoices<string[]>(`customCats:${userId}`, []) : []),
    currentCategory,
  ])].filter(value => value && value !== 'אחר').sort((a, b) => a.localeCompare(b, 'he'))
  const subcategories = [...new Set([
    ...(subcategoryCatalog?.[nextCategory] ?? []),
    ...(catalog?.subcategories?.[nextCategory]?.map(s => s.name) ?? []),
    ...(userId ? localChoices<Record<string, string[]>>(`customSubs:${userId}`, {})[nextCategory] ?? [] : []),
    ...(nextCategory === currentCategory && currentSubcategory ? [currentSubcategory] : []),
  ])].sort((a, b) => a.localeCompare(b, 'he'))

  // Changing the checkbox alone pins/unpins a row. For generic Bit rows, a
  // forced checkbox does not count as an edit until the user changes a value.
  const classificationChanged = nextCategory !== currentCategory
    || (nextSubcategory !== null && nextSubcategory !== currentSubcategory)
    || (!genericBit && onlyThis !== !!transaction._locked)
  const noteChanged = note.trim() !== currentNote
  const valid = !!nextCategory && nextCategory !== 'אחר' && (subcategory !== CUSTOM || !!nextSubcategory)

  return (
    <form className="transaction-classification-editor" aria-label="שינוי סיווג עסקה" onSubmit={async event => {
      event.preventDefault()
      if ((classificationChanged && !valid) || (!classificationChanged && !noteChanged) || saving) return
      setSaving(true)
      setError(undefined)
      try {
        const warning = await onSave({
          classification: classificationChanged
            ? { category: nextCategory, subcategory: nextSubcategory, onlyThis }
            : undefined,
          note: noteChanged ? note.trim() : undefined,
        })
        if (warning) setError(warning)
        else onClose()
      } catch {
        setError('שמירת השינויים נכשלה. נסו שוב.')
      } finally {
        setSaving(false)
      }
    }}>
      <label>
        קטגוריה
        <select value={category} disabled={saving} onChange={event => {
          setCategory(event.target.value)
          setSubcategory(event.target.value === currentCategory ? currentSubcategory : null)
        }}>
          {!categories.includes(currentCategory) && <option value={currentCategory} disabled>בחרו קטגוריה</option>}
          {categories.map(item => <option key={item}>{item}</option>)}
          <option value={CUSTOM}>+ קטגוריה חדשה</option>
        </select>
      </label>
      {category === CUSTOM && (
        <label>
          שם קטגוריה חדשה
          <input value={customCategory} onChange={event => {
            setCustomCategory(event.target.value)
            setSubcategory(null)
          }} disabled={saving} />
        </label>
      )}
      <label>
        תת־קטגוריה
        <select value={subcategory ?? (onlyThis ? '' : AUTOMATIC)} disabled={saving || !nextCategory} onChange={event => {
          setSubcategory(event.target.value === AUTOMATIC ? null : event.target.value)
        }}>
          {nextCategory !== currentCategory && !onlyThis && <option value={AUTOMATIC}>בחירה אוטומטית אם קיימת</option>}
          <option value="">ללא תת־קטגוריה</option>
          {subcategories.map(item => <option key={item}>{item}</option>)}
          <option value={CUSTOM}>+ תת־קטגוריה חדשה</option>
        </select>
      </label>
      {subcategory === CUSTOM && (
        <label>
          שם תת־קטגוריה חדשה
          <input value={customSubcategory} onChange={event => setCustomSubcategory(event.target.value)} disabled={saving} />
        </label>
      )}
      <label className="transaction-classification-scope">
        <input type="checkbox" checked={onlyThis} onChange={event => setOnlyThis(event.target.checked)} disabled={saving || genericBit} />
        <Lock size={13} aria-hidden="true" />
        <span>שינוי העסקה הזו בלבד</span>
      </label>
      {genericBit && <p>בתיאור מופיע רק Bit, ולכן אי אפשר לזהות אילו העברות נועדו לאותה מטרה.</p>}
      {!onlyThis && <p>השינוי יחול גם על עסקאות מאותו בית עסק, ויישמר כלל לסיווג עתידי.</p>}
      <label>
        הערה
        <textarea value={note} onChange={event => setNote(event.target.value)} rows={2} disabled={saving} />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="transaction-classification-actions">
        <Button type="submit" size="sm" loading={saving} disabled={(classificationChanged && !valid) || (!classificationChanged && !noteChanged)}>שמור שינויים</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={saving}>ביטול</Button>
      </div>
    </form>
  )
}
