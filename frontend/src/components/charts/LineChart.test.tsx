import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import LineChart, { sparseTimeTicks } from './LineChart'

const captured = vi.hoisted(() => ({ area: {} as Record<string, unknown>, tooltip: {} as Record<string, unknown>, chart: {} as Record<string, unknown>, xaxis: {} as Record<string, unknown> }))
vi.mock('../../hooks/useMediaQuery', () => ({ default: () => false }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
    captured.chart = props
    return <div>{props.children}</div>
  },
  Area: (props: Record<string, unknown>) => {
    captured.area = props
    return null
  },
  XAxis: (props: Record<string, unknown>) => {
    captured.xaxis = props
    return null
  },
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: (props: Record<string, unknown>) => {
    captured.tooltip = props
    const content = props.content as React.ReactElement<Record<string, unknown>>
    return (
      <div data-testid="tooltip">
        {React.cloneElement(content, { active: true, label: '16/06/2026', payload: [{ name: 'יתרה', value: -4787 }] })}
      </div>
    )
  },
}))

describe('LineChart', () => {
  beforeEach(() => { captured.area = {}; captured.tooltip = {}; captured.chart = {}; captured.xaxis = {} })

  it('keeps the chart in an LTR container and enables the a11y layer', () => {
    const { container } = render(<LineChart data={[{ label: '16/06/2026', value: -4787 }]} name="יתרה" />)
    expect(container.querySelector('[dir="ltr"]')).toBeTruthy()
    expect(captured.chart.accessibilityLayer).toBe(true)
  })

  it('active dot carries no literal coordinates (no stray 0,0 dot)', () => {
    render(<LineChart data={[{ label: '16/06/2026', value: 100 }]} />)
    const dot = captured.area.activeDot as React.ReactElement<{ cx?: number; cy?: number }>
    expect(dot.props.cx).toBeUndefined()
    expect(dot.props.cy).toBeUndefined()
  })

  it('uses a true time scale when labels are parseable dates', () => {
    render(<LineChart data={[{ label: '2026-06-11', value: 100 }, { label: '2026-06-16', value: 200 }]} />)
    expect(captured.xaxis.dataKey).toBe('ts')
    expect(captured.xaxis.type).toBe('number')
    expect(captured.xaxis.scale).toBe('time')
    const rows = captured.chart.data as { ts: number }[]
    expect(rows[0].ts).toBe(Date.UTC(2026, 5, 11))
    expect(rows[1].ts - rows[0].ts).toBe(5 * 24 * 60 * 60 * 1000)
  })

  it('falls back to a categorical axis for non-date labels', () => {
    render(<LineChart data={[{ label: 'סתם תווית', value: 100 }]} />)
    expect(captured.xaxis.dataKey).toBe('label')
    expect(captured.xaxis.type).not.toBe('number')
  })

  it('sparseTimeTicks keeps a collision-free gap and both ends', () => {
    const d = (day: number, month: number) => Date.UTC(2026, month - 1, day)
    const dense = [1, 3, 4, 9, 11, 13, 16, 20, 21, 27, 29].map((x) => d(x, 6))
    const sparseRest = [d(30, 7), d(8, 10), d(19, 10), d(26, 10)]
    const ticks = sparseTimeTicks([...dense, ...sparseRest], 7)
    expect(ticks[0]).toBe(d(1, 6))
    expect(ticks[ticks.length - 1]).toBe(d(26, 10))
    expect(ticks.length).toBeLessThanOrEqual(7)
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeGreaterThanOrEqual(18 * 24 * 60 * 60 * 1000)
    }
  })

  it('tooltip labels the series and preserves negative sign', () => {
    render(<LineChart data={[{ label: '16/06/2026', value: -4787 }]} name="יתרה" />)
    expect(captured.area.name).toBe('יתרה')
    const t = screen.getByTestId('tooltip').textContent!; expect(t).toContain('יתרה:'); expect(t).toContain('-₪4,787')
  })
})
