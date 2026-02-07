import { Sun, Moon, LogOut, Menu, X, CreditCard } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../lib/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────
interface HeaderProps {
  onToggleSidebar?: () => void
  sidebarOpen?: boolean
}

export default function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { user, signOut } = useAuth()

  // Derive display name from user metadata or email
  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'משתמש'

  return (
    <header
      style={{
        height: 'var(--header-height, 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-lg)',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
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
            display: 'none', // shown via CSS media query
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
          <CreditCard
            size={24}
            style={{ color: 'var(--accent)', flexShrink: 0 }}
          />
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
                display: 'block', // hidden on mobile via CSS
              }}
            >
              ניתוח חכם של הוצאות כרטיס אשראי
            </p>
          </div>
        </div>
      </div>

      {/* ─── Left side: theme toggle + user menu ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          flexShrink: 0,
        }}
      >
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

        {/* User info + sign out */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            paddingRight: 'var(--space-sm)',
            borderRight: '1px solid var(--border)',
            marginRight: 'var(--space-xs)',
          }}
        >
          <span
            className="header-username"
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayName}
          </span>

          <button
            onClick={() => signOut()}
            aria-label="התנתק"
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
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* ─── Responsive styles ─── */}
      <style>{`
        /* Show hamburger on mobile only */
        @media (max-width: 1023px) {
          .header-hamburger {
            display: flex !important;
          }
          .header-subtitle {
            display: none !important;
          }
          .header-username {
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
      `}</style>
    </header>
  )
}
