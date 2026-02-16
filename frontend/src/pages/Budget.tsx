import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Target,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  PiggyBank,
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import PageHeader from '../components/common/PageHeader'
import RadialProgress from '../components/ui/RadialProgress'
import EmptyState from '../components/common/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import { formatCurrency, formatPercent } from '../utils/formatting'
import { transactionsApi } from '../services/api'
import type { MetricsData, RawDonutData } from '../services/types'

// ─── Types ─────────────────────────────────────────────────────────────

interface BudgetGoal {
  id: string
  category: string
  limit: number
}

const STORAGE_KEY = 'budget-goals'

// ─── Helpers ───────────────────────────────────────────────────────────

function loadGoals(): BudgetGoal[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveGoals(goals: BudgetGoal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals))
}

// ─── Animation ─────────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
  }),
}

// ─── Component ─────────────────────────────────────────────────────────

export default function Budget() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  // Data
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [donutData, setDonutData] = useState<RawDonutData | null>(null)
  const [loading, setLoading] = useState(false)

  // Budget goals
  const [goals, setGoals] = useState<BudgetGoal[]>(loadGoals)
  const [newCategory, setNewCategory] = useState('')
  const [newLimit, setNewLimit] = useState('')
  const [showForm, setShowForm] = useState(false)

  // Fetch data
  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    const { signal } = controller

    const fetchData = async () => {
      setLoading(true)
      try {
        const [metricsRes, donutRes] = await Promise.all([
          transactionsApi.getMetrics(sessionId, signal),
          transactionsApi.getDonutChartV2(sessionId, signal),
        ])
        setMetrics(metricsRes)
        setDonutData(donutRes)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('Error loading budget data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    return () => controller.abort()
  }, [sessionId])

  // Category spending map
  const categorySpending = useMemo(() => {
    const map = new Map<string, number>()
    if (donutData?.categories) {
      donutData.categories.forEach((c) => map.set(c.name, c.value))
    }
    return map
  }, [donutData])

  // Available categories for new goals
  const availableCategories = useMemo(() => {
    if (!donutData?.categories) return []
    const usedCategories = new Set(goals.map((g) => g.category))
    return donutData.categories
      .map((c) => c.name)
      .filter((name) => !usedCategories.has(name))
  }, [donutData, goals])

  // Budget summary
  const budgetSummary = useMemo(() => {
    let totalBudget = 0
    let totalSpent = 0
    let overBudgetCount = 0

    goals.forEach((goal) => {
      totalBudget += goal.limit
      const spent = categorySpending.get(goal.category) ?? 0
      totalSpent += spent
      if (spent > goal.limit) overBudgetCount++
    })

    return {
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
      overBudgetCount,
      utilization: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
    }
  }, [goals, categorySpending])

  // Overall budget health: average of all individual goal percentages
  const overallBudgetHealth = useMemo(() => {
    if (goals.length === 0) return 0
    const totalPct = goals.reduce((sum, goal) => {
      const spent = categorySpending.get(goal.category) ?? 0
      return sum + Math.min(100, (spent / goal.limit) * 100)
    }, 0)
    return totalPct / goals.length
  }, [goals, categorySpending])

  // Handlers
  const addGoal = useCallback(() => {
    if (!newCategory || !newLimit || Number(newLimit) <= 0) return
    const goal: BudgetGoal = {
      id: `goal-${Date.now()}`,
      category: newCategory,
      limit: Number(newLimit),
    }
    const updated = [...goals, goal]
    setGoals(updated)
    saveGoals(updated)
    setNewCategory('')
    setNewLimit('')
    setShowForm(false)
  }, [newCategory, newLimit, goals])

  const removeGoal = useCallback(
    (id: string) => {
      const updated = goals.filter((g) => g.id !== id)
      setGoals(updated)
      saveGoals(updated)
    },
    [goals],
  )

  // ── No session ──────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <EmptyState
        icon="🎯"
        title="ניהול תקציב"
        text="העלה קובץ כדי להגדיר יעדי תקציב ולעקוב אחרי ההוצאות שלך"
      />
    )
  }

  if (loading) {
    return (
      <div style={{ direction: 'rtl' }}>
        <div className="metrics-grid">
          <Skeleton variant="card" count={3} />
        </div>
        <div style={{ marginTop: 'var(--space-xl)' }}>
          <Skeleton variant="rectangular" height={300} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ direction: 'rtl' }}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <PageHeader title="תקציב" subtitle="הגדרת יעדי תקציב ומעקב" icon={Target} />

      {/* ─── Overall Budget Health ────────────────────────────────── */}
      {goals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          style={{ marginBottom: 'var(--space-xl)' }}
        >
          <Card className="glass-card" padding="md">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-md) 0' }}>
              <RadialProgress
                value={overallBudgetHealth}
                size={140}
                label="בריאות תקציב"
                color={
                  overallBudgetHealth > 90
                    ? 'var(--danger)'
                    : overallBudgetHealth > 70
                    ? 'var(--warning)'
                    : 'var(--success)'
                }
              />
            </div>
          </Card>
        </motion.div>
      )}

      {/* ─── Summary Cards ─────────────────────────────────────────── */}
      {goals.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-md)',
            marginBottom: 'var(--space-xl)',
          }}
        >
          <motion.div initial="hidden" animate="visible" custom={0} variants={cardVariants}>
            <Card className="glass-card" padding="md">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(59, 130, 246, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PiggyBank size={20} style={{ color: '#3b82f6' }} />
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>תקציב כולל</span>
              </div>
              <AnimatedNumber
                value={budgetSummary.totalBudget}
                formatter={formatCurrency}
                style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}
              />
            </Card>
          </motion.div>

          <motion.div initial="hidden" animate="visible" custom={1} variants={cardVariants}>
            <Card className="glass-card" padding="md">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: budgetSummary.utilization > 90 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {budgetSummary.utilization > 90 ? (
                    <TrendingUp size={20} style={{ color: '#ef4444' }} />
                  ) : (
                    <TrendingDown size={20} style={{ color: '#10b981' }} />
                  )}
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>ניצול תקציב</span>
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatPercent(Math.min(budgetSummary.utilization, 999))}
              </span>
            </Card>
          </motion.div>

          <motion.div initial="hidden" animate="visible" custom={2} variants={cardVariants}>
            <Card className="glass-card" padding="md">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: budgetSummary.remaining >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {budgetSummary.remaining >= 0 ? (
                    <CheckCircle size={20} style={{ color: '#10b981' }} />
                  ) : (
                    <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                  )}
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {budgetSummary.remaining >= 0 ? 'נותר' : 'חריגה'}
                </span>
              </div>
              <AnimatedNumber
                value={Math.abs(budgetSummary.remaining)}
                formatter={formatCurrency}
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: budgetSummary.remaining >= 0 ? 'var(--accent-secondary, #10b981)' : 'var(--accent-danger, #ef4444)',
                }}
              />
            </Card>
          </motion.div>
        </div>
      )}

      {/* ─── Budget Goals List ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <div className="section-header-v2" style={{ marginBottom: 0 }}>
          <span>📊</span>
          <span>יעדי תקציב ({goals.length})</span>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => setShowForm((v) => !v)}
          disabled={availableCategories.length === 0 && !showForm}
        >
          הוסף יעד
        </Button>
      </div>

      {/* ─── Add Goal Form ─────────────────────────────────────────── */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          style={{ marginBottom: 'var(--space-md)' }}
        >
          <Card className="glass-card" padding="md">
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  קטגוריה
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-md, 8px)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input, var(--bg-card))',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    fontFamily: 'var(--font-family)',
                    direction: 'rtl',
                  }}
                >
                  <option value="">בחר קטגוריה...</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: '0 0 160px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  תקציב (₪)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: 'var(--radius-md, 8px)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input, var(--bg-card))',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    fontFamily: 'var(--font-mono, monospace)',
                    direction: 'ltr',
                    textAlign: 'right',
                  }}
                />
              </div>

              <Button variant="primary" size="sm" onClick={addGoal} disabled={!newCategory || !newLimit}>
                הוסף
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                ביטול
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ─── Goals Grid ────────────────────────────────────────────── */}
      {goals.length === 0 ? (
        <Card className="glass-card" padding="lg">
          <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
            <Target size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 500 }}>
              עדיין לא הגדרת יעדי תקציב
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              הוסף יעדים כדי לעקוב אחרי ההוצאות שלך בכל קטגוריה
            </p>
          </div>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--space-md)',
          }}
        >
          {goals.map((goal, idx) => {
            const spent = categorySpending.get(goal.category) ?? 0
            const pct = goal.limit > 0 ? (spent / goal.limit) * 100 : 0
            const isOver = pct > 100
            const isWarning = pct > 80 && !isOver

            return (
              <motion.div
                key={goal.id}
                custom={idx}
                initial="hidden"
                animate="visible"
                variants={cardVariants}
              >
                <Card className="glass-card" hover padding="md">
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {goal.category}
                    </h3>
                    <button
                      onClick={() => removeGoal(goal.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: 'var(--text-muted)',
                        borderRadius: '6px',
                        transition: 'color 0.15s',
                      }}
                      title="מחק יעד"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Radial Progress + Stats */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                    <RadialProgress
                      value={Math.min(100, (spent / goal.limit) * 100)}
                      size={80}
                      color={
                        pct > 90
                          ? 'var(--danger)'
                          : pct > 70
                          ? 'var(--warning)'
                          : 'var(--success)'
                      }
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>הוצאה</div>
                        <span
                          style={{
                            fontSize: '1.125rem',
                            fontWeight: 700,
                            color: isOver ? 'var(--accent-danger, #ef4444)' : 'var(--text-primary)',
                          }}
                        >
                          {formatCurrency(spent)}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>תקציב</div>
                        <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatCurrency(goal.limit)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isOver ? (
                      <>
                        <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444' }}>
                          חריגה של {formatCurrency(spent - goal.limit)}
                        </span>
                      </>
                    ) : isWarning ? (
                      <>
                        <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b' }}>
                          {formatPercent(pct)} מהתקציב נוצל
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={14} style={{ color: '#10b981' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>
                          נותרו {formatCurrency(goal.limit - spent)}
                        </span>
                      </>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ─── Overall Budget Overview ───────────────────────────────── */}
      {metrics && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
          style={{ marginTop: 'var(--space-xl)' }}
        >
          <div className="section-header-v2">
            <span>💰</span>
            <span>סיכום כללי</span>
          </div>
          <Card className="glass-card" padding="md">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 'var(--space-lg)',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>הוצאות כולל</div>
                <AnimatedNumber
                  value={Math.abs(metrics.total_expenses)}
                  formatter={formatCurrency}
                  style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-danger, #ef4444)' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>הכנסות כולל</div>
                <AnimatedNumber
                  value={metrics.total_income}
                  formatter={formatCurrency}
                  style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-secondary, #10b981)' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>ממוצע לעסקה</div>
                <AnimatedNumber
                  value={Math.abs(metrics.average_transaction)}
                  formatter={formatCurrency}
                  style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>סה"כ עסקאות</div>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {metrics.total_transactions.toLocaleString('he-IL')}
                </span>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .budget-goals-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
