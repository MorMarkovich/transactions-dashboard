import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DonutChart from './DonutChart'
import { ltrIsolate } from '../../utils/formatting'

const captured = vi.hoisted(() => ({ tooltip: {} as Record<string, unknown> }))
vi.mock('../../hooks/useMediaQuery', () => ({ default: () => false }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  Tooltip: (props: Record<string, unknown>) => {
    captured.tooltip = props
    const Content = props.content as React.ComponentType<Record<string, unknown>>
    return <div data-testid="tooltip" style={props.wrapperStyle as React.CSSProperties}>
      <Content active payload={[{ name: 'אוכל', value: 100, payload: { name: 'אוכל', value: 100 } }]} />
    </div>
  },
}))

describe('donut hover overlay', () => {
  beforeEach(() => { captured.tooltip = {} })
  it('keeps the tooltip above the center label and does not intercept the pointer', () => {
    render(<DonutChart data={[{ name: 'אוכל', value: 100 }]} total={200} />)
    const center = screen.getByText(ltrIsolate('₪200.00')).parentElement!
    expect(center).toHaveStyle({ zIndex: 1, pointerEvents: 'none' })
    expect(screen.getByTestId('tooltip')).toHaveStyle({ zIndex: 2, pointerEvents: 'none' })
    expect(captured.tooltip.isAnimationActive).toBe(false)
    expect(screen.getByText('אוכל')).toBeInTheDocument()
    expect(screen.getByText(/50.0%/)).toBeInTheDocument()
  })
  it('updates percentages after the total changes', () => {
    const { rerender } = render(<DonutChart data={[{ name: 'אוכל', value: 100 }]} total={200} />)
    rerender(<DonutChart data={[{ name: 'אוכל', value: 100 }]} total={400} />)
    expect(screen.getByText(/25.0%/)).toBeInTheDocument()
  })
  it('shows the empty state without a tooltip when there are no slices', () => {
    render(<DonutChart data={[]} total={0} />)
    expect(screen.getByText('אין נתונים להצגה')).toBeInTheDocument()
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument()
  })
})
