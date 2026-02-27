import { useState, useRef } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Lightbulb,
  Store,
  Wallet,
  Target,
  Database,
  Upload,
  Loader2,
  X,
  FolderOpen,
  PiggyBank,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Info,
} from 'lucide-react'
import Badge from '../ui/Badge'
import { useAuth } from '../../lib/AuthContext'
import { transactionsApi } from '../../services/api'
import { supabaseApi } from '../../services/supabaseApi'
import './Sidebar.css'

// ─── Types ────────────────────────────────────────────────────────────
interface SidebarProps {
  isOpen: boolean
  collapsed?: boolean
  onClose?: () => void
  onFileUploaded?: (sessionId: string) => void
  onToggleCollapse?: () => void
}

// ─── Navigation Sections ─────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'ראשי',
    items: [
      { to: '/', label: 'דשבורד', icon: LayoutDashboard },
      { to: '/transactions', label: 'עסקאות', icon: Receipt },
    ],
  },
  {
    label: 'ניתוח',
    items: [
      { to: '/trends', label: 'מגמות', icon: TrendingUp },
      { to: '/insights', label: 'תובנות', icon: Lightbulb },
      { to: '/merchants', label: 'בתי עסק', icon: Store },
    ],
  },
  {
    label: 'תקציב',
    items: [
      { to: '/budget', label: 'תקציב', icon: Target },
      { to: '/income', label: 'הכנסות', icon: Wallet },
      { to: '/savings', label: 'חיסכון', icon: PiggyBank },
    ],
  },
  {
    label: 'ניהול',
    items: [
      { to: '/data-management', label: 'ניהול מידע', icon: Database },
    ],
  },
]

// ─── Supported Formats ────────────────────────────────────────────────
const SUPPORTED_FORMATS = [
  { label: 'MAX', variant: 'info' as const },
  { label: 'לאומי', variant: 'success' as const },
  { label: 'דיסקונט', variant: 'purple' as const },
  { label: 'ויזה כאל', variant: 'warning' as const },
  { label: 'CSV', variant: 'default' as const },
]

export default function Sidebar({
  isOpen,
  collapsed = false,
  onClose,
  onFileUploaded,
  onToggleCollapse,
}: SidebarProps) {
  const [searchParams] = useSearchParams()
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('מעלה קובץ...')
  const [error, setError] = useState<string | null>(null)
  const [showFormats, setShowFormats] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user, signOut } = useAuth()

  const sessionId = searchParams.get('session_id')

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'משתמש'

  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)

  function buildNavHref(basePath: string): string {
    if (sessionId) {
      return `${basePath}?session_id=${sessionId}`
    }
    return basePath
  }

  // Save transactions to Supabase (fire and forget)
  const saveToSupabase = (transactions: unknown[]) => {
    if (!user || !transactions.length) return
    supabaseApi.deleteAllTransactions(user.id)
      .then(() => supabaseApi.saveTransactions(user.id, transactions))
      .catch(e => console.error('Failed to save to Supabase:', e))
  }

  const handleUploadFiles = async (files: File[]) => {
    setUploading(true)
    setError(null)

    try {
      if (files.length === 1) {
        setUploadStatus('מעלה קובץ...')
        const response = await transactionsApi.uploadFile(files[0])
        if (response.success && response.session_id) {
          // Fetch all transactions in background and save to Supabase
          transactionsApi.getTransactions(response.session_id, { page: 1, page_size: 50000 })
            .then(data => saveToSupabase(data.transactions as unknown[]))
            .catch(() => {})
          onFileUploaded?.(response.session_id)
        } else {
          setError('שגיאה בהעלאת הקובץ')
        }
      } else {
        // Multiple files: upload each, merge, create combined session
        const allTransactions: unknown[] = []

        for (let i = 0; i < files.length; i++) {
          setUploadStatus(`מעלה קובץ ${i + 1} מ-${files.length}...`)
          const response = await transactionsApi.uploadFile(files[i])
          if (response.success && response.session_id) {
            const data = await transactionsApi.getTransactions(
              response.session_id,
              { page: 1, page_size: 50000 }
            )
            allTransactions.push(...(data.transactions as unknown[]))
          }
        }

        if (allTransactions.length > 0) {
          setUploadStatus('ממזג נתונים...')
          const merged = await transactionsApi.restoreSession(allTransactions)
          if (merged.success && merged.session_id) {
            saveToSupabase(allTransactions)
            onFileUploaded?.(merged.session_id)
          } else {
            setError('שגיאה במיזוג הקבצים')
          }
        } else {
          setError('לא נמצאו עסקאות בקבצים')
        }
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: unknown } } }
      const detail = axiosErr?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'שגיאה בהעלאת הקובץ')
    } finally {
      setUploading(false)
      setUploadStatus('מעלה קובץ...')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(
      f => /\.(xlsx|xls|csv)$/i.test(f.name)
    )
    if (files.length > 0) handleUploadFiles(files)
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      {/* ─── Close button (mobile only) ─── */}
      <button
        className="sidebar-close-btn"
        onClick={onClose}
        aria-label="סגור תפריט"
      >
        <X size={16} />
      </button>

      {/* ─── Navigation ─── */}
      <nav className="sidebar-nav">
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
                  if (window.innerWidth < 1024) {
                    onClose?.()
                  }
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
          <div className="sidebar-upload-section">
            <div className="sidebar-upload-title">
              <FolderOpen size={16} />
              <span>העלאת קובץ</span>
              <button
                className="sidebar-info-btn"
                onClick={() => setShowFormats(!showFormats)}
                aria-label="פורמטים נתמכים"
                title="פורמטים נתמכים"
              >
                <Info size={14} />
              </button>
            </div>

            <div className="file-upload-area">
              <input
                ref={fileInputRef}
                type="file"
                id="sidebar-file-upload"
                accept=".xlsx,.xls,.csv"
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
                    <span className="file-upload-hint" style={{ color: 'var(--text-secondary)' }}>.xlsx, .xls, .csv</span>
                  </>
                )}
              </label>
            </div>

            {error && <div className="sidebar-error">{error}</div>}

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
          </div>
        </>
      )}

      {/* ─── User Profile Area ─── */}
      <div className={`sidebar-profile ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-profile-avatar">
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="sidebar-profile-info">
              <span className="sidebar-profile-name">{displayName}</span>
              <span className="sidebar-profile-email">
                {user?.email || ''}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="sidebar-signout-btn"
              aria-label="התנתק"
              title="התנתק"
            >
              <LogOut size={16} />
            </button>
          </>
        )}
      </div>

      {/* ─── Spinner keyframes ─── */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </aside>
  )
}
