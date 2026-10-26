import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
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

    // DOM order is newest-first so the RTL table reads oldest-first visually,
    // matching the LTR month strips and the comparison chart: NEXT, CURRENT, PREV
    const headMonths = [...container.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(headMonths).toEqual(['קטגוריה', NEXT, CURRENT, PREV, 'סה"כ'])

    const food = cellsOf('אוכל')
    expect(svgCount(food[1])).toBe(0) // future month: no delta
    expect(svgCount(food[2])).toBe(0) // in-progress month: no misleading delta
    expect(svgCount(food[3])).toBe(1) // past, populated month keeps its arrow

    const flights = cellsOf('טיסות ותיירות')
    expect(svgCount(flights[3])).toBe(0) // empty past cell: no arrow despite delta_abs
    expect(flights[3].textContent).toContain('—')
  })
})

describe('CategoryMonthlyComparison footer month mapping', () => {
  const mkData = (months: string[], totals: Record<string, number>) => ({
    months,
    month_totals: totals,
    grand_total: Object.values(totals).reduce((a, b) => a + b, 0),
    categories: [
      {
        name: 'אוכל',
        total: 0,
        pct_of_grand: 0,
        months: Object.fromEntries(months.map((m) => [m, { amount: 0, pct_of_month: 0, delta_abs: 0, delta_pct: 0 }])),
      },
    ],
  })
  const footerSums = (container: HTMLElement) =>
    [...container.querySelectorAll('tfoot td')].map((td, i) =>
      i === 0 ? td.textContent?.replace(/\s/g, '') : Number(td.textContent?.replace(/[^0-9.]/g, '')),    )
  const headMonths = (container: HTMLElement) =>
    [...container.querySelectorAll('thead th')].map((th) => th.textContent)

  it('footer sums sit under their own month headers (reversed API order)', () => {
    // API returns newest-first; totals are deliberately distinct per month
    const { container } = render(
      <CategoryMonthlyComparison
        data={mkData(['11/2026', '03/2026', '07/2026'], { '03/2026': 111, '07/2026': 777, '11/2026': 999 })}
        dateType="transaction"
      />,
    )
    // DOM: קטגוריה, 11, 07, 03, סה"כ (RTL reads 03..11 visually)
    expect(headMonths(container)).toEqual(['קטגוריה', '11/2026', '07/2026', '03/2026', 'סה"כ'])
    expect(footerSums(container)).toEqual(['סה"כחודשי', 999, 777, 111, 1887])
  })

  it('footer stays aligned when a middle month is deselected', () => {
    const { container } = render(
      <CategoryMonthlyComparison
        data={mkData(['03/2026', '04/2026', '05/2026', '06/2026'], { '03/2026': 100, '04/2026': 200, '05/2026': 300, '06/2026': 400 })}
        dateType="transaction"
      />,
    )
    const chip = [...container.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent?.trim() === '05/2026')!
    fireEvent.click(chip)
    expect(headMonths(container)).toEqual(['קטגוריה', '06/2026', '04/2026', '03/2026', 'סה"כ'])
    expect(footerSums(container)).toEqual(['סה"כחודשי', 400, 200, 100, 700])
  })

  it('row totals and pct follow the visible months after deselection', () => {
    const visibleData = {
      months: ['03/2026', '04/2026', '05/2026'],
      month_totals: { '03/2026': 100, '04/2026': 200, '05/2026': 300 },
      grand_total: 600,
      categories: [
        {
          name: 'אוכל',
          total: 600, // all-months total from the API; must NOT be shown when a month is hidden
          pct_of_grand: 100,
          months: {
            '03/2026': { amount: 100, pct_of_month: 100, delta_abs: 0, delta_pct: 0 },
            '04/2026': { amount: 200, pct_of_month: 100, delta_abs: 0, delta_pct: 0 },
            '05/2026': { amount: 300, pct_of_month: 100, delta_abs: 0, delta_pct: 0 },
          },
        },
      ],
    }
    const { container } = render(<CategoryMonthlyComparison data={visibleData} dateType="transaction" />)
    const lastCell = () => {
      const cells = [...container.querySelectorAll('tbody tr')[0].querySelectorAll('td')]
      return cells[cells.length - 1].textContent?.replace(/\s/g, '')
    }
    // all months visible: full total
    expect(lastCell()).toContain('600')
    // hide 05/2026 (300): row total shows only the visible 100+200
    const chip = [...container.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent?.trim() === '05/2026')!
    fireEvent.click(chip)
    expect(lastCell()).toContain('300')
    expect(lastCell()).not.toContain('600')
    // pct_of_grand recomputes against the visible grand total (300 of 300 = 100%)
    expect(lastCell()).toContain('100.0%')
  })
})

describe('CategoryMonthlyComparison chip lifecycle', () => {
  const mkData = (months: string[]) => ({
    months,
    month_totals: Object.fromEntries(months.map((m, i) => [m, (i + 1) * 100])),
    grand_total: 1000,
    categories: [
      {
        name: 'אוכל',
        total: 0,
        pct_of_grand: 0,
        months: Object.fromEntries(months.map((m) => [m, { amount: 0, pct_of_month: 0, delta_abs: 0, delta_pct: 0 }])),
      },
    ],
  })
  const chipFor = (container: HTMLElement, m: string) =>
    [...container.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent?.trim() === m)
  const headMonths = (container: HTMLElement) =>
    [...container.querySelectorAll('thead th')].map((th) => th.textContent)

  it('deselected chip stays visible (aria-pressed=false) and reselect restores the column', () => {
    const { container } = render(
      <CategoryMonthlyComparison data={mkData(['03/2026', '04/2026', '05/2026'])} dateType="transaction" />,
    )
    const chip = chipFor(container, '04/2026')!
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(chip)
    // chip still there, marked off; column gone
    expect(chipFor(container, '04/2026')).toBeTruthy()
    expect(chipFor(container, '04/2026')!.getAttribute('aria-pressed')).toBe('false')
    expect(headMonths(container)).toEqual(['קטגוריה', '05/2026', '03/2026', 'סה"כ'])
    // reselect restores
    fireEvent.click(chipFor(container, '04/2026')!)
    expect(headMonths(container)).toEqual(['קטגוריה', '05/2026', '04/2026', '03/2026', 'סה"כ'])
    expect(chipFor(container, '04/2026')!.getAttribute('aria-pressed')).toBe('true')
  })

  it('never deselects the last remaining month', () => {
    const { container } = render(
      <CategoryMonthlyComparison data={mkData(['03/2026', '04/2026'])} dateType="transaction" />,
    )
    fireEvent.click(chipFor(container, '03/2026')!)
    expect(headMonths(container)).toEqual(['קטגוריה', '04/2026', 'סה"כ'])
    // clicking the sole remaining month keeps it
    fireEvent.click(chipFor(container, '04/2026')!)
    expect(headMonths(container)).toEqual(['קטגוריה', '04/2026', 'סה"כ'])
    expect(chipFor(container, '04/2026')!.getAttribute('aria-pressed')).toBe('true')
  })
})
