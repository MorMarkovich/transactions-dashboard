import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TrendingUp, ArrowUpRight, ArrowDownRight, Activity, Hash, Calculator, type LucideIcon } from 'lucide-react'
import LineChart from '../components/charts/LineChart'
import { currentMonthKey } from '../utils/formatting'
import EmptyState from '../components/common/EmptyState'
import Button from '../components/ui/Button'
import PageHeader from '../components/common/PageHeader'
import WorkspaceMetrics from '../components/common/WorkspaceMetrics'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import Badge from '../components/ui/Badge'
import { transactionsApi } from '../services/api'
import { useDashboardFilterSelection } from '../context/FilterContext'
import { formatCurrency } from '../utils/formatting'
import type { RawTrendData, TrendStats } from '../services/types'

// ---------------------------------------------------------------------------
// Stat card configuration
// ---------------------------------------------------------------------------
interface StatCard {
  label: string
  icon: LucideIcon
  getNumericValue: (s: TrendStats) => number
  formatter: (v: number) => string
}

const STAT_CARDS: StatCard[] = [
  {
    label: '\u05D4\u05D5\u05E6\u05D0\u05D4 \u05D2\u05D3\u05D5\u05DC\u05D4',
    icon: ArrowUpRight,
    getNumericValue: (s) => Math.abs(s.max_expense),
    formatter: formatCurrency,
  },
  {
    label: '\u05DE\u05DE\u05D5\u05E6\u05E2 \u05D9\u05D5\u05DE\u05D9',
    icon: Calculator,
    getNumericValue: (s) => Math.abs(s.daily_avg),
    formatter: formatCurrency,
  },
  {
    label: '\u05D7\u05E6\u05D9\u05D5\u05DF',
    icon: Activity,
    getNumericValue: (s) => Math.abs(s.median),
    formatter: formatCurrency,
  },
  {
    label: '\u05E2\u05E1\u05E7\u05D0\u05D5\u05EA \u05D4\u05D5\u05E6\u05D0\u05D4',
    icon: Hash,
    getNumericValue: (s) => s.transaction_count,
    formatter: (v) => v.toLocaleString('he-IL'),
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Trends() {
  const { owner, category: dashboardCategory, subcategories } = useDashboardFilterSelection()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  // Data state
  const [trendData, setTrendData] = useState<RawTrendData | null>(null)
  const [trendStats, setTrendStats] = useState<TrendStats | null>(null)

  // UI state
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  // ---- Fetch trend data and stats in parallel with AbortController --------
  useEffect(() => {
    if (!sessionId) return

    const controller = new AbortController()
    const { signal } = controller

    const fetchData = async () => {
      setLoading(true)

      try {
        const scoped = owner || dashboardCategory || subcategories.length
          ? await transactionsApi.scopeSession(sessionId, owner, signal, dashboardCategory, subcategories)
          : sessionId
        if (signal.aborted) return
        const [trendRes, statsRes] = await Promise.all([
          transactionsApi.getTrendChartV2(scoped, signal),
          transactionsApi.getTrendStats(scoped, signal),
        ])

        if (signal.aborted) return
        setTrendData(trendRes)
        setTrendStats(statsRes)
        setLoadError(false)
      } catch (err: unknown) {
        if (signal.aborted) return
        if ((err instanceof DOMException && err.name === 'AbortError') || (err as { name?: string })?.name === 'CanceledError') return
        console.error('Error loading trend data:', err)
        setLoadError(true)
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    }

    fetchData()

    return () => controller.abort()
  }, [sessionId, retryNonce, owner, dashboardCategory, subcategories])

  // ---- Transform trend points for LineChart --------------------------------
  const lineChartData = useMemo(() => {
    if (!trendData?.points) return []
    return trendData.points.map((p) => ({
      label: p.date,
      value: p.balance,
    }))
  }, [trendData])

  // ---- No session: empty state --------------------------------------------
  if (!sessionId) {
    return (
      <EmptyState
        icon={'\u{1F4C8}'}
        title={'\u05DE\u05D2\u05DE\u05D5\u05EA \u05D5\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD'}
        text={'\u05D4\u05E2\u05DC\u05D4 \u05E7\u05D5\u05D1\u05E5 \u05DB\u05D3\u05D9 \u05DC\u05E8\u05D0\u05D5\u05EA \u05DE\u05D2\u05DE\u05D5\u05EA'}
      />
    )
  }

  // ---- Load failure: distinct from the no-session empty state ------------
  if (loadError && !trendData) {
    return (
      <EmptyState
        icon={'\u{26A0}\u{FE0F}'}
        title={'\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05E0\u05D5 \u05DC\u05D8\u05E2\u05D5\u05DF \u05D0\u05EA \u05D4\u05DE\u05D2\u05DE\u05D5\u05EA'}
        text={'\u05D0\u05D9\u05E8\u05E2\u05D4 \u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D8\u05E2\u05D9\u05E0\u05EA \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD. \u05D1\u05D3\u05E7\u05D5 \u05D0\u05EA \u05D4\u05D7\u05D9\u05D1\u05D5\u05E8 \u05D5\u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1.'}
        action={
          <Button variant="primary" size="sm" onClick={() => setRetryNonce((n) => n + 1)}>
            {'\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1'}
          </Button>
        }
      />
    )
  }

  // ---- Loading skeleton ---------------------------------------------------
  if (loading) {
    return (
      <div>
        <PageHeader
          title="מגמות"
          subtitle="ניתוח מגמות ההוצאות לאורך זמן"
          icon={TrendingUp}
        />
        {/* Stats skeleton */}
        <div className="card-grid-responsive">
          <Skeleton variant="card" count={4} />
        </div>
        {/* Chart skeleton */}
        <div style={{ marginTop: 'var(--space-xl)' }}>
          <Skeleton variant="rectangular" height={300} />
        </div>
        {/* Table skeleton */}
        <div style={{ marginTop: 'var(--space-xl)' }}>
          <Skeleton variant="rectangular" height={200} />
        </div>
      </div>
    )
  }

  // ---- Render -------------------------------------------------------------
  return (
    <div>
      <PageHeader
        title="מגמות"
        subtitle="ניתוח מגמות ההוצאות לאורך זמן, לפי תאריך העסקה (לא תאריך החיוב)"
        icon={TrendingUp}
      />

      {trendStats && (
        <WorkspaceMetrics label="סיכום מגמות" metrics={STAT_CARDS.map(card => ({
          label: card.label,
          value: card.formatter(card.getNumericValue(trendStats)),
          icon: card.icon,
        }))} />
      )}

      {/* ── Trend Line Chart ─────────────────────────────────────────── */}
      <div className="section-header-v2">
        <span>{'\u05DE\u05D2\u05DE\u05EA \u05DE\u05D0\u05D6\u05DF \u05DE\u05E6\u05D8\u05D1\u05E8'}</span>
      </div>
      <Card className="glass-card" padding="md">
        <LineChart data={lineChartData} height={300} name="יתרה" />
      </Card>

      {/* ── Monthly Comparison Table ─────────────────────────────────── */}
      {trendStats?.monthly && trendStats.monthly.length > 0 && (
        <>
          <div className="section-header-v2" style={{ marginTop: 'var(--space-xl)' }}>
            <span>{'\u05D4\u05E9\u05D5\u05D5\u05D0\u05D4 \u05D7\u05D5\u05D3\u05E9\u05D9\u05EA'}</span>
          </div>
          <Card className="glass-card" padding="none">
            <div className="table-card">
            <div className="table-scroll">
              <table
                className="transactions-table mobile-stack-table"
                role="table"
                aria-label={'\u05D8\u05D1\u05DC\u05EA \u05D4\u05E9\u05D5\u05D5\u05D0\u05D4 \u05D7\u05D5\u05D3\u05E9\u05D9\u05EA'}
              >
                <thead>
                  <tr>
                    <th scope="col">{'\u05D7\u05D5\u05D3\u05E9'}</th>
                    <th scope="col">{'\u05E1\u05DB\u05D5\u05DD'}</th>
                    <th scope="col">{'\u05E9\u05D9\u05E0\u05D5\u05D9'}</th>
                  </tr>
                </thead>
                <tbody>
                  {trendStats.monthly.map((row) => (
                    <tr key={row.month}>
                      <td data-label={'\u05D7\u05D5\u05D3\u05E9'} style={{ fontWeight: 600 }}>{row.month}</td>
                      <td data-label={'\u05E1\u05DB\u05D5\u05DD'} style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(Math.abs(row.amount))}
                      </td>
                      <td data-label={'\u05E9\u05D9\u05E0\u05D5\u05D9'}>
                        {row.month === currentMonthKey() ? (
                          <Badge variant="default" size="sm">
                            {'\u05D7\u05D5\u05D3\u05E9 \u05D7\u05DC\u05E7\u05D9'}
                          </Badge>
                        ) : row.change_pct !== null ? (
                          <Badge
                            variant={row.change_pct >= 0 ? 'danger' : 'success'}
                            size="sm"
                          >
                            {row.change_pct >= 0 ? (
                              <ArrowUpRight size={12} />
                            ) : (
                              <ArrowDownRight size={12} />
                            )}
                            {Math.abs(row.change_pct).toFixed(1)}%
                          </Badge>
                        ) : (
                          <Badge variant="default" size="sm">
                            {'\u2014'}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
