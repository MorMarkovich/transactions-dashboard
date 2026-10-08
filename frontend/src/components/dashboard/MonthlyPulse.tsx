import { useEffect, useState } from 'react'
import { ArrowLeft, Bookmark, Trash2, Wallet, TrendingDown, TrendingUp } from 'lucide-react'
import type { MonthOverviewData } from '../../services/types'
import { transactionsApi } from '../../services/api'
import { previousMonth, spendingChange, categoryChanges } from '../../utils/monthComparison'
import { formatCurrency, ltrIsolate } from '../../utils/formatting'

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
    <div className="pulse-heading"><div><span className="eyebrow">תמונת מצב חודשית</span><h2>{p.month ? ltrIsolate(p.month) : 'בחרו חודש'}</h2></div><span className="scope-pill">{p.dateType === 'billing' ? 'תאריך חיוב' : 'תאריך עסקה'} · {p.owner || 'כולם'}{p.category ? ` · ${p.category}` : ''}{p.subcategories.length ? ` · ${p.subcategories.join(', ')}` : ''}</span></div>
    <div className="pulse-kpis" aria-busy={p.loading}>
      <div className="pulse-main"><Wallet size={20}/><span>הוצאות בחודש שנבחר</span><strong>{current ? formatCurrency(current.total_expenses) : 'טוען...'}</strong><small>{current ? `${current.transaction_count} עסקאות לפי הסינון הנוכחי` : 'הנתונים מתעדכנים'}</small></div>
      <div><span>הכנסות שנקלטו</span><strong>{current ? formatCurrency(current.total_income) : '-'}</strong><small>{current?.total_income === 0 ? 'לא נקלטו הכנסות בסינון הזה' : 'לפי הנתונים בדשבורד'}</small></div>
      <div><span>הכנסות פחות הוצאות</span><strong className={net < 0 ? 'amount-negative' : 'amount-positive'}>{current ? formatCurrency(net, true) : '-'}</strong><small>לא יתרת חשבון הבנק</small></div>
    </div>
    <div className="pulse-comparison">
      <div className="comparison-title"><span>לעומת {priorMonth ? ltrIsolate(priorMonth) : 'החודש הקודם'}</span>{change && (change.amount > 0 ? <TrendingUp size={18}/> : <TrendingDown size={18}/>)}</div>
      {!current || status === 'loading' ? <p>טוען השוואה...</p> : status === 'error' ? <p>ההשוואה אינה זמינה כרגע</p> : !change ? <p>אין עסקאות בחודש הקודם להשוואה</p> : <div className="comparison-summary"><strong>{formatCurrency(change.amount, true)}</strong><span>{change.amount === 0 ? 'ללא שינוי' : change.amount > 0 ? 'יותר הוצאות' : 'פחות הוצאות'}{change.percent !== null ? ` · ${ltrIsolate(`${Math.abs(change.percent).toFixed(1)}%`)}` : ' · אין בסיס לאחוז שינוי'}</span></div>}
      <p className="coverage-note">השוואת החודשים כפי שנקלטו, לא תחזית ולא השוואה לאותו יום בחודש. חודש נוכחי או עתידי עשוי להיות חלקי. כל הסינונים חלים גם על החודש הקודם.</p>
      {changes.length > 0 && <div className="category-movers"><span className="eyebrow">השינויים הגדולים בהוצאות</span>{changes.map(c => <button key={c.name} onClick={() => p.onCategory(c.name)}><span>{c.name}</span><b>{formatCurrency(c.amount, true)}</b><ArrowLeft size={14}/></button>)}</div>}
      <button className="pulse-ledger-link" onClick={p.onTransactions}>לכל העסקאות <ArrowLeft size={16}/></button>
    </div>
    <details className="saved-views"><summary><Bookmark size={16}/> תצוגות שמורות <span>{views.length > 0 ? views.length : ''}</span></summary><p>שמרו קטגוריה, תתי-קטגוריות, בעלים וסוג תאריך. החודש נשאר החודש שבו אתם צופים. השמירה מקומית לדפדפן ולמשתמש הזה.</p><form onSubmit={e => { e.preventDefault(); if (!name.trim()) return; persist([...views.filter(v => v.name !== name.trim()), {name: name.trim(), category: p.category, subcategories: [...p.subcategories], owner: p.owner, dateType: p.dateType}].slice(-8)); setName('') }}><input aria-label="שם התצוגה" maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="למשל: קניות לבית"/><button type="submit" disabled={!name.trim()}>שמור תצוגה</button></form><div className="saved-view-list">{views.map(v => <div key={v.name}><button onClick={() => p.onApplyView(v)}>{v.name}</button><button aria-label={`מחק תצוגה ${v.name}`} onClick={() => persist(views.filter(x => x.name !== v.name))}><Trash2 size={14}/></button></div>)}</div><span role="status">{message}</span></details>
  </section>
}
