import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calendar, BarChart3, PieChart, CalendarDays, RefreshCw } from 'lucide-react'
import MetricsGrid from '../components/metrics/MetricsGrid'
import DonutChart from '../components/charts/DonutChart'
import BarChart from '../components/charts/BarChart'
import WeekdayChart from '../components/charts/WeekdayChart'
import CategoryList from '../components/category/CategoryList'
import EmptyState from '../components/common/EmptyState'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import Button from '../components/ui/Button'
import { transactionsApi } from '../services/api'
import type {
  MetricsData,
  RawDonutData,
  RawMonthlyData,
  RawWeekdayData,
  CategoryData,
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
        const [metricsRes, donutRes, monthlyRes, weekdayRes] = await Promise.all([
          transactionsApi.getMetrics(sessionId, signal),
          transactionsApi.getDonutChartV2(sessionId, signal),
          transactionsApi.getMonthlyChartV2(sessionId, signal),
          transactionsApi.getWeekdayChartV2(sessionId, signal),
        ])

        setMetrics(metricsRes)
        setDonutData(donutRes)
        setMonthlyData(monthlyRes)
        setWeekdayData(weekdayRes)
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
    <div>
      <MetricsGrid metrics={metrics} />

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
          <Card padding="md">
            <BarChart data={monthlyChartData} />
          </Card>

          <div className="section-title" style={{ marginTop: 'var(--space-lg)' }}>
            <CalendarDays size={20} />
            <span>{'\u05D4\u05EA\u05E4\u05DC\u05D2\u05D5\u05EA \u05DC\u05E4\u05D9 \u05D9\u05D5\u05DD \u05D1\u05E9\u05D1\u05D5\u05E2'}</span>
          </div>
          <Card padding="md">
            <WeekdayChart data={weekdayChartData} />
          </Card>
        </div>

        {/* Right column: Donut + Category list */}
        <div>
          <div className="section-title">
            <PieChart size={20} />
            <span>{'\u05D7\u05DC\u05D5\u05E7\u05D4 \u05DC\u05E4\u05D9 \u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D4'}</span>
          </div>
          <Card padding="md">
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

      {/* Responsive: single column on mobile */}
      <style>{`
        @media (max-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
