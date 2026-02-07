import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

// ─── Types ────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon: string
  title: string
  text: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-2xl) var(--space-lg)',
        minHeight: '300px',
      }}
    >
      {/* Icon with pulse animation */}
      <div
        style={{
          fontSize: '4rem',
          lineHeight: 1,
          marginBottom: 'var(--space-lg)',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      >
        {icon}
      </div>

      {/* Title */}
      <h3
        style={{
          margin: '0 0 var(--space-sm) 0',
          fontSize: 'var(--text-2xl)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-base)',
          color: 'var(--text-secondary)',
          maxWidth: '400px',
          lineHeight: 1.6,
        }}
      >
        {text}
      </p>

      {/* Optional action element */}
      {action && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          {action}
        </div>
      )}
    </motion.div>
  )
}
