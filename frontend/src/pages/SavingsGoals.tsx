import { useState, useMemo, useCallback } from 'react'
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

// ─── Constants ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'savings-goals'

const CATEGORIES = [
  'חופשה',
  'רכב',
  'חירום',
  'השקעה',
  'ריהוט',
  'אלקטרוניקה',
  'אחר',
]

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

function loadGoals(): SavingsGoal[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveGoals(goals: SavingsGoal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals))
}

// ─── Component ──────────────────────────────────────────────────────────

export default function SavingsGoals() {
  // State
  const [goals, setGoals] = useState<SavingsGoal[]>(loadGoals)
  const [showForm, setShowForm] = useState(false)
  const [addFundsId, setAddFundsId] = useState<string | null>(null)
  const [addFundsAmount, setAddFundsAmount] = useState('')

  // New goal form state
  const [newName, setNewName] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])

  // Summary
  const summary = useMemo(() => {
    const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0)
    const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0)
    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0
    return { totalSaved, totalTarget, overallProgress }
  }, [goals])

  // ── Handlers ──────────────────────────────────────────────────────────

  const addGoal = useCallback(() => {
    if (!newName.trim() || !newTarget || Number(newTarget) <= 0) return

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
    saveGoals(updated)
    setNewName('')
    setNewTarget('')
    setNewCategory(CATEGORIES[0])
    setNewColor(PRESET_COLORS[0])
    setShowForm(false)
  }, [newName, newTarget, newCategory, newColor, goals])

  const removeGoal = useCallback(
    (id: string) => {
      const updated = goals.filter((g) => g.id !== id)
      setGoals(updated)
      saveGoals(updated)
    },
    [goals],
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
      saveGoals(updated)
      setAddFundsId(null)
      setAddFundsAmount('')
    },
    [goals, addFundsAmount],
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
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="למשל: חופשה באירופה"
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input, var(--bg-card))',
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
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input, var(--bg-card))',
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
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input, var(--bg-card))',
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
                <div style={{ flex: '0 0 auto' }}>
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
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewColor(color)}
                        style={{
                          width: 28,
                          height: 28,
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
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={addGoal}
                    disabled={!newName.trim() || !newTarget || Number(newTarget) <= 0}
                  >
                    הוסף
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                    ביטול
                  </Button>
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
            <PiggyBank size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
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
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
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
