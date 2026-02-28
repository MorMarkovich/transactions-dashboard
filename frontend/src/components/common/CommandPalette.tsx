import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Lightbulb,
  Store,
  Wallet,
  Target,
  Database,
  PiggyBank,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

interface CommandItem {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void
  keywords: string[]
  group: string
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const { theme, toggleTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const sessionQuery = sessionId ? `?session_id=${sessionId}` : ''

  const commands: CommandItem[] = useMemo(
    () => [
      { id: 'dashboard', label: 'דשבורד', icon: <LayoutDashboard size={18} />, action: () => navigate(`/${sessionQuery}`), keywords: ['dashboard', 'דשבורד', 'ראשי', 'בית'], group: 'ניווט' },
      { id: 'transactions', label: 'עסקאות', icon: <Receipt size={18} />, action: () => navigate(`/transactions${sessionQuery}`), keywords: ['transactions', 'עסקאות', 'רשימה'], group: 'ניווט' },
      { id: 'trends', label: 'מגמות', icon: <TrendingUp size={18} />, action: () => navigate(`/trends${sessionQuery}`), keywords: ['trends', 'מגמות', 'גרפים'], group: 'ניווט' },
      { id: 'insights', label: 'תובנות', icon: <Lightbulb size={18} />, action: () => navigate(`/insights${sessionQuery}`), keywords: ['insights', 'תובנות', 'חכם'], group: 'ניווט' },
      { id: 'merchants', label: 'בתי עסק', icon: <Store size={18} />, action: () => navigate(`/merchants${sessionQuery}`), keywords: ['merchants', 'בתי עסק', 'חנויות'], group: 'ניווט' },
      { id: 'budget', label: 'תקציב', icon: <Target size={18} />, action: () => navigate(`/budget${sessionQuery}`), keywords: ['budget', 'תקציב', 'יעד', 'מגבלה'], group: 'ניווט' },
      { id: 'income', label: 'הכנסות', icon: <Wallet size={18} />, action: () => navigate(`/income${sessionQuery}`), keywords: ['income', 'הכנסות'], group: 'ניווט' },
      { id: 'savings', label: 'יעדי חיסכון', icon: <PiggyBank size={18} />, action: () => navigate(`/savings${sessionQuery}`), keywords: ['savings', 'חיסכון', 'יעדים', 'חסכון'], group: 'ניווט' },
      { id: 'data', label: 'ניהול נתונים', icon: <Database size={18} />, action: () => navigate(`/data-management${sessionQuery}`), keywords: ['data', 'נתונים', 'ניהול', 'management'], group: 'ניווט' },
      { id: 'theme', label: theme === 'dark' ? 'מצב בהיר' : 'מצב כהה', icon: theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />, action: () => { toggleTheme(); onClose() }, keywords: ['theme', 'dark', 'light', 'כהה', 'בהיר', 'מצב'], group: 'פעולות' },
    ],
    [navigate, sessionQuery, theme, toggleTheme, onClose],
  )

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.keywords.some((kw) => kw.toLowerCase().includes(q)),
    )
  }, [commands, query])

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1))
    }
  }, [filteredCommands.length, selectedIndex])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action()
            onClose()
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [filteredCommands, selectedIndex, onClose],
  )

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = list.children[selectedIndex] as HTMLElement
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 100000,
            }}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'fixed',
              top: '20%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: '520px',
              zIndex: 100001,
              direction: 'rtl',
            }}
          >
            <div
              style={{
                background: 'var(--glass-bg-hover)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-xl, 16px)',
                boxShadow: 'var(--elevation-4)',
                overflow: 'hidden',
              }}
            >
              {/* Search input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--glass-border)',
                }}
              >
                <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
                  onKeyDown={handleKeyDown}
                  placeholder="חפש עמוד או פעולה..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                    fontFamily: 'var(--font-family)',
                    direction: 'rtl',
                  }}
                />
                <kbd
                  style={{
                    padding: '2px 6px',
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-elevated)',
                    borderRadius: '4px',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div
                ref={listRef}
                style={{
                  maxHeight: '320px',
                  overflowY: 'auto',
                  padding: '8px',
                }}
              >
                {filteredCommands.length === 0 ? (
                  <div
                    style={{
                      padding: '24px 16px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.875rem',
                    }}
                  >
                    לא נמצאו תוצאות
                  </div>
                ) : (
                  filteredCommands.map((cmd, idx) => (
                    <div
                      key={cmd.id}
                      onClick={() => { cmd.action(); onClose() }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md, 8px)',
                        cursor: 'pointer',
                        background: idx === selectedIndex ? 'var(--bg-elevated)' : 'transparent',
                        transition: 'background 100ms ease',
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
                          background: idx === selectedIndex ? 'rgba(129, 140, 248, 0.15)' : 'var(--glass-bg)',
                          color: idx === selectedIndex ? 'var(--accent-primary, #818cf8)' : 'var(--text-secondary)',
                          flexShrink: 0,
                          transition: 'all 100ms ease',
                        }}
                      >
                        {cmd.icon}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {cmd.label}
                        </p>
                      </div>
                      {idx === selectedIndex && (
                        <kbd
                          style={{
                            padding: '2px 6px',
                            fontSize: '0.625rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                            background: 'var(--glass-bg)',
                            borderRadius: '4px',
                            border: '1px solid var(--glass-border)',
                          }}
                        >
                          Enter &#8629;
                        </kbd>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div
                style={{
                  padding: '8px 16px',
                  borderTop: '1px solid var(--glass-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span>&#8593;&#8595; ניווט</span>
                <span>&#8629; בחירה</span>
                <span>ESC סגירה</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
