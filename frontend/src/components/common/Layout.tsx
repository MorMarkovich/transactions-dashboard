import { type ReactNode, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './Header'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'
import QuickActions from './QuickActions'
import { useAuth } from '../../lib/AuthContext'
import { supabaseApi } from '../../services/supabaseApi'
import { transactionsApi } from '../../services/api'
import './Layout.css'

// ─── Constants ────────────────────────────────────────────────────────
const MOBILE_BREAKPOINT = 1024
const COLLAPSED_KEY = 'sidebar-collapsed'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const hasTriedRestore = useRef(false)
  // Block rendering children until a stale session_id is verified/restored
  const [sessionValidating, setSessionValidating] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return !!params.get('session_id')
  })

  // Sidebar defaults: open on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= MOBILE_BREAKPOINT
  })

  // Collapsed state persisted in localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  })

  // Track window resize to auto-show/hide sidebar
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>

    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const isDesktop = window.innerWidth >= MOBILE_BREAKPOINT
        setSidebarOpen(isDesktop)
      }, 150)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Global Ctrl+K / Cmd+K keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-restore last session from Supabase when user logs in with no active session
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (!user || hasTriedRestore.current) return
    hasTriedRestore.current = true

    const doRestore = () => {
      supabaseApi.getLatestTransactions(user.id)
        .then(transactions => {
          if (!transactions || transactions.length === 0) return
          return transactionsApi.restoreSession(transactions)
        })
        .then(response => {
          if (response?.success && response.session_id) {
            navigate(`/?session_id=${response.session_id}`, { replace: true })
          }
        })
        .catch(() => {}) // Silent fail — user can upload a new file
        .finally(() => setSessionValidating(false))
    }

    if (!sessionId) {
      setSessionValidating(false)
      doRestore()
      return
    }

    // Session ID is in URL — verify it still exists in the backend.
    // After a backend restart all in-memory sessions are wiped, so a stale
    // session_id causes 404s across the whole app.
    setSessionValidating(true)
    transactionsApi.getMetrics(sessionId)
      .then(() => {
        // Session is valid — allow children to render
        setSessionValidating(false)
      })
      .catch(err => {
        if ((err as { response?: { status?: number } }).response?.status === 404) {
          doRestore()
        } else {
          setSessionValidating(false)
        }
      })
  }, [user, searchParams, navigate])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setSidebarOpen(false)
    }
  }, [])

  const toggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  // File upload handler: navigate to dashboard with the new session_id
  const handleFileUploaded = useCallback(
    (sessionId: string) => {
      navigate(`/?session_id=${sessionId}`)
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        setSidebarOpen(false)
      }
    },
    [navigate],
  )

  return (
    <div className={`layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Header
        onToggleSidebar={toggleSidebar}
        sidebarOpen={sidebarOpen}
        onCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <div className="layout-content">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
          onClose={closeSidebar}
          onFileUploaded={handleFileUploaded}
          onToggleCollapse={toggleCollapse}
        />

        {/* Mobile overlay backdrop */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
          onClick={closeSidebar}
          aria-hidden="true"
        />

        {/* Main content area */}
        <main className="main-content">
          {sessionValidating ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', direction: 'rtl' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>...מאמת סשן</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] as const }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <QuickActions />
    </div>
  )
}
