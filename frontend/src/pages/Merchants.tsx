import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Store, ShoppingBag, Hash, TrendingUp, DollarSign, Users, Crown } from 'lucide-react'
import { transactionsApi } from '../services/api'
import type { MerchantData } from '../services/types'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import Button from '../components/ui/Button'
import MerchantChart from '../components/charts/MerchantChart'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { formatCurrency, formatNumber } from '../utils/formatting'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COUNT_OPTIONS = [5, 8, 10, 15] as const

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
  }),
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function MerchantsSkeleton() {
  return (
    <div style={{ direction: 'rtl' }}>
      <PageHeader
        title="בתי עסק"
        subtitle="ניתוח הוצאות לפי בתי עסק"
        icon={Store}
      />
      {/* Stats skeleton */}
      <div className="card-grid-responsive" style={{ marginBottom: 'var(--space-lg)' }}>
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
      {/* Chart skeleton */}
      <Skeleton variant="rectangular" height={300} />

      {/* Count selector skeleton */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginTop: 'var(--space-lg)',
          justifyContent: 'center',
        }}
      >
        {COUNT_OPTIONS.map((n) => (
          <Skeleton key={n} variant="rectangular" width={56} height={36} />
        ))}
      </div>

      {/* Card grid skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-md)',
          marginTop: 'var(--space-lg)',
        }}
      >
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function Merchants() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [merchantCount, setMerchantCount] = useState<number>(8)
  const [merchantData, setMerchantData] = useState<MerchantData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return

    const controller = new AbortController()
    const { signal } = controller

    const fetchMerchants = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await transactionsApi.getMerchants(sessionId, merchantCount, signal)
        setMerchantData(data)
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('Error loading merchants:', err)
          setError('שגיאה בטעינת בתי העסק')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchMerchants()
    return () => controller.abort()
  }, [sessionId, merchantCount])

  // ── Computed summary stats ──────────────────────────────────────────
  const summaryStats = useMemo(() => {
    if (!merchantData?.merchants.length) return null
    const { merchants } = merchantData
    const uniqueCount = merchants.length
    const totalSpending = merchants.reduce((sum, m) => sum + Math.abs(m.total), 0)
    const mostFrequent = merchants.reduce((prev, curr) =>
      curr.count > prev.count ? curr : prev, merchants[0])
    return { uniqueCount, totalSpending, mostFrequent }
  }, [merchantData])

  // ── No session ────────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <EmptyState
        icon="🏪"
        title="בתי עסק מובילים"
        text="העלה קובץ כדי לראות ניתוח של בתי העסק שלך"
      />
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading && !merchantData) {
    return <MerchantsSkeleton />
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (error) {
    return <EmptyState icon="⚠️" title="שגיאה" text={error} />
  }

  // ── No data ───────────────────────────────────────────────────────────
  if (!merchantData || !merchantData.merchants.length) {
    return (
      <EmptyState
        icon="🏪"
        title="אין נתונים"
        text="לא נמצאו נתוני בתי עסק בקובץ שהועלה"
      />
    )
  }

  const { merchants } = merchantData

  return (
    <div style={{ direction: 'rtl' }}>
      <PageHeader
        title="בתי עסק"
        subtitle="ניתוח הוצאות לפי בתי עסק"
        icon={Store}
      />

      {/* ─── Summary Stats Row ───────────────────────────────────────── */}
      {summaryStats && (
        <div className="card-grid-responsive" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="stat-card-compact glass-card">
            <div className="stat-icon" style={{ background: 'var(--gradient-stat-blue, linear-gradient(135deg, #4facfe, #00f2fe))' }}>
              <Users size={18} color="#fff" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{summaryStats.uniqueCount}</div>
              <div className="stat-label">בתי עסק</div>
            </div>
          </div>
          <div className="stat-card-compact glass-card">
            <div className="stat-icon" style={{ background: 'var(--gradient-stat-green, linear-gradient(135deg, #43e97b, #38f9d7))' }}>
              <DollarSign size={18} color="#fff" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(summaryStats.totalSpending)}</div>
              <div className="stat-label">סה"כ הוצאות</div>
            </div>
          </div>
          <div className="stat-card-compact glass-card">
            <div className="stat-icon" style={{ background: 'var(--gradient-stat-purple, linear-gradient(135deg, #667eea, #764ba2))' }}>
              <Crown size={18} color="#fff" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{summaryStats.mostFrequent.name}</div>
              <div className="stat-label">הכי תדיר ({summaryStats.mostFrequent.count} ביקורים)</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Section title ──────────────────────────────────────────── */}
      <div className="section-header-v2">
        <span>בתי עסק מובילים</span>
      </div>

      {/* ─── Count selector ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: 'var(--space-lg)',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            marginLeft: '4px',
          }}
        >
          הצג:
        </span>
        {COUNT_OPTIONS.map((n) => (
          <Button
            key={n}
            variant={merchantCount === n ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMerchantCount(n)}
          >
            {n}
          </Button>
        ))}
      </div>

      {/* ─── Merchant chart ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass-card" padding="md">
          <MerchantChart data={merchants} />
        </Card>
      </motion.div>

      {/* ─── Merchant detail cards ──────────────────────────────────── */}
      <div
        className="section-header-v2"
        style={{ marginTop: 'var(--space-xl)' }}
      >
        <span>פירוט בתי עסק</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 'var(--space-md)',
        }}
      >
        {merchants.map((merchant, idx) => (
          <motion.div
            key={merchant.name}
            custom={idx}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <Card className="glass-card" hover>
              {/* Merchant name header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '14px',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(129, 140, 248, 0.12)',
                    flexShrink: 0,
                  }}
                >
                  <Store size={20} style={{ color: '#818cf8' }} />
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={merchant.name}
                >
                  {merchant.name}
                </h3>
              </div>

              {/* Stats */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* Total spent */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag
                    size={14}
                    style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {"סה\"כ:"}
                  </span>
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginRight: 'auto',
                    }}
                  >
                    <AnimatedNumber value={merchant.total} formatter={formatCurrency} />
                  </span>
                </div>

                {/* Visit count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Hash
                    size={14}
                    style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    ביקורים:
                  </span>
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginRight: 'auto',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatNumber(merchant.count)}
                  </span>
                </div>

                {/* Average per visit */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp
                    size={14}
                    style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    ממוצע לביקור:
                  </span>
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginRight: 'auto',
                    }}
                  >
                    <AnimatedNumber value={merchant.average} formatter={formatCurrency} />
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
