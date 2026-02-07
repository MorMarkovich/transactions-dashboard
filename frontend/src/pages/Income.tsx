import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Wallet,
  TrendingDown,
  Scale,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabaseApi } from '../services/supabaseApi'
import { transactionsApi } from '../services/api'
import type { Income as IncomeType, MetricsData } from '../services/types'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import ProgressBar from '../components/ui/ProgressBar'
import ComparisonChart from '../components/charts/ComparisonChart'
import EmptyState from '../components/common/EmptyState'
import { ToastContainer, useToast } from '../components/ui/Toast'
import { formatCurrency } from '../utils/formatting'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const INCOME_TYPE_OPTIONS = [
  { value: 'משכורת', label: 'משכורת' },
  { value: 'פרילנס', label: 'פרילנס' },
  { value: 'השקעות', label: 'השקעות' },
  { value: 'מתנה', label: 'מתנה' },
  { value: 'החזר', label: 'החזר' },
  { value: 'אחר', label: 'אחר' },
]

const FREQUENCY_OPTIONS = [
  { value: 'חד-פעמי', label: 'חד-פעמי' },
  { value: 'חודשי', label: 'חודשי' },
  { value: 'שנתי', label: 'שנתי' },
]

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function IncomeSkeleton() {
  return (
    <div style={{ direction: 'rtl' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-lg)',
        }}
      >
        <div>
          <Skeleton variant="card" />
          <div style={{ marginTop: 'var(--space-md)' }}>
            <Skeleton variant="rectangular" height={260} />
          </div>
        </div>
        <div>
          <Skeleton variant="card" />
          <div style={{ marginTop: 'var(--space-md)' }}>
            <Skeleton variant="card" />
          </div>
          <div style={{ marginTop: 'var(--space-md)' }}>
            <Skeleton variant="card" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Summary card sub-component                                         */
/* ------------------------------------------------------------------ */

interface SummaryCardProps {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  numericValue?: number
  formatter?: (v: number) => string
  valueColor?: string
}

function SummaryCard({ icon, iconBg, label, value, numericValue, formatter, valueColor }: SummaryCardProps) {
  return (
    <Card className="glass-card" hover>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: iconBg,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: 'var(--text-secondary)',
            }}
          >
            {label}
          </p>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: valueColor || 'var(--text-primary)',
              direction: 'ltr',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {numericValue !== undefined && formatter ? (
              <AnimatedNumber value={numericValue} formatter={formatter} />
            ) : (
              value
            )}
          </p>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function Income() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const { toasts, showToast, removeToast } = useToast()

  // ── State ─────────────────────────────────────────────────────────────
  const [incomes, setIncomes] = useState<IncomeType[]>([])
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)

  // Form state
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [incomeType, setIncomeType] = useState('משכורת')
  const [recurring, setRecurring] = useState('חד-פעמי')

  // ── Computed values ───────────────────────────────────────────────────
  const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0)
  const totalExpenses = metrics?.total_expenses ?? 0
  const balance = totalIncome - totalExpenses
  const utilization = totalIncome > 0 ? Math.min((totalExpenses / totalIncome) * 100, 100) : 0
  const savings = totalIncome - totalExpenses

  // ── Fetch data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const loadAll = async () => {
      setLoading(true)
      try {
        const promises: Promise<any>[] = [supabaseApi.getIncomes(user.id)]

        if (sessionId) {
          promises.push(transactionsApi.getMetrics(sessionId))
        }

        const results = await Promise.all(promises)
        setIncomes(results[0] as IncomeType[])

        if (results[1]) {
          setMetrics(results[1] as MetricsData)
        }
      } catch (err) {
        console.error('Error loading income data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [user, sessionId])

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return
    if (!description.trim() || !amount) {
      showToast('נא למלא את כל השדות', 'warning')
      return
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('נא להזין סכום חיובי', 'warning')
      return
    }

    setSubmitting(true)

    // Optimistic: add a temporary income
    const tempId = `temp-${Date.now()}`
    const optimistic: IncomeType = {
      id: tempId,
      user_id: user.id,
      description: description.trim(),
      amount: numAmount,
      income_type: incomeType,
      recurring,
      created_at: new Date().toISOString(),
    }
    setIncomes((prev) => [optimistic, ...prev])

    // Reset form
    setDescription('')
    setAmount('')

    try {
      const saved = await supabaseApi.addIncome({
        user_id: user.id,
        description: optimistic.description,
        amount: optimistic.amount,
        income_type: optimistic.income_type,
        recurring: optimistic.recurring,
      })

      // Replace temp with real
      setIncomes((prev) => prev.map((inc) => (inc.id === tempId ? saved : inc)))
      showToast('הכנסה נוספה בהצלחה', 'success')
    } catch (err) {
      // Rollback
      setIncomes((prev) => prev.filter((inc) => inc.id !== tempId))
      showToast('שגיאה בהוספת הכנסה', 'error')
      console.error('Error adding income:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteIncome = async (id: string) => {
    if (!user) return
    setDeletingId(id)

    // Optimistic: remove immediately
    const backup = incomes
    setIncomes((prev) => prev.filter((inc) => inc.id !== id))

    try {
      await supabaseApi.deleteIncome(id)
      showToast('הכנסה נמחקה', 'success')
    } catch (err) {
      // Rollback
      setIncomes(backup)
      showToast('שגיאה במחיקת הכנסה', 'error')
      console.error('Error deleting income:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleClearAll = async () => {
    if (!user) return
    setClearingAll(true)

    const backup = incomes
    setIncomes([])

    try {
      await supabaseApi.deleteAllIncomes(user.id)
      showToast('כל ההכנסות נמחקו', 'success')
    } catch (err) {
      setIncomes(backup)
      showToast('שגיאה במחיקת הכנסות', 'error')
      console.error('Error clearing incomes:', err)
    } finally {
      setClearingAll(false)
    }
  }

  // ── Not logged in ─────────────────────────────────────────────────────
  if (!user) {
    return (
      <EmptyState
        icon="🔐"
        title="נדרשת התחברות"
        text="יש להתחבר כדי לנהל הכנסות ותקציב"
      />
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return <IncomeSkeleton />
  }

  return (
    <div style={{ direction: 'rtl' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* ─── Section title ──────────────────────────────────────────── */}
      <div className="section-title">
        <span>💰</span> ניהול הכנסות ותקציב
      </div>

      {/* ─── 2-column layout ────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-lg)',
          alignItems: 'start',
        }}
      >
        {/* ═══ Right column (RTL): Add income form + list ═══ */}
        <div>
          <Card className="glass-card">
            <h3
              style={{
                margin: '0 0 16px',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              הוסף הכנסה
            </h3>

            <form
              onSubmit={handleAddIncome}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <Input
                label="תיאור"
                placeholder="למשל: משכורת ינואר"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <Input
                label="סכום"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
                style={{ direction: 'ltr', textAlign: 'left' }}
              />

              <Select
                label="סוג הכנסה"
                options={INCOME_TYPE_OPTIONS}
                value={incomeType}
                onChange={setIncomeType}
              />

              <Select
                label="תדירות"
                options={FREQUENCY_OPTIONS}
                value={recurring}
                onChange={setRecurring}
              />

              <Button
                type="submit"
                fullWidth
                loading={submitting}
                icon={<Plus size={16} />}
              >
                הוסף הכנסה
              </Button>
            </form>
          </Card>

          {/* ─── Income list ────────────────────────────────────────── */}
          {incomes.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ marginTop: 'var(--space-md)' }}
            >
              <Card className="glass-card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    הכנסות ({incomes.length})
                  </h3>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleClearAll}
                    loading={clearingAll}
                    icon={<Trash2 size={14} />}
                  >
                    נקה הכל
                  </Button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                  }}
                >
                  <AnimatePresence mode="popLayout">
                    {incomes.map((income) => (
                      <motion.div
                        key={income.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            background: 'var(--bg-elevated, #334155)',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                          }}
                        >
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
                              {income.description}
                            </p>
                            <p
                              style={{
                                margin: '2px 0 0',
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {income.income_type} &middot; {income.recurring}
                            </p>
                          </div>

                          <span
                            style={{
                              fontSize: '0.9375rem',
                              fontWeight: 700,
                              color: 'var(--accent-secondary, #10b981)',
                              direction: 'ltr',
                              fontVariantNumeric: 'tabular-nums',
                              flexShrink: 0,
                            }}
                          >
                            {formatCurrency(income.amount)}
                          </span>

                          <button
                            onClick={() => handleDeleteIncome(income.id)}
                            disabled={deletingId === income.id}
                            aria-label="מחק הכנסה"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 30,
                              height: 30,
                              borderRadius: 6,
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-muted)',
                              cursor: deletingId === income.id ? 'not-allowed' : 'pointer',
                              opacity: deletingId === income.id ? 0.5 : 1,
                              transition: 'all 0.15s ease',
                              flexShrink: 0,
                            }}
                            className="income-delete-btn"
                          >
                            {deletingId === income.id ? (
                              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </Card>
            </motion.div>
          )}
        </div>

        {/* ═══ Left column: Summary + chart ═══ */}
        <div>
          {/* Summary cards */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)',
            }}
          >
            <SummaryCard
              icon={<Wallet size={20} style={{ color: '#34d399' }} />}
              iconBg="rgba(16, 185, 129, 0.12)"
              label="סה״כ הכנסות"
              value={formatCurrency(totalIncome)}
              numericValue={totalIncome}
              formatter={formatCurrency}
              valueColor="var(--accent-secondary, #10b981)"
            />

            <SummaryCard
              icon={<TrendingDown size={20} style={{ color: '#f87171' }} />}
              iconBg="rgba(239, 68, 68, 0.12)"
              label="סה״כ הוצאות"
              value={formatCurrency(totalExpenses)}
              numericValue={totalExpenses}
              formatter={formatCurrency}
              valueColor="var(--accent-danger, #ef4444)"
            />

            <SummaryCard
              icon={<Scale size={20} style={{ color: balance >= 0 ? '#34d399' : '#f87171' }} />}
              iconBg={balance >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'}
              label="מאזן"
              value={formatCurrency(balance)}
              numericValue={balance}
              formatter={formatCurrency}
              valueColor={
                balance >= 0
                  ? 'var(--accent-secondary, #10b981)'
                  : 'var(--accent-danger, #ef4444)'
              }
            />
          </div>

          {/* Budget utilization */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
            style={{ marginTop: 'var(--space-md)' }}
          >
            <Card className="glass-card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  ניצול תקציב
                </h4>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color:
                      utilization > 90
                        ? 'var(--accent-danger, #ef4444)'
                        : utilization > 70
                        ? 'var(--accent-warning, #f59e0b)'
                        : 'var(--accent-secondary, #10b981)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Math.round(utilization)}%
                </span>
              </div>
              <ProgressBar
                value={utilization}
                color={
                  utilization > 90
                    ? 'var(--gradient-danger)'
                    : utilization > 70
                    ? 'var(--accent-warning, #f59e0b)'
                    : 'var(--gradient-primary)'
                }
                height={10}
                showLabel={false}
              />
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                {totalIncome > 0
                  ? `${formatCurrency(totalExpenses)} מתוך ${formatCurrency(totalIncome)}`
                  : 'הוסף הכנסות כדי לראות ניצול תקציב'}
              </p>
            </Card>
          </motion.div>

          {/* Comparison chart */}
          {totalIncome > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.35 }}
              style={{ marginTop: 'var(--space-md)' }}
            >
              <Card className="glass-card">
                <h4
                  style={{
                    margin: '0 0 8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  הכנסות מול הוצאות
                </h4>
                <ComparisonChart
                  income={totalIncome}
                  expenses={totalExpenses}
                  savings={savings}
                  height={240}
                />
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .income-delete-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.12) !important;
          color: var(--accent-danger, #ef4444) !important;
        }

        @media (max-width: 768px) {
          /* Stack to single column on mobile - handled by parent grid */
        }
      `}</style>
    </div>
  )
}
