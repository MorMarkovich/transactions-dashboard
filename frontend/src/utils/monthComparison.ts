import type { MonthOverviewData } from '../services/types'

const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const israelMonthFormat = new Intl.DateTimeFormat('en-GB', {
  month: '2-digit', year: 'numeric', timeZone: 'Asia/Jerusalem',
})

export function formatMonthLabel(month: string): string {
  const [number, year] = month.split('/')
  return `${monthNames[Number(number) - 1] ?? number} ${year}`
}

export function isOpenMonth(month: string, now = new Date()): boolean {
  const calendarMonth = israelMonthFormat.format(now)
  const [mm, yyyy] = month.split('/')
  const [currentMonth, currentYear] = calendarMonth.split('/')
  return Number(yyyy) * 12 + Number(mm) >= Number(currentYear) * 12 + Number(currentMonth)
}

/** Calendar predecessor, never the previous populated month. */
export function previousMonth(month: string): string | null {
  const match = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(month)
  if (!match) return null
  const m = Number(match[1]), y = Number(match[2])
  return `${String(m === 1 ? 12 : m - 1).padStart(2, '0')}/${m === 1 ? y - 1 : y}`
}
export function spendingChange(current: number, previous: number) {
  const amount = (Math.round(current * 100) - Math.round(previous * 100)) / 100
  return { amount, percent: previous > 0 ? amount / previous * 100 : null }
}
export function categoryChanges(current: MonthOverviewData, previous: MonthOverviewData) {
  const names = new Set([...current.categories, ...previous.categories].map(c => c.name))
  return [...names].map(name => {
    const now = current.categories.find(c => c.name === name)?.expenses ?? 0
    const before = previous.categories.find(c => c.name === name)?.expenses ?? 0
    return { name, now, before, ...spendingChange(now, before) }
  }).filter(c => c.amount !== 0).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 5)
}
