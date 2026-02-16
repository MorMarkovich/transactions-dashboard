import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Heart, ChevronDown, ChevronUp } from 'lucide-react'
import RadialProgress from '../ui/RadialProgress'
import type {
  MetricsData,
  ForecastData,
  AnomalyItem,
  RecurringTransaction,
} from '../../services/types'

// ─── Props ────────────────────────────────────────────────────────────

interface FinancialHealthScoreProps {
  metrics: MetricsData
  forecast: ForecastData | null
  anomalies: AnomalyItem[]
  recurring: RecurringTransaction[]
}

// ─── Factor Labels (Hebrew) ──────────────────────────────────────────

const FACTOR_LABELS: Record<string, string> = {
  spending: 'מגמת הוצאות',
  anomalies: 'חריגות',
  recurring: 'מנויים קבועים',
  incomeRatio: 'יחס הכנסות/הוצאות',
}

const FACTOR_MAX: Record<string, number> = {
  spending: 30,
  anomalies: 25,
  recurring: 25,
  incomeRatio: 20,
}

// ─── Helpers ──────────────────────────────────────────────────────────

function computeScore(
  metrics: MetricsData,
  forecast: ForecastData | null,
  anomalies: AnomalyItem[],
  recurring: RecurringTransaction[],
) {
  // Spending trend factor (30 pts)
  let spendingFactor = 20
  if (forecast) {
    if (forecast.trend_direction === 'down') spendingFactor = 30
    else if (forecast.trend_direction === 'stable') spendingFactor = 20
    else if (forecast.trend_direction === 'up') spendingFactor = 5
  }

  // Anomaly factor (25 pts)
  const anomalyFactor = Math.max(0, 25 - anomalies.length * 5)

  // Recurring burden factor (25 pts)
  const recurringCount = recurring.length
  let recurringFactor = 5
  if (recurringCount < 3) recurringFactor = 25
  else if (recurringCount < 5) recurringFactor = 18
  else if (recurringCount < 8) recurringFactor = 10

  // Income ratio factor (20 pts)
  let incomeRatioFactor = 10
  if (metrics.total_income > 0) {
    const ratio = metrics.total_income / Math.abs(metrics.total_expenses)
    if (ratio > 1.2) incomeRatioFactor = 20
    else if (ratio > 1.0) incomeRatioFactor = 15
    else if (ratio > 0.8) incomeRatioFactor = 10
    else incomeRatioFactor = 5
  }

  const total = spendingFactor + anomalyFactor + recurringFactor + incomeRatioFactor

  return {
    total: Math.min(100, Math.max(0, total)),
    factors: {
      spending: spendingFactor,
      anomalies: anomalyFactor,
      recurring: recurringFactor,
      incomeRatio: incomeRatioFactor,
    },
  }
}

function getLetterGrade(score: number): string {
  if (score >= 80) return 'A'
  if (score >= 65) return 'B'
  if (score >= 50) return 'C'
  if (score >= 35) return 'D'
  return 'F'
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--success)'
  if (score >= 50) return 'var(--warning)'
  return 'var(--danger)'
}

function getGradeColor(score: number): string {
  if (score >= 80) return '#34d399'
  if (score >= 50) return '#fbbf24'
  return '#f87171'
}

// ─── Component ────────────────────────────────────────────────────────

export default function FinancialHealthScore({
  metrics,
  forecast,
  anomalies,
  recurring,
}: FinancialHealthScoreProps) {
  const [showBreakdown, setShowBreakdown] = useState(false)

  const { total, factors } = useMemo(
    () => computeScore(metrics, forecast, anomalies, recurring),
    [metrics, forecast, anomalies, recurring],
  )

  const letterGrade = getLetterGrade(total)
  const scoreColor = getScoreColor(total)
  const gradeColor = getGradeColor(total)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur, 16px))',
        WebkitBackdropFilter: 'blur(var(--glass-blur, 16px))',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: 'var(--space-6, 1.5rem)',
        direction: 'rtl',
      }}
    >
      {/* ─── Title ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: 'var(--space-4, 1rem)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(248, 113, 113, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Heart size={18} style={{ color: '#f87171' }} />
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          ציון בריאות פיננסית
        </h3>
      </div>

      {/* ─── Score Display ────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: 'var(--space-2, 0.5rem) 0 var(--space-4, 1rem)',
        }}
      >
        <RadialProgress
          value={total}
          size={140}
          color={scoreColor}
          strokeWidth={10}
        />

        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            color: gradeColor,
            lineHeight: 1,
            letterSpacing: '-0.025em',
          }}
        >
          {letterGrade}
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          {total >= 80
            ? 'מצב פיננסי מצוין!'
            : total >= 50
              ? 'מצב פיננסי סביר'
              : 'יש מקום לשיפור'}
        </p>
      </div>

      {/* ─── Toggle Breakdown ─────────────────────────────────── */}
      <button
        onClick={() => setShowBreakdown((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          padding: '8px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          fontFamily: "'Heebo', sans-serif",
          transition: 'color 0.15s',
        }}
      >
        <span>{showBreakdown ? 'הסתר פירוט' : 'הצג פירוט'}</span>
        {showBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* ─── Factors Breakdown ────────────────────────────────── */}
      {showBreakdown && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '8px',
          }}
        >
          {(Object.keys(factors) as Array<keyof typeof factors>).map((key) => {
            const value = factors[key]
            const max = FACTOR_MAX[key]
            const pct = (value / max) * 100

            return (
              <div key={key}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {FACTOR_LABELS[key]}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      direction: 'ltr',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {value}/{max}
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '9999px',
                    background: 'var(--bg-secondary, rgba(255,255,255,0.06))',
                    overflow: 'hidden',
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{
                      height: '100%',
                      borderRadius: '9999px',
                      background:
                        pct >= 75
                          ? 'var(--success)'
                          : pct >= 50
                            ? 'var(--warning)'
                            : 'var(--danger)',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </motion.div>
      )}
    </motion.div>
  )
}
