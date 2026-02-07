import { type ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple'
  size?: 'sm' | 'md'
}

const variantStyles: Record<string, { background: string; color: string }> = {
  default: {
    background: 'rgba(148, 163, 184, 0.15)',
    color: 'var(--text-secondary)',
  },
  success: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-secondary, #10b981)',
  },
  danger: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--accent-danger, #ef4444)',
  },
  warning: {
    background: 'rgba(245, 158, 11, 0.15)',
    color: 'var(--accent-warning, #f59e0b)',
  },
  info: {
    background: 'rgba(14, 165, 233, 0.15)',
    color: 'var(--accent-info, #0ea5e9)',
  },
  purple: {
    background: 'rgba(139, 92, 246, 0.15)',
    color: 'var(--accent-purple, #8b5cf6)',
  },
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: {
    padding: '2px 8px',
    fontSize: '0.7rem',
  },
  md: {
    padding: '4px 12px',
    fontSize: '0.8125rem',
  },
}

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
}: BadgeProps) {
  const colors = variantStyles[variant]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        borderRadius: '9999px',
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        ...colors,
        ...sizeStyles[size],
      }}
    >
      {children}
    </span>
  )
}
