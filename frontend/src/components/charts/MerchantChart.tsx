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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MerchantChartProps {
  data: { name: string; total: number; count: number; average: number }[]
  height?: number
}

interface PayloadEntry {
  name: string
  value: number
  payload: { name: string; total: number; count: number; average: number }
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

const GRADIENT_ID = 'merchantGradientFill'

function MerchantGradient() {
  return (
    <defs>
      <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.85} />
        <stop offset="100%" stopColor="#a78bfa" stopOpacity={1} />
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
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload

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
        minWidth: 160,
      }}
    >
      <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)' }}>
        {item.name}
      </p>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
          {"סה\"כ: "}{formatShekel(item.total)}
        </span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
          {'ביקורים: '}{item.count}
        </span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
          {'ממוצע לביקור: '}{formatShekel(item.average)}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Custom Y-axis tick for merchant names (truncated)                  */
/* ------------------------------------------------------------------ */

interface CustomTickProps {
  x: number
  y: number
  payload: { value: string }
}

function MerchantTick({ x, y, payload }: CustomTickProps) {
  const label = payload.value.length > 18 ? payload.value.slice(0, 17) + '...' : payload.value
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill="var(--text-secondary)"
      fontSize={12}
      fontFamily="var(--font-family)"
    >
      {label}
    </text>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const MerchantChart: React.FC<MerchantChartProps> = React.memo(function MerchantChart({
  data,
  height,
}) {
  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        אין נתונים להצגה
      </div>
    )
  }

  // Dynamic height: at least 200px, ~36px per merchant
  const computedHeight = height ?? Math.max(200, data.length * 36 + 40)

  return (
    <ResponsiveContainer width="100%" height={computedHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 8, left: 4, bottom: 8 }}
      >
        <MerchantGradient />

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          horizontal={false}
        />

        <YAxis
          dataKey="name"
          type="category"
          tick={MerchantTick as never}
          tickLine={false}
          axisLine={false}
          width={120}
          orientation="right"
          interval={0}
        />

        <XAxis
          type="number"
          tickFormatter={formatAxisShekel}
          tick={{
            fill: 'var(--text-secondary)',
            fontSize: 12,
            fontFamily: 'var(--font-family)',
          }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
        />

        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: 'var(--accent-muted)' }}
        />

        <Bar
          dataKey="total"
          fill={`url(#${GRADIENT_ID})`}
          radius={[0, 4, 4, 0]}
          maxBarSize={28}
          animationDuration={0}
        />
      </BarChart>
    </ResponsiveContainer>
  )
})

export default MerchantChart
