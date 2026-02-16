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
  Grid3X3,
} from 'lucide-react'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import SparklineChart from '../components/charts/SparklineChart'
import MetricsGrid from '../components/metrics/MetricsGrid'
import DonutChart from '../components/charts/DonutChart'
import BarChart from '../components/charts/BarChart'
import WeekdayChart from '../components/charts/WeekdayChart'
import HeatmapChart from '../components/charts/HeatmapChart'
import CategoryList from '../components/category/CategoryList'
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
  HeatmapData,
} from '../services/types'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  // Data state
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [donutData, setDonutData] = useState<RawDonutData | null>(null)
  const [monthlyData, setMonthlyData] = useState<RawMonthlyData | null>(null)
  const [weekdayData, setWeekdayData] = useState<RawWeekdayData | null>(null)
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummaryData | null>(null)
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [velocity, setVelocity] = useState<SpendingVelocityData | null>(null)
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([])
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null)

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

  const handleDismissAlert = useCallback((id: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(id))
  }, [])

  // ---- Fetch data with AbortController ------------------------------------
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
          transactionsApi.getMonthlyChartV2(sessionId, signal),
          transactionsApi.getWeekdayChartV2(sessionId, signal),
          transactionsApi.getWeeklySummary(sessionId, signal).catch(() => null),
          transactionsApi.getForecast(sessionId, signal).catch(() => null),
          transactionsApi.getSpendingVelocity(sessionId, signal).catch(() => null),
          transactionsApi.getAnomalies(sessionId, signal).catch(() => null),
          transactionsApi.getRecurring(sessionId, signal).catch(() => null),
          transactionsApi.getHeatmap(sessionId, signal).catch(() => null),
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
        if (results[9]) setHeatmapData(results[9] as HeatmapData)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message =
          err instanceof Error ? err.message : 'שגיאה בטעינת הנתונים'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    return () => controller.abort()
  }, [sessionId])

  // ---- Derive CategoryData[] from donut data via useMemo ------------------
  const categories = useMemo<CategoryData[]>(() => {
    if (!donutData?.categories) return []
    return donutData.categories.map((cat) => ({
      'קטגוריה': cat.name,
      'סכום_מוחלט': cat.value,
    }))
  }, [donutData])

  // ---- Transform monthly data for BarChart --------------------------------
  const monthlyChartData = useMemo(() => {
    if (!monthlyData?.months) return []
    return monthlyData.months.map((m) => ({
      label: m.month,
      value: m.amount,
    }))
  }, [monthlyData])

  // ---- Monthly amounts for sparklines ------------------------------------
  const monthlyAmounts = useMemo(() => {
    if (!monthlyData?.months) return undefined
    return monthlyData.months.map((m) => m.amount)
  }, [monthlyData])

  // ---- Transform weekday data for WeekdayChart ----------------------------
  const weekdayChartData = useMemo(() => {
    if (!weekdayData?.days) return []
    return weekdayData.days.map((d) => ({
      day: d.day,
      amount: d.amount,
    }))
  }, [weekdayData])

  // ---- Transform donut data for DonutChart --------------------------------
  const donutChartData = useMemo(() => {
    if (!donutData?.categories) return { data: [], total: 0 }
    return {
      data: donutData.categories.map((c) => ({ name: c.name, value: c.value })),
      total: donutData.total,
    }
  }, [donutData])

  // ---- No session: show welcome screen ------------------------------------
  if (!sessionId) {
    return (
      <>
        <EmptyState
          icon="📊"
          title={'ברוכים הבאים לדאשבורד!'}
          text={'העלה קובץ אקסל או CSV מחברת האשראי שלך כדי להתחיל בניתוח'}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--space-lg)',
            marginTop: 'var(--space-xl)',
          }}
        >
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <div className="feature-title">ניתוח ויזואלי</div>
            <div className="feature-desc">
              גרפים אינטראקטיביים וחכמים לתובנות מיידיות
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🏷️</div>
            <div className="feature-title">קטגוריות אוטומטיות</div>
            <div className="feature-desc">
              זיהוי אוטומטי של קטגוריות מהקובץ המקורי
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📑</div>
            <div className="feature-title">תמיכה מלאה</div>
            <div className="feature-desc">
              Excel עם מספר גליונות, CSV בעברית מלאה
            </div>
          </div>
        </div>
      </>
    )
  }

  // ---- Loading skeleton ---------------------------------------------------
  if (loading) {
    return (
      <div>
        <div className="card-grid-responsive">
          <Skeleton variant="card" count={4} />
        </div>
        <div className="bento-grid" style={{ marginTop: 'var(--space-xl)' }}>
          <div className="bento-full">
            <Skeleton variant="rectangular" height={100} />
          </div>
          <div className="bento-2-3">
            <Skeleton variant="rectangular" height={260} />
          </div>
          <div className="bento-1-3">
            <Skeleton variant="rectangular" height={260} />
          </div>
        </div>
      </div>
    )
  }

  // ---- Error state --------------------------------------------------------
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-2xl)',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            color: 'var(--accent-danger)',
            fontSize: '1rem',
            fontWeight: 600,
            marginBottom: 'var(--space-md)',
          }}
        >
          {error}
        </p>
        <Button
          variant="secondary"
          icon={<RefreshCw size={16} />}
          onClick={() => window.location.reload()}
        >
          נסה שוב
        </Button>
      </div>
    )
  }

  // ---- No data loaded yet -------------------------------------------------
  if (!metrics) return null

  // ---- Main dashboard view ------------------------------------------------
  return (
    <div style={{ direction: 'rtl', position: 'relative' }}>
      {/* Mesh gradient background */}
      <div
        className="mesh-gradient-bg"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '300px',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.6,
        }}
      />

      <PageHeader
        title="דשבורד"
        subtitle="סקירה כללית של ההוצאות וההכנסות שלך"
        icon={LayoutDashboard}
      />

      <MetricsGrid metrics={metrics} monthlyAmounts={monthlyAmounts} />

      {/* ── Spending Alerts ──────────────────────────────────────────── */}
      {(anomalies.length > 0 || recurring.length > 0 || forecast) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
          style={{
            marginTop: 'var(--space-lg)',
            position: 'relative',
            zIndex: 1,
          }}
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

      {/* ── Weekly Summary ──────────────────────────────────────────── */}
      {weeklySummary && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-md)',
            marginTop: 'var(--space-lg)',
            marginBottom: 'var(--space-lg)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* This week */}
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>השבוע</span>
              {weeklySummary.change_pct !== 0 && (
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: weeklySummary.change_pct > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(52, 211, 153, 0.12)',
                  color: weeklySummary.change_pct > 0 ? 'var(--accent-danger, #ef4444)' : 'var(--accent-secondary, #10b981)',
                }}>
                  {weeklySummary.change_pct > 0 ? '↑' : '↓'} {Math.abs(weeklySummary.change_pct)}%
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'right' }}>
              {formatCurrency(weeklySummary.this_week.total)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {weeklySummary.this_week.count} עסקאות · {weeklySummary.this_week.top_category}
            </p>
          </div>

          {/* Last week */}
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>שבוע שעבר</span>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'right' }}>
              {formatCurrency(weeklySummary.last_week.total)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {weeklySummary.last_week.count} עסקאות · {weeklySummary.last_week.top_category}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Main Charts: Bento Grid ─────────────────────────────────── */}
      <div className="bento-grid" style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}>
        {/* Monthly bar chart (2/3 width) */}
        <div className="bento-2-3">
          <div className="section-header-v2">
            <Calendar size={18} />
            <span>הוצאות לפי חודש</span>
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

      {/* ── Forecast & Velocity premium row ──────────────────────────── */}
      {(forecast || velocity) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.35 }}
          style={{
            display: 'grid',
            gridTemplateColumns: forecast && velocity ? '1fr 1fr' : '1fr',
            gap: 'var(--space-md)',
            marginTop: 'var(--space-xl)',
          }}
          className="dashboard-premium-row"
        >
          {/* Forecast card */}
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
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background:
                    forecast.trend_direction === 'up'
                      ? 'rgba(239, 68, 68, 0.12)'
                      : forecast.trend_direction === 'down'
                        ? 'rgba(52, 211, 153, 0.12)'
                        : 'rgba(148, 163, 184, 0.12)',
                  color:
                    forecast.trend_direction === 'up'
                      ? 'var(--accent-danger, #ef4444)'
                      : forecast.trend_direction === 'down'
                        ? 'var(--accent-secondary, #10b981)'
                        : 'var(--text-muted)',
                }}>
                  {forecast.trend_direction === 'up' ? '↑ עלייה' : forecast.trend_direction === 'down' ? '↓ ירידה' : '→ יציב'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ביטחון: {forecast.confidence === 'high' ? 'גבוה' : forecast.confidence === 'medium' ? 'בינוני' : 'נמוך'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>·</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ממוצע חודשי: {formatCurrency(forecast.avg_monthly)}
                </span>
              </div>
              {forecast.monthly_data.length > 1 && (
                <div style={{ marginTop: '12px' }}>
                  <SparklineChart
                    data={forecast.monthly_data.map(m => m.amount)}
                    color="var(--neon-cyan, var(--accent-primary))"
                    width={280}
                    height={40}
                  />
                </div>
              )}
            </Card>
          )}

          {/* Spending velocity card */}
          {velocity && (
            <Card variant="glass" padding="md">
              <div className="section-header-v2" style={{ marginTop: 0 }}>
                <Zap size={18} />
                <span>קצב הוצאות</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-lg)', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>יומי</div>
                  <AnimatedNumber
                    value={velocity.daily_avg}
                    formatter={formatCurrency}
                    style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>7 ימים</div>
                  <AnimatedNumber
                    value={velocity.rolling_7day}
                    formatter={formatCurrency}
                    style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>30 יום</div>
                  <AnimatedNumber
                    value={velocity.rolling_30day}
                    formatter={formatCurrency}
                    style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              {velocity.daily_data.length > 1 && (
                <div style={{ marginTop: '12px' }}>
                  <SparklineChart
                    data={velocity.daily_data.map(d => d.amount)}
                    color="var(--neon-purple, var(--accent-primary))"
                    width={280}
                    height={40}
                  />
                </div>
              )}
            </Card>
          )}
        </motion.div>
      )}

      {/* ── Heatmap ──────────────────────────────────────────────────── */}
      {heatmapData && heatmapData.categories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.35 }}
          style={{ marginTop: 'var(--space-xl)' }}
        >
          <div className="section-header-v2">
            <Grid3X3 size={18} />
            <span>מפת חום לפי קטגוריה</span>
          </div>
          <Card className="glass-card" padding="md">
            <HeatmapChart
              categories={heatmapData.categories}
              months={heatmapData.months}
              data={heatmapData.data}
            />
          </Card>
        </motion.div>
      )}

      {/* ── Month-over-Month Comparison ──────────────────────────────── */}
      {monthlyData && monthlyData.months.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.35 }}
          style={{ marginTop: 'var(--space-xl)' }}
        >
          <div className="section-header-v2">
            <BarChart3 size={18} />
            <span>השוואה חודשית</span>
          </div>
          <Card className="glass-card" padding="md">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(monthlyData.months.length, 6)}, 1fr)`,
                gap: 'var(--space-sm)',
              }}
              className="dashboard-monthly-comparison"
            >
              {monthlyData.months.slice(-6).map((month, idx, arr) => {
                const prev = idx > 0 ? arr[idx - 1].amount : null
                const changePct = prev ? ((month.amount - prev) / Math.abs(prev)) * 100 : null
                return (
                  <div
                    key={month.month}
                    style={{
                      textAlign: 'center',
                      padding: 'var(--space-sm)',
                      borderRadius: 'var(--radius-md, 8px)',
                      background: 'var(--bg-tertiary, rgba(255,255,255,0.03))',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {month.month}
                    </div>
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                        direction: 'ltr',
                      }}
                    >
                      {formatCurrency(month.amount)}
                    </div>
                    {changePct !== null && (
                      <div
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          marginTop: '4px',
                          color: changePct > 0 ? 'var(--accent-danger, #ef4444)' : 'var(--accent-secondary, #10b981)',
                        }}
                      >
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

      {/* Responsive: single column on mobile */}
      <style>{`
        @media (max-width: 768px) {
          .dashboard-premium-row {
            grid-template-columns: 1fr !important;
          }
          .dashboard-monthly-comparison {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}
