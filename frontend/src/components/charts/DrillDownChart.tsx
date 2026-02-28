import React, { useState, useCallback, useEffect } from 'react'
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
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Calendar, RotateCcw } from 'lucide-react'
import { formatCurrency, formatDate } from '../../utils/formatting'
import { transactionsApi } from '../../services/api'
import type { CategoryMerchantItem, Transaction } from '../../services/types'

// ─── Types ──────────────────────────────────────────────────────────────

type DrillLevel = 'categories' | 'merchants' | 'transactions'

interface CategoryBar {
  name: string
  fullName: string
  value: number
  count: number
}

interface DrillDownChartProps {
  /** Category data from the month overview endpoint */
  categories: { name: string; expenses: number }[]
  /** Currently selected month (MM/YYYY) */
  month: string
  /** Session ID */
  sessionId: string
  /** Chart height */
  height?: number
  /** Date type (transaction or billing) */
  dateType?: string
}

// ─── Constants ──────────────────────────────────────────────────────────

const BAR_COLORS = [
  '#818cf8', '#f87171', '#34d399', '#fbbf24', '#38bdf8',
  '#a78bfa', '#fb923c', '#f472b6', '#2dd4bf', '#94a3b8',
]

const formatAxisShekel = (v: number): string => {
  if (v >= 1000) return `₪${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`
  return `₪${v}`
}

// ─── Custom tooltip ─────────────────────────────────────────────────────

function DrillTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 12px',
        boxShadow: 'var(--shadow-lg)',
        direction: 'rtl',
        fontFamily: 'var(--font-family)',
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 500, fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'right' }}>
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────

