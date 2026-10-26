import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import CategoryMonthlyComparison from './CategoryMonthlyComparison'

vi.mock('../../hooks/useMediaQuery', () => ({ default: () => false }))

const NOW = new Date()
const mm = String(NOW.getMonth() + 1).padStart(2, '0')
const yyyy = NOW.getFullYear()
const CURRENT = `${mm}/${yyyy}` // in-progress month
const PREV = mm === '01' ? `12/${yyyy - 1}` : `${String(Number(mm) - 1).padStart(2, '0')}/${yyyy}`
const NEXT = mm === '12' ? `01/${yyyy + 1}` : `${String(Number(mm) + 1).padStart(2, '0')}/${yyyy}`

const data = {
  months: [PREV, CURRENT, NEXT],
  month_totals: { [PREV]: 2000, [CURRENT]: 1250, [NEXT]: 1000 },
  grand_total: 4250,
  categories: [
    {
      name: 'אוכל',
      total: 1800,
      pct_of_grand: 60,
      months: {
        [PREV]: { amount: 1000, pct_of_month: 50, delta_abs: 200, delta_pct: 25 },
        [CURRENT]: { amount: 500, pct_of_month: 40, delta_abs: -500, delta_pct: -50 },
        [NEXT]: { amount: 300, pct_of_month: 30, delta_abs: -200, delta_pct: -40 },
      },
    },
    {
      name: 'טיסות ותיירות',
      total: 0,
      pct_of_grand: 0,
      months: {
        // past month with no spend but a nonzero delta: no arrow on '—'
        [PREV]: { amount: 0, pct_of_month: 0, delta_abs: -700, delta_pct: -100 },
      },
    },
  ],
}

describe('CategoryMonthlyComparison delta arrows', () => {
  it('renders no arrow for empty cells, current month, or future months', () => {
    const { container } = render(<CategoryMonthlyComparison data={data} dateType="transaction" />)
    const rows = [...container.querySelectorAll('tbody tr')]
    const cellsOf = (name: string) => {
      const row = rows.find((r) => r.textContent?.includes(name))!
      return [...row.querySelectorAll('td')]
    }
    const svgCount = (td: Element) => td.querySelectorAll('svg').length

    const food = cellsOf('אוכל')
    // months render in the order passed: PREV, CURRENT, NEXT
    expect(svgCount(food[1])).toBe(1) // past, populated month keeps its arrow
    expect(svgCount(food[2])).toBe(0) // in-progress month: no misleading delta
    expect(svgCount(food[3])).toBe(0) // future month: no delta

    const flights = cellsOf('טיסות ותיירות')
    expect(svgCount(flights[1])).toBe(0) // empty past cell: no arrow despite delta_abs
    expect(flights[1].textContent).toContain('—')
  })
})
