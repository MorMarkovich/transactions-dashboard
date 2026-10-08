import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wallet, CalendarDays, Hash, TrendingUp, Search, ChevronDown, ChevronUp, Building2, Tag, type LucideIcon } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/common/EmptyState'
import { categoryColor } from '../utils/chartPalette'
import BarChart from '../components/charts/BarChart'
import { transactionsApi } from '../services/api'
import type { IncomeAnalysisData, IncomeTransactionDetail } from '../services/types'
import { formatCurrency, formatDate } from '../utils/formatting'

export default function Income() {
  const [params] = useSearchParams(); const sessionId = params.get('session_id')
  const [data,setData]=useState<IncomeAnalysisData|null>(null); const [loading,setLoading]=useState(false)
  const [month,setMonth]=useState(''); const [source,setSource]=useState(''); const [category,setCategory]=useState(''); const [search,setSearch]=useState('')
  const [selected,setSelected]=useState<IncomeTransactionDetail|null>(null)
  useEffect(()=>{if(!sessionId)return;const c=new AbortController();setLoading(true);transactionsApi.getIncomeAnalysis(sessionId,{month:month||undefined,source:source||undefined,category:category||undefined},c.signal).then(next=>{if(!c.signal.aborted)setData(next)}).catch(()=>{}).finally(()=>{if(!c.signal.aborted)setLoading(false)});return()=>c.abort()},[sessionId,month,source,category])
  // The backend narrows its option lists to the current selection; keep every
  // option ever seen so the user can switch straight to another source/month.
  const [facets,setFacets]=useState<{months:string[];sources:string[];categories:string[]}>({months:[],sources:[],categories:[]})
  useEffect(()=>{if(!data)return;setFacets(prev=>{const merge=(a:string[],b:{name:string}[])=>{const out=[...a];for(const x of b)if(!out.includes(x.name))out.push(x.name);return out};return {months:merge(prev.months,data.months??[]),sources:merge(prev.sources,data.sources??[]),categories:merge(prev.categories,data.categories??[])}})},[data])
  const visible=useMemo(()=>data?.transactions.filter(x=>!search||`${x.source} ${x.category} ${x.account} ${x.notes}`.toLowerCase().includes(search.toLowerCase()))??[],[data,search])
  if(!sessionId)return <EmptyState icon="💰" title="אין נתונים להצגה" text="טענו עסקאות כדי לעקוב אחרי ההכנסות"/>
  if(loading&&!data)return <Skeleton variant="rectangular" height={500}/>
  const months=data?.months??[], sources=data?.sources??[]
  return <div dir="rtl"><PageHeader title="הכנסות" subtitle="מעקב מלא אחרי כל הכנסה, המקור שלה והמגמה לאורך זמן" icon={Wallet}/>
    <div className="income-kpis">{([
      ['סה״כ הכנסות',formatCurrency(data?.total??0),Wallet],['מספר הכנסות',String(data?.count??0),Hash],['ממוצע להכנסה',formatCurrency(data?.average??0),TrendingUp],['חודשים פעילים',String(months.length),CalendarDays]
    ] as [string,string,LucideIcon][]).map(([label,value,Icon])=><Card key={String(label)} className="glass-card"><div className="income-kpi"><Icon size={20}/><div><span>{label}</span><strong>{value}</strong></div></div></Card>)}</div>
    <section className="income-filters glass-card"><label><span>חודש</span><select value={month} onChange={e=>setMonth(e.target.value)}><option value="">כל החודשים</option>{facets.months.map(x=><option key={x}>{x}</option>)}</select></label><label><span>מקור</span><select value={source} onChange={e=>setSource(e.target.value)}><option value="">כל המקורות</option>{facets.sources.map(x=><option key={x}>{x}</option>)}</select></label><label><span>קטגוריה</span><select key={`cat-${facets.categories.length}`} value={category} onChange={e=>setCategory(e.target.value)}><option value="">כל הקטגוריות</option>{facets.categories.map(x=><option key={x}>{x}</option>)}</select></label><label><span>חיפוש</span><div className="income-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="מקור, חשבון או הערה"/></div></label></section>
    {data&&data.count===0?<EmptyState icon="💰" title="אין הכנסות בסינון הזה" text="נסו לשנות את החודש, המקור או הקטגוריה"/>:<>
      <div className="income-charts"><Card className="glass-card"><h3>הרכב הכנסות לפי מקור</h3><div className="income-source-ranking">{sources.map((item,i)=><button key={item.name} onClick={()=>setSource(item.name)}><span className="rank-number">{String(i+1).padStart(2,'0')}</span><bdi className="income-source-name">{item.name}</bdi><bdi dir="ltr">{formatCurrency(item.value)}</bdi><span className="rank-bar"><i style={{width:`${item.value/(sources[0]?.value||1)*100}%`,background:categoryColor(item.name)}}/></span></button>)}</div></Card><Card className="glass-card"><h3>הכנסות לאורך זמן</h3><BarChart data={months.map(x=>({label:x.name,value:x.value}))} height={310}/></Card></div>
      <Card className="glass-card income-ledger"><div className="income-ledger-title"><h3>כל ההכנסות ({visible.length})</h3><span>לחצו על שורה לכל הפרטים</span></div><div className="income-table-wrap"><table><thead><tr><th>תאריך</th><th>מקור</th><th>קטגוריה</th><th>חשבון</th><th>סכום</th><th/></tr></thead><tbody>{visible.map(x=><tr key={x.id} onClick={()=>setSelected(selected?.id===x.id?null:x)} className={selected?.id===x.id?'selected':''}><td>{formatDate(x.date)}</td><td><strong><bdi>{x.source}</bdi></strong></td><td>{x.category||'ללא קטגוריה'}</td><td>{x.account}</td><td className="income-amount">{formatCurrency(x.amount)}</td><td>{selected?.id===x.id?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</td></tr>)}</tbody></table></div>
      {selected&&<div className="income-detail"><div><CalendarDays/><span>תאריך</span><strong>{formatDate(selected.date)}</strong></div><div><Building2/><span>מקור / חשבון</span><strong>{selected.source} · {selected.account}</strong></div><div><Tag/><span>סיווג</span><strong>{[selected.category,selected.subcategory].filter(Boolean).join(' / ')||'לא סווג'}</strong></div><div><Wallet/><span>סכום</span><strong>{formatCurrency(selected.amount)}</strong></div>{selected.notes&&<p><b>הערות:</b> {selected.notes}</p>}</div>}</Card>
    </>}</div>
}
