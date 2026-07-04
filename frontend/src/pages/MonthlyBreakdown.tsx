import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CalendarRange,
  CreditCard,
  Layers,
  PieChart,
  BarChart3,
} from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import EmptyState from '../components/common/EmptyState'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import DonutChart from '../components/charts/DonutChart'
import BarChart from '../components/charts/BarChart'
import IndustryMonthlyChart from '../components/charts/IndustryMonthlyChart'
import CategoryMonthlyComparison from '../components/charts/CategoryMonthlyComparison'
import { get_icon } from '../utils/constants'
import { formatCurrency } from '../utils/formatting'
import { transactionsApi } from '../services/api'
import type {
  IndustryMonthlyData,
  CategoryMonthlyComparisonData,
} from '../services/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format MM/YYYY → Hebrew-friendly label, e.g. "01/2024" → "ינואר 2024" */
const HEBREW_MONTHS: Record<string, string> = {
  '01': 'ינואר', '02': 'פברואר', '03': 'מרץ', '04': 'אפריל',
  '05': 'מאי', '06': 'יוני', '07': 'יולי', '08': 'אוגוסט',
  '09': 'ספטמבר', '10': 'אוקטובר', '11': 'נובמבר', '12': 'דצמבר',
}
function formatMonthLabel(mmYYYY: string): string {
  const [mm, yyyy] = mmYYYY.split('/')
  return `${HEBREW_MONTHS[mm] ?? mm} ${yyyy}`
}

// Same palette as DonutChart so the legend dots match the pie slices.
const PIE_COLORS = [
  '#818cf8', '#34d399', '#f87171', '#fbbf24', '#38bdf8',
  '#a78bfa', '#f6ad55', '#68d391', '#fc8181', '#63b3ed', '#94a3b8',
]

