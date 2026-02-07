import { useState, useRef } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Lightbulb,
  Store,
  Wallet,
  Database,
  Upload,
  Loader2,
  X,
  FolderOpen,
} from 'lucide-react'
import Badge from '../ui/Badge'
import { transactionsApi } from '../../services/api'
import './Sidebar.css'

// ─── Types ────────────────────────────────────────────────────────────
interface SidebarProps {
  isOpen: boolean
  onClose?: () => void
  onFileUploaded?: (sessionId: string) => void
}

// ─── Navigation Items ─────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard },
  { to: '/transactions', label: 'עסקאות', icon: Receipt },
  { to: '/trends', label: 'מגמות', icon: TrendingUp },
  { to: '/insights', label: 'תובנות', icon: Lightbulb },
  { to: '/merchants', label: 'בתי עסק', icon: Store },
  { to: '/income', label: 'הכנסות', icon: Wallet },
  { to: '/data-management', label: 'ניהול מידע', icon: Database },
] as const

// ─── Supported Formats ────────────────────────────────────────────────
const SUPPORTED_FORMATS = [
  { label: 'MAX', variant: 'info' as const },
  { label: 'לאומי', variant: 'success' as const },
  { label: 'דיסקונט', variant: 'purple' as const },
  { label: 'ויזה כאל', variant: 'warning' as const },
  { label: 'CSV', variant: 'default' as const },
]

export default function Sidebar({ isOpen, onClose, onFileUploaded }: SidebarProps) {
  const [searchParams] = useSearchParams()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preserve session_id across navigation
  const sessionId = searchParams.get('session_id')

  /**
   * Build target URL preserving the current session_id query param.
   */
  function buildNavHref(basePath: string): string {
    if (sessionId) {
      return `${basePath}?session_id=${sessionId}`
    }
    return basePath
  }

  /**
   * Handle file selection and upload.
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const response = await transactionsApi.uploadFile(file)
      if (response.success && response.session_id) {
        onFileUploaded?.(response.session_id)
      } else {
        setError('שגיאה בהעלאת הקובץ')
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'שגיאה בהעלאת הקובץ')
    } finally {
      setUploading(false)
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
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
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={buildNavHref(to)}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar-nav-link ${isActive ? 'active' : ''}`
            }
            onClick={() => {
              // Close sidebar on mobile after navigation
              if (window.innerWidth < 1024) {
                onClose?.()
              }
            }}
          >
            <span className="nav-icon">
              <Icon size={18} />
            </span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ─── Divider ─── */}
      <div className="sidebar-divider" />

      {/* ─── File Upload Section ─── */}
      <div className="sidebar-upload-section">
        <div className="sidebar-upload-title">
          <FolderOpen size={16} />
          <span>העלאת קובץ</span>
        </div>

        <div className="file-upload-area">
          <input
            ref={fileInputRef}
            type="file"
            id="sidebar-file-upload"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          <label
            htmlFor="sidebar-file-upload"
            className={`file-upload-label ${uploading ? 'uploading' : ''}`}
          >
            {uploading ? (
              <>
                <Loader2
                  size={24}
                  style={{
                    color: 'var(--accent)',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <span>מעלה קובץ...</span>
              </>
            ) : (
              <>
                <Upload size={24} style={{ color: 'var(--accent)' }} />
                <span>גרור קובץ או לחץ לבחירה</span>
                <span className="file-upload-hint">.xlsx, .xls, .csv</span>
              </>
            )}
          </label>
        </div>

        {error && (
          <div className="sidebar-error">{error}</div>
        )}
      </div>

      {/* ─── Supported Formats ─── */}
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
