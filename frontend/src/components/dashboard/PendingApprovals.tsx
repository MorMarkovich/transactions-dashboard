import { useEffect, useState } from 'react'
import { Clock3, RefreshCw } from 'lucide-react'
import { isPendingStale, readPendingCards } from '../../services/pendingApprovals'
import type { PendingCard, PendingSnapshot } from '../../services/pendingApprovals'
import './PendingApprovals.css'

const time = (value: string) => new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const money = (value: number) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(value / 100)

function SnapshotRows({ snapshot, empty }: { snapshot: PendingSnapshot; empty: boolean }) {
  const [year, month] = snapshot.scope.slice(snapshot.cardKey.length + 1).split('-')
  return <div className="pending-snapshot">
    <p className="pending-observed">תקופת חיוב: <bdi>{month}/{year}</bdi> · נצפה ב־<time dateTime={snapshot.observedAt}>{time(snapshot.observedAt)}</time></p>
    {snapshot.rows.length ? <ul className="pending-rows">{snapshot.rows.map(row => <li key={row.identity}>
      <span className="pending-merchant">{row.merchant}<small><time dateTime={row.date}>{row.date.split('-').reverse().join('/')}</time> · אישור זמני</small></span>
      <bdi className="pending-amount" dir="ltr">{money(row.authorizationMinor)}</bdi>
    </li>)}</ul> : <p>{empty ? 'לא נצפו עסקאות ממתינות בבדיקה האחרונה לתקופה זו.' : 'אין רשומות בתצפית השמורה. המצב הנוכחי אינו ידוע.'}</p>}
  </div>
}

// Mounted with a user key: a user switch unmounts all prior financial state.
export default function PendingApprovals({ userId, refreshKey = 0 }: { userId: string; refreshKey?: number }) {
  const [cards, setCards] = useState<PendingCard[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const refresh = () => setRetry(value => value + 1)
    window.addEventListener('bank-sync-completed', refresh)
    const clock = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => { window.removeEventListener('bank-sync-completed', refresh); window.clearInterval(clock) }
  }, [])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setStatus('loading')
    const timeout = window.setTimeout(() => { controller.abort(); if (active) setStatus('error') }, 10_000)
    void readPendingCards(userId, controller.signal).then(value => {
      if (active && !controller.signal.aborted) { setCards(value); setStatus('ready'); setNow(Date.now()) }
    }).catch(() => { if (active) setStatus('error') }).finally(() => window.clearTimeout(timeout))
    return () => { active = false; controller.abort(); window.clearTimeout(timeout) }
  }, [userId, refreshKey, retry])

  return <section className="pending-approvals" dir="rtl" aria-labelledby="pending-heading" aria-busy={status === 'loading'}>
    <header><h2 id="pending-heading"><Clock3 size={20} aria-hidden="true"/> עסקאות ממתינות</h2>
      <button type="button" onClick={() => setRetry(v => v + 1)} disabled={status === 'loading'} title="קריאת המידע השמור בלבד"><RefreshCw size={15} aria-hidden="true"/> רענן תצוגה</button></header>
    <p className="pending-note">אישורים זמניים בכרטיסי האשראי. הסכומים עשויים להשתנות ואינם נכללים בהוצאות, בתקציב או בייצוא העסקאות.</p>
    <p className="pending-note">כל הכרטיסים המחוברים · סינון החודש, הבעלים והקטגוריות אינו חל כאן. רענון התצוגה קורא מידע שמור ואינו מתחבר לבנק.</p>
    {status === 'error' && <p role="alert" className="pending-warning">לא ניתן לאמת את העסקאות הממתינות כרגע. {cards.length ? 'המידע המוצג הוא מהקריאה הקודמת ועשוי להיות לא עדכני.' : 'אין להסיק מכך שאין עסקאות ממתינות.'}</p>}
    {status === 'loading' && <p role="status">טוען מידע שמור…</p>}
    {status === 'ready' && cards.length === 0 && <p role="status">טרם התקבלו נתוני עסקאות ממתינות לכרטיסים שהוגדרו.</p>}
    {cards.map((card, index) => <article key={card.key} className="pending-card">
      <h3>{card.company === '77' ? 'אמריקן אקספרס' : 'ישראכרט'} · כרטיס <bdi>{card.suffix}</bdi> · חיבור {index + 1}</h3>
      {card.state === 'unknown' || !card.current ? <p className="pending-warning">החיבור אינו מאומת. לא מוצגות עסקאות מהחיבור הקודם.</p> : <>
        <p className={isPendingStale(card, now) || status !== 'ready' ? 'pending-warning' : 'pending-state'}>
          {isPendingStale(card, now) || status !== 'ready' ? 'מידע שמור — לא אומת כעדכני' : `${card.current.rows.length} עסקאות בתצפית האחרונה`}
          {card.state === 'retention_limit' && ' · העדכון נעצר עד לבדיקת התקופות הקודמות'}
        </p>
        <SnapshotRows snapshot={card.current} empty={!isPendingStale(card, now) && status === 'ready'}/>
        {card.unresolved.length > 0 && <details className="pending-unresolved"><summary>תקופות קודמות שטרם הוכרעו ({card.unresolved.length})</summary>
          <p>התקופה השתנתה. אין אישור שהעסקאות האלו חויבו או בוטלו; הן נשמרות בנפרד ולא מצורפות לתקופה הנוכחית.</p>
          {card.unresolved.map(snapshot => <SnapshotRows key={snapshot.scope} snapshot={snapshot} empty={false}/>)}</details>}
      </>}
      <p className="pending-observed">בדיקת איסוף אחרונה: <time dateTime={card.checkedAt}>{time(card.checkedAt)}</time></p>
    </article>)}
  </section>
}
