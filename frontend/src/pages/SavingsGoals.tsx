import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PiggyBank,
  Plus,
  Trash2,
  Target,
  TrendingUp,
  Wallet,
  ChevronUp,
  Check,
  X,
} from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import RadialProgress from '../components/ui/RadialProgress'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { formatCurrency } from '../utils/formatting'
import type { SavingsGoal } from '../services/types'
import { useAuth } from '../lib/AuthContext'

// ─── Constants ──────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'savings-goals'

const CATEGORIES = [
  'חופשה',
  'רכב',
  'חירום',
  'השקעה',
  'ריהוט',
  'אלקטרוניקה',
  'אחר',
]

const COLOR_NAMES: Record<string, string> = {
  '#818cf8': 'סגול',
  '#34d399': 'ירוק',
  '#f87171': 'אדום',
  '#fbbf24': 'צהוב',
  '#38bdf8': 'תכלת',
  '#fb923c': 'כתום',
}

const PRESET_COLORS = [
  '#818cf8',
  '#34d399',
  '#f87171',
  '#fbbf24',
  '#38bdf8',
  '#fb923c',
]

// ─── Animation ──────────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
  }),
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getStorageKey(ownerId: string | null): string {
  return ownerId ? `${STORAGE_KEY_PREFIX}-user-${ownerId}` : STORAGE_KEY_PREFIX
}

