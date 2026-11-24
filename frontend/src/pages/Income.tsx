import TransactionDrawer from '../components/table/TransactionDrawer'
import Button from '../components/ui/Button'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wallet, CalendarDays, Hash, TrendingUp, Search, ChevronDown, ChevronUp, Building2, Tag } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import WorkspaceMetrics from '../components/common/WorkspaceMetrics'
import Select from '../components/ui/Select'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/common/EmptyState'
import { useCategoryColor } from '../hooks/useCategoryColor'
import BarChart from '../components/charts/BarChart'
import { transactionsApi } from '../services/api'
import { useDashboardFilterSelection } from '../context/FilterContext'
import type { IncomeAnalysisData, IncomeTransactionDetail, Transaction } from '../services/types'
import { formatCurrency, formatDate, hebOwner } from '../utils/formatting'

export default function Income() {
  const { owner, category: dashboardCategory, subcategories } = useDashboardFilterSelection()
  const [params] = useSearchParams(); const sessionId = params.get('session_id')
  const categoryColor = useCategoryColor()
  const [data,setData]=useState<IncomeAnalysisData|null>(null); const [loading,setLoading]=useState(false)
  const [loadError,setLoadError]=useState(false); const [reloadTick,setReloadTick]=useState(0)
  const [month,setMonth]=useState(''); const [source,setSource]=useState(''); const [category,setCategory]=useState(''); const [search,setSearch]=useState('')
  const [selectedId, setSelectedId] = useState<IncomeTransactionDetail['id'] | null>(null)
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null)
  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    const { signal } = controller
    setLoading(true)
    setLoadError(false)
    const load = async () => {
      try {
        const scoped = owner || dashboardCategory || subcategories.length
          ? await transactionsApi.scopeSession(sessionId, owner, signal, dashboardCategory, subcategories)
          : sessionId
        if (signal.aborted) return
        const next = await transactionsApi.getIncomeAnalysis(scoped, {
          month: month || undefined, source: source || undefined, category: category || undefined,
        }, signal)
        if (!signal.aborted) setData(next)
      } catch {
        if (!signal.aborted) setLoadError(true)
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [sessionId, month, source, category, reloadTick, owner, dashboardCategory, subcategories])
  // The backend narrows its option lists to the current selection; keep every
  // option ever seen so the user can switch straight to another source/month.
  const [facets,setFacets]=useState<{months:string[];sources:string[];categories:string[]}>({months:[],sources:[],categories:[]})
  useEffect(()=>{if(!data)return;setFacets(prev=>{const merge=(a:string[],b:{name:string}[])=>{const out=[...a];for(const x of b)if(!out.includes(x.name))out.push(x.name);return out};return {months:merge(prev.months,data.months??[]),sources:merge(prev.sources,data.sources??[]),categories:merge(prev.categories,data.categories??[])}})},[data])
  const visible=useMemo(()=>data?.transactions.filter(x=>!search||`${x.source} ${x.category} ${x.account} ${x.notes}`.toLowerCase().includes(search.toLowerCase()))??[],[data,search])
  // Close the expanded detail once its row leaves the current result set
  // (filter/search change); keep it while the row is still present.
  useEffect(() => {
    if (selectedId !== null && !visible.some(item => item.id === selectedId)) setSelectedId(null)
  }, [selectedId, visible])
  const months = data?.months ?? []
  const sources = data?.sources ?? []

  return (
    <div className="income-page" dir="rtl">
      <PageHeader title="הכנסות" subtitle="מקורות הכנסה, מגמות לאורך זמן ופירוט לפי עסקה" icon={Wallet} />
      {!sessionId ? (
        <EmptyState icon="💰" title="אין נתונים להצגה" text="טענו עסקאות כדי לעקוב אחרי ההכנסות" />
      ) : loading && !data ? (
        <Skeleton variant="rectangular" height={500} />
      ) : loadError && !data ? (
        <Card className="glass-card">
          <EmptyState
            icon="⚠️"
            title="לא הצלחנו לטעון את ההכנסות"
            text="בדקו את החיבור ונסו שוב"
            action={<Button type="button" variant="secondary" onClick={() => setReloadTick(n => n + 1)}>נסו שוב</Button>}
          />
        </Card>
      ) : (
        <>
          {loadError && (
            <div className="income-load-error" role="alert">
              <span>העדכון האחרון נכשל - מוצגים הנתונים הקודמים.</span>
              <button type="button" onClick={() => setReloadTick(n => n + 1)}>נסו שוב</button>
            </div>
          )}
          <WorkspaceMetrics label="סיכום הכנסות" metrics={[
            { label: 'סה״כ הכנסות', value: formatCurrency(data?.total ?? 0), icon: Wallet, tone: 'positive' },
            { label: 'מספר הכנסות', value: data?.count ?? 0, icon: Hash },
            { label: 'ממוצע להכנסה', value: formatCurrency(data?.average ?? 0), icon: TrendingUp },
            { label: 'חודשים פעילים', value: months.length, icon: CalendarDays },
          ]} />
          <section className="income-filters glass-card" aria-label="סינון הכנסות">
            {[
              { label: 'חודש', all: 'כל החודשים', values: facets.months, value: month, onChange: setMonth },
              { label: 'מקור', all: 'כל המקורות', values: facets.sources, value: source, onChange: setSource },
              { label: 'קטגוריה', all: 'כל הקטגוריות', values: facets.categories, value: category, onChange: setCategory },
            ].map(filter => (
              <label key={filter.label}>
                <span>{filter.label}</span>
                <Select
                  ariaLabel={filter.label}
                  options={[{ value: '', label: filter.all }, ...filter.values.map(value => ({ value, label: value }))]}
                  value={filter.value}
                  onChange={filter.onChange}
                />
              </label>
            ))}
            <label>
              <span>חיפוש</span>
              <div className="income-search">
                <Search size={15} aria-hidden="true" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="מקור, חשבון או הערה" />
              </div>
            </label>
          </section>
          {data && data.count === 0 ? (
            <EmptyState icon="💰" title="אין הכנסות בסינון הזה" text="נסו לשנות את החודש, המקור או הקטגוריה" />
          ) : (
            <>
              <div className="income-charts">
                <Card className="glass-card">
                  <h2>הרכב הכנסות לפי מקור</h2>
                  <div className="income-source-ranking">
                    {sources.map(item => (
                      <button key={item.name} type="button" onClick={() => setSource(item.name)} aria-current={source === item.name || undefined}>
                        <bdi className="income-source-name">{item.name}</bdi>
                        <bdi dir="ltr">{formatCurrency(item.value)}</bdi>
                        <span className="rank-bar" aria-hidden="true">
                          <i style={{ width: `${item.value / (sources[0]?.value || 1) * 100}%`, background: categoryColor(item.name) }} />
                        </span>
                      </button>
                    ))}
                  </div>
                </Card>
                <Card className="glass-card">
                  <h2>הכנסות לאורך זמן</h2>
                  <BarChart data={months.map(item => ({ label: item.name, value: item.value }))} height={310} />
                </Card>
              </div>
              <Card className="glass-card income-ledger">
                <div className="income-ledger-title">
                  <h2>כל ההכנסות ({visible.length})</h2>
                </div>
                {visible.length === 0 ? (
                  <EmptyState
                    icon="🔎"
                    title={search ? `אין הכנסות שמתאימות ל״${search}״` : 'אין הכנסות להצגה'}
                    text={search ? 'הגרפים למעלה מציגים את כל ההכנסות בסינון הנוכחי, בלי החיפוש. נקו את החיפוש כדי לראות את הרשימה.' : 'נסו לשנות את הסינון'}
                  />
                ) : (
                  <div className="income-table-wrap" tabIndex={0} role="region" aria-label="רשימת הכנסות">
                    <table>
                      <thead><tr><th>תאריך</th><th>מקור</th><th>קטגוריה</th><th>חשבון</th><th>סכום</th><th>פרטים</th></tr></thead>
                      <tbody>
                        {visible.map(item => {
                          const expanded = selectedId === item.id
                          const toggleDetails = () => setSelectedId(expanded ? null : item.id)
                          return (
                            <Fragment key={item.id}>
                              <tr onClick={toggleDetails} className={expanded ? 'selected' : ''}>
                                <td>{formatDate(item.date)}</td>
                                <td><strong><bdi>{item.source}</bdi></strong></td>
                                <td>{item.category || 'ללא קטגוריה'}</td>
                                <td><bdi>{hebOwner(item.account)}</bdi></td>
                                <td className="income-amount"><bdi dir="ltr">{formatCurrency(item.amount)}</bdi></td>
                                <td>
                                  <button
                                    type="button"
                                    className="income-row-toggle"
                                    aria-label={`${expanded ? 'סגור' : 'הצג'} פרטי הכנסה: ${item.source}, ${formatDate(item.date)}`}
                                    aria-expanded={expanded}
                                    aria-controls={expanded ? 'income-detail' : undefined}
                                    onClick={event => { event.stopPropagation(); toggleDetails() }}
                                  >
                                    {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                                  </button>
                                </td>
                              </tr>
                              {expanded && (
                                <tr className="income-detail-row">
                                  <td colSpan={6}>
                                    <div className="income-detail" id="income-detail">
                                      <div><CalendarDays aria-hidden="true" /><span>תאריך</span><strong>{formatDate(item.date)}</strong></div>
                                      <div><Building2 aria-hidden="true" /><span>מקור / חשבון</span><strong><bdi>{hebOwner(item.source)}</bdi> · <bdi>{hebOwner(item.account)}</bdi></strong></div>
                                      <div><Tag aria-hidden="true" /><span>סיווג</span><strong>{[item.category, item.subcategory].filter(Boolean).join(' / ') || 'לא סווג'}</strong></div>
                                      <div><Wallet aria-hidden="true" /><span>סכום</span><strong><bdi dir="ltr">{formatCurrency(item.amount)}</bdi></strong></div>
                                      {item.notes && <p><b>הערות:</b> {item.notes}</p>}
                                      {item.transaction?.id != null && (
                                        <Button type="button" size="sm" variant="secondary" onClick={() => setEditTransaction(item.transaction ?? null)}>
                                          שנה קטגוריה
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}
      {sessionId && editTransaction && <TransactionDrawer
        transaction={editTransaction}
        isOpen={editTransaction !== null}
        startEditing
        onClose={() => setEditTransaction(null)}
        sessionId={sessionId}
        owner={owner}
        onUpdateTransaction={updated => setEditTransaction(current => current?.id === updated.id ? updated : current)}
        onClassificationChanged={() => setReloadTick(value => value + 1)}
      />}
    </div>
  )
}
