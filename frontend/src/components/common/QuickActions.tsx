import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Upload, Download, Wallet } from 'lucide-react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'

interface QuickActionsProps {
  onUploadClick?: () => void
  onExportClick?: () => void
}

const actions = [
  { id: 'income', icon: <Wallet size={18} />, label: 'הוסף הכנסה', color: '#34d399' },
  { id: 'export', icon: <Download size={18} />, label: 'ייצוא נתונים', color: '#38bdf8' },
  { id: 'upload', icon: <Upload size={18} />, label: 'העלאת קובץ', color: '#818cf8' },
]

export default function QuickActions({ onUploadClick, onExportClick }: QuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  // Close the FAB menu on route change
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  const handleAction = useCallback(
    (id: string) => {
      setIsOpen(false)
      switch (id) {
        case 'upload':
          onUploadClick?.()
          break
        case 'export':
          onExportClick?.()
          break
        case 'income':
          navigate(`/income${sessionId ? `?session_id=${sessionId}` : ''}`)
          break
      }
    },
    [navigate, sessionId, onUploadClick, onExportClick],
  )

  return (
    <>
      {/* Backdrop overlay when FAB menu is open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              zIndex: 9989,
            }}
          />
        )}
      </AnimatePresence>

      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          zIndex: 9990,
          display: 'flex',
          flexDirection: 'column-reverse',
          alignItems: 'center',
          gap: '12px',
        }}
      >
      {/* Main FAB button */}
      <motion.button
        onClick={toggle}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.2 }}
        aria-label={isOpen ? 'סגור פעולות' : 'פעולות מהירות'}
        title={isOpen ? 'סגור פעולות' : 'פעולות מהירות'}
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(129, 140, 248, 0.4)',
          transition: 'box-shadow 200ms ease',
        }}
      >
        {isOpen ? <X size={22} /> : <Plus size={22} />}
      </motion.button>

      {/* Action buttons */}
      <AnimatePresence>
        {isOpen &&
          actions.map((action, idx) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              transition={{ delay: idx * 0.05, duration: 0.2 }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {/* Label */}
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: idx * 0.05 + 0.1, duration: 0.15 }}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  background: 'var(--glass-bg-hover)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderRadius: '6px',
                  border: '1px solid var(--glass-border)',
                  whiteSpace: 'nowrap',
                  boxShadow: 'var(--elevation-2)',
                }}
              >
                {action.label}
              </motion.span>

              {/* Icon button */}
              <motion.button
                onClick={() => handleAction(action.id)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label={action.label}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--glass-bg-hover)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: action.color,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--elevation-2)',
                  transition: 'all 150ms ease',
                }}
              >
                {action.icon}
              </motion.button>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
    </>
  )
}
