import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Bookmark, ChevronDown, Trash2, Wallet } from 'lucide-react'
import type { MonthOverviewData } from '../../services/types'
import { transactionsApi } from '../../services/api'
import { previousMonth, spendingChange, categoryChanges, formatMonthLabel, isOpenMonth } from '../../utils/monthComparison'
import { formatCurrency } from '../../utils/formatting'

interface View {
  name: string
  category: string
  subcategories: string[]
  owner: string | null
  dateType: 'billing' | 'transaction'
}

interface Props {
  userId: string
  sessionId: string
  month: string | null
  overview: MonthOverviewData | null
  loading: boolean
  dateType: View['dateType']
  owner: View['owner']
  category: string
  subcategories: string[]
  refreshKey: number
  onApplyView: (view: View) => void
  onCategory: (name: string, month: string) => void
  onTransactions: () => void
}

function readViews(key: string): View[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(stored)) return []
    return stored.filter((value): value is View =>
      value && typeof value.name === 'string' && typeof value.category === 'string'
      && Array.isArray(value.subcategories) && value.subcategories.every((name: unknown) => typeof name === 'string')
      && (value.owner === null || typeof value.owner === 'string')
      && (value.dateType === 'billing' || value.dateType === 'transaction'),
    ).slice(0, 8)
  } catch {
    return []
  }
}

function SavedViews({ userId, category, subcategories, owner, dateType, onApplyView }: Props) {
  const key = `dashboard-views:${userId}`
  const [views, setViews] = useState(() => readViews(key))
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const persist = (next: View[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(next))
      setViews(next)
      setMessage('התצוגות עודכנו בדפדפן הזה')
    } catch {
      setMessage('לא ניתן לשמור בדפדפן הזה')
    }
  }

  const saveView = (event: FormEvent) => {
    event.preventDefault()
    const title = name.trim()
    if (!title) return
    persist([...views.filter(view => view.name !== title), {
      name: title, category, subcategories: [...subcategories], owner, dateType,
    }].slice(-8))
    setName('')
  }

  return (
    <details className="finance-saved">
      <summary><Bookmark size={17} aria-hidden="true" /> תצוגות שמורות <ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="finance-saved-body">
        <p>שמרו את הסינון הנוכחי לשימוש חוזר בדפדפן הזה.</p>
        <form onSubmit={saveView}>
          <input aria-label="שם התצוגה" maxLength={40} value={name} onChange={event => setName(event.target.value)} placeholder="שם לתצוגה" />
          <button type="submit" className="finance-action" disabled={!name.trim()}>שמור תצוגה</button>
        </form>
        <div className="finance-saved-list">{views.map(view => (
          <div key={view.name}>
            <button type="button" onClick={() => onApplyView(view)}>{view.name}</button>
            <button type="button" aria-label={`מחק תצוגה ${view.name}`} onClick={() => persist(views.filter(item => item !== view))}>
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        ))}</div>
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  )
}

interface ComparisonResult {
  key: string
  data: MonthOverviewData | null
}

