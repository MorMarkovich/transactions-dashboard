import { type ReactNode, useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './Header'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'
import QuickActions from './QuickActions'
import './Layout.css'

// ─── Constants ────────────────────────────────────────────────────────
const MOBILE_BREAKPOINT = 1024

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Sidebar defaults: open on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= MOBILE_BREAKPOINT
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

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    // Only close on mobile
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setSidebarOpen(false)
    }
  }, [])

  // File upload handler: navigate to dashboard with the new session_id
  const handleFileUploaded = useCallback(
    (sessionId: string) => {
      navigate(`/?session_id=${sessionId}`)
      // Close sidebar on mobile after upload
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        setSidebarOpen(false)
      }
    },
    [navigate],
  )

  return (
    <div className="layout">
      <Header
        onToggleSidebar={toggleSidebar}
        sidebarOpen={sidebarOpen}
        onCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <div className="layout-content">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={closeSidebar}
          onFileUploaded={handleFileUploaded}
        />

        {/* Mobile overlay backdrop */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
          onClick={closeSidebar}
          aria-hidden="true"
        />

        {/* Main content area */}
        <main className="main-content">
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
