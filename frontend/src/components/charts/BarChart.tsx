import React from 'react'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BarChartProps {
  data: { label: string; value: number }[]
  height?: number
  color?: string
}

interface PayloadEntry {
  name: string
  value: number
  payload: { label: string; value: number }
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
/*  Gradient definition                                                */
/* ------------------------------------------------------------------ */

const GRADIENT_ID = 'barGradientFill'

function BarGradient({ color }: { color: string }) {
  // Parse a secondary color by shifting hue slightly
  const secondary = color === '#818cf8' ? '#a78bfa' : color
  return (
    <defs>
      <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={secondary} stopOpacity={1} />
        <stop offset="100%" stopColor={color} stopOpacity={0.85} />
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

const BarChart: React.FC<BarChartProps> = React.memo(function BarChart({
  data,
  height = 260,
  color = '#818cf8',
}) {
  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        אין נתונים להצגה
      </div>
    )
  }

  const needsRotation = data.length > 5

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        margin={{ top: 8, right: 8, left: 4, bottom: needsRotation ? 40 : 8 }}
      >
        <BarGradient color={color} />

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />

        <XAxis
          dataKey="label"
          tick={{
            fill: 'var(--text-secondary)',
            fontSize: needsRotation ? 11 : 12,
            fontFamily: 'var(--font-family)',
          }}
          tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 12) + '…' : v}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          angle={needsRotation ? -35 : 0}
          textAnchor={needsRotation ? 'end' : 'middle'}
          height={needsRotation ? 70 : 30}
          interval={0}
        />

        <YAxis
          tickFormatter={formatAxisShekel}
          tick={{
            fill: 'var(--text-secondary)',
            fontSize: 12,
            fontFamily: 'var(--font-family)',
          }}
          tickLine={false}
          axisLine={false}
          width={56}
          orientation="right"
        />

        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: 'var(--accent-muted)' }}
        />

        <Bar
          dataKey="value"
          fill={`url(#${GRADIENT_ID})`}
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
          animationDuration={0}
        />
      </RechartsBarChart>
    </ResponsiveContainer>
  )
})

export default BarChart
