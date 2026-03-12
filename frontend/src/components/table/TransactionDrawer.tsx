import { useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Tag, CreditCard, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '../../utils/formatting'
import { transactionsApi } from '../../services/api'
import type { Transaction } from '../../services/types'

interface TransactionDrawerProps {
  transaction: Transaction | null
  isOpen: boolean
  onClose: () => void
  sessionId: string | null
  onUpdateTransaction?: (updated: Transaction) => void
}

export default function TransactionDrawer({ transaction, isOpen, onClose, sessionId, onUpdateTransaction }: TransactionDrawerProps) {
  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  const amount = transaction?.סכום ?? 0
  const isExpense = amount < 0

  const [notes, setNotes] = useState<string>(transaction?.הערות ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNotes(transaction?.הערות ?? '')
    setError(null)
    setSaving(false)
  }, [transaction])

  const handleSaveNotes = useCallback(async () => {
    if (!transaction || !sessionId || typeof transaction.id !== 'number') {
      return
    }
    try {
      setSaving(true)
      setError(null)
      await transactionsApi.updateTransactionNote(sessionId, transaction.id, notes)
      if (onUpdateTransaction) {
        onUpdateTransaction({ ...transaction, הערות: notes })
      }
    } catch (e) {
      console.error('Failed to save notes', e)
      setError('שמירת ההערות נכשלה. נסו שוב.')
    } finally {
      setSaving(false)
    }
  }, [transaction, sessionId, notes, onUpdateTransaction])

  return (
    <AnimatePresence>
      {isOpen && transaction && (
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
              background: 'var(--glass-bg-hover)',
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
                  width: 32,
                  height: 32,
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
                  color: isExpense ? 'var(--accent-danger, #ef4444)' : 'var(--accent-secondary, #10b981)',
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
                value={transaction.תיאור}
              />

              {/* Date */}
              <DetailRow
                icon={<Calendar size={16} />}
                label="תאריך"
                value={formatDate(transaction.תאריך)}
              />

              {/* Category */}
              {transaction.קטגוריה && (
                <DetailRow
                  icon={<Tag size={16} />}
                  label="קטגוריה"
                  value={transaction.קטגוריה}
                />
              )}

              {/* Card type / last 4 digits if available */}
              {transaction['ארבע ספרות אחרונות'] && (
                <DetailRow
                  icon={<CreditCard size={16} />}
                  label="כרטיס"
                  value={`**** ${transaction['ארבע ספרות אחרונות']}`}
                />
              )}

              {/* Manual notes */}
              <div
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
                    disabled={saving || !sessionId || !transaction}
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
              </div>
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
