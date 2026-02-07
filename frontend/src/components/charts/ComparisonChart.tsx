import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ComparisonChartProps {
  income: number
  expenses: number
  savings: number
  height?: number
}

interface PayloadEntry {
  name: string
  value: number
  payload: { name: string; value: number; color: string }
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COLORS: Record<string, string> = {
  income: '#34d399',   // green
  expenses: '#f87171', // red
  savings: '#818cf8',  // accent / blue-purple
}

const LABELS: Record<string, string> = {
  income: 'הכנסות',
  expenses: 'הוצאות',
  savings: 'חיסכון',
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

/* ------------------------------------------------------------------ */
/*  Gradients                                                          */
/* ------------------------------------------------------------------ */

function ComparisonGradients() {
  return (
    <defs>
      <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6ee7b7" stopOpacity={1} />
        <stop offset="100%" stopColor="#34d399" stopOpacity={0.85} />
      </linearGradient>
      <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fca5a5" stopOpacity={1} />
        <stop offset="100%" stopColor="#f87171" stopOpacity={0.85} />
      </linearGradient>
      <linearGradient id="gradSavings" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a78bfa" stopOpacity={1} />
        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.85} />
      </linearGradient>
    </defs>
  )
}

const GRADIENT_MAP: Record<string, string> = {
  income: 'url(#gradIncome)',
  expenses: 'url(#gradExpenses)',
  savings: 'url(#gradSavings)',
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
  const entry = payload[0]
  const key = entry.payload?.name ?? ''
  const label = LABELS[key] ?? key
  const color = COLORS[key] ?? 'var(--text-primary)'

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
      <p style={{ color, margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)' }}>
        {label}
      </p>
      <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 'var(--text-sm)' }}>
        {formatShekel(entry.value)}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const ComparisonChart: React.FC<ComparisonChartProps> = React.memo(function ComparisonChart({
  income,
  expenses,
  savings,
  height = 260,
}) {
  const chartData = useMemo(
    () => [
      { name: 'income', value: income, color: COLORS.income },
      { name: 'expenses', value: expenses, color: COLORS.expenses },
      { name: 'savings', value: savings, color: COLORS.savings },
    ],
    [income, expenses, savings],
  )

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 8, left: 4, bottom: 8 }}
      >
        <ComparisonGradients />

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />

        <XAxis
          dataKey="name"
          tickFormatter={(key: string) => LABELS[key] ?? key}
          tick={{
            fill: 'var(--text-secondary)',
            fontSize: 13,
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
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
          animationDuration={0}
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={GRADIENT_MAP[entry.name] ?? entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})

export default ComparisonChart
