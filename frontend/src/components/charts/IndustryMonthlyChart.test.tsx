import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import IndustryMonthlyChart from './IndustryMonthlyChart'
import { categoryColor } from '../../utils/chartPalette'
import type { IndustryMonthlyData } from '../../services/types'

vi.mock('../../hooks/useMediaQuery', () => ({ default: () => false }))
const captured: { barData: Record<string, unknown>[]; xAxisProps: Record<string, unknown> } = {
  barData: [],
  xAxisProps: {},
}

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children, data }: { children: React.ReactNode; data: Record<string, unknown>[] }) => {
    captured.barData = data
    return <div>{children}</div>
  },
  Bar: () => null,
  XAxis: (props: Record<string, unknown>) => {
    captured.xAxisProps = props
    return null
  },
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

const data: IndustryMonthlyData = {
  months: ['06/2026', '07/2026'],
  series: [
    { name: 'טכנולוגיה', data: [100, 200] },
    { name: 'טיפוח', data: [50, 60] },
    { name: 'בילויים', data: [30, 40] },
  ],
}

describe('IndustryMonthlyChart category colors', () => {
  it('colors every stacked series from the shared categoryColor mapping', () => {
    const { container } = render(<IndustryMonthlyChart data={data} />)
    data.series.forEach((s, i) => {
      const grad = container.querySelector(`#industGrad${i}`)
      expect(grad, `gradient for ${s.name}`).not.toBeNull()
      const stops = [...grad!.querySelectorAll('stop')].map((st) => st.getAttribute('stop-color'))
      expect(stops).toEqual([categoryColor(s.name), categoryColor(s.name)])
    })
  })

  it('matches the canonical palette slots used by the donut and comparison table', () => {
    expect(categoryColor('טכנולוגיה')).toBe('var(--category-15, #F783AC)')
    expect(categoryColor('טיפוח')).toBe('var(--category-13, #9775FA)')
    expect(categoryColor('בילויים')).toBe('var(--category-11, #FF6B6B)')
  })

  it('keeps all canonical categories distinct', () => {
    const names = [
      'שונות', 'הוצאות שוטפות', 'העברת כספים', 'חוגים וספורט', 'משיכת מזומן',
      'תרופות וטיפולים', 'הוצאות משתנות', 'אוכל', 'טיסות ותיירות', 'פארם',
      'בילויים', 'קניות', 'טיפוח', 'אירועים ומתנות', 'טכנולוגיה', 'סושי',
      'העברה להשקעות', 'הוראות קבע',
    ]
    const colors = names.map((n) => categoryColor(n))
    expect(new Set(colors).size).toBe(names.length)
  })
})

describe('IndustryMonthlyChart month axis', () => {
  it('renders months oldest-first even when the API returns them unsorted', () => {
    const unsorted: IndustryMonthlyData = {
      months: ['11/2026', '03/2026', '07/2026'],
      series: [{ name: 'אוכל', data: [110, 30, 70] }],
    }
    render(<IndustryMonthlyChart data={unsorted} />)
    expect(captured.barData.map((row) => row.month)).toEqual(['03/2026', '07/2026', '11/2026'])
    // values travel with their month after sorting
    expect(captured.barData.map((row) => row['אוכל'])).toEqual([30, 70, 110])
  })

  it('shortens rotated tick labels to MM/YY when more than 6 months show', () => {
    const many: IndustryMonthlyData = {
      months: ['01/2026', '02/2026', '03/2026', '04/2026', '05/2026', '06/2026', '07/2026'],
      series: [{ name: 'אוכל', data: [1, 2, 3, 4, 5, 6, 7] }],
    }
    render(<IndustryMonthlyChart data={many} />)
    const fmt = captured.xAxisProps.tickFormatter as (m: string) => string
    expect(fmt('03/2026')).toBe('03/26')
  })

  it('keeps the full MM/YYYY label when rotation is not needed', () => {
    const few: IndustryMonthlyData = {
      months: ['05/2026', '06/2026'],
      series: [{ name: 'אוכל', data: [1, 2] }],
    }
    render(<IndustryMonthlyChart data={few} />)
    const fmt = captured.xAxisProps.tickFormatter as (m: string) => string
    expect(fmt('06/2026')).toBe('06/2026')
  })
})

describe('IndustryMonthlyChart scale and mobile paths', () => {
  it('keeps month->value mapping correct for 24+ unsorted months', () => {
    // 26 months across 2025-2027, deliberately shuffled
    const all: string[] = []
    for (let y = 2025; y <= 2027; y++) for (let m = 1; m <= 12; m++) all.push(`${String(m).padStart(2, '0')}/${y}`)
    const months = all.slice(0, 26)
    const shuffled = [...months].reverse() // worst case: fully reversed
    const big: IndustryMonthlyData = {
      months: shuffled,
      series: [{ name: 'אוכל', data: shuffled.map((_, i) => i + 1) }],
    }
    render(<IndustryMonthlyChart data={big} />)
    expect(captured.barData.map((row) => row.month)).toEqual(months)
    // each value travels with its month: value for months[k] was 26-k in the shuffled input
    months.forEach((_, k) => {
      expect(captured.barData[k]['אוכל']).toBe(26 - k)
    })
    // rotation + MM/YY at this scale
    const fmt = captured.xAxisProps.tickFormatter as (m: string) => string
    expect(fmt('01/2027')).toBe('01/27')
  })

  it('mobile list renders months ascending with the matching series values', async () => {
    vi.resetModules()
    vi.doMock('../../hooks/useMediaQuery', () => ({ default: () => true }))
    const { default: MobileChart } = await import('./IndustryMonthlyChart')
    const data: IndustryMonthlyData = {
      months: ['11/2026', '03/2026'],
      series: [{ name: 'אוכל', data: [110, 30] }],
    }
    const { container } = render(<MobileChart data={data} />)
    const titles = [...container.querySelectorAll('.mobile-chart-row-title')].map((el) => el.textContent)
    expect(titles).toEqual(['03/2026', '11/2026'])
    const values = [...container.querySelectorAll('.mobile-chart-row-value')].map((el) => el.textContent)
    expect(values).toEqual(['₪30', '₪110'])
  })
})

describe('IndustryMonthlyChart CustomTooltip', () => {
  it('uses series colors for dots (not gradient url fills) and matches legend order', async () => {
    const { CustomTooltip } = await import('./IndustryMonthlyChart')
    const { render } = await import('@testing-library/react')
    const payload = [
      { name: 'הוצאות שוטפות', value: 320, color: 'url(#industGrad1)' },
      { name: 'אוכל', value: 900, color: 'url(#industGrad0)' },
    ]
    const colorOf = (n: string) => (n === 'אוכל' ? '#AA0001' : '#00BB02')
    const { container } = render(
      <CustomTooltip active payload={payload} label="05/2026" colorOf={colorOf} seriesOrder={['אוכל', 'הוצאות שוטפות']} />,
    )
    const rows = [...container.querySelectorAll('p')].slice(1, 3)
    // legend order: אוכל first
    expect(rows[0].textContent).toContain('אוכל')
    expect(rows[1].textContent).toContain('הוצאות שוטפות')
    // dots carry the series color, never the url(#...) gradient fill
    const dotSpan = rows[0].querySelector('span')!
    expect(dotSpan.getAttribute('style')).toContain('rgb(170, 0, 1)')
    expect(dotSpan.getAttribute('style')).not.toContain('url(')
    expect(container.textContent).toContain('1,220')
  })
})