// Cap pie slices so it stays readable; the rest are grouped into "אחר".
const MAX_PIE_SLICES = 10

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MonthlyBreakdown() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  // ── Data state ────────────────────────────────────────────────────
  const [comparison, setComparison] = useState<CategoryMonthlyComparisonData | null>(null)
  const [industryMonthly, setIndustryMonthly] = useState<IndustryMonthlyData | null>(null)
  const [hasBillingDate, setHasBillingDate] = useState(false)
  const [owners, setOwners] = useState<string[]>([])

  // ── UI state ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateType, setDateType] = useState<'transaction' | 'billing'>('billing')
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null)
  // Month subset for the stacked comparison chart
  const [selectedComparisonMonths, setSelectedComparisonMonths] = useState<Set<string>>(new Set())
  // Month whose category pie is shown
  const [pieMonth, setPieMonth] = useState<string | null>(null)
  // Category whose per-month bars are shown
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // ── Load the list of people (owners) for the per-person filter ──
  useEffect(() => {
    if (!sessionId) { setOwners([]); return }
    const controller = new AbortController()
    transactionsApi.getOwners(sessionId, controller.signal)
      .then(setOwners)
      .catch(() => setOwners([]))
    return () => controller.abort()
  }, [sessionId])

  // ── Fetch all data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    const { signal } = controller

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const sid = await transactionsApi.scopeSession(sessionId, selectedOwner, signal)
        const [metrics, comparisonData, industryData] = await Promise.all([
          transactionsApi.getMetrics(sid, signal),
          transactionsApi.getCategoryMonthlyComparison(sid, dateType, signal),
          transactionsApi.getIndustryMonthly(sid, dateType, signal).catch(() => null),
        ])
        setHasBillingDate(metrics.has_billing_date ?? false)
        setComparison(comparisonData)
        if (industryData) setIndustryMonthly(industryData)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'CanceledError') return
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת הנתונים')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    return () => controller.abort()
  }, [sessionId, dateType, selectedOwner])

  // Sync month/category defaults when comparison data (re)loads
  useEffect(() => {
    if (!comparison) return
    if (comparison.months.length) {
      setPieMonth((prev) =>
        prev && comparison.months.includes(prev)
          ? prev
          : comparison.months[comparison.months.length - 1])
    }
    if (comparison.categories.length) {
      setSelectedCategory((prev) =>
        prev && comparison.categories.some((c) => c.name === prev)
          ? prev
          : comparison.categories[0].name)
    }
  }, [comparison])

  // Sync stacked-chart month selection when industry data loads
  useEffect(() => {
    if (industryMonthly?.months.length) {
      setSelectedComparisonMonths(new Set(industryMonthly.months))
    }
  }, [industryMonthly])

  const filteredIndustryMonthly = useMemo<IndustryMonthlyData | null>(() => {
    if (!industryMonthly) return null
    if (!selectedComparisonMonths.size || selectedComparisonMonths.size === industryMonthly.months.length) {
      return industryMonthly
    }
    const monthIndices = industryMonthly.months
      .map((m, i) => (selectedComparisonMonths.has(m) ? i : -1))
      .filter((i): i is number => i >= 0)
    return {
      months: monthIndices.map(i => industryMonthly.months[i]),
      series: industryMonthly.series.map(s => ({
        ...s,
        data: monthIndices.map(i => s.data[i]),
      })),
    }
  }, [industryMonthly, selectedComparisonMonths])

  // ── Pie: category breakdown of the selected month ──────────────────
  const pieData = useMemo(() => {
    if (!comparison || !pieMonth) return { slices: [] as { name: string; value: number; pct: number }[], total: 0 }
    const total = comparison.month_totals[pieMonth] ?? 0
    const items = comparison.categories
      .map((cat) => {
        const cell = cat.months[pieMonth]
        return { name: cat.name, value: cell?.amount ?? 0, pct: cell?.pct_of_month ?? 0 }
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
    if (items.length <= MAX_PIE_SLICES) return { slices: items, total }
    const top = items.slice(0, MAX_PIE_SLICES - 1)
    const rest = items.slice(MAX_PIE_SLICES - 1)
    const restValue = rest.reduce((s, item) => s + item.value, 0)
    top.push({
      name: 'אחר',
      value: restValue,
      pct: total > 0 ? (restValue / total) * 100 : 0,
    })
    return { slices: top, total }
  }, [comparison, pieMonth])

  // ── Bars: the selected category's spend in every month ─────────────
  const categoryRow = useMemo(
    () => comparison?.categories.find((c) => c.name === selectedCategory) ?? null,
    [comparison, selectedCategory],
  )

  const categoryBars = useMemo(() => {
    if (!comparison || !categoryRow) return []
    return comparison.months.map((m) => ({
      label: m,
      value: categoryRow.months[m]?.amount ?? 0,
    }))
  }, [comparison, categoryRow])

  const categoryStats = useMemo(() => {
    if (!categoryRow || !categoryBars.length) return null
    const activeMonths = categoryBars.filter((b) => b.value > 0)
    const peak = categoryBars.reduce((best, b) => (b.value > best.value ? b : best), categoryBars[0])
    return {
      total: categoryRow.total,
      monthlyAvg: activeMonths.length ? categoryRow.total / activeMonths.length : 0,
      peakMonth: peak.value > 0 ? peak : null,
      pctOfGrand: categoryRow.pct_of_grand,
    }
  }, [categoryRow, categoryBars])

  // ── No session ────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <EmptyState
        icon="📅"
        title="אין נתונים להצגה"
        text="חזרו לדשבורד וטענו את העסקאות — ואז הפילוח החודשי יופיע כאן."
      />
    )
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (loading && !comparison) {
    return (
      <div>
        <Skeleton variant="rectangular" height={60} />
        <div style={{ marginTop: 'var(--space-lg)' }}><Skeleton variant="rectangular" height={320} /></div>
        <div style={{ marginTop: 'var(--space-lg)' }}><Skeleton variant="rectangular" height={340} /></div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────
  if (error && !comparison) {
    return (
      <EmptyState icon="⚠️" title="שגיאה בטעינת הנתונים" text={error} />
    )
  }

  if (!comparison || !comparison.months.length || !comparison.categories.length) {
    return (
      <EmptyState
        icon="📅"
        title="אין הוצאות לפילוח"
        text="ברגע שייטענו עסקאות עם הוצאות, הפילוח החודשי יופיע כאן."
      />
    )
  }

  const monthChip = (m: string, active: boolean, onClick: () => void) => (
    <button
      key={m}
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 'var(--radius-full)',
        border: '1px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        background: active ? 'var(--accent-muted)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        fontSize: '0.75rem',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        transition: 'all 0.15s',
      }}
    >
      {m}
    </button>
  )

  return (
    <div style={{ direction: 'rtl', position: 'relative' }}>
      <PageHeader
        title="פילוח חודשי"
        subtitle="ניתוח ההוצאות שלך חודש-אחר-חודש, לפי קטגוריה"
        icon={CalendarRange}
      />

      {/* ── Per-person filter ──────────────────────────────────────── */}
      {owners.filter((o) => o !== 'משותף').length > 1 && (
        <div className="filter-chips" style={{ marginBottom: 'var(--space-md)', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginInlineEnd: '4px' }}>תצוגה לפי:</span>
          <span
            className={`filter-chip ${!selectedOwner ? 'active' : ''}`}
            onClick={() => setSelectedOwner(null)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedOwner(null) }}
          >
            הכל
          </span>
          {owners.filter((o) => o !== 'משותף').map((o) => (
            <span
              key={o}
              className={`filter-chip ${selectedOwner === o ? 'active' : ''}`}
              onClick={() => setSelectedOwner(o)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedOwner(o) }}
            >
              {o}
            </span>
          ))}
        </div>
      )}

      {/* ── Date type toggle (billing / transaction) ───────────────── */}
      {hasBillingDate && (
        <div style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <CreditCard size={15} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>קיבוץ לפי:</span>
          <div style={{ display: 'flex', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {(['transaction', 'billing'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setDateType(type)}
                style={{
                  padding: '5px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-family)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: dateType === type ? 'var(--accent)' : 'transparent',
                  color: dateType === type ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {type === 'transaction' ? 'תאריך עסקה' : 'תאריך חיוב'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Pie: category breakdown for a chosen month ─────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ marginTop: 'var(--space-lg)' }}
      >
        <div className="section-header-v2">
          <PieChart size={18} />
          <span>עוגת קטגוריות לפי חודש</span>
          {pieMonth && (
            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)', color: 'var(--accent)', fontWeight: 600 }}>
              {formatMonthLabel(pieMonth)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-sm)' }}>
          {comparison.months.map((m) => monthChip(m, m === pieMonth, () => setPieMonth(m)))}
        </div>
        <Card className="glass-card" padding="md">
          <div
            className="monthly-pie-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
              gap: 'var(--space-lg)',
              alignItems: 'center',
            }}
          >
            <DonutChart data={pieData.slices} total={pieData.total} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pieData.slices.map((slice, i) => (
                <div
                  key={slice.name}
                  onClick={slice.name === 'אחר' ? undefined : () => setSelectedCategory(slice.name)}
                  title={slice.name === 'אחר' ? undefined : 'הצגת הקטגוריה לאורך זמן'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: slice.name === 'אחר' ? 'default' : 'pointer',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: selectedCategory === slice.name ? 'var(--accent-muted)' : 'transparent',
                  }}
                >
                  <span className="category-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {get_icon(slice.name)} {slice.name}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {slice.pct.toFixed(1)}%
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', direction: 'ltr', flexShrink: 0 }}>
                    {formatCurrency(slice.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ── Selected category across months (bar chart) ────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35 }}
        style={{ marginTop: 'var(--space-lg)' }}
      >
        <div className="section-header-v2">
          <BarChart3 size={18} />
          <span>קטגוריה לאורך זמן</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            בחרו קטגוריה כדי לראות את ההוצאות שלה בכל חודש
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: 'var(--space-sm)' }}>
          {comparison.categories.map((cat) => {
            const active = cat.name === selectedCategory
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid',
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                  background: active ? 'var(--accent-muted)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: '0.6875rem',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                  transition: 'all 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ fontSize: '0.8rem' }}>{get_icon(cat.name)}</span>
                {cat.name}
              </button>
            )
          })}
        </div>
        {categoryRow && (
          <Card className="glass-card" padding="md">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>{get_icon(categoryRow.name)}</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{categoryRow.name}</span>
              </div>
              {categoryStats && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>
                    סה״כ: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>{formatCurrency(categoryStats.total)}</strong>
                    {' '}({categoryStats.pctOfGrand.toFixed(1)}% מכלל ההוצאות)
                  </span>
                  <span>
                    ממוצע חודשי: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>{formatCurrency(categoryStats.monthlyAvg)}</strong>
                  </span>
                  {categoryStats.peakMonth && (
                    <span>
                      חודש שיא: <strong style={{ color: 'var(--text-primary)' }}>{categoryStats.peakMonth.label}</strong>
                      {' '}(<span style={{ fontFamily: 'var(--font-mono)', direction: 'ltr', display: 'inline-block' }}>{formatCurrency(categoryStats.peakMonth.value)}</span>)
                    </span>
                  )}
                </div>
              )}
            </div>
            <BarChart data={categoryBars} height={280} reversed />
          </Card>
        )}
      </motion.div>

      {/* ── Month-by-month comparison table ────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
        style={{ marginTop: 'var(--space-lg)' }}
      >
        <div className="section-header-v2">
          <CalendarRange size={18} />
          <span>השוואת חודשים לפי קטגוריה</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            ולכמה אחוז מההוצאות החודשיות
          </span>
        </div>
        <Card className="glass-card" padding="md">
          <CategoryMonthlyComparison
            data={comparison}
            dateType={dateType}
            hasBillingDate={hasBillingDate}
            onCategoryClick={setSelectedCategory}
          />
        </Card>
      </motion.div>

      {/* ── Stacked bars: all categories per month ─────────────────── */}
      {industryMonthly && industryMonthly.months.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          style={{ marginTop: 'var(--space-lg)' }}
        >
          <div className="section-header-v2">
            <Layers size={18} />
            <span>השוואת הוצאות לפי קטגוריה</span>
            {hasBillingDate && (
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)', color: 'var(--accent)', fontWeight: 600 }}>
                {dateType === 'billing' ? 'תאריך חיוב' : 'תאריך עסקה'}
              </span>
            )}
          </div>
          {/* Month selector pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-sm)' }}>
            {industryMonthly.months.map((m) =>
              monthChip(m, selectedComparisonMonths.has(m), () => setSelectedComparisonMonths(prev => {
                const next = new Set(prev)
                if (next.has(m)) {
                  if (next.size > 1) next.delete(m)
                } else {
                  next.add(m)
                }
                return next
              })))}
          </div>
          <Card className="glass-card" padding="md">
            <IndustryMonthlyChart data={filteredIndustryMonthly!} height={320} />
          </Card>
        </motion.div>
      )}
    </div>
  )
}
