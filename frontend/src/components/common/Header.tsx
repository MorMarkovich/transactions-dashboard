import { Sun, Moon, Menu, X, CreditCard, Search } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import NotificationCenter from './NotificationCenter'

// ─── Types ────────────────────────────────────────────────────────────
interface HeaderProps {
  onToggleSidebar?: () => void
  sidebarOpen?: boolean
  onCommandPalette?: () => void
}

// Detect Mac so we show the correct keyboard shortcut label
const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform)

export default function Header({ onToggleSidebar, sidebarOpen, onCommandPalette }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header
      style={{
        height: 'var(--header-height, 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-lg)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur, 16px))',
        WebkitBackdropFilter: 'blur(var(--glass-blur, 16px))',
        borderBottom: '1px solid var(--glass-border)',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky, 20)' as any,
        direction: 'rtl',
        gap: 'var(--space-md)',
        flexShrink: 0,
      }}
    >
      {/* ─── Right side: hamburger (mobile) + title ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          minWidth: 0,
        }}
      >
        {/* Mobile hamburger button */}
        <button
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'סגור תפריט' : 'פתח תפריט'}
          className="header-hamburger"
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            flexShrink: 0,
          }}
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* App title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', minWidth: 0 }}>
          <span title="מנתח עסקאות — ניתוח חכם של הוצאות כרטיס אשראי" style={{ flexShrink: 0, display: 'inline-flex' }}>
            <CreditCard
              size={24}
              style={{ color: 'var(--accent)' }}
            />
          </span>
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--text-xl)',
                fontWeight: 800,
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
              }}
            >
              מנתח עסקאות
            </h1>
            <p
              className="header-subtitle"
              style={{
                margin: 0,
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                fontWeight: 400,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                display: 'block',
              }}
            >
              ניתוח חכם של הוצאות כרטיס אשראי
            </p>
          </div>
        </div>
      </div>

      {/* ─── Center: search bar ─── */}
      <div
        onClick={() => onCommandPalette?.()}
        className="header-search-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          cursor: 'pointer',
          transition: 'all 150ms ease',
          maxWidth: '320px',
          flex: 1,
          minWidth: '120px',
        }}
      >
        <Search size={15} style={{ flexShrink: 0, opacity: 0.6 }} />
        <span style={{ flex: 1 }}>חיפוש...</span>
        <kbd
          style={{
            fontSize: '0.65rem',
            padding: '2px 6px',
            borderRadius: '4px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono, monospace)',
            flexShrink: 0,
          }}
        >
          {isMac ? '⌘K' : 'Ctrl+K'}
        </kbd>
      </div>

      {/* ─── Left side: notifications + theme toggle ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          flexShrink: 0,
        }}
      >
        {/* Notifications */}
        <NotificationCenter />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
          className="header-icon-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* ─── Responsive styles ─── */}
      <style>{`
        @media (max-width: 1023px) {
          .header-hamburger {
            display: flex !important;
          }
          .header-subtitle {
            display: none !important;
          }
          .header-search-bar {
            display: none !important;
          }
        }

        .header-icon-btn:hover {
          background: var(--bg-card-hover) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-hover) !important;
        }

        .header-hamburger:hover {
          background: var(--bg-card-hover) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-hover) !important;
        }

        .header-search-bar:hover {
          border-color: var(--border-accent) !important;
          background: var(--bg-card-hover) !important;
        }
      `}</style>
    </header>
  )
}