export default function MonthlyPulse(props: Props) {
  const { sessionId, month, overview, loading, dateType, owner, category, subcategories, refreshKey } = props
  const priorMonth = month ? previousMonth(month) : null
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [expandedFor, setExpandedFor] = useState<string | null>(null)
  const comparisonKey = JSON.stringify([props.userId, sessionId, priorMonth, dateType, owner, category, subcategories, refreshKey, retry])

  useEffect(() => {
    if (!priorMonth) return
    const controller = new AbortController()
    const load = async () => {
      try {
        const sid = await transactionsApi.scopeSession(sessionId, owner, controller.signal, category, subcategories)
        if (controller.signal.aborted) return
        const data = await transactionsApi.getMonthOverview(sid, priorMonth, dateType, controller.signal)
        if (!controller.signal.aborted) setResult({ key: comparisonKey, data })
      } catch {
        if (!controller.signal.aborted) setResult({ key: comparisonKey, data: null })
      }
    }
    void load()
    return () => controller.abort()
  }, [category, comparisonKey, dateType, owner, priorMonth, sessionId, subcategories])

  const current = !loading && overview?.month === month ? overview : null
  const comparison = result?.key === comparisonKey ? result : null
  const previous = comparison?.data
  const hasPrevious = previous && (previous.transaction_count > 0 || previous.total_income > 0)
  const change = current && hasPrevious ? spendingChange(current.total_expenses, previous.total_expenses) : null
  const changes = current && hasPrevious ? categoryChanges(current, previous) : []
  const net = current ? spendingChange(current.total_income, current.total_expenses).amount : 0
  const shownChanges = expandedFor === comparisonKey ? changes : changes.slice(0, 3)
  const currentIsOpen = month ? isOpenMonth(month) : false
  const displayAmount = (amount: number | undefined, signed = false) => (
    amount !== undefined ? <bdi dir="ltr">{formatCurrency(amount, signed)}</bdi> : loading ? 'טוען...' : '—'
  )

  return (
    <section className="finance-overview" aria-label="תמונת מצב חודשית">
      <div className="finance-overview-grid">
        <div className="finance-balance" aria-busy={loading}>
          <div className="finance-balance-top">
            <div>
              <h2>הוצאות החודש</h2>
              {currentIsOpen && <span className="finance-period-status">נתונים עד כה</span>}
            </div>
            <span className="finance-balance-icon"><Wallet size={21} aria-hidden="true" /></span>
          </div>
          <div className="finance-kpis">
            <div className="finance-spending">
              <strong className="finance-main-amount">{displayAmount(current?.total_expenses)}</strong>
              <span>{current ? `${current.transaction_count.toLocaleString('he-IL')} עסקאות הוצאה` : loading ? 'מעדכנים את הסיכום' : 'אין נתונים לתצוגה'}</span>
            </div>
            <div className="finance-kpi finance-income">
              <span><ArrowDownLeft size={16} aria-hidden="true" /> הכנסות שנקלטו</span>
              <strong>{displayAmount(current?.total_income)}</strong>
            </div>
            <div className="finance-kpi finance-net">
              <span><ArrowUpRight size={16} aria-hidden="true" /> הכנסות פחות הוצאות</span>
              <strong className={net < 0 ? 'amount-negative' : net > 0 ? 'amount-positive' : undefined}>{displayAmount(current ? net : undefined, true)}</strong>
            </div>
          </div>
          <button type="button" className="finance-action finance-ledger-action" onClick={props.onTransactions} disabled={!month}>
            עסקאות החודש וייצוא <ArrowLeft size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="finance-panel finance-comparison" aria-busy={Boolean(priorMonth && (!comparison || loading))}>
          <div className="finance-section-heading"><div>
            <h2>מה השתנה?</h2>
            {priorMonth && <p>לעומת {formatMonthLabel(priorMonth)}</p>}
          </div></div>
          {!month || (!current && !loading) ? <p className="finance-muted">נתוני החודש אינם זמינים.</p>
            : loading || (priorMonth && !comparison) ? <p className="finance-muted">טוען השוואה…</p>
              : comparison && !previous ? (
                <div className="finance-retry"><p>ההשוואה אינה זמינה כרגע</p><button type="button" className="finance-action" onClick={() => setRetry(value => value + 1)}>נסו שוב</button></div>
              ) : !change ? <p className="finance-muted">אין עסקאות בחודש הקודם להשוואה</p>
                : (
                  <>
                    <div className="finance-delta">
                      <strong className={change.amount > 0 ? 'amount-negative' : change.amount < 0 ? 'amount-positive' : undefined}>
                        <bdi dir="ltr">{formatCurrency(change.amount, true)}</bdi>
                      </strong>
                      <span>{change.amount === 0 ? 'ללא שינוי בהוצאות' : change.amount > 0 ? 'עלייה בהוצאות' : 'ירידה בהוצאות'}</span>
                      {change.percent !== null && change.amount !== 0 && <bdi dir="ltr" className="finance-percent">{Math.abs(change.percent).toLocaleString('he-IL', { maximumFractionDigits: 1 })}%</bdi>}
                    </div>
                    {currentIsOpen && <p className="finance-muted">חודש חלקי בהשוואה לחודש הקודם כפי שנקלט.</p>}
                    {shownChanges.length > 0 && <ul className="finance-movers">
                      {shownChanges.map(item => (
                        <li key={item.name}><button type="button" onClick={() => props.onCategory(item.name, item.now > 0 ? month : priorMonth ?? month)}>
                          <span>{item.name}</span>
                          <bdi dir="ltr" className={item.amount > 0 ? 'amount-negative' : 'amount-positive'}>{formatCurrency(item.amount, true)}</bdi>
                          <ArrowLeft size={14} aria-hidden="true" />
                        </button></li>
                      ))}
                    </ul>}
                    {changes.length > 3 && <button type="button" className="finance-text-action" aria-expanded={expandedFor === comparisonKey} onClick={() => setExpandedFor(expandedFor === comparisonKey ? null : comparisonKey)}>
                      {expandedFor === comparisonKey ? 'הצגת פחות שינויים' : 'כל השינויים המובילים'} <ChevronDown size={15} aria-hidden="true" />
                    </button>}
                  </>
                )}
        </div>
      </div>
      <SavedViews key={props.userId} {...props} />
    </section>
  )
}
