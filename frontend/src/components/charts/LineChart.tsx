import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LineChartProps {
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
  `${v < 0 ? '-' : ''}₪${Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const formatAxisShekel = (v: number): string => {
  if (Math.abs(v) >= 1000) return `₪${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`
  return `₪${v}`
}

/** Format a date label to DD/MM/YYYY for Hebrew locale display. */
const formatDateLabel = (label: string): string => {
  // Handle ISO dates like "2025-09-20"
  if (/^\d{4}-\d{2}-\d{2}/.test(label)) {
    const [y, m, d] = label.split('-')
    return `${d}/${m}/${y}`
  }
  return label
}

/* ------------------------------------------------------------------ */
/*  Gradient definition                                                */
/* ------------------------------------------------------------------ */

const GRADIENT_ID = 'areaGradientFill'

function AreaGradient({ color }: { color: string }) {
  return (
    <defs>
      <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.35} />
        <stop offset="95%" stopColor={color} stopOpacity={0.02} />
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
        {label ? formatDateLabel(label) : label}
      </p>
      <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 'var(--text-sm)' }}>
        {formatShekel(payload[0].value)}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Custom active dot (shown on hover)                                 */
/* ------------------------------------------------------------------ */

interface ActiveDotProps {
  cx: number
  cy: number
  stroke: string
}

function ActiveDot({ cx, cy, stroke }: ActiveDotProps) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill={stroke} fillOpacity={0.2} stroke="none" />
      <circle cx={cx} cy={cy} r={3.5} fill={stroke} stroke="var(--bg-card)" strokeWidth={2} />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const LineChart: React.FC<LineChartProps> = React.memo(function LineChart({
  data,
  height = 300,
  color = '#818cf8',
}) {
  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        אין נתונים להצגה
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 8, left: 4, bottom: 8 }}
      >
        <AreaGradient color={color} />

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />

        <XAxis
          dataKey="label"
          tickFormatter={formatDateLabel}
          tick={{
            fill: 'var(--text-secondary)',
            fontSize: 12,
            fontFamily: 'var(--font-family)',
          }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          interval="preserveStartEnd"
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
          cursor={{ stroke: 'var(--border-hover)', strokeDasharray: '4 4' }}
        />

        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${GRADIENT_ID})`}
          dot={false}
          activeDot={<ActiveDot cx={0} cy={0} stroke={color} />}
          animationDuration={0}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
})

export default LineChart
