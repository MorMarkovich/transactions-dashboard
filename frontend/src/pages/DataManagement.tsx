import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database,
  Wallet,
  Upload,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  Calendar,
  ChevronDown,
  Layers,
  Tag,
  TrendingDown,
  TrendingUp,
  Columns,
  Clock,
  Hash,
  Plus,
  Loader2,
  Receipt,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabaseApi } from '../services/supabaseApi'
import { transactionsApi } from '../services/api'
import type {
  UploadHistory,
  Income,
  SessionInfo,
  SessionFileInfo,
} from '../services/types'
import Card from '../components/ui/Card'
import Skeleton from '../components/ui/Skeleton'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import { ToastContainer, useToast } from '../components/ui/Toast'
import { formatCurrency, formatDate, formatNumber } from '../utils/formatting'
import { get_icon } from '../utils/constants'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StorageInfo {
  transactionSets: number
  incomeCount: number
  uploads: UploadHistory[]
}

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

const INCOME_TYPE_LABELS: Record<string, string> = {
  salary: 'משכורת',
  freelance: 'פרילנס',
  rental: 'שכירות',
  investment: 'השקעות',
  other: 'אחר',
}

const RECURRING_LABELS: Record<string, string> = {
  monthly: 'חודשי',
  weekly: 'שבועי',
  yearly: 'שנתי',
  one_time: 'חד-פעמי',
  once: 'חד-פעמי',
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
/*  Collapsible section                                                */
/* ------------------------------------------------------------------ */

function CollapsibleSection({
  icon,
  iconColor,
  title,
  badge,
  expanded,
  onToggle,
  children,
  dangerStyle,
}: {
  icon: React.ReactNode
  iconColor?: string
  title: string
  badge?: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  dangerStyle?: boolean
}) {
  return (
    <Card padding="md" className="glass-card">
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          fontFamily: 'var(--font-family)',
        }}
      >
        <span style={{ flexShrink: 0, color: iconColor }}>{icon}</span>
        <span
          style={{
            fontSize: '0.9375rem',
            fontWeight: 700,
            color: dangerStyle ? 'var(--accent-danger, #ef4444)' : 'var(--text-primary)',
          }}
        >
          {title}
        </span>
        {badge && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
            ({badge})
          </span>
        )}
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-muted)',
            marginRight: 'auto',
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: '16px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
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
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--space-md)',
        }}
      >
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
      <div style={{ marginTop: 'var(--space-xl)' }}>
        <Skeleton variant="rectangular" height={400} />
      </div>
      <div style={{ marginTop: 'var(--space-xl)' }}>
        <Skeleton variant="rectangular" height={200} />
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
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('session_id')

  // ── Storage & session state ─────────────────────────────────────────
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [incomes, setIncomes] = useState<Income[]>([])
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Income form state ───────────────────────────────────────────────
  const [incDescription, setIncDescription] = useState('')
  const [incAmount, setIncAmount] = useState('')
  const [incType, setIncType] = useState('משכורת')
  const [incRecurring, setIncRecurring] = useState('חד-פעמי')
  const [submitting, setSubmitting] = useState(false)
  const [deletingIncomeId, setDeletingIncomeId] = useState<string | null>(null)

  // ── Delete modals ───────────────────────────────────────────────────
  const [deletingIncomes, setDeletingIncomes] = useState(false)
  const [deletingTransactions, setDeletingTransactions] = useState(false)
  const [showDeleteIncomesModal, setShowDeleteIncomesModal] = useState(false)
  const [showDeleteTransactionsModal, setShowDeleteTransactionsModal] = useState(false)

  // ── Section expand state ────────────────────────────────────────────
  const [dangerZoneExpanded, setDangerZoneExpanded] = useState(false)
  const [sessionInfoExpanded, setSessionInfoExpanded] = useState(true)
  const [incomesExpanded, setIncomesExpanded] = useState(true)
  const [uploadsExpanded, setUploadsExpanded] = useState(true)
  const [sessionFiles, setSessionFiles] = useState<SessionFileInfo[]>([])
  const [filesExpanded, setFilesExpanded] = useState(true)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)

  // ── Fetch storage info ──────────────────────────────────────────────
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

  const fetchIncomes = useCallback(async () => {
    if (!user) return
    try {
      const data = await supabaseApi.getIncomes(user.id)
      setIncomes(data)
    } catch (err) {
      console.error('Error fetching incomes:', err)
    }
  }, [user])

  const fetchSessionInfo = useCallback(async () => {
    if (!sessionId) return
    try {
      const data = await transactionsApi.getSessionInfo(sessionId)
      setSessionInfo(data)
    } catch (err) {
      console.error('Error fetching session info:', err)
    }
  }, [sessionId])

  const fetchSessionFiles = useCallback(async () => {
    if (!sessionId) return
    try {
      const data = await transactionsApi.getSessionFiles(sessionId)
      setSessionFiles(data.files)
    } catch {
      setSessionFiles([])
    }
  }, [sessionId])

  const handleDeleteFile = useCallback(async (fileName: string) => {
    if (!sessionId) return
    setDeletingFile(fileName)
    try {
      const result = await transactionsApi.deleteSessionFile(sessionId, fileName)
      if (result.remaining === 0) {
        // All files removed — clear session entirely
        await transactionsApi.deleteSession(sessionId).catch(() => {})
        setSessionInfo(null)
        setSessionFiles([])
        navigate(window.location.pathname, { replace: true })
      } else {
        await Promise.all([fetchSessionFiles(), fetchSessionInfo()])
      }
    } catch (err) {
      console.error('Error deleting file:', err)
    } finally {
      setDeletingFile(null)
    }
  }, [sessionId, fetchSessionFiles, fetchSessionInfo, navigate])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)
      await Promise.all([fetchStorageInfo(), fetchIncomes(), fetchSessionInfo(), fetchSessionFiles()])
      setLoading(false)
    }
    load()
  }, [user, fetchStorageInfo, fetchIncomes, fetchSessionInfo, fetchSessionFiles])

  // ── Income handlers ─────────────────────────────────────────────────
  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!incDescription.trim() || !incAmount) {
      showToast('נא למלא את כל השדות', 'warning')
      return
    }
    const numAmount = parseFloat(incAmount)
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('נא להזין סכום חיובי', 'warning')
      return
    }

    setSubmitting(true)
    const tempId = `temp-${Date.now()}`
    const optimistic: Income = {
      id: tempId,
      user_id: user.id,
      description: incDescription.trim(),
      amount: numAmount,
      income_type: incType,
      recurring: incRecurring,
      created_at: new Date().toISOString(),
    }
    setIncomes((prev) => [optimistic, ...prev])
    setIncDescription('')
    setIncAmount('')

    try {
      const saved = await supabaseApi.addIncome({
        user_id: user.id,
        description: optimistic.description,
        amount: optimistic.amount,
        income_type: optimistic.income_type,
        recurring: optimistic.recurring,
      })
      setIncomes((prev) => prev.map((inc) => (inc.id === tempId ? saved : inc)))
      showToast('הכנסה נוספה בהצלחה', 'success')
      await fetchStorageInfo()
    } catch (err) {
      setIncomes((prev) => prev.filter((inc) => inc.id !== tempId))
      showToast('שגיאה בהוספת הכנסה', 'error')
      console.error('Error adding income:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteIncome = async (id: string) => {
    if (!user) return
    setDeletingIncomeId(id)
    const backup = incomes
    setIncomes((prev) => prev.filter((inc) => inc.id !== id))

    try {
      await supabaseApi.deleteIncome(id)
      showToast('הכנסה נמחקה', 'success')
      await fetchStorageInfo()
    } catch (err) {
      setIncomes(backup)
      showToast('שגיאה במחיקת הכנסה', 'error')
      console.error('Error deleting income:', err)
    } finally {
      setDeletingIncomeId(null)
    }
  }

  const handleDeleteAllIncomes = async () => {
    if (!user) return
    setDeletingIncomes(true)
    try {
      await supabaseApi.deleteAllIncomes(user.id)
      showToast('כל ההכנסות נמחקו בהצלחה', 'success')
      setShowDeleteIncomesModal(false)
      setIncomes([])
      // Check if transactions are also empty — if so, clear session entirely
      const info = await supabaseApi.getStorageInfo(user.id)
      if (info.transactionSets === 0 && sessionId) {
        await transactionsApi.deleteSession(sessionId).catch(() => {})
        setSessionInfo(null)
        setSessionFiles([])
        navigate(window.location.pathname, { replace: true })
      }
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
      // Also clear the in-memory backend session
      if (sessionId) {
        await transactionsApi.deleteSession(sessionId).catch(() => {})
      }
      showToast('כל העסקאות נמחקו בהצלחה', 'success')
      setShowDeleteTransactionsModal(false)
      setSessionInfo(null)
      setSessionFiles([])
      // Remove session_id from URL so Dashboard shows empty state
      navigate(window.location.pathname, { replace: true })
      await fetchStorageInfo()
    } catch (err) {
      console.error('Error deleting transactions:', err)
      showToast('שגיאה במחיקת עסקאות', 'error')
    } finally {
      setDeletingTransactions(false)
    }
  }

  // ── Not logged in ───────────────────────────────────────────────────
  if (!user) {
    return (
      <EmptyState
        icon="🔐"
        title="נדרשת התחברות"
        text="יש להתחבר כדי לנהל את הנתונים שלך"
      />
    )
  }

  if (loading) {
    return <DataManagementSkeleton />
  }

  const uploads = storageInfo?.uploads ?? []
  const manualIncome = incomes.reduce((sum, i) => sum + i.amount, 0)

  return (
    <div style={{ direction: 'rtl' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <PageHeader
        title="ניהול נתונים"
        subtitle="צפייה מלאה, ניהול, סינון ומחיקה של כל הנתונים שלך"
        icon={Database}
      />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  STORAGE OVERVIEW CARDS                                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
          value={formatNumber(incomes.length)}
        />
        <InfoCard
          index={2}
          icon={<Upload size={22} style={{ color: '#0ea5e9' }} />}
          iconBg="rgba(14, 165, 233, 0.12)"
          label="העלאות"
          value={formatNumber(uploads.length)}
        />
        {sessionId && (
          <InfoCard
            index={3}
            icon={<Receipt size={22} style={{ color: '#f59e0b' }} />}
            iconBg="rgba(245, 158, 11, 0.12)"
            label="עסקאות בסשן"
            value={formatNumber(sessionInfo?.total_rows ?? 0)}
          />
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  UPLOADED FILES MANAGER                                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {sessionId && sessionFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
          style={{ marginTop: 'var(--space-xl)' }}
        >
          <CollapsibleSection
            icon={<FileSpreadsheet size={18} />}
            iconColor="#0ea5e9"
            title="קבצים שהועלו"
            badge={`${sessionFiles.length} קבצים`}
            expanded={filesExpanded}
            onToggle={() => setFilesExpanded(!filesExpanded)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {sessionFiles.map((file) => (
                <Card key={file.name} variant="glass" padding="sm">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <FileSpreadsheet size={16} style={{ color: '#0ea5e9', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Hash size={11} />
                          {formatNumber(file.transaction_count)} עסקאות
                        </span>
                        {file.total_expenses > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--danger)' }}>
                            <TrendingDown size={11} />
                            {formatCurrency(file.total_expenses)}
                          </span>
                        )}
                        {file.total_income > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}>
                            <TrendingUp size={11} />
                            {formatCurrency(file.total_income)}
                          </span>
                        )}
                        {file.date_from && file.date_to && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={11} />
                            {file.date_from} — {file.date_to}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteFile(file.name)}
                      disabled={deletingFile === file.name}
                      title={`מחק ${file.name}`}
                      style={{ flexShrink: 0 }}
                    >
                      {deletingFile === file.name ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </CollapsibleSection>
        </motion.div>
      )}


      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  SESSION DATA EXPLORER                                         */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {sessionInfo && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
          style={{ marginTop: 'var(--space-xl)' }}
        >
          <CollapsibleSection
            icon={<Layers size={18} />}
            iconColor="#818cf8"
            title="נתוני הסשן הנוכחי"
            badge={`${formatNumber(sessionInfo.total_rows)} שורות`}
            expanded={sessionInfoExpanded}
            onToggle={() => setSessionInfoExpanded(!sessionInfoExpanded)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={summaryBoxStyle}>
                  <TrendingDown size={16} style={{ color: '#f87171' }} />
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>סה"כ הוצאות</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--danger)', direction: 'ltr', textAlign: 'right' }}>
                      {formatCurrency(sessionInfo.total_expenses)}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{formatNumber(sessionInfo.expense_count)} עסקאות</div>
                  </div>
                </div>
                <div style={summaryBoxStyle}>
                  <TrendingUp size={16} style={{ color: '#34d399' }} />
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>סה"כ הכנסות</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--success)', direction: 'ltr', textAlign: 'right' }}>
                      {formatCurrency(sessionInfo.total_income)}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{formatNumber(sessionInfo.income_count)} עסקאות</div>
                  </div>
                </div>
                <div style={summaryBoxStyle}>
                  <Calendar size={16} style={{ color: '#818cf8' }} />
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>טווח תאריכים</div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {sessionInfo.date_from ? formatDate(sessionInfo.date_from) : '—'} — {sessionInfo.date_to ? formatDate(sessionInfo.date_to) : '—'}
                    </div>
                    {sessionInfo.has_billing_date && (
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        חיוב: {sessionInfo.billing_date_from ? formatDate(sessionInfo.billing_date_from) : '—'} — {sessionInfo.billing_date_to ? formatDate(sessionInfo.billing_date_to) : '—'}
                      </div>
                    )}
                  </div>
                </div>
                <div style={summaryBoxStyle}>
                  <Clock size={16} style={{ color: '#f59e0b' }} />
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>חודשים בנתונים</div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {sessionInfo.months.length > 0 ? sessionInfo.months.join(' · ') : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Columns detected */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Columns size={14} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>עמודות שזוהו ({sessionInfo.columns.length})</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {sessionInfo.columns.map((col) => (
                    <span key={col} style={{
                      padding: '4px 10px',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-card)',
                      fontSize: '0.6875rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                    }}>
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {/* Categories breakdown */}
              {sessionInfo.categories.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Tag size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>קטגוריות ({sessionInfo.categories.length})</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <th style={thStyle}>קטגוריה</th>
                          <th style={thStyle}>עסקאות</th>
                          <th style={thStyle}>הוצאות</th>
                          <th style={thStyle}>הכנסות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionInfo.categories.map((cat, idx) => (
                          <tr
                            key={cat.name}
                            style={{
                              borderBottom: idx < sessionInfo.categories.length - 1 ? '1px solid var(--border-color)' : 'none',
                            }}
                          >
                            <td style={tdStyle}>
                              <span style={{ marginLeft: '6px' }}>{get_icon(cat.name)}</span>
                              {cat.name}
                            </td>
                            <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                              {formatNumber(cat.count)}
                            </td>
                            <td style={{ ...tdStyle, color: 'var(--danger)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', direction: 'ltr', textAlign: 'center' }}>
                              {cat.expense_total > 0 ? formatCurrency(cat.expense_total) : '—'}
                            </td>
                            <td style={{ ...tdStyle, color: 'var(--success)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', direction: 'ltr', textAlign: 'center' }}>
                              {cat.income_total > 0 ? formatCurrency(cat.income_total) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  INCOME MANAGEMENT                                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.35 }}
        style={{ marginTop: 'var(--space-xl)' }}
      >
        <CollapsibleSection
          icon={<Wallet size={18} />}
          iconColor="#34d399"
          title="ניהול הכנסות"
          badge={`${formatNumber(incomes.length)} רשומות · סה"כ ${formatCurrency(manualIncome)}`}
          expanded={incomesExpanded}
          onToggle={() => setIncomesExpanded(!incomesExpanded)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', alignItems: 'start' }}>
            {/* Add income form */}
            <div>
              <div className="glass-card" style={{ padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  הוסף הכנסה
                </h4>
                <form onSubmit={handleAddIncome} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Input
                    label="תיאור"
                    placeholder="למשל: משכורת ינואר"
                    value={incDescription}
                    onChange={(e) => setIncDescription(e.target.value)}
                  />
                  <Input
                    label="סכום"
                    type="number"
                    placeholder="0.00"
                    value={incAmount}
                    onChange={(e) => setIncAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    style={{ direction: 'ltr', textAlign: 'left' }}
                  />
                  <Select
                    label="סוג הכנסה"
                    options={INCOME_TYPE_OPTIONS}
                    value={incType}
                    onChange={setIncType}
                  />
                  <Select
                    label="תדירות"
                    options={FREQUENCY_OPTIONS}
                    value={incRecurring}
                    onChange={setIncRecurring}
                  />
                  <Button type="submit" fullWidth loading={submitting} icon={<Plus size={16} />}>
                    הוסף הכנסה
                  </Button>
                </form>
              </div>
            </div>

            {/* Income list */}
            <div>
              {incomes.length > 0 ? (
                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      הכנסות ({incomes.length})
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
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
                              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {income.description}
                              </p>
                              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {INCOME_TYPE_LABELS[income.income_type] || income.income_type} &middot; {RECURRING_LABELS[income.recurring] || income.recurring} &middot; {formatDate(income.created_at)}
                              </p>
                            </div>
                            <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--accent-secondary, #10b981)', direction: 'ltr', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                              {formatCurrency(income.amount)}
                            </span>
                            <button
                              onClick={() => handleDeleteIncome(income.id)}
                              disabled={deletingIncomeId === income.id}
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
                                cursor: deletingIncomeId === income.id ? 'not-allowed' : 'pointer',
                                opacity: deletingIncomeId === income.id ? 0.5 : 1,
                                transition: 'all 0.15s ease',
                                flexShrink: 0,
                              }}
                              className="income-delete-btn"
                            >
                              {deletingIncomeId === income.id ? (
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
                </div>
              ) : (
                <div className="glass-card" style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <Wallet size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    אין הכנסות שמורות. הוסף הכנסה משמאל.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  UPLOAD HISTORY                                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {uploads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.35 }}
          style={{ marginTop: 'var(--space-xl)' }}
        >
          <CollapsibleSection
            icon={<FileSpreadsheet size={18} />}
            iconColor="#0ea5e9"
            title="היסטוריית העלאות"
            badge={`${formatNumber(uploads.length)} העלאות`}
            expanded={uploadsExpanded}
            onToggle={() => setUploadsExpanded(!uploadsExpanded)}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
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
                      transition={{ delay: 0.05 + idx * 0.04 }}
                      style={{
                        borderBottom: idx < uploads.length - 1 ? '1px solid var(--border-color)' : 'none',
                      }}
                      className="upload-row"
                    >
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileSpreadsheet size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                            {upload.file_name}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                        {formatNumber(upload.row_count)}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--accent-danger, #ef4444)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', direction: 'ltr', textAlign: 'center' }}>
                        {formatCurrency(upload.total_expenses)}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--accent-secondary, #10b981)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', direction: 'ltr', textAlign: 'center' }}>
                        {formatCurrency(upload.total_income)}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          {formatDate(upload.uploaded_at)}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  DANGER ZONE                                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.35 }}
        style={{ marginTop: 'var(--space-xl)' }}
      >
        <CollapsibleSection
          icon={<AlertTriangle size={18} />}
          iconColor="#f87171"
          title="אזור מסוכן"
          expanded={dangerZoneExpanded}
          onToggle={() => setDangerZoneExpanded(!dangerZoneExpanded)}
          dangerStyle
        >
          <div
            style={{
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <AlertTriangle size={20} style={{ color: '#f87171' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--accent-danger, #ef4444)' }}>
                פעולות בלתי הפיכות
              </h3>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              פעולות אלו ימחקו נתונים לצמיתות ולא ניתן יהיה לשחזר אותם.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Button
                variant="danger"
                icon={<Trash2 size={16} />}
                onClick={() => setShowDeleteIncomesModal(true)}
                disabled={(storageInfo?.incomeCount ?? 0) === 0}
              >
                מחק את כל ההכנסות
              </Button>
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
        </CollapsibleSection>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  MODALS & OVERLAYS                                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* Delete incomes modal */}
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
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              פעולה זו תמחק את כל ההכנסות שלך (
              <strong>{formatNumber(storageInfo?.incomeCount ?? 0)}</strong> רשומות).
              לא ניתן לשחזר נתונים אלו לאחר המחיקה.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>
            <Button variant="danger" onClick={handleDeleteAllIncomes} loading={deletingIncomes} icon={<Trash2 size={16} />}>
              מחק הכל
            </Button>
            <Button variant="secondary" onClick={() => setShowDeleteIncomesModal(false)}>
              ביטול
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete transactions modal */}
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
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              פעולה זו תמחק את כל העסקאות השמורות שלך (
              <strong>{formatNumber(storageInfo?.transactionSets ?? 0)}</strong> סטים).
              לא ניתן לשחזר נתונים אלו לאחר המחיקה.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>
            <Button variant="danger" onClick={handleDeleteAllTransactions} loading={deletingTransactions} icon={<Trash2 size={16} />}>
              מחק הכל
            </Button>
            <Button variant="secondary" onClick={() => setShowDeleteTransactionsModal(false)}>
              ביטול
            </Button>
          </div>
        </div>
      </Modal>

      <style>{`
        .upload-row:hover td {
          background: var(--bg-elevated, #334155);
        }
        .income-delete-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.12) !important;
          color: var(--accent-danger, #ef4444) !important;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
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

const summaryBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  padding: '12px 14px',
  background: 'var(--glass-bg)',
  borderRadius: '8px',
  border: '1px solid var(--glass-border)',
}
