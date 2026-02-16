import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TrendingUp, ArrowUpRight, ArrowDownRight, Activity, Hash, Calculator } from 'lucide-react'
import { motion } from 'framer-motion'
import LineChart from '../components/charts/LineChart'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import Badge from '../components/ui/Badge'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import { transactionsApi } from '../services/api'
import { formatCurrency } from '../utils/formatting'
import type { RawTrendData, TrendStats } from '../services/types'

// ---------------------------------------------------------------------------
// Stat card configuration
// ---------------------------------------------------------------------------
interface StatCard {
  key: string
  label: string
  icon: React.ReactNode
  gradient: string
  getNumericValue: (s: TrendStats) => number
  formatter: (v: number) => string
}

const STAT_CARDS: StatCard[] = [
  {
    key: 'max_expense',
    label: '\u05D4\u05D5\u05E6\u05D0\u05D4 \u05D2\u05D3\u05D5\u05DC\u05D4',
    icon: <ArrowUpRight size={18} color="#fff" />,
    gradient: 'var(--gradient-stat-red, linear-gradient(135deg, #f093fb 0%, #f5576c 100%))',
    getNumericValue: (s) => Math.abs(s.max_expense),
    formatter: formatCurrency,
  },
  {
    key: 'daily_avg',
    label: '\u05DE\u05DE\u05D5\u05E6\u05E2 \u05D9\u05D5\u05DE\u05D9',
    icon: <Calculator size={18} color="#fff" />,
    gradient: 'var(--gradient-stat-blue, linear-gradient(135deg, #4facfe 0%, #00f2fe 100%))',
    getNumericValue: (s) => Math.abs(s.daily_avg),
    formatter: formatCurrency,
  },
  {
    key: 'median',
    label: '\u05D7\u05E6\u05D9\u05D5\u05DF',
    icon: <Activity size={18} color="#fff" />,
    gradient: 'var(--gradient-stat-green, linear-gradient(135deg, #43e97b 0%, #38f9d7 100%))',
    getNumericValue: (s) => Math.abs(s.median),
    formatter: formatCurrency,
  },
  {
    key: 'transaction_count',
    label: '\u05DE\u05E1\u05E4\u05E8 \u05E2\u05E1\u05E7\u05D0\u05D5\u05EA',
    icon: <Hash size={18} color="#fff" />,
    gradient: 'var(--gradient-stat-purple, linear-gradient(135deg, #667eea 0%, #764ba2 100%))',
    getNumericValue: (s) => s.transaction_count,
    formatter: (v) => v.toLocaleString('he-IL'),
  },
]

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
  }),
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Trends() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  // Data state
  const [trendData, setTrendData] = useState<RawTrendData | null>(null)
  const [trendStats, setTrendStats] = useState<TrendStats | null>(null)

  // UI state
  const [loading, setLoading] = useState(false)

  // ---- Fetch trend data and stats in parallel with AbortController --------
  useEffect(() => {
    if (!sessionId) return

    const controller = new AbortController()
    const { signal } = controller

    const fetchData = async () => {
      setLoading(true)

      try {
        const [trendRes, statsRes] = await Promise.all([
          transactionsApi.getTrendChartV2(sessionId, signal),
          transactionsApi.getTrendStats(sessionId, signal),
        ])

        setTrendData(trendRes)
        setTrendStats(statsRes)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('Error loading trend data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    return () => controller.abort()
  }, [sessionId])

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
        subtitle="ניתוח מגמות ההוצאות לאורך זמן"
        icon={TrendingUp}
      />

      {/* ── Stats Cards (compact horizontal layout) ───────────────────── */}
      {trendStats && (
        <div className="card-grid-responsive" style={{ marginBottom: 'var(--space-lg)' }}>
          {STAT_CARDS.map((card, index) => (
            <motion.div
              key={card.key}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="stat-card-compact glass-card">
                <div className="stat-icon" style={{ background: card.gradient }}>
                  {card.icon}
                </div>
                <div className="stat-content">
                  <div className="stat-value">
                    <AnimatedNumber value={card.getNumericValue(trendStats)} formatter={card.formatter} />
                  </div>
                  <div className="stat-label">{card.label}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Trend Line Chart ─────────────────────────────────────────── */}
      <div className="section-header-v2">
        <span>{'\u05DE\u05D2\u05DE\u05EA \u05DE\u05D0\u05D6\u05DF \u05DE\u05E6\u05D8\u05D1\u05E8'}</span>
      </div>
      <Card className="glass-card" padding="md">
        <LineChart data={lineChartData} height={300} />
      </Card>

      {/* ── Monthly Comparison Table ─────────────────────────────────── */}
      {trendStats?.monthly && trendStats.monthly.length > 0 && (
        <>
          <div className="section-header-v2" style={{ marginTop: 'var(--space-xl)' }}>
            <span>{'\u05D4\u05E9\u05D5\u05D5\u05D0\u05D4 \u05D7\u05D5\u05D3\u05E9\u05D9\u05EA'}</span>
          </div>
          <Card className="glass-card" padding="none">
            <div className="table-scroll">
              <table
                className="transactions-table"
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
                      <td style={{ fontWeight: 600 }}>{row.month}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(Math.abs(row.amount))}
                      </td>
                      <td>
                        {row.change_pct !== null ? (
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
          </Card>
        </>
      )}
    </div>
  )
}
