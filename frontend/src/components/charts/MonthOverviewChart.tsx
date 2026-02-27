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
import type { MonthOverviewCategory } from '../../services/types'

interface MonthOverviewChartProps {
  categories: MonthOverviewCategory[]
  height?: number
}

const formatShekel = (v: number): string =>
  `₪${Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

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
        minWidth: '160px',
      }}
    >
      <p style={{ color: 'var(--text-primary)', margin: '0 0 6px', fontWeight: 600, fontSize: '0.875rem' }}>
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ margin: '2px 0', fontSize: '0.8125rem', color: entry.color, fontWeight: 500 }}>
          {entry.name === 'expenses' ? 'הוצאות' : 'הכנסות'}: {formatShekel(entry.value)}
        </p>
      ))}
    </div>
  )
}

const EXPENSE_COLOR = '#f87171'
const INCOME_COLOR = '#34d399'

const MonthOverviewChart: React.FC<MonthOverviewChartProps> = React.memo(function MonthOverviewChart({
  categories,
  height = 300,
}) {
  if (!categories.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        אין נתונים להצגה
      </div>
    )
  }

  // Filter out categories with zero for both income and expenses
  const data = categories
    .filter((c) => c.expenses > 0 || c.income > 0)
    .slice(0, 10) // show top 10 categories
    .map((c) => ({
      name: c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
      fullName: c.name,
      expenses: c.expenses,
      income: c.income,
    }))

  const hasIncome = data.some((d) => d.income > 0)
  const needsRotation = data.length > 5

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 4, bottom: needsRotation ? 48 : 8 }}
      >
        <defs>
          <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity={1} />
            <stop offset="100%" stopColor={EXPENSE_COLOR} stopOpacity={0.85} />
          </linearGradient>
          <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6ee7b7" stopOpacity={1} />
            <stop offset="100%" stopColor={INCOME_COLOR} stopOpacity={0.85} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />

        <XAxis
          dataKey="name"
          tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-family)' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          angle={needsRotation ? -35 : 0}
          textAnchor={needsRotation ? 'end' : 'middle'}
          height={needsRotation ? 60 : 30}
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

        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent-muted)' }} />

        <Legend
          formatter={(value) => (value === 'expenses' ? 'הוצאות' : 'הכנסות')}
          wrapperStyle={{ fontSize: '0.8125rem', fontFamily: 'var(--font-family)', paddingTop: '8px' }}
        />

        <Bar dataKey="expenses" name="expenses" fill="url(#expGrad)" radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={0} />
        {hasIncome && (
          <Bar dataKey="income" name="income" fill="url(#incGrad)" radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={0} />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
})

export default MonthOverviewChart
