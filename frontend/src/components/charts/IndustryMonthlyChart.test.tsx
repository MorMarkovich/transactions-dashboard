import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import IndustryMonthlyChart from './IndustryMonthlyChart'
import { categoryColor } from '../../utils/chartPalette'
import type { IndustryMonthlyData } from '../../services/types'

vi.mock('../../hooks/useMediaQuery', () => ({ default: () => false }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
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
    const colors = names.map(categoryColor)
    expect(new Set(colors).size).toBe(names.length)
  })
})
