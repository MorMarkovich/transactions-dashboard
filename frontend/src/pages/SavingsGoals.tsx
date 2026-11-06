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
import Select from '../components/ui/Select'
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

function isValidGoal(value: unknown): value is SavingsGoal {
  if (!value || typeof value !== 'object') return false
  const g = value as Record<string, unknown>
  return (
    typeof g.id === 'string' &&
    typeof g.name === 'string' &&
    typeof g.category === 'string' &&
    typeof g.color === 'string' &&
    typeof g.created_at === 'string' &&
    Number.isFinite(g.target_amount) &&
    Number.isFinite(g.current_amount) &&
    (g.target_amount as number) > 0 &&
    (g.current_amount as number) >= 0
  )
}

// Preserve the original raw value under versioned backup keys before anything
// else could overwrite it; a failed backup write never touches the original.
// Returns false when the raw could not be preserved anywhere.
const MAX_RAW_BACKUPS = 3

function backupRawGoals(storageKey: string, raw: string): boolean {
  try {
    for (let i = 1; i <= MAX_RAW_BACKUPS; i++) {
      const backupKey = i === 1 ? `${storageKey}-corrupt-backup` : `${storageKey}-corrupt-backup-${i}`
      const existing = localStorage.getItem(backupKey)
      if (existing === raw) return true // already preserved
      if (existing === null) {
        localStorage.setItem(backupKey, raw)
        return true
      }
    }
  } catch {
    /* storage may be unavailable */
  }
  return false
}

// A corrupt original we had to drop but could not yet preserve. While this is
// set, repair writes to that key are refused so the raw is never lost silently.
let unpreservedRaw: { key: string; raw: string } | null = null

function loadGoals(ownerId: string | null, legacySessionId: string | null): SavingsGoal[] {
  const storageKey = getStorageKey(ownerId)
  try {
    let stored = localStorage.getItem(storageKey)
    if (!stored && ownerId && legacySessionId) {
      stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}-${legacySessionId}`)
      if (stored) localStorage.setItem(storageKey, stored)
    }
    if (!stored) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(stored)
    } catch {
      if (!backupRawGoals(storageKey, stored)) unpreservedRaw = { key: storageKey, raw: stored }
      return []
    }
    if (!Array.isArray(parsed)) {
      if (!backupRawGoals(storageKey, stored)) unpreservedRaw = { key: storageKey, raw: stored }
      return []
    }
    // Recover every valid entry; drop malformed ones instead of crashing the
    // app or rendering NaN, keeping the original raw value in the backup.
    const valid = parsed.filter(isValidGoal)
    if (valid.length !== parsed.length && !backupRawGoals(storageKey, stored)) {
      unpreservedRaw = { key: storageKey, raw: stored }
    }
    return valid
  } catch {
    return []
  }
}

// Returns false when persistence failed (private browsing / quota) so callers
// can avoid showing a change as saved when it was not. Refuses the write while
// an unpreserved corrupt original exists for this key: retry the backup first,
// so the original raw is never overwritten without a surviving copy.
function saveGoals(goals: SavingsGoal[], ownerId: string | null): boolean {
  const storageKey = getStorageKey(ownerId)
  try {
    if (unpreservedRaw && unpreservedRaw.key === storageKey) {
      if (!backupRawGoals(storageKey, unpreservedRaw.raw)) return false
      unpreservedRaw = null
    }
    localStorage.setItem(storageKey, JSON.stringify(goals))
    return true
  } catch {
    return false
  }
}

// ─── Component ──────────────────────────────────────────────────────────

export default function SavingsGoals() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const sessionId = searchParams.get('session_id')
  const ownerId = user?.id ?? null

  // State
  const [goals, setGoals] = useState<SavingsGoal[]>(() => loadGoals(ownerId, sessionId))
  // Re-key when the auth owner changes (account switch without remount):
  // never show or write the previous owner's goals under the new key.
  const [goalsOwner, setGoalsOwner] = useState(ownerId)
  if (goalsOwner !== ownerId) {
    setGoalsOwner(ownerId)
    setGoals(loadGoals(ownerId, sessionId))
  }
  const [showForm, setShowForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState('')
  const [addFundsId, setAddFundsId] = useState<string | null>(null)
  const [addFundsAmount, setAddFundsAmount] = useState('')
  const [fundsError, setFundsError] = useState('')

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
    if (!saveGoals(updated, ownerId)) {
      setFormError('השמירה נכשלה - היעד לא נשמר, נסה שוב')
      return
    }
    setGoals(updated)
    setNewName('')
    setNewTarget('')
    setNewCategory(CATEGORIES[0])
    setNewColor(PRESET_COLORS[0])
    setShowForm(false)
  }, [newName, newTarget, newCategory, newColor, goals, ownerId])

  const removeGoal = useCallback(
    (id: string) => {
      const updated = goals.filter((g) => g.id !== id)
      if (!saveGoals(updated, ownerId)) {
        setSaveError('השמירה נכשלה - היעד לא נמחק, נסה שוב')
        return
      }
      setSaveError('')
      setGoals(updated)
    },
    [goals, ownerId],
  )

  const handleAddFunds = useCallback(
    (id: string) => {
      const amount = Number(addFundsAmount)
      if (!addFundsAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
        setFundsError('נא להזין סכום חיובי')
        return
      }
      const goal = goals.find((g) => g.id === id)
      if (!goal) return
      const remaining = goal.target_amount - goal.current_amount
      if (amount > remaining) {
        setFundsError(`נשארו רק ${formatCurrency(remaining)} ליעד - הסכום לא נוסף`)
        return
      }
      setFundsError('')
      const updated = goals.map((g) =>
        g.id === id ? { ...g, current_amount: g.current_amount + amount } : g,
      )
      if (!saveGoals(updated, ownerId)) {
        setFundsError('השמירה נכשלה - הסכום לא נוסף, נסה שוב')
        return
      }
      setGoals(updated)
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

      {/* ─── Persist-failure notice ────────────────────────────── */}
      {saveError && (
        <div
          role="alert"
          style={{
            marginBottom: 'var(--space-md)',
            fontSize: '0.8125rem',
            color: 'var(--accent-danger, #ef4444)',
            fontWeight: 500,
          }}
        >
          {saveError}
        </div>
      )}

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
                  <Select ariaLabel="קטגוריה" options={CATEGORIES.map((cat) => ({ value: cat, label: cat }))} value={newCategory} onChange={setNewCategory} />
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

                      {confirmDeleteId === goal.id ? (
                        <span style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                          <button
                            onClick={() => { removeGoal(goal.id); setConfirmDeleteId(null) }}
                            style={{ minWidth: 44, minHeight: 44, borderRadius: '8px', border: 'none', background: 'var(--accent-danger, #ef4444)', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                          >
                            למחוק?
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            style={{ minWidth: 44, minHeight: 44, borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            ביטול
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(goal.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            minWidth: 44,
                            minHeight: 44,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            borderRadius: '6px',
                            transition: 'color 0.15s',
                            flexShrink: 0,
                          }}
                          title="מחק יעד"
                          aria-label={`מחק את היעד ${goal.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
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
                          <div>
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
                                width: 44,
                                height: 44,
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
                                setFundsError('')
                              }}
                              style={{
                                width: 44,
                                height: 44,
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
                          {fundsError && (
                            <div role="alert" style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--accent-danger, #ef4444)', fontWeight: 500 }}>
                              {fundsError}
                            </div>
                          )}
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
                              setFundsError('')
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
