import type { MonthOverviewData } from '../services/types'

/** Calendar predecessor, never the previous populated month. */
export function previousMonth(month: string): string | null {
  const match = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(month)
  if (!match) return null
  const m = Number(match[1]), y = Number(match[2])
  return `${String(m === 1 ? 12 : m - 1).padStart(2, '0')}/${m === 1 ? y - 1 : y}`
}
export function spendingChange(current: number, previous: number) {
  const amount = current - previous
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
