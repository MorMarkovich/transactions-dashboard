import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Calendar,
  BarChart3,
  PieChart,
  CalendarDays,
  RefreshCw,
  TrendingUp,
  Zap,
  Bell,
  LayoutDashboard,
  ChevronRight,
  ChevronLeft,
  CreditCard,
  ArrowUpDown,
  Layers,
} from 'lucide-react'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import SparklineChart from '../components/charts/SparklineChart'
import MetricsGrid from '../components/metrics/MetricsGrid'
import DonutChart from '../components/charts/DonutChart'
import BarChart from '../components/charts/BarChart'
import WeekdayChart from '../components/charts/WeekdayChart'
import CategoryList from '../components/category/CategoryList'
import MonthOverviewChart from '../components/charts/MonthOverviewChart'
import IndustryMonthlyChart from '../components/charts/IndustryMonthlyChart'
import SpendingAlerts from '../components/ui/SpendingAlerts'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import Button from '../components/ui/Button'
import { formatCurrency } from '../utils/formatting'
import { transactionsApi } from '../services/api'
import type {
  MetricsData,
  RawDonutData,
  RawMonthlyData,
  RawWeekdayData,
  CategoryData,
  WeeklySummaryData,
  ForecastData,
  SpendingVelocityData,
  AnomalyItem,
  RecurringTransaction,
  MonthOverviewData,
  IndustryMonthlyData,
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  // ── Data state ────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [donutData, setDonutData] = useState<RawDonutData | null>(null)
  const [monthlyData, setMonthlyData] = useState<RawMonthlyData | null>(null)
  const [weekdayData, setWeekdayData] = useState<RawWeekdayData | null>(null)
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummaryData | null>(null)
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [velocity, setVelocity] = useState<SpendingVelocityData | null>(null)
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([])
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])
  const [monthOverview, setMonthOverview] = useState<MonthOverviewData | null>(null)
  const [industryMonthly, setIndustryMonthly] = useState<IndustryMonthlyData | null>(null)

  // ── UI state ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [dateType, setDateType] = useState<'transaction' | 'billing'>('transaction')
  const [monthOverviewLoading, setMonthOverviewLoading] = useState(false)
  const [selectedComparisonMonths, setSelectedComparisonMonths] = useState<Set<string>>(new Set())

  const handleDismissAlert = useCallback((id: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(id))
  }, [])

  // ── Fetch all data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    const { signal } = controller

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const results = await Promise.all([
          transactionsApi.getMetrics(sessionId, signal),
          transactionsApi.getDonutChartV2(sessionId, signal),
          transactionsApi.getMonthlyChartV2(sessionId, dateType, signal),
          transactionsApi.getWeekdayChartV2(sessionId, signal),
          transactionsApi.getWeeklySummary(sessionId, signal).catch(() => null),
          transactionsApi.getForecast(sessionId, signal).catch(() => null),
          transactionsApi.getSpendingVelocity(sessionId, signal).catch(() => null),
          transactionsApi.getAnomalies(sessionId, signal).catch(() => null),
          transactionsApi.getRecurring(sessionId, signal).catch(() => null),
          transactionsApi.getIndustryMonthly(sessionId, dateType, signal).catch(() => null),
        ])

        setMetrics(results[0] as MetricsData)
        setDonutData(results[1] as RawDonutData)
        setMonthlyData(results[2] as RawMonthlyData)
        setWeekdayData(results[3] as RawWeekdayData)
        if (results[4]) setWeeklySummary(results[4] as WeeklySummaryData)
        if (results[5]) setForecast(results[5] as ForecastData)
        if (results[6]) setVelocity(results[6] as SpendingVelocityData)
        if (results[7]) setAnomalies((results[7] as { anomalies: AnomalyItem[] }).anomalies ?? [])
        if (results[8]) setRecurring((results[8] as { recurring: RecurringTransaction[] }).recurring ?? [])
        if (results[9]) setIndustryMonthly(results[9] as IndustryMonthlyData)

        // Auto-select most recent month
        const monthly = results[2] as RawMonthlyData
        if (monthly?.months?.length) {
          const latest = monthly.months[monthly.months.length - 1].month
          setSelectedMonth(latest)
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : 'שגיאה בטעינת הנתונים'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    return () => controller.abort()
  }, [sessionId, dateType])

  // ── Fetch month overview when selectedMonth changes ────────────────
  useEffect(() => {
    if (!sessionId || !selectedMonth) return
    const controller = new AbortController()

    const fetchOverview = async () => {
      setMonthOverviewLoading(true)
      try {
        const data = await transactionsApi.getMonthOverview(sessionId, selectedMonth, dateType, controller.signal)
        setMonthOverview(data)
      } catch {
        // non-critical
      } finally {
        setMonthOverviewLoading(false)
      }
    }

    fetchOverview()
    return () => controller.abort()
  }, [sessionId, selectedMonth, dateType])

  // ── Derived data ───────────────────────────────────────────────────
  const categories = useMemo<CategoryData[]>(() => {
    if (!donutData?.categories) return []
    return donutData.categories.map((cat) => ({
      'קטגוריה': cat.name,
      'סכום_מוחלט': cat.value,
    }))
  }, [donutData])

  const monthlyChartData = useMemo(() => {
    if (!monthlyData?.months) return []
    return monthlyData.months.map((m) => ({ label: m.month, value: m.amount }))
  }, [monthlyData])

  const monthlyAmounts = useMemo(() => {
    if (!monthlyData?.months) return undefined
    return monthlyData.months.map((m) => m.amount)
  }, [monthlyData])

  const weekdayChartData = useMemo(() => {
    if (!weekdayData?.days) return []
    return weekdayData.days.map((d) => ({ day: d.day, amount: d.amount }))
  }, [weekdayData])

  const donutChartData = useMemo(() => {
    if (!donutData?.categories) return { data: [], total: 0 }
    return {
      data: donutData.categories.map((c) => ({ name: c.name, value: c.value })),
      total: donutData.total,
    }
  }, [donutData])

  // List of months to show in selector (last 12 months)
  const availableMonths = useMemo(() => {
    if (!monthlyData?.months) return []
    return [...monthlyData.months].reverse().slice(0, 12)
  }, [monthlyData])

  // Sync comparison month selection when industry data loads
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

  const hasBillingDate = metrics?.has_billing_date ?? false

  // ── Month selector navigation ──────────────────────────────────────
  const selectedMonthIdx = useMemo(() => {
    if (!selectedMonth || !availableMonths.length) return 0
    return availableMonths.findIndex((m) => m.month === selectedMonth)
  }, [selectedMonth, availableMonths])

  const goToPrevMonth = useCallback(() => {
    if (selectedMonthIdx < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[selectedMonthIdx + 1].month)
    }
  }, [selectedMonthIdx, availableMonths])

  const goToNextMonth = useCallback(() => {
    if (selectedMonthIdx > 0) {
      setSelectedMonth(availableMonths[selectedMonthIdx - 1].month)
    }
  }, [selectedMonthIdx, availableMonths])

  // ── No session ────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <>
        <EmptyState
          icon="📊"
          title={'ברוכים הבאים לדאשבורד!'}
          text={'העלה קובץ אקסל או CSV מחברת האשראי שלך כדי להתחיל בניתוח'}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-lg)', marginTop: 'var(--space-xl)' }}>
          <div className="feature-card"><div className="feature-icon">📊</div><div className="feature-title">ניתוח ויזואלי</div><div className="feature-desc">גרפים אינטראקטיביים וחכמים לתובנות מיידיות</div></div>
          <div className="feature-card"><div className="feature-icon">🏷️</div><div className="feature-title">קטגוריות אוטומטיות</div><div className="feature-desc">זיהוי אוטומטי של קטגוריות מהקובץ המקורי</div></div>
          <div className="feature-card"><div className="feature-icon">📑</div><div className="feature-title">תמיכה מלאה</div><div className="feature-desc">Excel עם מספר גליונות, CSV בעברית מלאה</div></div>
        </div>
      </>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <div className="card-grid-responsive">
          <Skeleton variant="card" count={4} />
        </div>
        <div className="bento-grid" style={{ marginTop: 'var(--space-xl)' }}>
          <div className="bento-full"><Skeleton variant="rectangular" height={100} /></div>
          <div className="bento-2-3"><Skeleton variant="rectangular" height={300} /></div>
          <div className="bento-1-3"><Skeleton variant="rectangular" height={300} /></div>
          <div className="bento-full"><Skeleton variant="rectangular" height={320} /></div>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', textAlign: 'center' }}>
        <p style={{ color: 'var(--accent-danger)', fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-md)' }}>{error}</p>
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => window.location.reload()}>נסה שוב</Button>
      </div>
    )
  }

  if (!metrics) return null

  // ── Main view ──────────────────────────────────────────────────────
  return (
    <div style={{ direction: 'rtl', position: 'relative' }}>
      {/* Mesh gradient background */}
      <div className="mesh-gradient-bg" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '300px', pointerEvents: 'none', zIndex: 0, opacity: 0.6 }} />

      <PageHeader
        title="דשבורד"
        subtitle="סקירה כללית של ההוצאות וההכנסות שלך"
        icon={LayoutDashboard}
      />

      {/* ── Date type toggle (billing / transaction) ───────────────── */}
      {hasBillingDate && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ marginBottom: 'var(--space-md)', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}
        >
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
        </motion.div>
      )}

      <MetricsGrid metrics={metrics} monthlyAmounts={monthlyAmounts} />

      {/* ── Month selector + overview ──────────────────────────────── */}
      {availableMonths.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
        >
          {/* Section header */}
          <div className="section-header-v2">
            <Calendar size={18} />
            <span>סקירת חודש</span>
            {hasBillingDate && (
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)', color: 'var(--accent)', fontWeight: 600 }}>
                {dateType === 'billing' ? 'תאריך חיוב' : 'תאריך עסקה'}
              </span>
            )}
          </div>

          {/* Month selector bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            marginBottom: 'var(--space-md)',
            flexWrap: 'wrap',
          }}>
            <button
              onClick={goToPrevMonth}
              disabled={selectedMonthIdx >= availableMonths.length - 1}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                cursor: selectedMonthIdx >= availableMonths.length - 1 ? 'not-allowed' : 'pointer',
                opacity: selectedMonthIdx >= availableMonths.length - 1 ? 0.4 : 1,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="חודש קודם"
            >
              <ChevronRight size={16} />
            </button>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
              {availableMonths.slice(0, 8).map((m) => (
                <button
                  key={m.month}
                  onClick={() => setSelectedMonth(m.month)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid',
                    borderColor: selectedMonth === m.month ? 'var(--accent)' : 'var(--border)',
                    background: selectedMonth === m.month ? 'var(--accent-muted)' : 'transparent',
                    color: selectedMonth === m.month ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: selectedMonth === m.month ? 700 : 500,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family)',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatMonthLabel(m.month)}
                </button>
              ))}
            </div>

            <button
              onClick={goToNextMonth}
              disabled={selectedMonthIdx <= 0}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                cursor: selectedMonthIdx <= 0 ? 'not-allowed' : 'pointer',
                opacity: selectedMonthIdx <= 0 ? 0.4 : 1,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="חודש הבא"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          {/* Month overview content */}
          {monthOverviewLoading ? (
            <Skeleton variant="rectangular" height={320} />
          ) : monthOverview && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: 'var(--space-md)',
            }}
              className="month-overview-grid"
            >
              {/* Summary cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <Card variant="glass" padding="md">
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
                    הוצאות — {formatMonthLabel(monthOverview.month)}
                  </div>
                  <AnimatedNumber
                    value={monthOverview.total_expenses}
                    formatter={formatCurrency}
                    style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--danger)', fontFamily: 'var(--font-mono)', direction: 'ltr', display: 'block' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {monthOverview.transaction_count} עסקאות
                  </div>
                </Card>

                {monthOverview.total_income > 0 && (
                  <Card variant="glass" padding="md">
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                      הכנסות — {formatMonthLabel(monthOverview.month)}
                    </div>
                    <AnimatedNumber
                      value={monthOverview.total_income}
                      formatter={formatCurrency}
                      style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font-mono)', direction: 'ltr', display: 'block' }}
                    />
                  </Card>
                )}

                {monthOverview.total_income > 0 && (
                  <Card variant="glass" padding="md">
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '6px' }}>יתרה נטו</div>
                    {(() => {
                      const balance = monthOverview.total_income - monthOverview.total_expenses
                      return (
                        <AnimatedNumber
                          value={Math.abs(balance)}
                          formatter={(v) => `${balance >= 0 ? '+' : '-'}${formatCurrency(v)}`}
                          style={{
                            fontSize: '1.625rem', fontWeight: 700,
                            color: balance >= 0 ? 'var(--success)' : 'var(--danger)',
                            fontFamily: 'var(--font-mono)', direction: 'ltr', display: 'block'
                          }}
                        />
                      )
                    })()}
                  </Card>
                )}

                {/* Top category */}
                {monthOverview.categories.length > 0 && (
                  <Card variant="glass" padding="md">
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '8px' }}>חלוקה לפי קטגוריה</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {monthOverview.categories.filter((c) => c.expenses > 0).slice(0, 5).map((cat) => {
                        const pct = monthOverview.total_expenses > 0 ? (cat.expenses / monthOverview.total_expenses) * 100 : 0
                        return (
                          <div key={cat.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{cat.name}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{pct.toFixed(0)}%</span>
                            </div>
                            <div style={{ height: '4px', borderRadius: '2px', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )}
              </div>

              {/* Grouped bar chart */}
              <Card variant="glass" padding="md">
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowUpDown size={14} />
                  הוצאות לעומת הכנסות לפי קטגוריה
                </div>
                <MonthOverviewChart
                  categories={monthOverview.categories}
                  height={280}
                />
              </Card>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Industry monthly comparison ────────────────────────────── */}
      {industryMonthly && industryMonthly.months.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
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
            {industryMonthly.months.map((m) => {
              const isSelected = selectedComparisonMonths.has(m)
              return (
                <button
                  key={m}
                  onClick={() => setSelectedComparisonMonths(prev => {
                    const next = new Set(prev)
                    if (next.has(m)) {
                      if (next.size > 1) next.delete(m)
                    } else {
                      next.add(m)
                    }
                    return next
                  })}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    background: isSelected ? 'var(--accent-muted)' : 'transparent',
                    color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family)',
                    transition: 'all 0.15s',
                  }}
                >
                  {m}
                </button>
              )
            })}
          </div>
          <Card className="glass-card" padding="md">
            <IndustryMonthlyChart data={filteredIndustryMonthly!} height={320} />
          </Card>
        </motion.div>
      )}

      {/* ── Spending Alerts ────────────────────────────────────────── */}
      {(anomalies.length > 0 || recurring.length > 0 || forecast) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
          style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
        >
          <div className="section-header-v2">
            <Bell size={18} />
            <span>התראות והמלצות</span>
          </div>
          <SpendingAlerts
            metrics={metrics}
            anomalies={anomalies}
            recurring={recurring}
            forecast={forecast}
            dismissedAlerts={dismissedAlerts}
            onDismiss={handleDismissAlert}
          />
        </motion.div>
      )}

      {/* ── Weekly Summary ─────────────────────────────────────────── */}
      {weeklySummary && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
        >
          <div className="glass-card" style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>השבוע</span>
              {weeklySummary.change_pct !== 0 && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: weeklySummary.change_pct > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(52, 211, 153, 0.12)', color: weeklySummary.change_pct > 0 ? 'var(--accent-danger, #ef4444)' : 'var(--accent-secondary, #10b981)' }}>
                  {weeklySummary.change_pct > 0 ? '↑' : '↓'} {Math.abs(weeklySummary.change_pct)}%
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'right' }}>{formatCurrency(weeklySummary.this_week.total)}</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{weeklySummary.this_week.count} עסקאות · {weeklySummary.this_week.top_category}</p>
          </div>
          <div className="glass-card" style={{ padding: '18px 22px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>שבוע שעבר</span>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'right' }}>{formatCurrency(weeklySummary.last_week.total)}</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{weeklySummary.last_week.count} עסקאות · {weeklySummary.last_week.top_category}</p>
          </div>
        </motion.div>
      )}

      {/* ── Main Charts: Bento Grid ────────────────────────────────── */}
      <div className="bento-grid" style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}>
        {/* Monthly bar chart (2/3 width) */}
        <div className="bento-2-3">
          <div className="section-header-v2">
            <Calendar size={18} />
            <span>הוצאות לפי חודש</span>
            {hasBillingDate && (
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)', color: 'var(--accent)', fontWeight: 600 }}>
                {dateType === 'billing' ? 'חיוב' : 'עסקה'}
              </span>
            )}
          </div>
          <Card className="glass-card" padding="md">
            <BarChart data={monthlyChartData} />
          </Card>
        </div>

        {/* Donut chart (1/3 width) */}
        <div className="bento-1-3">
          <div className="section-header-v2">
            <PieChart size={18} />
            <span>חלוקה לפי קטגוריה</span>
          </div>
          <Card className="glass-card" padding="md">
            {donutChartData.data.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <DonutChart data={donutChartData.data} total={donutChartData.total} />
              </div>
            )}
          </Card>
        </div>

        {/* Weekday chart (1/3 width) */}
        <div className="bento-1-3">
          <div className="section-header-v2">
            <CalendarDays size={18} />
            <span>התפלגות לפי יום בשבוע</span>
          </div>
          <Card className="glass-card" padding="md">
            <WeekdayChart data={weekdayChartData} />
          </Card>
        </div>

        {/* Category list (2/3 width) */}
        <div className="bento-2-3">
          <div className="section-header-v2">
            <BarChart3 size={18} />
            <span>פירוט קטגוריות</span>
          </div>
          {categories.length > 0 && <CategoryList categories={categories} />}
        </div>
      </div>

      {/* ── Forecast & Velocity ────────────────────────────────────── */}
      {(forecast || velocity) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.35 }}
          style={{ display: 'grid', gridTemplateColumns: forecast && velocity ? '1fr 1fr' : '1fr', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}
          className="dashboard-premium-row"
        >
          {forecast && (
            <Card variant="glass" padding="md">
              <div className="section-header-v2" style={{ marginTop: 0 }}>
                <TrendingUp size={18} />
                <span>תחזית חודש הבא</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                <AnimatedNumber
                  value={forecast.forecast_amount}
                  formatter={formatCurrency}
                  style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}
                />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: forecast.trend_direction === 'up' ? 'rgba(239, 68, 68, 0.12)' : forecast.trend_direction === 'down' ? 'rgba(52, 211, 153, 0.12)' : 'rgba(148, 163, 184, 0.12)', color: forecast.trend_direction === 'up' ? 'var(--accent-danger, #ef4444)' : forecast.trend_direction === 'down' ? 'var(--accent-secondary, #10b981)' : 'var(--text-muted)' }}>
                  {forecast.trend_direction === 'up' ? '↑ עלייה' : forecast.trend_direction === 'down' ? '↓ ירידה' : '→ יציב'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ביטחון: {forecast.confidence === 'high' ? 'גבוה' : forecast.confidence === 'medium' ? 'בינוני' : 'נמוך'}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>·</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ממוצע חודשי: {formatCurrency(forecast.avg_monthly)}</span>
              </div>
              {forecast.monthly_data.length > 1 && (
                <div style={{ marginTop: '12px' }}>
                  <SparklineChart data={forecast.monthly_data.map((m) => m.amount)} color="var(--neon-cyan, var(--accent-primary))" width={280} height={40} />
                </div>
              )}
            </Card>
          )}

          {velocity && (
            <Card variant="glass" padding="md">
              <div className="section-header-v2" style={{ marginTop: 0 }}>
                <Zap size={18} />
                <span>קצב הוצאות</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-lg)', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>יומי</div>
                  <AnimatedNumber value={velocity.daily_avg} formatter={formatCurrency} style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>7 ימים</div>
                  <AnimatedNumber value={velocity.rolling_7day} formatter={formatCurrency} style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>30 יום</div>
                  <AnimatedNumber value={velocity.rolling_30day} formatter={formatCurrency} style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }} />
                </div>
              </div>
              {velocity.daily_data.length > 1 && (
                <div style={{ marginTop: '12px' }}>
                  <SparklineChart data={velocity.daily_data.map((d) => d.amount)} color="var(--neon-purple, var(--accent-primary))" width={280} height={40} />
                </div>
              )}
            </Card>
          )}
        </motion.div>
      )}

      {/* ── Month-over-Month ───────────────────────────────────────── */}
      {monthlyData && monthlyData.months.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.35 }}
          style={{ marginTop: 'var(--space-lg)' }}
        >
          <div className="section-header-v2">
            <BarChart3 size={18} />
            <span>השוואה חודשית</span>
          </div>
          <Card className="glass-card" padding="md">
            <div
              style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(monthlyData.months.length, 6)}, 1fr)`, gap: 'var(--space-sm)' }}
              className="dashboard-monthly-comparison"
            >
              {monthlyData.months.slice(-6).map((month, idx, arr) => {
                const prev = idx > 0 ? arr[idx - 1].amount : null
                const changePct = prev ? ((month.amount - prev) / Math.abs(prev)) * 100 : null
                const isSelected = month.month === selectedMonth
                return (
                  <div
                    key={month.month}
                    onClick={() => setSelectedMonth(month.month)}
                    style={{
                      textAlign: 'center',
                      padding: 'var(--space-md)',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--accent-muted)' : 'var(--bg-tertiary, rgba(255,255,255,0.03))',
                      border: isSelected ? '1px solid var(--border-accent)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: isSelected ? 'var(--accent)' : 'var(--text-muted)', marginBottom: '6px', fontWeight: isSelected ? 600 : 400 }}>
                      {month.month}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>
                      {formatCurrency(month.amount)}
                    </div>
                    {changePct !== null && (
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, marginTop: '6px', color: changePct > 0 ? 'var(--accent-danger, #ef4444)' : 'var(--accent-secondary, #10b981)' }}>
                        {changePct > 0 ? '↑' : '↓'} {Math.abs(changePct).toFixed(1)}%
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </motion.div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .dashboard-premium-row { grid-template-columns: 1fr !important; }
          .dashboard-monthly-comparison { grid-template-columns: repeat(3, 1fr) !important; }
          .month-overview-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
