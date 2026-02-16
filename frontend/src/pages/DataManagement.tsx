import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Database,
  Wallet,
  Upload,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  Calendar,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabaseApi } from '../services/supabaseApi'
import type { UploadHistory } from '../services/types'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { ToastContainer, useToast } from '../components/ui/Toast'
import { formatCurrency, formatDate, formatNumber } from '../utils/formatting'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StorageInfo {
  transactionSets: number
  incomeCount: number
  uploads: UploadHistory[]
}

/* ------------------------------------------------------------------ */
/*  Animation                                                          */
/* ------------------------------------------------------------------ */

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.4, 0, 0.2, 1] as const },
  }),
}

/* ------------------------------------------------------------------ */
/*  Storage info card sub-component                                    */
/* ------------------------------------------------------------------ */

interface InfoCardProps {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string | number
  index: number
}

function InfoCard({ icon, iconBg, label, value, index }: InfoCardProps) {
  return (
    <motion.div custom={index} initial="hidden" animate="visible" variants={cardVariants}>
      <Card className="glass-card" hover>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                margin: '4px 0 0',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {value}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function DataManagementSkeleton() {
  return (
    <div style={{ direction: 'rtl' }}>
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
      </div>
      <div style={{ marginTop: 'var(--space-xl)' }}>
        <Skeleton variant="rectangular" height={200} />
      </div>
      <div style={{ marginTop: 'var(--space-xl)' }}>
        <Skeleton variant="rectangular" height={120} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function DataManagement() {
  const { user } = useAuth()
  const { toasts, showToast, removeToast } = useToast()

  // ── State ─────────────────────────────────────────────────────────────
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [deletingIncomes, setDeletingIncomes] = useState(false)
  const [deletingTransactions, setDeletingTransactions] = useState(false)
  const [showDeleteIncomesModal, setShowDeleteIncomesModal] = useState(false)
  const [showDeleteTransactionsModal, setShowDeleteTransactionsModal] = useState(false)

  // ── Fetch storage info ────────────────────────────────────────────────
  const fetchStorageInfo = useCallback(async () => {
    if (!user) return
    try {
      const info = await supabaseApi.getStorageInfo(user.id)
      setStorageInfo(info)
    } catch (err) {
      console.error('Error fetching storage info:', err)
      showToast('שגיאה בטעינת מידע אחסון', 'error')
    }
  }, [user, showToast])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)
      await fetchStorageInfo()
      setLoading(false)
    }
    load()
  }, [user, fetchStorageInfo])

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleDeleteAllIncomes = async () => {
    if (!user) return
    setDeletingIncomes(true)
    try {
      await supabaseApi.deleteAllIncomes(user.id)
      showToast('כל ההכנסות נמחקו בהצלחה', 'success')
      setShowDeleteIncomesModal(false)
      await fetchStorageInfo()
    } catch (err) {
      console.error('Error deleting incomes:', err)
      showToast('שגיאה במחיקת הכנסות', 'error')
    } finally {
      setDeletingIncomes(false)
    }
  }

  const handleDeleteAllTransactions = async () => {
    if (!user) return
    setDeletingTransactions(true)
    try {
      await supabaseApi.deleteAllTransactions(user.id)
      showToast('כל העסקאות נמחקו בהצלחה', 'success')
      setShowDeleteTransactionsModal(false)
      await fetchStorageInfo()
    } catch (err) {
      console.error('Error deleting transactions:', err)
      showToast('שגיאה במחיקת עסקאות', 'error')
    } finally {
      setDeletingTransactions(false)
    }
  }

  // ── Not logged in ─────────────────────────────────────────────────────
  if (!user) {
    return (
      <EmptyState
        icon="🔐"
        title="נדרשת התחברות"
        text="יש להתחבר כדי לנהל את הנתונים שלך"
      />
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return <DataManagementSkeleton />
  }

  const uploads = storageInfo?.uploads ?? []

  return (
    <div style={{ direction: 'rtl' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <PageHeader
        title="ניהול נתונים"
        subtitle="צפייה, ניהול ומחיקה של הנתונים השמורים שלך"
        icon={Database}
      />

      {/* ─── Storage overview cards ─────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-md)',
        }}
      >
        <InfoCard
          index={0}
          icon={<Database size={22} style={{ color: '#818cf8' }} />}
          iconBg="rgba(129, 140, 248, 0.12)"
          label="סטים של עסקאות"
          value={formatNumber(storageInfo?.transactionSets ?? 0)}
        />
        <InfoCard
          index={1}
          icon={<Wallet size={22} style={{ color: '#34d399' }} />}
          iconBg="rgba(16, 185, 129, 0.12)"
          label="הכנסות שמורות"
          value={formatNumber(storageInfo?.incomeCount ?? 0)}
        />
        <InfoCard
          index={2}
          icon={<Upload size={22} style={{ color: '#0ea5e9' }} />}
          iconBg="rgba(14, 165, 233, 0.12)"
          label="העלאות"
          value={formatNumber(uploads.length)}
        />
      </div>

      {/* ─── Upload history table ───────────────────────────────────── */}
      {uploads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
          style={{ marginTop: 'var(--space-xl)' }}
        >
          <div className="section-header-v2">
            <FileSpreadsheet size={18} />
            <span>היסטוריית העלאות</span>
          </div>

          <Card className="glass-card" padding="none">
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    <th style={thStyle}>שם קובץ</th>
                    <th style={thStyle}>שורות</th>
                    <th style={thStyle}>הוצאות</th>
                    <th style={thStyle}>הכנסות</th>
                    <th style={thStyle}>תאריך העלאה</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((upload, idx) => (
                    <motion.tr
                      key={upload.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 + idx * 0.04 }}
                      style={{
                        borderBottom:
                          idx < uploads.length - 1
                            ? '1px solid var(--border-color)'
                            : 'none',
                      }}
                      className="upload-row"
                    >
                      <td style={tdStyle}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <FileSpreadsheet
                            size={16}
                            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                          />
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '200px',
                            }}
                          >
                            {upload.file_name}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                        {formatNumber(upload.row_count)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: 'var(--accent-danger, #ef4444)',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          direction: 'ltr',
                          textAlign: 'center',
                        }}
                      >
                        {formatCurrency(upload.total_expenses)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: 'var(--accent-secondary, #10b981)',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          direction: 'ltr',
                          textAlign: 'center',
                        }}
                      >
                        {formatCurrency(upload.total_income)}
                      </td>
                      <td style={tdStyle}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Calendar
                            size={14}
                            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                          />
                          {formatDate(upload.uploaded_at)}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ─── Danger zone ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.35 }}
        style={{ marginTop: 'var(--space-xl)' }}
      >
        <div className="section-header-v2">
          <AlertTriangle size={18} />
          <span>אזור מסוכן</span>
        </div>

        <Card
          padding="lg"
          className="glass-card"
        >
          <div
            style={{
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '16px',
              }}
            >
              <AlertTriangle size={20} style={{ color: '#f87171' }} />
              <h3
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--accent-danger, #ef4444)',
                }}
              >
                פעולות בלתי הפיכות
              </h3>
            </div>

            <p
              style={{
                margin: '0 0 20px',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              פעולות אלו ימחקו נתונים לצמיתות ולא ניתן יהיה לשחזר אותם.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              {/* Delete all incomes */}
              <Button
                variant="danger"
                icon={<Trash2 size={16} />}
                onClick={() => setShowDeleteIncomesModal(true)}
                disabled={(storageInfo?.incomeCount ?? 0) === 0}
              >
                מחק את כל ההכנסות
              </Button>

              {/* Delete all transactions */}
              <Button
                variant="danger"
                icon={<Trash2 size={16} />}
                onClick={() => setShowDeleteTransactionsModal(true)}
                disabled={(storageInfo?.transactionSets ?? 0) === 0}
              >
                מחק את כל העסקאות
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ─── Delete incomes modal ───────────────────────────────────── */}
      <Modal
        isOpen={showDeleteIncomesModal}
        onClose={() => setShowDeleteIncomesModal(false)}
        title="האם אתה בטוח?"
        size="sm"
      >
        <div style={{ direction: 'rtl' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              padding: '14px',
              background: 'rgba(239, 68, 68, 0.08)',
              borderRadius: '10px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <AlertTriangle size={24} style={{ color: '#f87171', flexShrink: 0 }} />
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                lineHeight: 1.6,
              }}
            >
              פעולה זו תמחק את כל ההכנסות שלך (
              <strong>{formatNumber(storageInfo?.incomeCount ?? 0)}</strong> רשומות).
              לא ניתן לשחזר נתונים אלו לאחר המחיקה.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-start',
            }}
          >
            <Button
              variant="danger"
              onClick={handleDeleteAllIncomes}
              loading={deletingIncomes}
              icon={<Trash2 size={16} />}
            >
              מחק הכל
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteIncomesModal(false)}
            >
              ביטול
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Delete transactions modal ──────────────────────────────── */}
      <Modal
        isOpen={showDeleteTransactionsModal}
        onClose={() => setShowDeleteTransactionsModal(false)}
        title="האם אתה בטוח?"
        size="sm"
      >
        <div style={{ direction: 'rtl' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              padding: '14px',
              background: 'rgba(239, 68, 68, 0.08)',
              borderRadius: '10px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <AlertTriangle size={24} style={{ color: '#f87171', flexShrink: 0 }} />
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                lineHeight: 1.6,
              }}
            >
              פעולה זו תמחק את כל העסקאות השמורות שלך (
              <strong>{formatNumber(storageInfo?.transactionSets ?? 0)}</strong> סטים).
              לא ניתן לשחזר נתונים אלו לאחר המחיקה.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-start',
            }}
          >
            <Button
              variant="danger"
              onClick={handleDeleteAllTransactions}
              loading={deletingTransactions}
              icon={<Trash2 size={16} />}
            >
              מחק הכל
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteTransactionsModal(false)}
            >
              ביטול
            </Button>
          </div>
        </div>
      </Modal>

      <style>{`
        .upload-row:hover td {
          background: var(--bg-elevated, #334155);
        }
      `}</style>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Table styles                                                       */
/* ------------------------------------------------------------------ */

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'right',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  fontSize: '0.8125rem',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: 'var(--text-primary)',
  fontSize: '0.8125rem',
  transition: 'background 0.15s ease',
}
