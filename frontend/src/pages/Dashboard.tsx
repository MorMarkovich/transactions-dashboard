import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, BarChart3, PieChart, CalendarDays, RefreshCw, TrendingUp, Zap } from 'lucide-react'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import SparklineChart from '../components/charts/SparklineChart'
import MetricsGrid from '../components/metrics/MetricsGrid'
import DonutChart from '../components/charts/DonutChart'
import BarChart from '../components/charts/BarChart'
import WeekdayChart from '../components/charts/WeekdayChart'
import CategoryList from '../components/category/CategoryList'
import EmptyState from '../components/common/EmptyState'
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

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        ])

        setMetrics(results[0] as MetricsData)
        setDonutData(results[1] as RawDonutData)
        setMonthlyData(results[2] as RawMonthlyData)
        setWeekdayData(results[3] as RawWeekdayData)
        if (results[4]) setWeeklySummary(results[4] as WeeklySummaryData)
        if (results[5]) setForecast(results[5] as ForecastData)
        if (results[6]) setVelocity(results[6] as SpendingVelocityData)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message =
          err instanceof Error ? err.message : '\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D8\u05E2\u05D9\u05E0\u05EA \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD'
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
      '\u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D4': cat.name,
      '\u05E1\u05DB\u05D5\u05DD_\u05DE\u05D5\u05D7\u05DC\u05D8': cat.value,
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
          icon="\u{1F4CA}"
          title={'\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC\u05D3\u05D0\u05E9\u05D1\u05D5\u05E8\u05D3!'}
          text={'\u05D4\u05E2\u05DC\u05D4 \u05E7\u05D5\u05D1\u05E5 \u05D0\u05E7\u05E1\u05DC \u05D0\u05D5 CSV \u05DE\u05D7\u05D1\u05E8\u05EA \u05D4\u05D0\u05E9\u05E8\u05D0\u05D9 \u05E9\u05DC\u05DA \u05DB\u05D3\u05D9 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05D1\u05E0\u05D9\u05EA\u05D5\u05D7'}
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
            <div className="feature-icon">{'\u{1F4CA}'}</div>
            <div className="feature-title">{'\u05E0\u05D9\u05EA\u05D5\u05D7 \u05D5\u05D9\u05D6\u05D5\u05D0\u05DC\u05D9'}</div>
            <div className="feature-desc">
              {'\u05D2\u05E8\u05E4\u05D9\u05DD \u05D0\u05D9\u05E0\u05D8\u05E8\u05D0\u05E7\u05D8\u05D9\u05D1\u05D9\u05D9\u05DD \u05D5\u05D7\u05DB\u05DE\u05D9\u05DD \u05DC\u05EA\u05D5\u05D1\u05E0\u05D5\u05EA \u05DE\u05D9\u05D9\u05D3\u05D9\u05D5\u05EA'}
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">{'\u{1F3F7}\uFE0F'}</div>
            <div className="feature-title">{'\u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D5\u05EA \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05D5\u05EA'}</div>
            <div className="feature-desc">
              {'\u05D6\u05D9\u05D4\u05D5\u05D9 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9 \u05E9\u05DC \u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D5\u05EA \u05DE\u05D4\u05E7\u05D5\u05D1\u05E5 \u05D4\u05DE\u05E7\u05D5\u05E8\u05D9'}
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">{'\u{1F4D1}'}</div>
            <div className="feature-title">{'\u05EA\u05DE\u05D9\u05DB\u05D4 \u05DE\u05DC\u05D0\u05D4'}</div>
            <div className="feature-desc">
              {'Excel \u05E2\u05DD \u05DE\u05E1\u05E4\u05E8 \u05D2\u05DC\u05D9\u05D5\u05E0\u05D5\u05EA, CSV \u05D1\u05E2\u05D1\u05E8\u05D9\u05EA \u05DE\u05DC\u05D0\u05D4'}
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
        {/* 4 metric card skeletons */}
        <div className="metrics-grid">
          <Skeleton variant="card" count={4} />
        </div>

        {/* 2-column chart skeleton */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '3fr 2fr',
            gap: 'var(--space-lg)',
            marginTop: 'var(--space-xl)',
          }}
        >
          <div>
            <Skeleton variant="rectangular" height={260} />
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <Skeleton variant="rectangular" height={230} />
            </div>
          </div>
          <div>
            <Skeleton variant="rectangular" height={340} />
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <Skeleton variant="rectangular" height={200} />
            </div>
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
          {'\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1'}
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

      <MetricsGrid metrics={metrics} />

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
                  {weeklySummary.change_pct > 0 ? '\u2191' : '\u2193'} {Math.abs(weeklySummary.change_pct)}%
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'right' }}>
              {formatCurrency(weeklySummary.this_week.total)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {weeklySummary.this_week.count} \u05E2\u05E1\u05E7\u05D0\u05D5\u05EA \u00B7 {weeklySummary.this_week.top_category}
            </p>
          </div>

          {/* Last week */}
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>\u05E9\u05D1\u05D5\u05E2 \u05E9\u05E2\u05D1\u05E8</span>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'right' }}>
              {formatCurrency(weeklySummary.last_week.total)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {weeklySummary.last_week.count} \u05E2\u05E1\u05E7\u05D0\u05D5\u05EA \u00B7 {weeklySummary.last_week.top_category}
            </p>
          </div>
        </motion.div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '3fr 2fr',
          gap: 'var(--space-lg)',
          marginTop: 'var(--space-xl)',
        }}
        className="dashboard-grid"
      >
        {/* Left column: Monthly + Weekday charts */}
        <div>
          <div className="section-title">
            <Calendar size={20} />
            <span>{'\u05D4\u05D5\u05E6\u05D0\u05D5\u05EA \u05DC\u05E4\u05D9 \u05D7\u05D5\u05D3\u05E9'}</span>
          </div>
          <Card className="glass-card" padding="md">
            <BarChart data={monthlyChartData} />
          </Card>

          <div className="section-title" style={{ marginTop: 'var(--space-lg)' }}>
            <CalendarDays size={20} />
            <span>{'\u05D4\u05EA\u05E4\u05DC\u05D2\u05D5\u05EA \u05DC\u05E4\u05D9 \u05D9\u05D5\u05DD \u05D1\u05E9\u05D1\u05D5\u05E2'}</span>
          </div>
          <Card className="glass-card" padding="md">
            <WeekdayChart data={weekdayChartData} />
          </Card>
        </div>

        {/* Right column: Donut + Category list */}
        <div>
          <div className="section-title">
            <PieChart size={20} />
            <span>{'\u05D7\u05DC\u05D5\u05E7\u05D4 \u05DC\u05E4\u05D9 \u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D4'}</span>
          </div>
          <Card className="glass-card" padding="md">
            {donutChartData.data.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <DonutChart data={donutChartData.data} total={donutChartData.total} />
              </div>
            )}
          </Card>

          <div className="section-title" style={{ marginTop: 'var(--space-lg)' }}>
            <BarChart3 size={20} />
            <span>{'\u05E4\u05D9\u05E8\u05D5\u05D8 \u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D5\u05EA'}</span>
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
              <div className="section-title" style={{ marginBottom: 'var(--space-sm)' }}>
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
                  {forecast.trend_direction === 'up' ? '↑' : forecast.trend_direction === 'down' ? '↓' : '→'} {forecast.trend_direction === 'up' ? 'עלייה' : forecast.trend_direction === 'down' ? 'ירידה' : 'יציב'}
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
              <div className="section-title" style={{ marginBottom: 'var(--space-sm)' }}>
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

      {/* Responsive: single column on mobile */}
      <style>{`
        @media (max-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }
          .dashboard-premium-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
