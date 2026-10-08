import { useEffect, useState } from 'react'
import { ArrowLeft, Bookmark, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import type { MonthOverviewData } from '../../services/types'
import { transactionsApi } from '../../services/api'
import { previousMonth, spendingChange, categoryChanges } from '../../utils/monthComparison'
import { formatCurrency, ltrIsolate } from '../../utils/formatting'

const monthNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const monthLabel = (month: string) => { const [m,y] = month.split('/'); return `${monthNames[Number(m)-1]} ${y}` }
interface View { name: string; category: string; subcategories: string[]; owner: string | null; dateType: 'billing' | 'transaction' }
interface Props {
  userId: string; sessionId: string; month: string | null; overview: MonthOverviewData | null;
  loading: boolean; dateType: 'billing' | 'transaction'; owner: string | null; category: string;
  subcategories: string[]; refreshKey: number; onApplyView: (view: View) => void;
  onCategory: (name: string) => void; onTransactions: () => void;
}
export default function MonthlyPulse(p: Props) {
  const [previous, setPrevious] = useState<MonthOverviewData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [views, setViews] = useState<View[]>([])
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [expandedChanges, setExpandedChanges] = useState(false)
  const key = `dashboard-views:${p.userId}`
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) || '[]')
      setViews(Array.isArray(stored) ? stored.filter((v): v is View => !!v && typeof v.name === 'string' && typeof v.category === 'string' && Array.isArray(v.subcategories) && v.subcategories.every((s: unknown) => typeof s === 'string') && (v.owner === null || typeof v.owner === 'string') && ['billing', 'transaction'].includes(v.dateType)).slice(0, 8) : [])
    } catch { setViews([]) }
  }, [key])
  const persist = (next: View[]) => {
    try { localStorage.setItem(key, JSON.stringify(next)); setViews(next); setMessage('נשמר בדפדפן הזה') }
    catch { setMessage('לא ניתן לשמור בדפדפן הזה') }
  }
  const priorMonth = p.month ? previousMonth(p.month) : null
  useEffect(() => {
    const controller = new AbortController()
    setPrevious(null)
    if (!priorMonth) return
    setStatus('loading')
    const load = async () => {
      try {
        const sid = await transactionsApi.scopeSession(p.sessionId, p.owner, controller.signal, p.category, p.subcategories)
        const data = await transactionsApi.getMonthOverview(sid, priorMonth, p.dateType, controller.signal)
        if (!controller.signal.aborted) { setPrevious(data); setStatus('ready') }
      } catch { if (!controller.signal.aborted) setStatus('error') }
    }
    void load()
    return () => controller.abort()
  }, [p.sessionId, priorMonth, p.owner, p.category, p.subcategories, p.dateType, p.refreshKey])
  const current = !p.loading && p.overview?.month === p.month ? p.overview : null
  const change = current && previous && previous.transaction_count > 0 ? spendingChange(current.total_expenses, previous.total_expenses) : null
  const changes = current && previous && previous.transaction_count > 0 ? categoryChanges(current, previous) : []
  const net = current ? current.total_income - current.total_expenses : 0
  return <section className="monthly-pulse" aria-label="תמונת מצב חודשית">
    <div className="pulse-first-row" aria-busy={p.loading}>
      <div className="pulse-spending">
        <div className="pulse-heading"><span className="eyebrow">{p.month ? monthLabel(p.month) : 'בחרו חודש'}</span></div>
        <span className="pulse-label">הוצאות החודש</span>
        <strong className="pulse-focal">{current ? <bdi dir="ltr">{formatCurrency(current.total_expenses)}</bdi> : p.loading ? 'טוען...' : 'לא זמין'}</strong>
        <div className="pulse-context"><span>{current ? `${current.transaction_count} עסקאות` : 'הנתונים מתעדכנים'}</span><span className="pulse-basis">{change?.percent != null && <bdi className={change.amount > 0 ? 'amount-negative' : 'amount-positive'} dir="ltr">{change.amount > 0 ? '+' : ''}{change.percent.toFixed(1)}%</bdi>}{change?.percent != null && <span aria-hidden="true"> · </span>}{p.dateType === 'billing' ? 'תאריך חיוב' : 'תאריך עסקה'} · {p.owner === 'joint' ? 'משותף' : p.owner || 'כולם'}</span></div>
      </div>
      <div className="pulse-income orbit-kpi"><span className="orbit-kpi-overline">תמונת מצב חודשית</span><span>הכנסות שנקלטו</span><strong><bdi dir="ltr">{current ? formatCurrency(current.total_income) : '-'}</bdi></strong><small>{current?.total_income === 0 ? 'לא נקלטו הכנסות בסינון הזה' : 'לפי הנתונים בדשבורד'}</small></div>
        <div className="pulse-net orbit-kpi"><span className="orbit-kpi-overline">סיכום החודש</span><span>הכנסות פחות הוצאות</span><strong className={net < 0 ? 'amount-negative' : 'amount-positive'}><bdi dir="ltr">{current ? formatCurrency(net, true) : '-'}</bdi></strong><small>לא יתרת חשבון הבנק</small></div>
    </div>
    <div className="pulse-comparison">
      <div className="comparison-title"><span>לעומת {priorMonth ? monthLabel(priorMonth) : 'החודש הקודם'}</span>{change && (change.amount > 0 ? <TrendingUp size={18}/> : <TrendingDown size={18}/>)}</div>
      {!current && !p.loading ? <p>נתוני החודש אינם זמינים. נסו לרענן את הדף.</p> : !current || status === 'loading' ? <p>טוען השוואה...</p> : status === 'error' ? <p>ההשוואה אינה זמינה כרגע</p> : !change ? <p>אין עסקאות בחודש הקודם להשוואה</p> : <div className={`comparison-summary ${change.amount > 0 ? 'comparison-up' : 'comparison-down'}`}><strong>{change.amount === 0 ? 'ללא שינוי בהוצאות' : `הוצאות ${change.amount > 0 ? 'גבוהות' : 'נמוכות'}${change.percent !== null ? ` ב-${ltrIsolate(`${Math.abs(change.percent).toFixed(1)}%`)}` : ''}`}</strong><span><bdi dir="ltr">{formatCurrency(change.amount, true)}</bdi> שינוי בסכום ההוצאות</span></div>}
      <details className="coverage-details"><summary>על ההשוואה</summary><p className="coverage-note">השוואת החודשים כפי שנקלטו, לא תחזית ולא השוואה לאותו יום בחודש. חודש נוכחי או עתידי עשוי להיות חלקי. כל הסינונים חלים גם על החודש הקודם.</p></details>
      {changes.length > 0 && <div className={`category-movers ${expandedChanges ? 'expanded' : ''}`}><span className="eyebrow">שינוי לפי קטגוריה לעומת {priorMonth ? monthLabel(priorMonth) : 'החודש הקודם'}</span>{changes.map(c => <button key={c.name} onClick={() => p.onCategory(c.name)}><span>{c.name}</span><span className="mover-delta">{c.amount > 0 ? 'עלייה' : 'ירידה'} <bdi dir="ltr">{formatCurrency(c.amount, true)}</bdi></span><span className="mover-bar"><i style={{width:`${Math.max(5, Math.abs(c.amount) / Math.max(...changes.map(x => Math.abs(x.amount))) * 100)}%`, background:c.amount > 0 ? 'var(--danger)' : 'var(--success)'}}/></span><ArrowLeft size={14}/></button>)}{changes.length > 3 && <button className="movers-expand" onClick={()=>setExpandedChanges(v=>!v)}>{expandedChanges ? 'הצג פחות' : 'כל השינויים'}</button>}</div>}
      <button className="pulse-ledger-link" onClick={p.onTransactions}>לכל העסקאות <ArrowLeft size={16}/></button>
    </div>
    <details className="saved-views"><summary><Bookmark size={16}/> תצוגות שמורות <span>{views.length > 0 ? views.length : ''}</span><span className="save-view-label">שמירת תצוגה</span></summary><p>שמרו קטגוריה, תתי-קטגוריות, בעלים וסוג תאריך. החודש נשאר החודש שבו אתם צופים. השמירה מקומית לדפדפן ולמשתמש הזה.</p><form onSubmit={e => { e.preventDefault(); if (!name.trim()) return; persist([...views.filter(v => v.name !== name.trim()), {name: name.trim(), category: p.category, subcategories: [...p.subcategories], owner: p.owner, dateType: p.dateType}].slice(-8)); setName('') }}><input aria-label="שם התצוגה" maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="למשל: קניות לבית"/><button type="submit" disabled={!name.trim()}>שמור תצוגה</button></form><div className="saved-view-list">{views.map(v => <div key={v.name}><button onClick={() => p.onApplyView(v)}>{v.name}</button><button aria-label={`מחק תצוגה ${v.name}`} onClick={() => persist(views.filter(x => x.name !== v.name))}><Trash2 size={14}/></button></div>)}</div><span role="status">{message}</span></details>
  </section>
}
