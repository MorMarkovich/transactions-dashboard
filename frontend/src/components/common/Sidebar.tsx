import { useState, useRef, useEffect } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  CalendarRange,
  TrendingUp,
  Store,
  Wallet,
  Target,
  Database,
  Upload,
  Loader2,
  X,
  FolderOpen,
  PiggyBank,
  ChevronsLeft,
  ChevronsRight,
  Info,
  Settings,
  Search,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import Badge from '../ui/Badge'
import RefreshFromBanks from './RefreshFromBanks'
import PinkasBrand from './PinkasBrand'
import SignOutButton from './SignOutButton'
import { useAuth } from '../../lib/AuthContext'
import { scoped, SNAPSHOT_SEEN_BASE } from '../../lib/userStorage'
import { transactionsApi } from '../../services/api'
import { supabaseApi } from '../../services/supabaseApi'
import { clearSampleSession } from '../../lib/sampleMode'
import { mergeDroppedRows, summarizeDroppedRows } from '../../lib/droppedRows'
import { UPLOAD_FILES_EVENT, UPLOAD_STATE_EVENT, type UploadState } from './OnboardingWizard'
import './Sidebar.css'

// ─── Types ────────────────────────────────────────────────────────────
interface SidebarProps {
  isOpen: boolean
  collapsed?: boolean
  onClose?: () => void
  onFileUploaded?: (sessionId: string) => void
  onToggleCollapse?: () => void
  onSearch?: () => void
}

// ─── Navigation Sections ─────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'ראשי',
    items: [
      { to: '/', label: 'סקירה', icon: LayoutDashboard },
      { to: '/transactions', label: 'עסקאות', icon: Receipt },
    ],
  },
  {
    label: 'ניתוח',
    items: [
      { to: '/monthly', label: 'השוואת חודשים', icon: CalendarRange },
      { to: '/trends', label: 'מגמות', icon: TrendingUp },
      { to: '/merchants', label: 'בתי עסק', icon: Store },
    ],
  },
  {
    label: 'תכנון',
    items: [
      { to: '/budget', label: 'תקציב', icon: Target },
      { to: '/income', label: 'הכנסות', icon: Wallet },
      { to: '/savings', label: 'חיסכון', icon: PiggyBank },
    ],
  },
  {
    label: 'ניהול',
    items: [
      { to: '/data-management', label: 'חשבונות ונתונים', icon: Database },
    ],
  },
]

// ─── Supported Formats ────────────────────────────────────────────────
const SUPPORTED_FORMATS = [
  { label: 'MAX', variant: 'info' as const },
  { label: 'לאומי', variant: 'success' as const },
  { label: 'דיסקונט', variant: 'purple' as const },
  { label: 'ישראכרט', variant: 'warning' as const },
  { label: 'CSV', variant: 'default' as const },
]

/** User-facing Hebrew message for a failed upload. Server details are shown only when already Hebrew. */
function uploadErrorMessage(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { detail?: unknown } }; code?: string }
  const detail = e?.response?.data?.detail
  if (typeof detail === 'string' && /[\u0590-\u05FF]/.test(detail)) return detail
  const status = e?.response?.status
  if (!e?.response) return 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.'
  if (status === 401) return 'ההתחברות פגה. התחברו מחדש ונסו שוב.'
  if (status === 413) return 'הקובץ גדול מדי. אפשר להעלות קבצים עד 20MB.'
  if (status === 429) return 'יותר מדי ניסיונות בזמן קצר. נסו שוב בעוד דקה.'
  if (status && status >= 500) return 'משהו השתבש בשרת. נסו שוב בעוד רגע.'
  return 'לא הצלחנו להעלות את הקובץ. ודאו שזה קובץ תנועות (xlsx, xls, csv או pdf) ונסו שוב.'
}

