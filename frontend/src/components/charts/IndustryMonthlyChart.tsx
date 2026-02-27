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

interface IndustryMonthlyChartProps {
  data: IndustryMonthlyData
  height?: number
}

const COLORS = [
  '#818cf8',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#38bdf8',
  '#fb923c',
  '#e879f9',
]

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
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
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
      {[...payload].reverse().map((entry) => (
        entry.value > 0 && (
          <p key={entry.name} style={{ margin: '2px 0', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ color: entry.color }}>● {entry.name}</span>
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
  if (!data.months.length || !data.series.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        אין נתונים להצגה
      </div>
    )
  }

  // Build recharts data: [{month: "01/2024", "מזון": 1500, "תחבורה": 800, ...}, ...]
  const chartData = data.months.map((month, idx) => {
    const entry: Record<string, string | number> = { month }
    for (const series of data.series) {
      entry[series.name] = series.data[idx] ?? 0
    }
    return entry
  })

  const needsRotation = data.months.length > 6

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 8, left: 4, bottom: needsRotation ? 44 : 8 }}
      >
        <defs>
          {data.series.map((s, i) => (
            <linearGradient key={s.name} id={`industGrad${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.95} />
              <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.65} />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />

        <XAxis
          dataKey="month"
          tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-family)' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          angle={needsRotation ? -40 : 0}
          textAnchor={needsRotation ? 'end' : 'middle'}
          height={needsRotation ? 55 : 30}
          interval={0}
        />

        <YAxis
          tickFormatter={formatAxisShekel}
          tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-family)' }}
          tickLine={false}
          axisLine={false}
          width={58}
          orientation="right"
        />

        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

        <Legend
          wrapperStyle={{ fontSize: '0.8rem', fontFamily: 'var(--font-family)', paddingTop: '8px' }}
          iconSize={10}
          iconType="circle"
        />

        {data.series.map((s, i) => (
          <Bar
            key={s.name}
            dataKey={s.name}
            stackId="a"
            fill={`url(#industGrad${i})`}
            radius={i === data.series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={52}
            animationDuration={0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
})

export default IndustryMonthlyChart
