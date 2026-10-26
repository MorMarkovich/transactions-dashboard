import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { IndustryMonthlyData } from '../../services/types'
import useMediaQuery from '../../hooks/useMediaQuery'
import { monthKeyNum } from '../../utils/formatting'
import { useCategoryColor } from '../../hooks/useCategoryColor'

interface IndustryMonthlyChartProps {
  data: IndustryMonthlyData
  height?: number
}

const formatAxisShekel = (v: number): string => {
  if (v >= 1000) return `₪${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`
  return `₪${v}`
}

interface TooltipPayload {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
  // Bar fills are gradients, so payload colors arrive as url(#...) which is not
  // a usable CSS color - resolve the series color by name instead.
  colorOf?: (name: string) => string
  // Legend series order, so tooltip rows read the same way as the legend.
  seriesOrder?: string[]
}

export function CustomTooltip({ active, payload, label, colorOf, seriesOrder }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  const rows = seriesOrder
    ? [...payload].sort((a, b) => seriesOrder.indexOf(a.name) - seriesOrder.indexOf(b.name))
    : [...payload].reverse()
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        boxShadow: 'var(--shadow-lg)',
        direction: 'rtl',
        fontFamily: 'var(--font-family)',
        minWidth: '180px',
      }}
    >
      <p style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>
        {label}
      </p>
      {rows.map((entry) => (
        entry.value > 0 && (
          <p key={entry.name} style={{ margin: '2px 0', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ color: colorOf ? colorOf(entry.name) : entry.color }}>● {entry.name}</span>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              ₪{Math.round(entry.value).toLocaleString('he-IL')}
            </span>
          </p>
        )
      ))}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: '6px', paddingTop: '6px' }}>
        <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)' }}>סה&quot;כ</span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            ₪{Math.round(total).toLocaleString('he-IL')}
          </span>
        </p>
      </div>
    </div>
  )
}

const IndustryMonthlyChart: React.FC<IndustryMonthlyChartProps> = React.memo(function IndustryMonthlyChart({
  data,
  height = 320,
}) {
  const isCompact = useMediaQuery('(max-width: 640px)')
  const categoryColor = useCategoryColor()

  if (!data.months.length || !data.series.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        אין נתונים להצגה
      </div>
    )
  }

  // Sort ascending by month ONCE, matching the oldest-first LTR month strips
  // (backend order is not guaranteed). Both the mobile list and the desktop
  // chart read from this, so series values keep their month mapping.
  const order = data.months
    .map((month, idx) => ({ month, idx, key: monthKeyNum(month) }))
    .sort((a, b) => (a.key ?? 0) - (b.key ?? 0))
  const sortedMonths = order.map((o) => o.month)
  const sortedSeries = data.series.map((series) => ({
    ...series,
    data: order.map((o) => series.data[o.idx] ?? 0),
  }))

  // Build recharts data: [{month: "01/2024", "מזון": 1500, "תחבורה": 800, ...}, ...]
  const chartData = sortedMonths.map((month, idx) => {
    const entry: Record<string, string | number> = { month }
    for (const series of sortedSeries) {
      entry[series.name] = series.data[idx] ?? 0
    }
    return entry
  })

  const needsRotation = sortedMonths.length > 6
  // Rotated labels use the short MM/YY form so they stay readable.
  const formatMonthTick = (month: string): string =>
    needsRotation ? month.replace(/^(\d{2})\/\d{2}(\d{2})$/, '$1/$2') : month

  if (isCompact) {
    const monthTotals = sortedMonths.map((month, idx) => {
      const values = sortedSeries
        .map((series) => ({ name: series.name, value: series.data[idx] ?? 0 }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value)
      const total = values.reduce((sum, item) => sum + item.value, 0)
      return { month, total, values: values.slice(0, 3) }
    })
    const maxTotal = Math.max(...monthTotals.map((item) => item.total), 1)

    return (
      <div className="mobile-chart-list">
        {monthTotals.map((item) => (
          <div key={item.month} className="mobile-chart-row">
            <div className="mobile-chart-row-header">
              <span className="mobile-chart-row-title">{item.month}</span>
              <span className="mobile-chart-row-value">₪{Math.round(item.total).toLocaleString('he-IL')}</span>
            </div>
            <div className="mobile-chart-bar-track">
              <div
                className="mobile-chart-bar-fill"
                style={{ width: `${Math.max((item.total / maxTotal) * 100, 4)}%` }}
              />
            </div>
            <div className="mobile-chart-tags">
              {item.values.map((entry) => (
                <span key={entry.name} className="mobile-chart-tag">
                  {entry.name}: ₪{Math.round(entry.value).toLocaleString('he-IL')}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        accessibilityLayer={false}
        data={chartData}
        margin={{ top: 8, right: 8, left: 4, bottom: 8 }}
      >
        <defs>
          {sortedSeries.map((s, i) => (
            <linearGradient key={s.name} id={`industGrad${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={categoryColor(s.name)} stopOpacity={0.95} />
              <stop offset="100%" stopColor={categoryColor(s.name)} stopOpacity={0.65} />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />

        {/* oldest-first left-to-right, matching the LTR month strips above the chart */}
        <XAxis
          dataKey="month"
          padding={{ right: 28 }}
          tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-family)' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          angle={needsRotation ? -40 : 0}
          textAnchor={needsRotation ? 'end' : 'middle'}
          tickMargin={needsRotation ? 14 : 8}
          height={needsRotation ? 52 : 36}
          interval={needsRotation ? 'preserveStartEnd' : 0}
          minTickGap={needsRotation ? 10 : 0}
          tickFormatter={formatMonthTick}
        />

        <YAxis
          tickFormatter={formatAxisShekel}
          tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-family)' }}
          tickLine={false}
          axisLine={false}
          width={58}
          orientation="right"
        />

        <Tooltip content={<CustomTooltip colorOf={categoryColor} seriesOrder={sortedSeries.map((s) => s.name)} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

        <Legend
          wrapperStyle={{ fontSize: '0.8rem', fontFamily: 'var(--font-family)', paddingTop: '8px' }}
          iconSize={10}
          iconType="circle"
        />

        {sortedSeries.map((s, i) => (
          <Bar
            key={s.name}
            dataKey={s.name}
            stackId="a"
            fill={`url(#industGrad${i})`}
            radius={i === sortedSeries.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={52}
            animationDuration={0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
})

export default IndustryMonthlyChart