const DrillDownChart: React.FC<DrillDownChartProps> = React.memo(function DrillDownChart({
  categories,
  month,
  sessionId,
  height = 300,
  dateType,
}) {
  const [level, setLevel] = useState<DrillLevel>('categories')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null)
  const [merchantData, setMerchantData] = useState<CategoryMerchantItem[]>([])
  const [transactionData, setTransactionData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)

  // Reset when month or categories change
  useEffect(() => {
    setLevel('categories')
    setSelectedCategory(null)
    setSelectedMerchant(null)
  }, [month, categories])

  const handleCategoryClick = useCallback(async (categoryName: string) => {
    setLoading(true)
    setSelectedCategory(categoryName)
    try {
      const data = await transactionsApi.getCategoryMerchants(sessionId, month, categoryName, dateType)
      setMerchantData(data.merchants)
      setLevel('merchants')
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [sessionId, month, dateType])

  const handleMerchantClick = useCallback(async (merchantName: string) => {
    if (!selectedCategory) return
    setLoading(true)
    setSelectedMerchant(merchantName)
    try {
      const data = await transactionsApi.getMerchantTransactions(sessionId, month, selectedCategory, merchantName, dateType)
      setTransactionData(data.transactions)
      setLevel('transactions')
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [sessionId, month, selectedCategory, dateType])

  const goBack = useCallback(() => {
    if (level === 'transactions') {
      setLevel('merchants')
      setSelectedMerchant(null)
    } else if (level === 'merchants') {
      setLevel('categories')
      setSelectedCategory(null)
    }
  }, [level])

  const resetToTop = useCallback(() => {
    setLevel('categories')
    setSelectedCategory(null)
    setSelectedMerchant(null)
  }, [])

  // ── Build chart data ────────────────────────────────────────────────

  const categoryBars: CategoryBar[] = categories
    .filter((c) => c.expenses > 0)
    .slice(0, 10)
    .map((c) => ({
      name: c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
      fullName: c.name,
      value: c.expenses,
      count: 0,
    }))

  const merchantBars: CategoryBar[] = merchantData.map((m) => ({
    name: m.name.length > 14 ? m.name.slice(0, 14) + '…' : m.name,
    fullName: m.name,
    value: m.total,
    count: m.count,
  }))

  // ── Breadcrumb ──────────────────────────────────────────────────────

  const breadcrumb = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
      <button
        onClick={resetToTop}
        style={{
          background: 'none', border: 'none', cursor: level === 'categories' ? 'default' : 'pointer',
          color: level === 'categories' ? 'var(--text-primary)' : 'var(--accent)', fontWeight: 600,
          fontFamily: 'var(--font-family)', fontSize: '0.75rem', padding: 0,
          textDecoration: level === 'categories' ? 'none' : 'underline',
        }}
      >
        קטגוריות
      </button>

      {selectedCategory && (
        <>
          <ChevronLeft size={12} style={{ color: 'var(--text-muted)' }} />
          <button
            onClick={level === 'merchants' ? undefined : goBack}
            style={{
              background: 'none', border: 'none',
              cursor: level === 'merchants' ? 'default' : 'pointer',
              color: level === 'merchants' ? 'var(--text-primary)' : 'var(--accent)',
              fontWeight: 600, fontFamily: 'var(--font-family)', fontSize: '0.75rem', padding: 0,
              textDecoration: level === 'merchants' ? 'none' : 'underline',
            }}
          >
            {selectedCategory}
          </button>
        </>
      )}

      {selectedMerchant && (
        <>
          <ChevronLeft size={12} style={{ color: 'var(--text-muted)' }} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {selectedMerchant}
          </span>
        </>
      )}

      {level !== 'categories' && (
        <button
          onClick={goBack}
          aria-label="חזור"
          style={{
            background: 'var(--glass-bg)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-full)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, marginRight: '6px', color: 'var(--text-muted)',
          }}
        >
          <RotateCcw size={10} />
        </button>
      )}
    </div>
  )

  // ── Render ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        {breadcrumb}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          טוען...
        </div>
      </div>
    )
  }

  // Transaction list level
  if (level === 'transactions') {
    return (
      <div>
        {breadcrumb}
        <div style={{ maxHeight: height, overflowY: 'auto', marginTop: '8px' }}>
          {transactionData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>אין עסקאות</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {transactionData.map((tx, i) => (
                <motion.div
                  key={`${tx.תאריך}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--glass-bg)',
                    borderRadius: 'var(--radius-md, 8px)',
                    border: '1px solid var(--glass-border)',
                    gap: '8px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.תיאור}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Calendar size={9} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{formatDate(tx.תאריך)}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--danger)', direction: 'ltr', flexShrink: 0 }}>
                    {formatCurrency(tx.סכום)}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Bar chart levels (categories or merchants)
  const bars = level === 'categories' ? categoryBars : merchantBars
  const needsRotation = bars.length > 5

  if (bars.length === 0) {
    return (
      <div>
        {breadcrumb}
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>אין נתונים להצגה</div>
      </div>
    )
  }

  return (
    <div>
      {breadcrumb}
      <div style={{ marginTop: '6px', fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        {level === 'categories' ? 'לחצו על עמודה כדי לפרט לפי בית עסק' : 'לחצו על עמודה כדי לראות עסקאות'}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={level + (selectedCategory ?? '')}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={bars}
              margin={{ top: 8, right: 8, left: 4, bottom: needsRotation ? 48 : 8 }}
              onClick={(state) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const payload = (state as any)?.activePayload as { payload: CategoryBar }[] | undefined
                if (!payload?.length) return
                const clicked = payload[0].payload
                if (level === 'categories') {
                  handleCategoryClick(clicked.fullName)
                } else if (level === 'merchants') {
                  handleMerchantClick(clicked.fullName)
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <defs>
                {bars.map((_, i) => (
                  <linearGradient key={i} id={`drillGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BAR_COLORS[i % BAR_COLORS.length]} stopOpacity={1} />
                    <stop offset="100%" stopColor={BAR_COLORS[i % BAR_COLORS.length]} stopOpacity={0.6} />
                  </linearGradient>
                ))}
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

              <Tooltip content={<DrillTooltip />} cursor={{ fill: 'var(--accent-muted)', opacity: 0.3 }} />

              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40} animationDuration={400}>
                {bars.map((_, i) => (
                  <Cell key={i} fill={`url(#drillGrad${i})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </AnimatePresence>
    </div>
  )
})

export default DrillDownChart
