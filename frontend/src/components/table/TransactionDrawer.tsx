import { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Tag, CreditCard, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '../../utils/formatting'
import { transactionsApi } from '../../services/api'
import { supabaseApi } from '../../services/supabaseApi'
import { useAuth } from '../../lib/AuthContext'
import { pushOverlay, removeOverlay, isTopOverlay, lockBodyScroll, unlockBodyScroll } from '../../lib/overlayStack'
import SimilarTransactions from './SimilarTransactions'
import TransactionClassificationEditor from './TransactionClassificationEditor'
import { saveTransactionEdits, type TransactionEditorChanges } from '../../services/transactionEdits'
import Button from '../ui/Button'
import type { Transaction as BaseTransaction } from '../../services/types'

// Allow extra dynamic fields (e.g. 'ארבע ספרות אחרונות') on top of the core Transaction shape
interface Transaction extends BaseTransaction {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface TransactionDrawerProps {
  transaction: Transaction | null
  isOpen: boolean
  onClose: () => void
  sessionId: string | null
  owner?: string | null
  onUpdateTransaction?: (updated: Transaction) => void
  onClassificationChanged?: () => void
  startEditing?: boolean
}

export default function TransactionDrawer(props: TransactionDrawerProps) {
  return <TransactionDrawerDetails key={`${props.sessionId}:${props.transaction?.id ?? props.transaction?.תיאור ?? ''}:${props.isOpen}`} {...props} />
}

function TransactionDrawerDetails({
  transaction, isOpen, onClose, sessionId, owner = null, onUpdateTransaction, onClassificationChanged, startEditing = false,
}: TransactionDrawerProps) {
  const [editing, setEditing] = useState(startEditing)
  const [related, setRelated] = useState<Transaction | null>(null)
  const active = related ?? transaction
  // Overlay stack id: this drawer closes on Escape only when it is the
  // topmost overlay, so a palette/modal above it closes first.
  const overlayIdRef = useRef<string | null>(null)

  // Close on Escape (topmost overlay only)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlayIdRef.current && isTopOverlay(overlayIdRef.current)) onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!isOpen) return
    const id = pushOverlay()
    overlayIdRef.current = id
    lockBodyScroll()
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      removeOverlay(id)
      overlayIdRef.current = null
      unlockBodyScroll()
    }
  }, [isOpen, handleKeyDown])

  // Keyboard modal: move focus in, keep Tab inside, restore focus on close.
  useEffect(() => {
    if (!isOpen) return
    const opener = document.activeElement as HTMLElement | null
    const outside = Array.from(document.querySelectorAll<HTMLElement>('.orbit-topbar, .mobile-bottom-nav'))
    const previous = outside.map((el) => el.inert)
    outside.forEach((el) => { el.inert = true })
    const getDrawer = () => document.querySelector<HTMLElement>('.transaction-drawer')
    const focusable = () => {
      const d = getDrawer()
      if (!d) return [] as HTMLElement[]
      return Array.from(d.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((el) => el.getClientRects().length > 0)
    }
    const t = window.setTimeout(() => {
      const d = getDrawer()
      const target = d?.querySelector<HTMLElement>('button[aria-label="סגור"]') ?? focusable()[0] ?? d
      target?.focus()
    }, 60)
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      if (!overlayIdRef.current || !isTopOverlay(overlayIdRef.current)) return
      const d = getDrawer()
      const items = focusable()
      if (!d || items.length === 0) { event.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !d.contains(active))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (active === last || !d.contains(active))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', trap)
      outside.forEach((el, i) => { el.inert = previous[i] })
      if (opener?.isConnected) opener.focus()
    }
  }, [isOpen])

  const amount = active?.סכום ?? 0
  const isExpense = amount < 0

  const [notes, setNotes] = useState<string>(active?.הערות ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNotes(active?.הערות ?? '')
    setError(null)
    setSaving(false)
  }, [active])

  const { user } = useAuth()

  const handleSaveNotes = useCallback(async () => {
    if (!active || !sessionId || typeof active.id !== 'number') {
      return
    }
    try {
      setSaving(true)
      setError(null)
      const resp = await transactionsApi.updateTransactionNote(sessionId, active.id, notes)
      // Persist by fingerprint so the note survives restores and cold starts.
      if (user && resp.txn_key) {
        if (notes.trim()) {
          await supabaseApi.upsertTransactionNote(user.id, resp.txn_key, notes).catch(() => {})
        } else {
          await supabaseApi.deleteTransactionNote(user.id, resp.txn_key).catch(() => {})
        }
      }
      const updated = { ...active, הערות: resp.notes ?? '' }
      if (related) setRelated(updated)
      onUpdateTransaction?.(updated)
    } catch (e) {
      console.error('Failed to save notes', e)
      setError('שמירת ההערות נכשלה. נסו שוב.')
    } finally {
      setSaving(false)
    }
  }, [active, sessionId, notes, onUpdateTransaction, related, user])

  const handleSaveClassification = async (changes: TransactionEditorChanges) => {
    if (!active || !sessionId) return
    const { updated, warning } = await saveTransactionEdits(sessionId, user?.id, active, changes)
    if (related) setRelated(updated)
    if (changes.note !== undefined) setNotes(updated.הערות ?? '')
    onUpdateTransaction?.(updated)
    if (changes.classification) onClassificationChanged?.()
    return warning
  }

  return (
    <AnimatePresence>
      {isOpen && active && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 99998,
            }}
          />

          {/* Drawer - slides from left in RTL context */}
          <motion.div
            className="transaction-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="פרטי עסקה"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '100%',
              maxWidth: '400px',
              zIndex: 99999,
              background: 'var(--bg-card)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRight: '1px solid var(--glass-border)',
              boxShadow: 'var(--elevation-4)',
              direction: 'rtl',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--glass-border)',
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
                פרטי עסקה
              </h3>
              <button
                onClick={onClose}
                aria-label="סגור"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Amount hero */}
            <div
              style={{
                padding: '24px 20px',
                textAlign: 'center',
                borderBottom: '1px solid var(--glass-border)',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '2rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: isExpense ? 'var(--accent-danger, #ef4444)' : 'var(--success)',
                  direction: 'ltr',
                  letterSpacing: '-0.02em',
                }}
              >
                {formatCurrency(amount)}
              </p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                {isExpense ? 'הוצאה' : 'הכנסה'}
              </p>
            </div>

            {/* Details */}
            <div
              style={{
                padding: '20px',
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Description */}
              <DetailRow
                icon={<FileText size={16} />}
                label="תיאור"
                value={active.תיאור}
              />

              {/* Date */}
              <DetailRow
                icon={<Calendar size={16} />}
                label="תאריך"
                value={formatDate(active.תאריך)}
              />

              {/* Billing date (when the card issuer supplies one) */}
              {active.תאריך_חיוב && (
                <DetailRow
                  icon={<Calendar size={16} />}
                  label="תאריך חיוב"
                  value={formatDate(active.תאריך_חיוב)}
                />
              )}

              {/* Category */}
              {active.קטגוריה && (
                <DetailRow
                  icon={<Tag size={16} />}
                  label="קטגוריה"
                  value={active.קטגוריה}
                />
              )}

              {/* Card type / last 4 digits if available */}
              {active['ארבע ספרות אחרונות'] && (
                <DetailRow
                  icon={<CreditCard size={16} />}
                  label="כרטיס"
                  value={`**** ${active['ארבע ספרות אחרונות']}`}
                />
              )}

              {active.קטגוריה_משנה && (
                <DetailRow icon={<Tag size={16} />} label="תת־קטגוריה" value={active.קטגוריה_משנה} />
              )}
              {related && <Button type="button" size="sm" variant="ghost" onClick={() => {
                setRelated(null)
                setEditing(false)
              }}>חזרה לעסקה המקורית</Button>}
              {sessionId && typeof active.id === 'number' && (
                editing ? (
                  <TransactionClassificationEditor
                    key={active.id}
                    transaction={active}
                    sessionId={sessionId}
                    userId={user?.id}
                    onSave={handleSaveClassification}
                    onClose={() => setEditing(false)}
                  />
                ) : (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)} disabled={saving}>
                    שנה קטגוריה
                  </Button>
                )
              )}
              {isOpen && sessionId && typeof active.id === 'number' && (
                <SimilarTransactions key={JSON.stringify([sessionId, active.id, owner])}
                  sessionId={sessionId} transactionId={active.id} owner={owner}
                  onEdit={item => { setRelated(item); setEditing(true) }} />
              )}

              {!editing && <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                  }}
                >
                  הערות
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="הוסיפו הערה חופשית על העסקה הזו"
                  rows={3}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md, 8px)',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                  }}
                />
                {error && (
                  <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
                    {error}
                  </span>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={saving || !sessionId || !active}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '999px',
                      border: 'none',
                      background: 'var(--accent-primary, #4f46e5)',
                      color: '#fff',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: saving ? 'default' : 'pointer',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'שומר...' : 'שמור הערות'}
                  </button>
                </div>
              </div>}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        background: 'var(--glass-bg)',
        borderRadius: 'var(--radius-md, 8px)',
        border: '1px solid var(--glass-border)',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'rgba(129, 140, 248, 0.1)',
          color: 'var(--accent-primary, #818cf8)',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: '0.6875rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: '2px 0 0',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            wordBreak: 'break-word',
          }}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
