import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastData {
  id: string
  message: string
  type: ToastType
  duration: number
}

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose: () => void
}

// ─── Icon & color map ────────────────────────────────────────────────
const toastConfig: Record<
  ToastType,
  { icon: typeof CheckCircle; color: string; bg: string }
> = {
  success: {
    icon: CheckCircle,
    color: 'var(--accent-secondary, #10b981)',
    bg: 'rgba(16, 185, 129, 0.12)',
  },
  error: {
    icon: AlertCircle,
    color: 'var(--accent-danger, #ef4444)',
    bg: 'rgba(239, 68, 68, 0.12)',
  },
  info: {
    icon: Info,
    color: 'var(--accent-info, #0ea5e9)',
    bg: 'rgba(14, 165, 233, 0.12)',
  },
  warning: {
    icon: AlertTriangle,
    color: 'var(--accent-warning, #f59e0b)',
    bg: 'rgba(245, 158, 11, 0.12)',
  },
}

// ─── Single toast item ───────────────────────────────────────────────
export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(onClose, duration)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [duration, onClose])

  const config = toastConfig[type]
  const Icon = config.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        border: `1px solid ${config.color}33`,
        borderRadius: '12px',
        boxShadow: 'var(--shadow-lg)',
        minWidth: '280px',
        maxWidth: '420px',
        direction: 'rtl',
        backdropFilter: 'blur(12px)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background: config.bg,
          flexShrink: 0,
        }}
      >
        <Icon size={16} style={{ color: config.color }} />
      </span>

      <span
        style={{
          flex: 1,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.5,
        }}
      >
        {message}
      </span>

      <button
        onClick={onClose}
        aria-label="סגור הודעה"
        className="ui-toast-close"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: '6px',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
      >
        <X size={14} />
      </button>

      <style>{`
        .ui-toast-close:hover {
          background: var(--bg-elevated, #334155) !important;
          color: var(--text-primary) !important;
        }
      `}</style>
    </motion.div>
  )
}

// ─── Toast container ─────────────────────────────────────────────────
export function ToastContainer({ toasts, removeToast }: {
  toasts: ToastData[]
  removeToast: (id: string) => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <Toast
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── useToast hook ───────────────────────────────────────────────────
let toastCounter = 0

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3000) => {
      const id = `toast-${++toastCounter}-${Date.now()}`
      setToasts((prev) => [...prev, { id, message, type, duration }])
    },
    [],
  )

  return { toasts, showToast, removeToast }
}