function loadGoals(ownerId: string | null, legacySessionId: string | null): SavingsGoal[] {
  try {
    let stored = localStorage.getItem(getStorageKey(ownerId))
    if (!stored && ownerId && legacySessionId) {
      stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}-${legacySessionId}`)
      if (stored) localStorage.setItem(getStorageKey(ownerId), stored)
    }
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveGoals(goals: SavingsGoal[], ownerId: string | null) {
  localStorage.setItem(getStorageKey(ownerId), JSON.stringify(goals))
}

// ─── Component ──────────────────────────────────────────────────────────

export default function SavingsGoals() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const sessionId = searchParams.get('session_id')
  const ownerId = user?.id ?? null

  // State
  const [goals, setGoals] = useState<SavingsGoal[]>(() => loadGoals(ownerId, sessionId))
  const [showForm, setShowForm] = useState(false)
  const [addFundsId, setAddFundsId] = useState<string | null>(null)
  const [addFundsAmount, setAddFundsAmount] = useState('')

  // New goal form state
  const [newName, setNewName] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [formError, setFormError] = useState('')

  // Summary
  const summary = useMemo(() => {
    const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0)
    const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0)
    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0
    return { totalSaved, totalTarget, overallProgress }
  }, [goals])

  // ── Handlers ──────────────────────────────────────────────────────────

  const addGoal = useCallback(() => {
    if (!newName.trim()) {
      setFormError('נא להזין שם ליעד')
      return
    }
    if (!newTarget || Number(newTarget) <= 0) {
      setFormError('נא להזין סכום יעד חיובי')
      return
    }
    setFormError('')

    const goal: SavingsGoal = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      target_amount: Number(newTarget),
      current_amount: 0,
      category: newCategory,
      color: newColor,
      created_at: new Date().toISOString(),
    }
    const updated = [...goals, goal]
    setGoals(updated)
    saveGoals(updated, ownerId)
    setNewName('')
    setNewTarget('')
    setNewCategory(CATEGORIES[0])
    setNewColor(PRESET_COLORS[0])
    setShowForm(false)
  }, [newName, newTarget, newCategory, newColor, goals, ownerId])

  const removeGoal = useCallback(
    (id: string) => {
      const updated = goals.filter((g) => g.id !== id)
      setGoals(updated)
      saveGoals(updated, ownerId)
    },
    [goals, ownerId],
  )

  const handleAddFunds = useCallback(
    (id: string) => {
      const amount = Number(addFundsAmount)
      if (!amount || amount <= 0) return

      const updated = goals.map((g) =>
        g.id === id
          ? { ...g, current_amount: Math.min(g.current_amount + amount, g.target_amount) }
          : g,
      )
      setGoals(updated)
      saveGoals(updated, ownerId)
      setAddFundsId(null)
      setAddFundsAmount('')
    },
    [goals, addFundsAmount, ownerId],
  )

  return (
    <div style={{ direction: 'rtl' }}>
      {/* ─── Header ──────────────────────────────────────────────── */}
      <PageHeader
        title="יעדי חיסכון"
        subtitle="הגדרת יעדים ומעקב אחר החיסכון שלך"
        icon={PiggyBank}
      />

      {/* ─── Summary Cards ───────────────────────────────────────── */}
      {goals.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
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
                    background: 'rgba(52, 211, 153, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Wallet size={20} style={{ color: '#34d399' }} />
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  סה״כ נחסך
                </span>
              </div>
              <span
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  direction: 'ltr',
                  display: 'block',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCurrency(summary.totalSaved)}
              </span>
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
                    background: 'rgba(129, 140, 248, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Target size={20} style={{ color: '#818cf8' }} />
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  יעד כולל
                </span>
              </div>
              <span
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  direction: 'ltr',
                  display: 'block',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCurrency(summary.totalTarget)}
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
                    background: 'rgba(56, 189, 248, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TrendingUp size={20} style={{ color: '#38bdf8' }} />
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  התקדמות כללית
                </span>
              </div>
              <span
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {Math.round(summary.overallProgress)}%
              </span>
            </Card>
          </motion.div>
        </div>
      )}

      {/* ─── Action Bar ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-md)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          <PiggyBank size={20} style={{ color: 'var(--accent)' }} />
          <span>יעדים ({goals.length})</span>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={showForm ? <ChevronUp size={14} /> : <Plus size={14} />}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'סגור' : 'הוסף יעד'}
        </Button>
      </div>

      {/* ─── Add Goal Form ───────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ marginBottom: 'var(--space-md)', overflow: 'hidden' }}
          >
            <Card className="glass-card" padding="md">
              <h4
                style={{
                  margin: '0 0 16px',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                יעד חדש
              </h4>
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-sm)',
                  alignItems: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
                {/* Name */}
                <div style={{ flex: '1 1 180px' }}>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    שם היעד
                  </label>
                  <input
                    type="text"
                    aria-label="שם היעד"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="למשל: חופשה באירופה"
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      paddingInlineEnd: '34px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-input, var(--bg-card))',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      fontFamily: "var(--font-family, 'Heebo', sans-serif)",
                      direction: 'rtl',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Target amount */}
                <div style={{ flex: '0 0 140px' }}>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    סכום יעד (₪)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    aria-label="סכום יעד (₪)"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      paddingInlineEnd: '34px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-input, var(--bg-card))',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      direction: 'ltr',
                      textAlign: 'right',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Category */}
                <div style={{ flex: '0 0 140px' }}>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    קטגוריה
                  </label>
                  <select
                    aria-label="קטגוריה"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      paddingInlineEnd: '34px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-input, var(--bg-card))',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      fontFamily: "var(--font-family, 'Heebo', sans-serif)",
                      direction: 'rtl',
                      outline: 'none',
                    }}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Color picker */}
                <div style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '100%' }}>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    צבע
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewColor(color)}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: color,
                          border:
                            newColor === color
                              ? '3px solid var(--text-primary)'
                              : '2px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          outline: 'none',
                          boxShadow: newColor === color ? `0 0 8px ${color}` : 'none',
                        }}
                        title={COLOR_NAMES[color] ?? color}
                        aria-label={`צבע ${COLOR_NAMES[color] ?? color}`}
                        aria-pressed={newColor === color}
                      />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={addGoal}
                  >
                    הוסף
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); setFormError('') }}>
                    ביטול
                  </Button>
                  {formError && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-danger, #ef4444)', fontWeight: 500 }}>
                      {formError}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Goals Grid ──────────────────────────────────────────── */}
      {goals.length === 0 ? (
        <Card className="glass-card" padding="lg">
          <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
            <PiggyBank size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px', display: 'block', marginInline: 'auto' }} />
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '1rem',
                fontWeight: 500,
              }}
            >
              עדיין לא הגדרת יעדי חיסכון
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              הוסף יעדים כדי לעקוב אחרי החיסכון שלך
            </p>
          </div>
        </Card>
      ) : (
        <div
          className="responsive-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
            gap: 'var(--space-md)',
          }}
        >
          <AnimatePresence mode="popLayout">
            {goals.map((goal, idx) => {
              const pct =
                goal.target_amount > 0
                  ? (goal.current_amount / goal.target_amount) * 100
                  : 0
              const isComplete = pct >= 100

              return (
                <motion.div
                  key={goal.id}
                  custom={idx}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, scale: 0.9 }}
                  variants={cardVariants}
                  layout
                >
                  <Card className="glass-card" hover padding="md" borderAccent={goal.color}>
                    {/* Header row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3
                          style={{
                            margin: '0 0 6px',
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {goal.name}
                        </h3>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            color: goal.color,
                            background: `${goal.color}1a`,
                          }}
                        >
                          {goal.category}
                        </span>
                      </div>

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
                          flexShrink: 0,
                        }}
                        title="מחק יעד"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Radial Progress */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: '16px',
                      }}
                    >
                      <RadialProgress
                        value={Math.min(pct, 100)}
                        size={100}
                        strokeWidth={8}
                        color={isComplete ? 'var(--success)' : goal.color}
                        label={isComplete ? 'הושלם!' : undefined}
                      />
                    </div>

                    {/* Amounts */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--text-muted)',
                            marginBottom: '2px',
                          }}
                        >
                          נחסך
                        </div>
                        <span
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            direction: 'ltr',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatCurrency(goal.current_amount)}
                        </span>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--text-muted)',
                            marginBottom: '2px',
                          }}
                        >
                          יעד
                        </div>
                        <span
                          style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            direction: 'ltr',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatCurrency(goal.target_amount)}
                        </span>
                      </div>
                    </div>

                    {/* Add funds */}
                    {!isComplete && (
                      <>
                        {addFundsId === goal.id ? (
                          <div
                            style={{
                              display: 'flex',
                              gap: '6px',
                              alignItems: 'center',
                            }}
                          >
                            <input
                              type="number"
                              min="0"
                              step="10"
                              value={addFundsAmount}
                              onChange={(e) => setAddFundsAmount(e.target.value)}
                              placeholder="סכום"
                              autoFocus
                              style={{
                                flex: 1,
                                height: '34px',
                                padding: '0 10px',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: '1px solid var(--border)',
                                background: 'var(--bg-input, var(--bg-card))',
                                color: 'var(--text-primary)',
                                fontSize: '0.8125rem',
                                fontFamily: 'var(--font-mono, monospace)',
                                direction: 'ltr',
                                textAlign: 'right',
                                outline: 'none',
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddFunds(goal.id)
                                if (e.key === 'Escape') {
                                  setAddFundsId(null)
                                  setAddFundsAmount('')
                                }
                              }}
                            />
                            <button
                              onClick={() => handleAddFunds(goal.id)}
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '8px',
                                border: 'none',
                                background: 'var(--success)',
                                color: '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                              title="אישור"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setAddFundsId(null)
                                setAddFundsAmount('')
                              }}
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                              title="ביטול"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            fullWidth
                            icon={<Plus size={14} />}
                            onClick={() => {
                              setAddFundsId(goal.id)
                              setAddFundsAmount('')
                            }}
                          >
                            הוסף כסף
                          </Button>
                        )}
                      </>
                    )}

                    {isComplete && (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '6px',
                          borderRadius: '8px',
                          background: 'var(--success-muted)',
                          color: 'var(--success)',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                        }}
                      >
                        היעד הושלם!
                      </div>
                    )}
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
             </button>
              )}
            </div>

            {/* Sort pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpDown size={12} style={{ color: 'var(--text-muted)' }} />
              {([
                { key: 'amount' as const, label: 'סכום' },
                { key: 'change' as const, label: 'שינוי' },
                { key: 'count' as const, label: 'כמות' },
                { key: 'avg' as const, label: 'ממוצע' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSnapshotSort(opt.key)}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid',
                    borderColor: snapshotSort === opt.key ? 'var(--accent)' : 'var(--border)',
                    background: snapshotSort === opt.key ? 'var(--accent-muted)' : 'transparent',
                    color: snapshotSort === opt.key ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '0.6875rem', fontWeight: snapshotSort === opt.key ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'var(--font-family)', transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Advanced toggle + Clear */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
              <button
                onClick={() => setSnapshotShowAdvanced(!snapshotShowAdvanced)}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid',
                  borderColor: snapshotShowAdvanced ? 'var(--accent)' : 'var(--border)',
                  background: snapshotShowAdvanced ? 'var(--accent-muted)' : 'transparent',
                  color: snapshotShowAdvanced ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: '0.6875rem', fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-family)', display: 'inline-flex', alignItems: 'center', gap: '4px',
                }}
              >
                <SlidersHorizontal size={11} />
                מתקדם
                {snapshotActiveFilterCount > 0 && (
                  <span style={{
                    minWidth: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent)',
                    color: 'var(--on-accent, #fff)', fontSize: '0.6rem', fontWeight: 700, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>{snapshotActiveFilterCount}</span>
                )}
              </button>
              {snapshotActiveFilterCount > 0 && (
                <button
                  onClick={clearAllSnapshotFilters}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--danger)',
                    background: 'transparent', color: 'var(--danger)', fontSize: '0.6875rem',
                    fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-family)',
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                  }}
                >
                  <X size={10} />
                  נקה הכל
                </button>
              )}
            </div>
          </div>

          {/* ─── Category chip multi-select (always visible) ─── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
            {/* Select All / Deselect All */}
            <button
              onClick={() => setSnapshotSelectedCats(snapshotSelectedCats === null ? new Set() : null)}
              style={{
                padding: '4px 10px', borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
                background: snapshotSelectedCats === null ? 'var(--accent-muted)' : 'transparent',
                color: snapshotSelectedCats === null ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-family)', transition: 'all 0.15s',
              }}
            >
              {snapshotSelectedCats === null ? 'הכל' : 'בחר הכל'}
            </button>
            {categorySnapshot.categories.filter((c, i) => !isNarrow || chipsOpen || i < 5 || snapshotExcluded.has(c.name) || (snapshotSelectedCats !== null && !snapshotSelectedCats.has(c.name))).map((cat) => {
              const isSelected = snapshotSelectedCats === null || snapshotSelectedCats.has(cat.name)
              const isExcluded = snapshotExcluded.has(cat.name)
              return (
                <button
                  key={cat.name}
                  onClick={() => {
                    if (isExcluded) {
                      setSnapshotExcluded(prev => { const n = new Set(prev); n.delete(cat.name); return n })
                      return
                    }
                    if (snapshotSelectedCats === null) {
                      // First deselection: select all except this one
                      const all = new Set(categorySnapshot.categories.map(c => c.name))
                      all.delete(cat.name)
                      setSnapshotSelectedCats(all)
                    } else if (isSelected) {
                      const next = new Set(snapshotSelectedCats)
                      next.delete(cat.name)
                      setSnapshotSelectedCats(next.size === 0 ? null : next)
                    } else {
                      const next = new Set(snapshotSelectedCats)
                      next.add(cat.name)
                      // If all are now selected, reset to null (= "all")
                      setSnapshotSelectedCats(next.size === categorySnapshot.categories.length ? null : next)
                    }
                  }}
                  style={{
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    border: '1px solid',
                    borderColor: isExcluded ? 'var(--danger)' : isSelected ? 'var(--accent)' : 'var(--border)',
                    background: isExcluded ? 'var(--danger-muted)' : isSelected ? 'var(--accent-muted)' : 'transparent',
                    color: isExcluded ? 'var(--danger)' : isSelected ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '0.6875rem', fontWeight: isSelected ? 500 : 400, cursor: 'pointer',
                    fontFamily: 'var(--font-family)', transition: 'all 0.15s',
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    textDecoration: isExcluded ? 'line-through' : 'none',
                    opacity: isExcluded ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontSize: '0.8rem' }}><Tag size={18}/></span>
                  {cat.name}
                  <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>({cat.percent.toFixed(1)}%)</span>
                </button>
              )
            })}
            {isNarrow && categorySnapshot.categories.length > 5 && (
              <button
                onClick={() => setChipsOpen(o => !o)}
                aria-expanded={chipsOpen}
                style={{
                  padding: '4px 12px', minHeight: 36, borderRadius: 'var(--radius-full)',
                  border: '1px dashed var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: '0.6875rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-family)',
                }}
              >
                {chipsOpen ? 'הצג פחות' : `עוד ${categorySnapshot.categories.length - 5} קטגוריות`}
              </button>
            )}
          </div>

          {/* ─── Advanced filters panel (collapsible) ─── */}
          {snapshotShowAdvanced && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px',
              marginBottom: '10px', padding: '10px 14px',
              borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}>
              {/* Amount range */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>סכום:</span>
                <input type="number" placeholder="מינימום" value={snapshotMinAmount} onChange={(e) => setSnapshotMinAmount(e.target.value)}
                  style={{ width: '80px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', direction: 'ltr' }} />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>—</span>
                <input type="number" placeholder="מקסימום" value={snapshotMaxAmount} onChange={(e) => setSnapshotMaxAmount(e.target.value)}
                  style={{ width: '80px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', direction: 'ltr' }} />
              </div>

              {/* Month range */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>תקופה:</span>
                <select value={snapshotMonthFrom} onChange={(e) => setSnapshotMonthFrom(e.target.value)}
                  style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 6px', fontSize: '0.6875rem', fontFamily: 'var(--font-family)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <option value="">מתחילת התקופה</option>
                  {availableMonths.map((m) => <option key={m.month} value={m.month}>{m.month}</option>)}
                </select>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>עד</span>
                <select value={snapshotMonthTo} onChange={(e) => setSnapshotMonthTo(e.target.value)}
                  style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 6px', fontSize: '0.6875rem', fontFamily: 'var(--font-family)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <option value="">סוף התקופה</option>
                  {availableMonths.map((m) => <option key={m.month} value={m.month}>{m.month}</option>)}
                </select>
              </div>

              {/* Excluded chips */}
              {snapshotExcluded.size > 0 && (
                <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', alignSelf: 'center' }}>מוחרגות:</span>
                  {[...snapshotExcluded].map((name) => (
                    <span key={name} onClick={() => { const n = new Set(snapshotExcluded); n.delete(name); setSnapshotExcluded(n) }}
                      style={{ fontSize: '0.625rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--danger-muted)', color: 'var(--danger)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      {name} <X size={9} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Results summary ─── */}
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>
              {sortedSnapshotCategories.length === categorySnapshot.categories.length
                ? `${categorySnapshot.categories.length} קטגוריות · ${categorySnapshot.total_count === 1 ? 'עסקה אחת' : `${categorySnapshot.total_count} עסקאות`}`
                : `מציג ${sortedSnapshotCategories.length} מתוך ${categorySnapshot.categories.length} קטגוריות`
              }
            </span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>
              סה״כ: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(snapshotFilteredTotal)}</strong>
              {sortedSnapshotCategories.length < categorySnapshot.categories.length && categorySnapshot.total > 0 && (
                <> ({((snapshotFilteredTotal / categorySnapshot.total) * 100).toFixed(1)}%)</>
              )}
            </span>
          </div>

          {/* ─── Category cards grid ─── */}
          <div className="dashboard-category-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
            gap: 'var(--space-sm)',
          }}>
            {(snapshotExpanded ? sortedSnapshotCategories : sortedSnapshotCategories.slice(0, 8)).map((cat) => {
              const changeColor = cat.month_change > 5 ? 'var(--danger)' : cat.month_change < -5 ? 'var(--success)' : 'var(--text-muted)'
              const changeBg = cat.month_change > 5 ? 'var(--danger-muted)' : cat.month_change < -5 ? 'var(--success-muted)' : 'rgba(148, 163, 184, 0.1)'
              const isRenaming = editingCategoryName === cat.name
              const isSavingRename = savingCategoryName === cat.name
              return (
                <div key={cat.name} className="studio-category" style={{ cursor: 'pointer' }}>
                <Card
                  variant="glass"
                  padding="sm"
                  hover
                  onClick={() => handleCategoryCardClick(cat.name)}
                >
                  <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
                    {/* Exclude button */}
                    <button
                      className="category-hide-btn"
                      onClick={(e) => { e.stopPropagation(); setSnapshotExcluded(prev => new Set([...prev, cat.name])) }}
                      title={`הסתר ${cat.name}`}
                      style={{
                        position: 'absolute', top: '-2px', left: '-2px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                        color: 'var(--text-muted)', fontSize: '10px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, opacity: 0.4, transition: 'all 0.15s', zIndex: 2,
                      }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1'; (e.target as HTMLElement).style.color = 'var(--danger)' }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.4'; (e.target as HTMLElement).style.color = 'var(--text-muted)' }}
                    >
                      <X size={9} />
                    </button>
                    {/* Icon */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      flexShrink: 0,
                    }}>
                      <Tag size={18}/>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Row 1: Name + Total */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                        {isRenaming ? (
                          <form
                            onClick={(e) => e.stopPropagation()}
                            onSubmit={(e) => {
                              e.preventDefault()
                              handleCategoryRename(cat.name)
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}
                          >
                            <input
                              value={categoryRenameValue}
                              onChange={(e) => setCategoryRenameValue(e.target.value)}
                              autoFocus
                              disabled={isSavingRename}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                border: '1px solid var(--accent)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '4px 6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-family)',
                                outline: 'none',
                              }}
                            />
                            <button
                              type="submit"
                              disabled={isSavingRename || !categoryRenameValue.trim()}
                              title="שמור"
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                border: '1px solid var(--accent)',
                                background: 'var(--accent)',
                                color: 'var(--on-accent, #fff)',
                                cursor: isSavingRename ? 'wait' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                              }}
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelCategoryRename}
                              title="בטל"
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                              }}
                            >
                              <X size={12} />
                            </button>
                          </form>
                        ) : (
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cat.name}
                          </span>
                        )}
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', flexShrink: 0 }}>
                          {formatCurrency(cat.total)}
                        </span>
                      </div>

                      {/* Row 2: Stats chips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                        {!isRenaming && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startCategoryRename(cat.name)
                            }}
                            aria-label="ערוך שם קטגוריה" title="ערוך שם קטגוריה"
                            style={{
                              height: 36, minWidth: 36,
                              borderRadius: 'var(--radius-full)',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-elevated)',
                              color: 'var(--accent)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '0 8px',
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              fontFamily: 'var(--font-family)',
                            }}
                          >
                            <Edit2 size={11} />
                          </button>
                        )}
                        {/* Transaction count */}
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Tag size={10} />
                          {cat.count === 1 ? 'עסקה אחת' : `${cat.count} עסקאות`}
                        </span>
                        {/* Percentage */}
                        <span style={{ fontSize: '0.625rem', color: 'var(--accent)', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)' }}>
                          {cat.percent.toFixed(1)}%
                        </span>
                        {/* Month-over-month change */}
                        {cat.month_change !== 0 && (
                          <span style={{
                            fontSize: '0.625rem', fontWeight: 600,
                            padding: '1px 6px', borderRadius: 'var(--radius-full)',
                            background: changeBg, color: changeColor,
                            display: 'inline-flex', alignItems: 'center', gap: '2px',
                          }}>
                            {cat.month_change > 0 ? '↑' : '↓'}{Math.abs(cat.month_change).toFixed(0)}%
                          </span>
                        )}
                      </div>

                      {/* Row 3: Analytical details */}
                      <details className="category-extra" onClick={e => e.stopPropagation()}><summary>פרטים נוספים</summary><div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          ממוצע: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>{formatCurrency(cat.avg_transaction)}</strong>
                        </span>
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          חודשי: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>{formatCurrency(cat.monthly_avg)}</strong>
                        </span>
                      </div>

                      {/* Row 4: Top merchant */}
                      {cat.top_merchant && (
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <bdi>{cat.top_merchant}</bdi> ({formatCurrency(cat.top_merchant_total)})
                        </div>
                      )}

                      </details>
                      {/* Row 5: Progress bar + mini sparkline */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(cat.percent, 100)}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
                        </div>
                        {cat.sparkline && cat.sparkline.length > 1 && (
                          <div style={{ flexShrink: 0, opacity: 0.7 }}>
                            <SparklineChart data={cat.sparkline} color="var(--accent)" width={60} height={16} strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
                </div>
              )
            })}
          </div>

          {/* Show more / less toggle */}
          {sortedSnapshotCategories.length > 8 && (
            <div style={{ textAlign: 'center', marginTop: 'var(--space-sm)' }}>
              <button
                onClick={() => setSnapshotExpanded(!snapshotExpanded)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 20px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                  transition: 'all 0.15s',
                }}
              >
                {snapshotExpanded
                  ? 'הצג פחות'
                  : `הצג עוד ${sortedSnapshotCategories.length - 8} קטגוריות`
                }
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Income sources (where income came from) ────────────────── */}
      {incomeSources && incomeSources.sources.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
        >
          <div className="section-header-v2" style={{ flexWrap: 'wrap' }}>
            <span>מקורות הכנסה</span>
            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--info-muted)', color: 'var(--info)', fontWeight: 600 }}>כל התקופה</span>
            <span style={{ marginInlineStart: 'auto', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>
              {formatCurrency(incomeSources.total)}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-5)',
            }}
          >
            {incomeSources.sources.map((s, i) => {
              const pct = incomeSources.total > 0 ? (s.value / incomeSources.total) * 100 : 0
              const color = INCOME_COLORS[i % INCOME_COLORS.length]
              return (
                <div key={s.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '6px', minWidth: 0 }}>
                    <span className="category-dot" style={{ background: color }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                      {s.name}
                      {s.count > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}> · {s.count}</span>}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>{Math.round(pct)}%</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--success)', direction: 'ltr', flexShrink: 0 }}>
                      {formatCurrency(s.value)}
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(pct, 1.5)}%`, height: '100%', background: color, borderRadius: 'var(--radius-full)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ── Multi-month composition comparison ───────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
        style={{ marginTop: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
      >
        <Card
          className="glass-card"
          padding="md"
          hover
          onClick={() => navigate(`/monthly?session_id=${sessionId}`)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <BarChart3 size={18} style={{ color: 'var(--accent)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>השוואת חודשים</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                השוואת הרכב ההוצאות בין כמה חודשים, לפי קטגוריה ותת-קטגוריה
              </div>
            </div>
            <ChevronLeft size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
        </Card>
      </motion.div>

      {/* ── Weekly Summary ─────────────────────────────────────────── */}
      {weeklySummary && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
          className="dashboard-weekly-row"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-lg)', position: 'relative', zIndex: 1 }}
        >
          <div className="glass-card" style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>השבוע</span>
              {weeklySummary.change_pct !== 0 && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: weeklySummary.change_pct > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(52, 211, 153, 0.12)', color: weeklySummary.change_pct > 0 ? 'var(--accent-danger, #ef4444)' : 'var(--success)' }}>
                  {weeklySummary.change_pct > 0 ? '↑' : '↓'} {Math.abs(weeklySummary.change_pct)}%
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'right' }}>{formatCurrency(weeklySummary.this_week.total)}</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{weeklySummary.this_week.count} עסקאות{weeklySummary.this_week.top_category ? ` · ${weeklySummary.this_week.top_category}` : ''}</p>
          </div>
          <div className="glass-card" style={{ padding: '18px 22px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>שבוע שעבר</span>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr', textAlign: 'right' }}>{formatCurrency(weeklySummary.last_week.total)}</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{weeklySummary.last_week.count} עסקאות{weeklySummary.last_week.top_category ? ` · ${weeklySummary.last_week.top_category}` : ''}</p>
          </div>
        </motion.div>
      )}

      {/* Bento grid charts removed — data available in ניהול נתונים */}

      {/* ── Forecast & Velocity ────────────────────────────────────── */}
      {(forecast || velocity) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.35 }}
          style={{ display: 'grid', gridTemplateColumns: forecast && velocity ? '1fr 1fr' : '1fr', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}
          className="dashboard-premium-row"
        >
          {forecast && (
            <Card variant="glass" padding="md">
              <div className="section-header-v2" style={{ marginTop: 0 }}>
                <TrendingUp size={18} />
                <span title="תחזית לינארית על חודשים קלנדריים מלאים (לפי תאריך העסקה, בלי החודש הנוכחי). שונה מסרגל החודשים למעלה שמבוסס על תאריך חיוב.">תחזית חודש הבא</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                <AnimatedNumber
                  value={forecast.forecast_amount}
                  formatter={formatCurrency}
                  style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}
                />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: forecast.trend_direction === 'up' ? 'rgba(239, 68, 68, 0.12)' : forecast.trend_direction === 'down' ? 'rgba(52, 211, 153, 0.12)' : 'rgba(148, 163, 184, 0.12)', color: forecast.trend_direction === 'up' ? 'var(--accent-danger, #ef4444)' : forecast.trend_direction === 'down' ? 'var(--success)' : 'var(--text-muted)' }}>
                  {forecast.trend_direction === 'up' ? '↑ עלייה' : forecast.trend_direction === 'down' ? '↓ ירידה' : '→ יציב'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'help' }}
                  title={forecast.confidence === 'high'
                    ? 'רמת ביטחון גבוהה: 6+ חודשי נתונים עם מגמה עקבית (R² > 0.7)'
                    : forecast.confidence === 'medium'
                      ? 'רמת ביטחון בינונית: 3+ חודשי נתונים עם מגמה מתונה (R² > 0.4)'
                      : `רמת ביטחון נמוכה: ${(forecast.monthly_data?.length ?? 0) < 3 ? 'פחות מ-3 חודשי נתונים' : 'תנודתיות גבוהה בין חודשים'} — ככל שיצטברו נתונים התחזית תשתפר`}
                >
                  ביטחון: {forecast.confidence === 'high' ? 'גבוה' : forecast.confidence === 'medium' ? 'בינוני' : 'נמוך'} ⓘ
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>·</span>
                <span
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'help' }}
                  title={`ממוצע ההוצאות לחודש קלנדרי מלא (לפי תאריך העסקה, בנפרד מסרגל החודשים שמבוסס על תאריך חיוב), על פני ${forecast.monthly_data?.length ?? 0} חודשים, בלי החודש הנוכחי. התחזית מבוססת על מגמת שינוי ולא על הממוצע בלבד`}
                >
                  ממוצע בפועל: {formatCurrency(forecast.avg_monthly)}
                </span>
              </div>
              {forecast.monthly_data.length > 1 && (
                <div style={{ marginTop: '12px' }}>
                  <SparklineChart data={forecast.monthly_data.map((m) => m.amount)} color="var(--neon-cyan, var(--accent-primary))" width={280} height={40} />
                </div>
              )}
            </Card>
          )}

          {velocity && (
            <Card variant="glass" padding="md">
              <div className="section-header-v2" style={{ marginTop: 0 }}>
                <Zap size={18} />
                <span>קצב הוצאות</span>
              </div>
              <div className="velocity-stats" style={{ display: 'flex', gap: 'var(--space-lg)', marginBottom: '8px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>יומי</div>
                  <AnimatedNumber value={velocity.daily_avg} formatter={formatCurrency} style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>7 ימים</div>
                  <AnimatedNumber value={velocity.rolling_7day} formatter={formatCurrency} style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>30 יום</div>
                  <AnimatedNumber value={velocity.rolling_30day} formatter={formatCurrency} style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }} />
                </div>
              </div>
              {velocity.daily_data.length > 1 && (
                <div style={{ marginTop: '12px' }}>
                  <SparklineChart data={velocity.daily_data.map((d) => d.amount)} color="var(--neon-purple, var(--accent-primary))" width={280} height={40} />
                </div>
              )}
              {/* Monthly burn-down progress bar */}
              {forecast && forecast.avg_monthly > 0 && (() => {
                const last30Total = velocity.rolling_30day * 30
                const burnRatio = (last30Total / forecast.avg_monthly) * 100
                const burnPct = Math.min(burnRatio, 100)
                const isOver = last30Total > forecast.avg_monthly
                return (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', cursor: 'help' }} title="סך ההוצאות ב-30 הימים האחרונים (ממוצע יומי כפול 30) מול ממוצע ההוצאות החודשי. לא קשור ליעדי התקציב.">הוצאות 30 יום מול ממוצע חודשי</span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: isOver ? 'var(--danger)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {burnRatio.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${burnPct}%`,
                        borderRadius: '3px',
                        background: isOver
                          ? 'linear-gradient(90deg, var(--danger), #fb923c)'
                          : burnPct > 75
                            ? 'linear-gradient(90deg, var(--warning), #fbbf24)'
                            : 'linear-gradient(90deg, var(--success), #6ee7b7)',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                )
              })()}
            </Card>
          )}
        </motion.div>
      )}

      {/* ── Month-over-Month ───────────────────────────────────────── */}
      {monthlyData && monthlyData.months.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          style={{ marginTop: 'var(--space-lg)' }}
        >
          <div className="section-header-v2">
            <BarChart3 size={18} />
            <span>השוואת חודשים</span>
            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)', color: 'var(--accent)', fontWeight: 600 }}>
              {Math.min(monthlyData.months.length, 6)} חודשים אחרונים
            </span>
          </div>
          <Card className="glass-card" padding="md">
            <div
              style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(monthlyData.months.length, 6)}, 1fr)`, gap: 'var(--space-sm)' }}
              className="dashboard-monthly-comparison"
            >
              {monthlyData.months.slice(-6).map((month, idx, arr) => {
                const prev = idx > 0 ? arr[idx - 1].amount : null
                const changePct = prev ? ((month.amount - prev) / Math.abs(prev)) * 100 : null
                const isSelected = month.month === selectedMonth
                return (
                  <button type="button"
                    key={month.month}
                    onClick={() => setSelectedMonth(month.month)}
                    style={{
                      textAlign: 'center',
                      padding: 'var(--space-md)',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--accent-muted)' : 'var(--bg-secondary)',
                      border: isSelected ? '1px solid var(--border-accent)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: isSelected ? 'var(--accent)' : 'var(--text-muted)', marginBottom: '6px', fontWeight: isSelected ? 600 : 400 }}>
                      {month.month}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', direction: 'ltr' }}>
                      {formatCurrency(month.amount)}
                    </div>
                    <div className="month-bar-track"><i style={{height:`${Math.max(2,month.amount/Math.max(...monthlyData.months.map(m=>m.amount))*100)}%`}}/></div>
                    {changePct !== null && (
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, marginTop: '6px', color: changePct > 0 ? 'var(--accent-danger, #ef4444)' : 'var(--success)' }}>
                        {changePct > 0 ? '↑' : '↓'} {Math.abs(changePct).toFixed(1)}%
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Category Transactions Drawer ────────────────────────────── */}
      <CategoryTransactionsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        category={drawerCategory}
        month={
          snapshotMonthFrom || snapshotMonthTo
            ? (snapshotMonthFrom && snapshotMonthTo && snapshotMonthFrom === snapshotMonthTo
                ? snapshotMonthFrom
                : `${snapshotMonthFrom || '...'} — ${snapshotMonthTo || '...'}`)
            : ''
        }
        transactions={drawerTransactions}
        total={drawerTotal}
        loading={drawerLoading}
        error={drawerError}
        onRetry={() => drawerCategory && loadDrawerTransactions(drawerCategory)}
        availableCategories={availableCategoryNames}
        onCategoryChange={handleCategoryChange}
        subcategoryOptions={drawerSubcategoryOptions}
        subcategoryCatalog={subcategoryCatalogMap}
        onSubcategoryChange={handleSubcategoryChange}
        onSaveNote={handleSaveNote}
        onBulkCategoryChange={handleBulkCategoryChange}
      />

      <CategoryManagerModal
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
        categories={managerCategories}
        onRenameCategory={handleManagerRename}
        onAddCategory={addCustomCategory}
        onAddSubcategory={addCustomSubcategory}
      />
    </div>
    </>
  )
                  }
