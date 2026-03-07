import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Calendar,
  BarChart3,
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
  Grid3X3,
  Tag,
  Activity,
  Clock,
  Search,
  X,
  SlidersHorizontal,
} from 'lucide-react'
import { filterAndSortCategories, countActiveFilters } from '../utils/categoryFilters'
import { get_icon } from '../utils/constants'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import SparklineChart from '../components/charts/SparklineChart'
import MetricsGrid from '../components/metrics/MetricsGrid'
import IndustryMonthlyChart from '../components/charts/IndustryMonthlyChart'
import CategoryTransactionsDrawer from '../components/table/CategoryTransactionsDrawer'
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
  WeeklySummaryData,
  ForecastData,
  SpendingVelocityData,
  AnomalyItem,
  RecurringTransaction,
  MonthOverviewData,
  IndustryMonthlyData,
  CategorySnapshotData,
  Transaction,
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
  const [, setDonutData] = useState<RawDonutData | null>(null)
  const [monthlyData, setMonthlyData] = useState<RawMonthlyData | null>(null)
  const [, setWeekdayData] = useState<RawWeekdayData | null>(null)
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummaryData | null>(null)
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [velocity, setVelocity] = useState<SpendingVelocityData | null>(null)
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([])
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])
  const [monthOverview, setMonthOverview] = useState<MonthOverviewData | null>(null)
  const [industryMonthly, setIndustryMonthly] = useState<IndustryMonthlyData | null>(null)
  const [categorySnapshot, setCategorySnapshot] = useState<CategorySnapshotData | null>(null)

  // ── UI state ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [dateType, setDateType] = useState<'transaction' | 'billing'>('transaction')
  const [monthOverviewLoading, setMonthOverviewLoading] = useState(false)
  const [dataLoadedAt, setDataLoadedAt] = useState<Date | null>(null)
  const [selectedComparisonMonths, setSelectedComparisonMonths] = useState<Set<string>>(new Set())
  const [snapshotSort, setSnapshotSort] = useState<'amount' | 'change' | 'count' | 'avg'>('amount')
  const [snapshotExpanded, setSnapshotExpanded] = useState(false)
  const [snapshotSearch, setSnapshotSearch] = useState('')
  const [snapshotExcluded, setSnapshotExcluded] = useState<Set<string>>(new Set())
  const [snapshotMinAmount, setSnapshotMinAmount] = useState('')
  const [snapshotMaxAmount, setSnapshotMaxAmount] = useState('')
  const [snapshotMonthFrom, setSnapshotMonthFrom] = useState('')
  const [snapshotMonthTo, setSnapshotMonthTo] = useState('')
  const [snapshotSelectedCats, setSnapshotSelectedCats] = useState<Set<string> | null>(null)
  const [snapshotShowAdvanced, setSnapshotShowAdvanced] = useState(false)

  // ── Category drill-down drawer state ────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerCategory, setDrawerCategory] = useState('')
  const [drawerTransactions, setDrawerTransactions] = useState<Transaction[]>([])
  const [drawerTotal, setDrawerTotal] = useState(0)
  const [drawerLoading, setDrawerLoading] = useState(false)

  const handleCategoryCardClick = useCallback(async (categoryName: string) => {
    if (!sessionId) return
    setDrawerCategory(categoryName)
    setDrawerOpen(true)
    setDrawerLoading(true)
    try {
      // Use snapshot date range filters to match what the card displays
      const data = await transactionsApi.getCategoryTransactions(
        sessionId, '', categoryName, dateType, undefined, undefined,
        snapshotMonthFrom || undefined, snapshotMonthTo || undefined,
      )
      setDrawerTransactions(data.transactions)
      setDrawerTotal(data.total)
    } catch {
      setDrawerTransactions([])
      setDrawerTotal(0)
    } finally {
      setDrawerLoading(false)
    }
  }, [sessionId, snapshotMonthFrom, snapshotMonthTo, dateType])

  const handleDismissAlert = useCallback((id: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(id))
  }, [])

  // ── Inject responsive CSS once (prevent duplicate <style> elements) ──
  useEffect(() => {
    const STYLE_ID = 'dashboard-responsive-css'
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      @media (max-width: 768px) {
        .dashboard-premium-row { grid-template-columns: 1fr !important; }
        .dashboard-monthly-comparison { grid-template-columns: repeat(3, 1fr) !important; }
        .month-overview-grid { grid-template-columns: 1fr !important; }
      }
    `
    document.head.appendChild(style)
    return () => { document.getElementById(STYLE_ID)?.remove() }
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
          transactionsApi.getCategorySnapshot(sessionId, signal, undefined, undefined, dateType).catch(() => null),
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
        if (results[10]) setCategorySnapshot(results[10] as CategorySnapshotData)

        setDataLoadedAt(new Date())

        // Auto-select most recent month
        const monthly = results[2] as RawMonthlyData
        if (monthly?.months?.length) {
          const latest = monthly.months[monthly.months.length - 1].month
          setSelectedMonth(latest)
          // Default snapshot to last month so user sees recent monthly breakdown
          setSnapshotMonthFrom(latest)
          setSnapshotMonthTo(latest)
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
  const monthlyAmounts = useMemo(() => {
    if (!monthlyData?.months) return undefined
    return monthlyData.months.map((m) => m.amount)
  }, [monthlyData])

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

  // ── Sync category snapshot month with selectedMonth ──
  useEffect(() => {
    if (selectedMonth) {
      setSnapshotMonthFrom(selectedMonth)
      setSnapshotMonthTo(selectedMonth)
    }
  }, [selectedMonth])

  // ── Refetch category snapshot when month range or date type changes ──
  useEffect(() => {
    if (!sessionId) return
    if (!snapshotMonthFrom && !snapshotMonthTo) return // initial load already covered
    const controller = new AbortController()
    transactionsApi.getCategorySnapshot(
      sessionId, controller.signal,
      snapshotMonthFrom || undefined, snapshotMonthTo || undefined, dateType,
    )
      .then((data) => setCategorySnapshot(data))
      .catch(() => {})
    return () => controller.abort()
  }, [sessionId, snapshotMonthFrom, snapshotMonthTo, dateType])

  // ── Filtered + sorted snapshot categories (uses extracted pure fn) ────
  const snapshotFilterOpts = useMemo(() => ({
    search: snapshotSearch,
    excluded: snapshotExcluded,
    minAmount: snapshotMinAmount ? parseFloat(snapshotMinAmount) : 0,
    maxAmount: snapshotMaxAmount ? parseFloat(snapshotMaxAmount) : 0,
    selectedCategories: snapshotSelectedCats,
    sort: snapshotSort,
  }), [snapshotSearch, snapshotExcluded, snapshotMinAmount, snapshotMaxAmount, snapshotSelectedCats, snapshotSort])

  const sortedSnapshotCategories = useMemo(
    () => filterAndSortCategories(categorySnapshot?.categories ?? [], snapshotFilterOpts),
    [categorySnapshot, snapshotFilterOpts],
  )

  const snapshotFilteredTotal = useMemo(
    () => sortedSnapshotCategories.reduce((s, c) => s + c.total, 0),
    [sortedSnapshotCategories],
  )

  const snapshotActiveFilterCount = useMemo(
    () => countActiveFilters(snapshotFilterOpts),
    [snapshotFilterOpts],
  )

  const clearAllSnapshotFilters = useCallback(() => {
    setSnapshotSearch('')
    setSnapshotExcluded(new Set())
    setSnapshotMinAmount('')
    setSnapshotMaxAmount('')
    setSnapshotMonthFrom('')
    setSnapshotMonthTo('')
    setSnapshotSelectedCats(null)
  }, [])

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

      {/* ── Financial Health Banner ──────────────────────────────────── */}
      {metrics && (() => {
        // Use month-specific data when a month is selected, otherwise global metrics
        const hasMonthData = selectedMonth && monthOverview
        const displayExpenses = hasMonthData ? monthOverview.total_expenses : Math.abs(metrics.total_expenses)
        const displayIncome = hasMonthData ? monthOverview.total_income : metrics.total_income
        const displayBalance = displayIncome - displayExpenses
        const displaySavingsRate = displayIncome > 0 ? (displayBalance / displayIncome * 100) : 0
        const periodLabel = hasMonthData ? selectedMonth : 'כל התקופה'

        return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            position: 'relative', zIndex: 1,
            marginBottom: 'var(--space-md)',
            padding: '16px 20px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-md)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={18} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>בריאות פיננסית</span>
            <span style={{ fontSize: '0.625rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--info-muted)', color: 'var(--info)', fontWeight: 500 }}>
              {periodLabel}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '2px' }}>הוצאות</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--danger)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>
                {formatCurrency(displayExpenses)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '2px' }}>הכנסות</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: displayIncome > 0 ? 'var(--success)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>
                {formatCurrency(displayIncome)}
              </div>
              {hasMonthData && displayIncome === 0 && metrics.total_income > 0 && (
                <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                  אין הכנסות בחודש זה
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '2px' }}>יתרה</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: displayBalance >= 0 ? 'var(--success)' : 'var(--danger)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>
                {displayBalance >= 0 ? '+' : ''}{formatCurrency(displayBalance)}
              </div>
            </div>
            {displayIncome > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '2px' }}>שיעור חיסכון</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: displaySavingsRate >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {displaySavingsRate.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
          {/* Last Updated Timestamp */}
          {dataLoadedAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block', flexShrink: 0 }} />
              <Clock size={11} />
              <span>עודכן {dataLoadedAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </motion.div>
        )
      })()}

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
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 'var(--space-md)',
            }}
              className="month-overview-grid"
            >
              {/* Summary cards */}
              <>
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
                    {monthOverview.transaction_count === 1 ? 'עסקה אחת' : `${monthOverview.transaction_count} עסקאות`}
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
              </>

            </div>
          )}
        </motion.div>
      )}

      {/* ── Full Category Snapshot ──────────────────────────────────── */}
      {categorySnapshot && categorySnapshot.categories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
          style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
        >
          {/* ─── Header ─── */}
          <div className="section-header-v2" style={{ flexWrap: 'wrap' }}>
            <Grid3X3 size={18} />
            <span>סיכום הוצאות לפי קטגוריה</span>
            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--info-muted)', color: 'var(--info)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {snapshotMonthFrom || snapshotMonthTo
                ? (snapshotMonthFrom && snapshotMonthTo && snapshotMonthFrom === snapshotMonthTo
                    ? snapshotMonthFrom
                    : `${snapshotMonthFrom || '...'} — ${snapshotMonthTo || '...'}`)
                : `כל התקופה · ${categorySnapshot.month_count} חודשים`}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--accent)', fontWeight: 500, fontStyle: 'italic' }}>
              לחצו על קטגוריה לפירוט עסקאות
            </span>
          </div>

          {/* ─── Toolbar: Search + Sort + Actions (always visible) ─── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 200px', maxWidth: '280px', position: 'relative' }}>
              <Search size={13} style={{ color: 'var(--text-muted)', position: 'absolute', right: '8px', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="חיפוש קטגוריה או בית עסק..."
                value={snapshotSearch}
                onChange={(e) => setSnapshotSearch(e.target.value)}
                style={{
                  width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)',
                  padding: '6px 32px 6px 10px', fontSize: '0.75rem', fontFamily: 'var(--font-family)',
                  background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
              />
              {snapshotSearch && (
                <button onClick={() => setSnapshotSearch('')} style={{ position: 'absolute', left: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Sort pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpDown size={12} style={{ color: 'var(--text-muted)' }} />
              {([
                { key: 'amount' as const, label: 'סכום' },
                { key: 'change' as const, label: 'שינוי' },
                { key: 'count' as const, label: 'כמות' },
                { key: 'avg' as const, label: 'ממוצע' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSnapshotSort(opt.key)}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid',
                    borderColor: snapshotSort === opt.key ? 'var(--accent)' : 'var(--border)',
                    background: snapshotSort === opt.key ? 'var(--accent-muted)' : 'transparent',
                    color: snapshotSort === opt.key ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '0.6875rem', fontWeight: snapshotSort === opt.key ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'var(--font-family)', transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Advanced toggle + Clear */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
              <button
                onClick={() => setSnapshotShowAdvanced(!snapshotShowAdvanced)}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid',
                  borderColor: snapshotShowAdvanced ? 'var(--accent)' : 'var(--border)',
                  background: snapshotShowAdvanced ? 'var(--accent-muted)' : 'transparent',
                  color: snapshotShowAdvanced ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: '0.6875rem', fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-family)', display: 'inline-flex', alignItems: 'center', gap: '4px',
                }}
              >
                <SlidersHorizontal size={11} />
                מתקדם
                {snapshotActiveFilterCount > 0 && (
                  <span style={{
                    minWidth: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent)',
                    color: '#fff', fontSize: '0.6rem', fontWeight: 700, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>{snapshotActiveFilterCount}</span>
                )}
              </button>
              {snapshotActiveFilterCount > 0 && (
                <button
                  onClick={clearAllSnapshotFilters}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--danger)',
                    background: 'transparent', color: 'var(--danger)', fontSize: '0.6875rem',
                    fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-family)',
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                  }}
                >
                  <X size={10} />
                  נקה הכל
                </button>
              )}
            </div>
          </div>

          {/* ─── Category chip multi-select (always visible) ─── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
            {/* Select All / Deselect All */}
            <button
              onClick={() => setSnapshotSelectedCats(snapshotSelectedCats === null ? new Set() : null)}
              style={{
                padding: '4px 10px', borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
                background: snapshotSelectedCats === null ? 'var(--accent-muted)' : 'transparent',
                color: snapshotSelectedCats === null ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-family)', transition: 'all 0.15s',
              }}
            >
              {snapshotSelectedCats === null ? 'הכל' : 'בחר הכל'}
            </button>
            {categorySnapshot.categories.map((cat) => {
              const isSelected = snapshotSelectedCats === null || snapshotSelectedCats.has(cat.name)
              const isExcluded = snapshotExcluded.has(cat.name)
              return (
                <button
                  key={cat.name}
                  onClick={() => {
                    if (isExcluded) {
                      setSnapshotExcluded(prev => { const n = new Set(prev); n.delete(cat.name); return n })
                      return
                    }
                    if (snapshotSelectedCats === null) {
                      // First deselection: select all except this one
                      const all = new Set(categorySnapshot.categories.map(c => c.name))
                      all.delete(cat.name)
                      setSnapshotSelectedCats(all)
                    } else if (isSelected) {
                      const next = new Set(snapshotSelectedCats)
                      next.delete(cat.name)
                      setSnapshotSelectedCats(next.size === 0 ? null : next)
                    } else {
                      const next = new Set(snapshotSelectedCats)
                      next.add(cat.name)
                      // If all are now selected, reset to null (= "all")
                      setSnapshotSelectedCats(next.size === categorySnapshot.categories.length ? null : next)
                    }
                  }}
                  style={{
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    border: '1px solid',
                    borderColor: isExcluded ? 'var(--danger)' : isSelected ? 'var(--accent)' : 'var(--border)',
                    background: isExcluded ? 'var(--danger-muted)' : isSelected ? 'var(--accent-muted)' : 'transparent',
                    color: isExcluded ? 'var(--danger)' : isSelected ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '0.6875rem', fontWeight: isSelected ? 500 : 400, cursor: 'pointer',
                    fontFamily: 'var(--font-family)', transition: 'all 0.15s',
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    textDecoration: isExcluded ? 'line-through' : 'none',
                    opacity: isExcluded ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontSize: '0.8rem' }}>{get_icon(cat.name)}</span>
                  {cat.name}
                  <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>({cat.percent.toFixed(0)}%)</span>
                </button>
              )
            })}
          </div>

          {/* ─── Advanced filters panel (collapsible) ─── */}
          {snapshotShowAdvanced && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px',
              marginBottom: '10px', padding: '10px 14px',
              borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}>
              {/* Amount range */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>סכום:</span>
                <input type="number" placeholder="מינימום" value={snapshotMinAmount} onChange={(e) => setSnapshotMinAmount(e.target.value)}
                  style={{ width: '80px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', direction: 'ltr' }} />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>—</span>
                <input type="number" placeholder="מקסימום" value={snapshotMaxAmount} onChange={(e) => setSnapshotMaxAmount(e.target.value)}
                  style={{ width: '80px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', direction: 'ltr' }} />
              </div>

              {/* Month range */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>תקופה:</span>
                <select value={snapshotMonthFrom} onChange={(e) => setSnapshotMonthFrom(e.target.value)}
                  style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 6px', fontSize: '0.6875rem', fontFamily: 'var(--font-family)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <option value="">מתחילת התקופה</option>
                  {availableMonths.map((m) => <option key={m.month} value={m.month}>{m.month}</option>)}
                </select>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>עד</span>
                <select value={snapshotMonthTo} onChange={(e) => setSnapshotMonthTo(e.target.value)}
                  style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 6px', fontSize: '0.6875rem', fontFamily: 'var(--font-family)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <option value="">סוף התקופה</option>
                  {availableMonths.map((m) => <option key={m.month} value={m.month}>{m.month}</option>)}
                </select>
              </div>

              {/* Excluded chips */}
              {snapshotExcluded.size > 0 && (
                <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', alignSelf: 'center' }}>מוחרגות:</span>
                  {[...snapshotExcluded].map((name) => (
                    <span key={name} onClick={() => { const n = new Set(snapshotExcluded); n.delete(name); setSnapshotExcluded(n) }}
                      style={{ fontSize: '0.625rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--danger-muted)', color: 'var(--danger)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      {name} <X size={9} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Results summary ─── */}
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>
              {sortedSnapshotCategories.length === categorySnapshot.categories.length
                ? `${categorySnapshot.categories.length} קטגוריות · ${categorySnapshot.total_count === 1 ? 'עסקה אחת' : `${categorySnapshot.total_count} עסקאות`}`
                : `מציג ${sortedSnapshotCategories.length} מתוך ${categorySnapshot.categories.length} קטגוריות`
              }
            </span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>
              סה״כ: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(snapshotFilteredTotal)}</strong>
              {sortedSnapshotCategories.length < categorySnapshot.categories.length && categorySnapshot.total > 0 && (
                <> ({((snapshotFilteredTotal / categorySnapshot.total) * 100).toFixed(1)}%)</>
              )}
            </span>
          </div>

          {/* ─── Category cards grid ─── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'var(--space-sm)',
          }}>
            {(snapshotExpanded ? sortedSnapshotCategories : sortedSnapshotCategories.slice(0, 8)).map((cat) => {
              const changeColor = cat.month_change > 5 ? 'var(--danger)' : cat.month_change < -5 ? 'var(--success)' : 'var(--text-muted)'
              const changeBg = cat.month_change > 5 ? 'var(--danger-muted)' : cat.month_change < -5 ? 'var(--success-muted)' : 'rgba(148, 163, 184, 0.1)'
              return (
                <div key={cat.name} style={{ cursor: 'pointer' }}>
                <Card
                  variant="glass"
                  padding="sm"
                  hover
                  onClick={() => handleCategoryCardClick(cat.name)}
                >
                  <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
                    {/* Exclude button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSnapshotExcluded(prev => new Set([...prev, cat.name])) }}
                      title={`הסתר ${cat.name}`}
                      style={{
                        position: 'absolute', top: '-2px', left: '-2px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                        color: 'var(--text-muted)', fontSize: '10px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, opacity: 0.4, transition: 'all 0.15s', zIndex: 2,
                      }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1'; (e.target as HTMLElement).style.color = 'var(--danger)' }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.4'; (e.target as HTMLElement).style.color = 'var(--text-muted)' }}
                    >
                      <X size={9} />
                    </button>
                    {/* Icon */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      flexShrink: 0,
                    }}>
                      {get_icon(cat.name)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Row 1: Name + Total */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cat.name}
                        </span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', flexShrink: 0 }}>
                          {formatCurrency(cat.total)}
                        </span>
                      </div>

                      {/* Row 2: Stats chips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                        {/* Transaction count */}
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Tag size={10} />
                          {cat.count === 1 ? 'עסקה אחת' : `${cat.count} עסקאות`}
                        </span>
                        {/* Percentage */}
                        <span style={{ fontSize: '0.625rem', color: 'var(--accent)', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)' }}>
                          {cat.percent.toFixed(1)}%
                        </span>
                        {/* Month-over-month change */}
                        {cat.month_change !== 0 && (
                          <span style={{
                            fontSize: '0.625rem', fontWeight: 600,
                            padding: '1px 6px', borderRadius: 'var(--radius-full)',
                            background: changeBg, color: changeColor,
                            display: 'inline-flex', alignItems: 'center', gap: '2px',
                          }}>
                            {cat.month_change > 0 ? '↑' : '↓'}{Math.abs(cat.month_change).toFixed(0)}%
                          </span>
                        )}
                      </div>

                      {/* Row 3: Analytical details */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          ממוצע: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>{formatCurrency(cat.avg_transaction)}</strong>
                        </span>
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          חודשי: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>{formatCurrency(cat.monthly_avg)}</strong>
                        </span>
                      </div>

                      {/* Row 4: Top merchant */}
                      {cat.top_merchant && (
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          🏪 {cat.top_merchant} ({formatCurrency(cat.top_merchant_total)})
                        </div>
                      )}

                      {/* Row 5: Progress bar + mini sparkline */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(cat.percent, 100)}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
                        </div>
                        {cat.sparkline && cat.sparkline.length > 1 && (
                          <div style={{ flexShrink: 0, opacity: 0.7 }}>
                            <SparklineChart data={cat.sparkline} color="var(--accent)" width={60} height={16} strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
                </div>
              )
            })}
          </div>

          {/* Show more / less toggle */}
          {sortedSnapshotCategories.length > 8 && (
            <div style={{ textAlign: 'center', marginTop: 'var(--space-sm)' }}>
              <button
                onClick={() => setSnapshotExpanded(!snapshotExpanded)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 20px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                  transition: 'all 0.15s',
                }}
              >
                {snapshotExpanded
                  ? 'הצג פחות'
                  : `הצג עוד ${sortedSnapshotCategories.length - 8} קטגוריות`
                }
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Metrics Grid (totals) ─────────────────────────────────── */}
      <div style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}>
        <MetricsGrid metrics={metrics} monthlyAmounts={monthlyAmounts} />
      </div>

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

      {/* Bento grid charts removed — data available in ניהול נתונים */}

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'help' }}
                  title={forecast.confidence === 'high'
                    ? 'רמת ביטחון גבוהה: 6+ חודשי נתונים עם מגמה עקבית (R² > 0.7)'
                    : forecast.confidence === 'medium'
                      ? 'רמת ביטחון בינונית: 3+ חודשי נתונים עם מגמה מתונה (R² > 0.4)'
                      : `רמת ביטחון נמוכה: ${(forecast.monthly_data?.length ?? 0) < 3 ? 'פחות מ-3 חודשי נתונים' : 'תנודתיות גבוהה בין חודשים'} — ככל שיצטברו נתונים התחזית תשתפר`}
                >
                  ביטחון: {forecast.confidence === 'high' ? 'גבוה' : forecast.confidence === 'medium' ? 'בינוני' : 'נמוך'} ⓘ
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>·</span>
                <span
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'help' }}
                  title="ממוצע ההוצאות החודשי על פני כל התקופה — התחזית מבוססת על מגמת שינוי ולא על הממוצע בלבד"
                >
                  ממוצע בפועל: {formatCurrency(forecast.avg_monthly)}
                </span>
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
              {/* Monthly burn-down progress bar */}
              {forecast && forecast.avg_monthly > 0 && (() => {
                const burnPct = Math.min((velocity.rolling_30day / forecast.avg_monthly) * 100, 100)
                const isOver = velocity.rolling_30day > forecast.avg_monthly
                return (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>שריפת תקציב חודשי</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: isOver ? 'var(--danger)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {burnPct.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${burnPct}%`,
                        borderRadius: '3px',
                        background: isOver
                          ? 'linear-gradient(90deg, var(--danger), #fb923c)'
                          : burnPct > 75
                            ? 'linear-gradient(90deg, var(--warning), #fbbf24)'
                            : 'linear-gradient(90deg, var(--success), #6ee7b7)',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                )
              })()}
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
            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)', color: 'var(--accent)', fontWeight: 600 }}>
              {monthlyData.months.length} חודשים
            </span>
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

      {/* ── Category Transactions Drawer ────────────────────────────── */}
      <CategoryTransactionsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        category={drawerCategory}
        month={
          snapshotMonthFrom || snapshotMonthTo
            ? (snapshotMonthFrom && snapshotMonthTo && snapshotMonthFrom === snapshotMonthTo
                ? snapshotMonthFrom
                : `${snapshotMonthFrom || '...'} — ${snapshotMonthTo || '...'}`)
            : ''
        }
        transactions={drawerTransactions}
        total={drawerTotal}
        loading={drawerLoading}
      />
    </div>
  )
}
