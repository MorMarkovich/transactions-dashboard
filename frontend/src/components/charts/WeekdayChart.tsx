import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import useMediaQuery from '../../hooks/useMediaQuery'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WeekdayChartProps {
  data: { day: string; amount: number }[]
  height?: number
}

interface PayloadEntry {
  name: string
  value: number
  payload: { day: string; amount: number }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatShekel = (v: number): string =>
  `₪${Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const formatAxisShekel = (v: number): string => {
  if (v >= 1000) return `₪${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`
  return `₪${v}`
}

/* ------------------------------------------------------------------ */
/*  Gradient                                                           */
/* ------------------------------------------------------------------ */

const GRADIENT_ID = 'weekdayGradientFill'

function WeekdayGradient() {
  return (
    <defs>
      <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a78bfa" stopOpacity={1} />
        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.85} />
      </linearGradient>
    </defs>
  )
}

/* ------------------------------------------------------------------ */
/*  Custom tooltip                                                     */
/* ------------------------------------------------------------------ */

interface TooltipContentProps {
  active?: boolean
  payload?: PayloadEntry[]
  label?: string
}

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null

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
      }}
    >
      <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)' }}>
        {label}
      </p>
      <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 'var(--text-sm)' }}>
        {formatShekel(payload[0].value)}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const WeekdayChart: React.FC<WeekdayChartProps> = React.memo(function WeekdayChart({
  data,
  height = 230,
}) {
  const isCompact = useMediaQuery('(max-width: 640px)')

  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        אין נתונים להצגה
      </div>
    )
  }
  const chartHeight = isCompact ? Math.max(210, Math.min(height, 240)) : height

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        margin={{
          top: 8,
          right: isCompact ? 0 : 8,
          left: isCompact ? 0 : 4,
          bottom: 8,
        }}
      >
        <WeekdayGradient />

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />

        <XAxis
          dataKey="day"
          tick={{
            fill: 'var(--text-secondary)',
            fontSize: isCompact ? 10 : 13,
            fontFamily: 'var(--font-family)',
          }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          interval={0}
        />

        <YAxis
          tickFormatter={formatAxisShekel}
          tick={{
            fill: 'var(--text-secondary)',
            fontSize: isCompact ? 10 : 12,
            fontFamily: 'var(--font-family)',
          }}
          tickLine={false}
          axisLine={false}
          width={isCompact ? 44 : 56}
          orientation="right"
        />

        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: 'var(--accent-muted)' }}
        />

        <Bar
          dataKey="amount"
          fill={`url(#${GRADIENT_ID})`}
          radius={[4, 4, 0, 0]}
          maxBarSize={isCompact ? 30 : 44}
          animationDuration={0}
        />
      </BarChart>
    </ResponsiveContainer>
  )
})

export default WeekdayChart
