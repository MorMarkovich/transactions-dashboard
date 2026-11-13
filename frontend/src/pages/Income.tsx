import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wallet, CalendarDays, Hash, TrendingUp, Search, ChevronDown, ChevronUp, Building2, Tag, type LucideIcon } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import Select from '../components/ui/Select'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/common/EmptyState'
import { useCategoryColor } from '../hooks/useCategoryColor'
import BarChart from '../components/charts/BarChart'
import { transactionsApi } from '../services/api'
import { useDashboardFilterSelection } from '../context/FilterContext'
import type { IncomeAnalysisData, IncomeTransactionDetail } from '../services/types'
import { formatCurrency, formatDate, hebOwner } from '../utils/formatting'

export default function Income() {
  const { owner, category: dashboardCategory, subcategories } = useDashboardFilterSelection()
  const [params] = useSearchParams(); const sessionId = params.get('session_id')
  const categoryColor = useCategoryColor()
  const [data,setData]=useState<IncomeAnalysisData|null>(null); const [loading,setLoading]=useState(false)
  const [loadError,setLoadError]=useState(false); const [reloadTick,setReloadTick]=useState(0)
  const [month,setMonth]=useState(''); const [source,setSource]=useState(''); const [category,setCategory]=useState(''); const [search,setSearch]=useState('')
  const [selected,setSelected]=useState<IncomeTransactionDetail|null>(null)
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
  useEffect(()=>{if(selected&&!visible.some(x=>x.id===selected.id))setSelected(null)},[selected,visible])
  if(!sessionId)return <EmptyState icon="💰" title="אין נתונים להצגה" text="טענו עסקאות כדי לעקוב אחרי ההכנסות"/>
  if(loading&&!data)return <Skeleton variant="rectangular" height={500}/>
  const months=data?.months??[], sources=data?.sources??[]
  return <div dir="rtl"><PageHeader title="הכנסות" subtitle="מעקב מלא אחרי כל הכנסה, המקור שלה והמגמה לאורך זמן" icon={Wallet}/>
    {loadError&&!data&&<Card className="glass-card"><EmptyState icon="⚠️" title="לא הצלחנו לטעון את ההכנסות" text="בדקו את החיבור ונסו שוב" action={<button type="button" className="income-retry-btn" onClick={()=>setReloadTick(n=>n+1)}>נסו שוב</button>}/></Card>}
    <div className="income-kpis">{((loadError&&!data?[
      ['סה״כ הכנסות','–',Wallet],['מספר הכנסות','–',Hash],['ממוצע להכנסה','–',TrendingUp],['חודשים פעילים','–',CalendarDays]
    ]:[
      ['סה״כ הכנסות',formatCurrency(data?.total??0),Wallet],['מספר הכנסות',String(data?.count??0),Hash],['ממוצע להכנסה',formatCurrency(data?.average??0),TrendingUp],['חודשים פעילים',String(months.length),CalendarDays]
    ]) as [string,string,LucideIcon][]).map(([label,value,Icon])=><Card key={String(label)} className="glass-card"><div className="income-kpi"><Icon size={20}/><div><span>{label}</span><strong>{value}</strong></div></div></Card>)}</div>
    <section className="income-filters glass-card"><label><span>חודש</span><Select ariaLabel="חודש" options={[{value:'',label:'כל החודשים'},...facets.months.map(x=>({value:x,label:x}))]} value={month} onChange={setMonth}/></label><label><span>מקור</span><Select ariaLabel="מקור" options={[{value:'',label:'כל המקורות'},...facets.sources.map(x=>({value:x,label:x}))]} value={source} onChange={setSource}/></label><label><span>קטגוריה</span><Select ariaLabel="קטגוריה" options={[{value:'',label:'כל הקטגוריות'},...facets.categories.map(x=>({value:x,label:x}))]} value={category} onChange={setCategory}/></label><label><span>חיפוש</span><div className="income-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="מקור, חשבון או הערה"/></div></label></section>
    {loadError&&!data?null
    :data&&data.count===0?<EmptyState icon="💰" title="אין הכנסות בסינון הזה" text="נסו לשנות את החודש, המקור או הקטגוריה"/>:<>
      {loadError&&<div className="income-load-error" role="alert"><span>העדכון האחרון נכשל - מוצגים הנתונים הקודמים.</span><button type="button" onClick={()=>setReloadTick(n=>n+1)}>נסו שוב</button></div>}
      <div className="income-charts"><Card className="glass-card"><h3>הרכב הכנסות לפי מקור</h3><div className="income-source-ranking">{sources.map((item,i)=><button key={item.name} onClick={()=>setSource(item.name)}><span className="rank-number">{String(i+1).padStart(2,'0')}</span><bdi className="income-source-name">{item.name}</bdi><bdi dir="ltr">{formatCurrency(item.value)}</bdi><span className="rank-bar"><i style={{width:`${item.value/(sources[0]?.value||1)*100}%`,background:categoryColor(item.name)}}/></span></button>)}</div></Card><Card className="glass-card"><h3>הכנסות לאורך זמן</h3><BarChart data={months.map(x=>({label:x.name,value:x.value}))} height={310}/></Card></div>
      <Card className="glass-card income-ledger"><div className="income-ledger-title"><h3>כל ההכנסות ({visible.length})</h3>{visible.length>0&&<span>לחצו על שורה לכל הפרטים</span>}</div>{visible.length===0?<EmptyState icon="🔎" title={search?`אין הכנסות שמתאימות ל״${search}״`:'אין הכנסות להצגה'} text={search?'הגרפים למעלה מציגים את כל ההכנסות בסינון הנוכחי, בלי החיפוש. נקו את החיפוש כדי לראות את הרשימה.':'נסו לשנות את הסינון'}/>:<div className="income-table-wrap"><table><thead><tr><th>תאריך</th><th>מקור</th><th>קטגוריה</th><th>חשבון</th><th>סכום</th><th/></tr></thead><tbody>{visible.map(x=><tr key={x.id} onClick={()=>setSelected(selected?.id===x.id?null:x)} className={selected?.id===x.id?'selected':''}><td>{formatDate(x.date)}</td><td><strong><bdi>{x.source}</bdi></strong></td><td>{x.category||'ללא קטגוריה'}</td><td><span style={{whiteSpace:'nowrap'}}>{hebOwner(x.account)}</span></td><td className="income-amount">{formatCurrency(x.amount)}</td><td>{selected?.id===x.id?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</td></tr>)}</tbody></table></div>}
      {selected&&<div className="income-detail"><div><CalendarDays/><span>תאריך</span><strong>{formatDate(selected.date)}</strong></div><div><Building2/><span>מקור / חשבון</span><strong><span style={{whiteSpace:'nowrap'}}>{hebOwner(selected.source)}</span> · <span style={{whiteSpace:'nowrap'}}>{hebOwner(selected.account)}</span></strong></div><div><Tag/><span>סיווג</span><strong>{[selected.category,selected.subcategory].filter(Boolean).join(' / ')||'לא סווג'}</strong></div><div><Wallet/><span>סכום</span><strong>{formatCurrency(selected.amount)}</strong></div>{selected.notes&&<p><b>הערות:</b> {selected.notes}</p>}</div>}</Card>
    </>}</div>
}
