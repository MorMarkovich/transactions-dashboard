import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import DonutChart from './DonutChart'
import { ltrIsolate } from '../../utils/formatting'
import { categoryColor } from '../../utils/chartPalette'
import { ThemeProvider, useTheme } from '../../context/ThemeContext'

const captured = vi.hoisted(() => ({ tooltip: {} as Record<string, unknown>, fills: [] as (string | undefined)[] }))
vi.mock('../../hooks/useMediaQuery', () => ({ default: () => false }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: (props: { fill?: string }) => {
    captured.fills.push(props.fill)
    return null
  },
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

describe('donut slice colors', () => {
  beforeEach(() => { captured.fills = [] })
  it('gives colliding unknown sub-category names distinct slice colors', () => {
    render(<DonutChart data={[{ name: 'ביטוח', value: 100 }, { name: 'מנויים ושירותים', value: 50 }]} total={150} />)
    expect(captured.fills).toHaveLength(2)
    expect(captured.fills[0]).toBeTruthy()
    expect(captured.fills[0]).not.toBe(captured.fills[1])
  })
  it('keeps canonical category slices on their canonical colors', () => {
    render(<DonutChart data={[{ name: 'אוכל', value: 100 }, { name: 'בילויים', value: 50 }]} total={150} />)
    expect(captured.fills).toEqual(['var(--category-7, #B2ADEE)', 'var(--category-11, #FF6B6B)'])
  })
})

function ThemeToggle() {
  const { toggleTheme } = useTheme()
  return <button data-testid="theme-toggle" onClick={toggleTheme}>toggle</button>
}

describe('live theme toggle (no reload)', () => {
  beforeEach(() => {
    captured.fills = []
    localStorage.clear()
    document.documentElement.dataset.theme = 'dark'
  })

  it('recomputes custom slice colors dark -> light -> dark without a reload', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
        <DonutChart data={[{ name: 'ביטוח', value: 100 }, { name: 'מנויים ושירותים', value: 50 }]} total={150} />
      </ThemeProvider>,
    )
    const darkFills = captured.fills.slice(-2)
    expect(darkFills[0]).toBe(categoryColor('ביטוח', 'dark'))
    expect(darkFills[1]).toBe(categoryColor('מנויים ושירותים', 'dark'))

    fireEvent.click(screen.getByTestId('theme-toggle'))
    const lightFills = captured.fills.slice(-2)
    expect(lightFills[0]).toBe(categoryColor('ביטוח', 'light'))
    expect(lightFills[1]).toBe(categoryColor('מנויים ושירותים', 'light'))
    expect(lightFills).not.toEqual(darkFills)

    fireEvent.click(screen.getByTestId('theme-toggle'))
    expect(captured.fills.slice(-2)).toEqual(darkFills)
  })

  it('keeps canonical slices on var(--category-N) across a live toggle', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
        <DonutChart data={[{ name: 'אוכל', value: 100 }, { name: 'ביטוח', value: 50 }]} total={150} />
      </ThemeProvider>,
    )
    const before = captured.fills.slice(-2)
    expect(before[0]).toBe('var(--category-7, #B2ADEE)')
    fireEvent.click(screen.getByTestId('theme-toggle'))
    const after = captured.fills.slice(-2)
    expect(after[0]).toBe('var(--category-7, #B2ADEE)')
    expect(after[1]).toBe(categoryColor('ביטוח', 'light'))
    expect(after[1]).not.toBe(before[1])
  })
})