export default function Sidebar({
  isOpen,
  collapsed = false,
  onClose,
  onFileUploaded,
  onToggleCollapse,
  onSearch,
}: SidebarProps) {
  const [searchParams] = useSearchParams()
  const {theme, toggleTheme} = useTheme()
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('מעלה קובץ...')
  // Parser-dropped rows from the last upload. Persistent (not a toast) so a
  // user who missed the merge summary still sees that rows were rejected.
  const [droppedRows, setDroppedRows] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showFormats, setShowFormats] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()

  const sessionId = searchParams.get('session_id')

  function buildNavHref(basePath: string): string {
    if (sessionId) {
      return `${basePath}?session_id=${sessionId}`
    }
    return basePath
  }

  // Save transactions to Supabase (fire and forget)
  const saveToSupabase = (transactions: unknown[]) => {
    if (!user || !transactions.length) return
    // Insert-first only: NEVER pre-delete the durable snapshot. If the insert
    // fails, the user's last good backup must survive (R10);
    // saveTransactions prunes older snapshots itself once the new one is durable.
    supabaseApi.saveTransactions(user.id, transactions)
      .then(() => supabaseApi.getLatestSnapshotAt(user.id))
      .then((at) => { if (at) localStorage.setItem(scoped(SNAPSHOT_SEEN_BASE, user.id), at) })
      .catch(e => console.error('Failed to save to Supabase:', e))
  }

  const handleUploadFiles = async (files: File[]) => {
    setUploading(true)
    setError(null)
    setDroppedRows(null)

    try {
      // Upload all files, tag each transaction with its source file name
      const allTransactions: unknown[] = []
      const droppedAcc: Record<string, number> = {}

      for (let i = 0; i < files.length; i++) {
        setUploadStatus(files.length === 1
          ? 'מעלה קובץ...'
          : `מעלה קובץ ${i + 1} מ-${files.length}...`)
        const response = await transactionsApi.uploadFile(files[i])
        if (response.success && response.session_id) {
          mergeDroppedRows(droppedAcc, response.dropped_rows)
          const data = await transactionsApi.getTransactions(
            response.session_id,
            { page: 1, page_size: 50000 }
          )
          // Tag each transaction with its source file name
          const tagged = (data.transactions as unknown as Record<string, unknown>[]).map(tx => ({
            ...tx,
            _source_file: files[i].name,
          }))
          allTransactions.push(...tagged)
        }
      }

      if (allTransactions.length > 0) {
        setUploadStatus('ממזג נתונים...')
        // Load user-defined category rules so freshly merged data picks
        // them up immediately (no need to wait for a page reload).
        const rules = user ? await supabaseApi.getCategoryRules(user.id).catch(() => []) : []
        const overrides = user ? await supabaseApi.getTransactionOverrides(user.id).catch(() => []) : []
        const customCats = user ? await supabaseApi.getUserCategories(user.id).catch(() => []) : []
        const notes = user ? await supabaseApi.getTransactionNotes(user.id).catch(() => []) : []
        const merged = await transactionsApi.restoreSession(
          allTransactions, rules, overrides, customCats.map((c) => c.name), notes)
        if (merged.success && merged.session_id) {
          const removedParts: string[] = []
          if (merged.duplicates_removed && merged.duplicates_removed > 0) {
            removedParts.push(`${merged.duplicates_removed} כפילויות`)
          }
          if (merged.cc_payments_removed && merged.cc_payments_removed > 0) {
            removedParts.push(`${merged.cc_payments_removed} חיובי אשראי כפולים`)
          }
          if (removedParts.length > 0) {
            setUploadStatus(`הוסרו: ${removedParts.join(', ')}`)
          }
          if (Object.keys(droppedAcc).length > 0) setDroppedRows(droppedAcc)
          clearSampleSession()
          saveToSupabase(allTransactions)
          onFileUploaded?.(merged.session_id)
        } else {
          setError('שגיאה במיזוג הקבצים')
        }
      } else {
        setError('לא נמצאו עסקאות בקבצים')
      }
    } catch (err: unknown) {
      setError(uploadErrorMessage(err))
    } finally {
      setUploading(false)
      setUploadStatus('מעלה קובץ...')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // After the local bank-sync tool writes a fresh snapshot to Supabase, reload
  // it through the same restore path used after a manual upload.
  const handleBankSynced = async () => {
    if (!user) return
    const [transactions, rules, overrides, customCats, notes] = await Promise.all([
      supabaseApi.getLatestTransactions(user.id),
      supabaseApi.getCategoryRules(user.id).catch(() => []),
      supabaseApi.getTransactionOverrides(user.id).catch(() => []),
      supabaseApi.getUserCategories(user.id).catch(() => []),
      supabaseApi.getTransactionNotes(user.id).catch(() => []),
    ])
    if (!transactions?.length) throw new Error('Missing saved transactions')
    const merged = await transactionsApi.restoreSession(
      transactions as unknown[], rules, overrides, customCats.map((c) => c.name), notes)
    if (!merged.success || !merged.session_id) throw new Error('Could not restore the saved transactions')
    onFileUploaded?.(merged.session_id)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleUploadFiles(Array.from(files))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear when leaving the label itself, not a child element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  // Uploads started from the onboarding wizard on the dashboard page.
  useEffect(() => {
    const onFiles = (e: Event) => {
      const files = (e as CustomEvent<File[]>).detail
      if (files?.length && !uploading) handleUploadFiles(files)
    }
    window.addEventListener(UPLOAD_FILES_EVENT, onFiles)
    return () => window.removeEventListener(UPLOAD_FILES_EVENT, onFiles)
  })

  // Mirror upload progress so the wizard can show it (the sidebar is hidden on mobile).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent<UploadState>(UPLOAD_STATE_EVENT, { detail: { uploading, status: uploadStatus, error } }))
  }, [uploading, uploadStatus, error])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(
      f => /\.(xlsx|xls|csv|pdf)$/i.test(f.name)
    )
    if (files.length > 0) handleUploadFiles(files)
  }

  return (
    <aside role={isOpen ? "dialog" : undefined} aria-modal={isOpen ? true : undefined} aria-label="תפריט ניהול וניווט" tabIndex={-1} className={`sidebar ${isOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div className="studio-brand"><PinkasBrand to={buildNavHref('/')} onClick={onClose} /></div>
      <div className="studio-sidebar-tools"><button onClick={onSearch} aria-label="חיפוש"><Search size={18}/>{!collapsed && <span>חיפוש <kbd dir="ltr">⌘K</kbd></span>}</button><button onClick={toggleTheme} aria-label={theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button></div>
      {/* ─── Close button (mobile only) ─── */}
      <button
        className="sidebar-close-btn"
        onClick={onClose}
        aria-label="סגור תפריט"
      >
        <X size={16} />
      </button>

      {/* ─── Navigation ─── */}
      <nav className="sidebar-nav" aria-label="ניווט בסביבת העבודה">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="sidebar-section">
            {!collapsed && (
              <div className="nav-section-label">{section.label}</div>
            )}
            {collapsed && <div className="sidebar-section-divider" />}
            {section.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={buildNavHref(to)}
                end={to === '/'}
                className={({ isActive }) =>
                  `sidebar-nav-link ${isActive ? 'active' : ''}`
                }
                onClick={() => {
                  onClose?.()
                }}
                title={collapsed ? label : undefined}
              >
                <span className="nav-icon">
                  <Icon size={18} />
                </span>
                {!collapsed && <span className="nav-label">{label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* ─── Collapse Toggle (desktop only) ─── */}
      <button
        type="button"
        className="sidebar-collapse-btn"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleCollapse?.()
        }}
        aria-label={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
        title={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
      >
        {collapsed ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
      </button>

      {/* ─── File Upload Section ─── */}
      {!collapsed && (
        <>
          <div className="sidebar-divider" />
          <div className="sidebar-data-actions">
            <RefreshFromBanks onSynced={handleBankSynced} sidebarClosed={!isOpen} />
          </div>
          <details className="sidebar-upload-section">
            <summary className="sidebar-upload-title">
              <FolderOpen size={16} />
              <span>העלאת קובץ</span>
            </summary>
            <button
              className="sidebar-info-btn"
              onClick={() => setShowFormats(!showFormats)}
              aria-label="פורמטים נתמכים"
              title="פורמטים נתמכים"
            >
              <Info size={14} />
            </button>

            <div className="file-upload-area">
              <input
                ref={fileInputRef}
                type="file"
                id="sidebar-file-upload"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                multiple
                style={{ display: 'none' }}
              />
              <label
                htmlFor="sidebar-file-upload"
                className={`file-upload-label ${uploading ? 'uploading' : ''} ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {uploading ? (
                  <>
                    <Loader2
                      size={20}
                      style={{
                        color: 'var(--accent)',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                    <span>{uploadStatus}</span>
                  </>
                ) : isDragging ? (
                  <>
                    <Upload size={20} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontWeight: 600 }}>שחרר כאן להעלאה</span>
                  </>
                ) : (
                  <>
                    <Upload size={20} style={{ color: 'var(--accent)' }} />
                    <span>גרור קובץ/ים או לחץ לבחירה</span>
                    <span className="file-upload-hint" style={{ color: 'var(--text-secondary)' }}>.xlsx, .xls, .csv, .pdf</span>
                  </>
                )}
              </label>
            </div>

            {error && <div className="sidebar-error">{error}</div>}

            {droppedRows && (() => {
              const summary = summarizeDroppedRows(droppedRows)
              if (!summary) return null
              return (
                <div
                  className={summary.level === 'warning' ? 'sidebar-dropped-warning' : 'sidebar-dropped-info'}
                  role={summary.level === 'warning' ? 'alert' : 'status'}
                >
                  <span>{summary.text}</span>
                  <button type="button" aria-label="סגור" onClick={() => setDroppedRows(null)}>×</button>
                </div>
              )
            })()}

            {showFormats && (
              <div className="sidebar-formats">
                <div className="sidebar-formats-title">פורמטים נתמכים</div>
                <div className="sidebar-formats-list">
                  {SUPPORTED_FORMATS.map(({ label, variant }) => (
                    <Badge key={label} variant={variant} size="sm">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </details>
          <div className="sidebar-account">
            <NavLink className="sidebar-nav-link" to={buildNavHref('/account')} onClick={onClose}>
              <Settings size={18} aria-hidden="true" /> הגדרות חשבון
            </NavLink>
            <SignOutButton className="sidebar-nav-link sidebar-sign-out" />
          </div>
        </>
      )}

    </aside>
  )
                         }
