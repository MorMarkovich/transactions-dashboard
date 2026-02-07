import React, { useCallback } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Label,
} from 'recharts'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DonutChartProps {
  data: { name: string; value: number }[]
  total: number
}

interface PayloadEntry {
  name: string
  value: number
  payload: { name: string; value: number }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COLORS = [
  '#818cf8',
  '#34d399',
  '#f87171',
  '#fbbf24',
  '#38bdf8',
  '#a78bfa',
  '#94a3b8',
]

const formatShekel = (v: number): string =>
  `${v < 0 ? '-' : ''}₪${Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

/* ------------------------------------------------------------------ */
/*  Custom tooltip                                                     */
/* ------------------------------------------------------------------ */

interface TooltipProps {
  active?: boolean
  payload?: PayloadEntry[]
  total: number
}

function ChartTooltip({ active, payload, total }: TooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'

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
        {entry.name}
      </p>
      <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 'var(--text-sm)' }}>
        {formatShekel(entry.value)} &middot; {pct}%
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Custom label on slices                                             */
/* ------------------------------------------------------------------ */

interface LabelProps {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  percent: number
}

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: LabelProps) {
  if (percent < 0.04) return null // hide labels for tiny slices
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

/* ------------------------------------------------------------------ */
/*  Center label (total)                                               */
/* ------------------------------------------------------------------ */

interface CenterProps {
  cx: number
  cy: number
  total: number
}

function CenterLabel({ cx, cy, total }: CenterProps) {
  return (
    <g>
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fill: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-family)' }}
      >
        {"סה\"כ"}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fill: 'var(--text-primary)', fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-family)' }}
      >
        {formatShekel(total)}
      </text>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const DonutChart: React.FC<DonutChartProps> = React.memo(function DonutChart({
  data,
  total,
}) {
  const tooltipContent = useCallback(
    (props: { active?: boolean; payload?: PayloadEntry[] }) => (
      <ChartTooltip {...props} total={total} />
    ),
    [total],
  )

  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        אין נתונים להצגה
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="85%"
          paddingAngle={2}
          animationDuration={0}
          label={renderCustomLabel as any}
          labelLine={false}
        >
          {data.map((_entry, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} stroke="none" />
          ))}
          <Label
            content={({ viewBox }) => {
              const { cx, cy } = viewBox as { cx: number; cy: number }
              return <CenterLabel cx={cx} cy={cy} total={total} />
            }}
            position="center"
          />
        </Pie>

        <Tooltip content={tooltipContent as any} />
      </PieChart>
    </ResponsiveContainer>
  )
})

export default DonutChart
