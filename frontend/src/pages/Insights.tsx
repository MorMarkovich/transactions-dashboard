import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Flame,
  Store,
  CalendarDays,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Minus,
  Percent,
  Lightbulb,
} from 'lucide-react'
import { transactionsApi } from '../services/api'
import type { InsightData, TrendStats } from '../services/types'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { formatCurrency, formatDate } from '../utils/formatting'

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
  }),
}

/* ------------------------------------------------------------------ */
/*  Background gradients for insight cards                             */
/* ------------------------------------------------------------------ */

const CARD_GRADIENTS = [
  'var(--gradient-stat-purple)',
  'var(--gradient-stat-green)',
  'var(--gradient-stat-blue)',
  'var(--gradient-stat-red)',
  'var(--gradient-stat-yellow)',
  'var(--gradient-stat-purple)',
  'var(--gradient-stat-green)',
  'var(--gradient-stat-blue)',
]

/* ------------------------------------------------------------------ */
/*  Insight Card sub-component                                         */
/* ------------------------------------------------------------------ */

interface InsightCardProps {
  icon: React.ReactNode
  iconBg: string
  title: string
  value: string
  subtitle: string
  extra?: string
  index: number
  backgroundGradient?: string
}

function InsightCard({ icon, iconBg, title, value, subtitle, extra, index, backgroundGradient }: InsightCardProps) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      style={backgroundGradient ? { background: backgroundGradient, borderRadius: 'var(--radius-lg, 12px)' } : undefined}
    >
      <Card
        className="insight-card glass-card"
        hover
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: iconBg,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
              }}
            >
              {title}
            </p>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '1.375rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.2,
              }}
            >
              {value}
            </p>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
              }}
            >
              {subtitle}
            </p>
            {extra && (
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                {extra}
              </p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function InsightsSkeleton() {
  return (
    <div style={{ direction: 'rtl' }}>
      <PageHeader
        title="תובנות"
        subtitle="תובנות חכמות על דפוסי ההוצאות שלך"
        icon={Lightbulb}
      />
      {/* Skeleton cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-md)',
        }}
      >
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>

      {/* Skeleton alerts */}
      <div style={{ marginTop: 'var(--space-xl)' }}>
        <Skeleton variant="rectangular" height={160} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function Insights() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [insights, setInsights] = useState<InsightData | null>(null)
  const [trendStats, setTrendStats] = useState<TrendStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return

    const controller = new AbortController()
    const { signal } = controller

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [insightsData, trendStatsData] = await Promise.all([
          transactionsApi.getInsights(sessionId, signal),
          transactionsApi.getTrendStats(sessionId, signal),
        ])
        setInsights(insightsData)
        setTrendStats(trendStatsData)
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('Error loading insights:', err)
          setError('שגיאה בטעינת התובנות')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    return () => controller.abort()
  }, [sessionId])

  // ── No session ────────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <EmptyState
        icon="💡"
        title="תובנות חכמות"
        text="העלה קובץ כדי לקבל תובנות מתקדמות על ההוצאות שלך"
      />
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return <InsightsSkeleton />
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <EmptyState
        icon="⚠️"
        title="שגיאה"
        text={error}
      />
    )
  }

  // ── No data ───────────────────────────────────────────────────────────
  if (!insights) return null

  const { biggest_expense, top_merchant, expensive_day, avg_transaction, large_transactions } =
    insights

  return (
    <div style={{ direction: 'rtl' }}>
      <PageHeader
        title="תובנות"
        subtitle="תובנות חכמות על דפוסי ההוצאות שלך"
        icon={Lightbulb}
      />

      {/* ─── Section title ──────────────────────────────────────────── */}
      <div className="section-header-v2">
        <span>תובנות חכמות</span>
      </div>

      {/* ─── Insight cards 3-column grid ──────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-md)',
        }}
      >
        {/* 1. Biggest expense */}
        <InsightCard
          index={0}
          icon={<Flame size={22} style={{ color: '#f87171' }} />}
          iconBg="rgba(239, 68, 68, 0.12)"
          title="ההוצאה הגדולה ביותר"
          value={formatCurrency(biggest_expense.amount)}
          subtitle={biggest_expense.description}
          extra={`${formatDate(biggest_expense.date)} · ${biggest_expense.category}`}
          backgroundGradient={CARD_GRADIENTS[0]}
        />

        {/* 2. Top merchant */}
        <InsightCard
          index={1}
          icon={<Store size={22} style={{ color: '#818cf8' }} />}
          iconBg="rgba(129, 140, 248, 0.12)"
          title="בית העסק המוביל"
          value={top_merchant.name}
          subtitle={`${top_merchant.count} ביקורים`}
          extra={`סה"כ ${formatCurrency(top_merchant.total)}`}
          backgroundGradient={CARD_GRADIENTS[1]}
        />

        {/* 3. Most expensive day */}
        <InsightCard
          index={2}
          icon={<CalendarDays size={22} style={{ color: '#f59e0b' }} />}
          iconBg="rgba(245, 158, 11, 0.12)"
          title="היום היקר ביותר"
          value={expensive_day.day}
          subtitle={`ממוצע ${formatCurrency(expensive_day.average)}`}
          backgroundGradient={CARD_GRADIENTS[2]}
        />

        {/* 4. Average per transaction */}
        <InsightCard
          index={3}
          icon={<BarChart3 size={22} style={{ color: '#34d399' }} />}
          iconBg="rgba(16, 185, 129, 0.12)"
          title="ממוצע לעסקה"
          value={formatCurrency(avg_transaction)}
          subtitle="ממוצע לכל העסקאות"
          backgroundGradient={CARD_GRADIENTS[3]}
        />
      </div>

      {/* ─── Extra insights from trend stats ────────────────────────── */}
      {trendStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          style={{ marginTop: 'var(--space-xl)' }}
        >
          <div className="section-header-v2">
            <span>תובנות נוספות</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--space-md)',
            }}
          >
            <InsightCard
              index={4}
              icon={<TrendingUp size={22} style={{ color: '#06b6d4' }} />}
              iconBg="rgba(6, 182, 212, 0.12)"
              title="ממוצע יומי"
              value={formatCurrency(trendStats.daily_avg)}
              subtitle="הוצאה ממוצעת ליום עם עסקאות"
              backgroundGradient={CARD_GRADIENTS[4]}
            />
            <InsightCard
              index={5}
              icon={<Minus size={22} style={{ color: '#8b5cf6' }} />}
              iconBg="rgba(139, 92, 246, 0.12)"
              title="חציון לעסקה"
              value={formatCurrency(trendStats.median)}
              subtitle="ערך חציון לכל עסקה"
              backgroundGradient={CARD_GRADIENTS[5]}
            />
            {(() => {
              const lastMonth = trendStats.monthly?.length
                ? trendStats.monthly[trendStats.monthly.length - 1]
                : undefined
              const changePct = lastMonth?.change_pct
              return trendStats.monthly?.length > 0 && changePct != null ? (
                <InsightCard
                  index={6}
                  icon={<Percent size={22} style={{ color: '#ec4899' }} />}
                  iconBg="rgba(236, 72, 153, 0.12)"
                  title="שינוי חודשי"
                  value={changePct >= 0 ? `+${changePct}%` : `${changePct}%`}
                  subtitle="השוואה לחודש הקודם"
                  backgroundGradient={CARD_GRADIENTS[6]}
                />
              ) : (
                <InsightCard
                  index={6}
                  icon={<Flame size={22} style={{ color: '#f97316' }} />}
                  iconBg="rgba(249, 115, 22, 0.12)"
                  title="הוצאה מקסימלית"
                  value={formatCurrency(trendStats.max_expense)}
                  subtitle="העסקה היקרה ביותר"
                  backgroundGradient={CARD_GRADIENTS[6]}
                />
              )
            })()}
            <InsightCard
              index={7}
              icon={<BarChart3 size={22} style={{ color: '#10b981' }} />}
              iconBg="rgba(16, 185, 129, 0.12)"
              title="סה״כ עסקאות"
              value={String(trendStats.transaction_count)}
              subtitle="מספר עסקאות הוצאה"
              backgroundGradient={CARD_GRADIENTS[7]}
            />
          </div>
        </motion.div>
      )}

      {/* ─── Large transaction alerts ───────────────────────────────── */}
      {large_transactions && large_transactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          style={{ marginTop: 'var(--space-xl)' }}
        >
          <div className="section-header-v2">
            <span>התראות עסקאות גדולות</span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)',
            }}
          >
            {large_transactions.map((tx, idx) => (
              <motion.div
                key={`${tx.תאריך}-${tx.תיאור}-${idx}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.05, duration: 0.3 }}
              >
                <Card className="glass-card" padding="sm">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    {/* Warning icon */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(245, 158, 11, 0.12)',
                        flexShrink: 0,
                      }}
                    >
                      <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                    </div>

                    {/* Description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tx.תיאור}
                      </p>
                      <p
                        style={{
                          margin: '2px 0 0',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {formatDate(tx.תאריך)}
                        {tx.קטגוריה && ` · ${tx.קטגוריה}`}
                      </p>
                    </div>

                    {/* Amount + badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexShrink: 0,
                      }}
                    >
                      <Badge variant="warning" size="sm">
                        חריגה
                      </Badge>
                      <span
                        style={{
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: 'var(--accent-danger, #ef4444)',
                          direction: 'ltr',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatCurrency(tx.סכום)}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .insight-card {
            /* Let the grid handle 1-col on mobile via parent */
          }
        }
      `}</style>
    </div>
  )
}
