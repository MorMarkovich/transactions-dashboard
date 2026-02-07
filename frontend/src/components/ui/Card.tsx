import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  padding?: 'none' | 'sm' | 'md' | 'lg'
  variant?: 'default' | 'glass' | 'elevated'
  glowOnHover?: boolean
}

const paddingMap: Record<NonNullable<CardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
}

const variantStyles: Record<NonNullable<CardProps['variant']>, React.CSSProperties> = {
  default: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
  },
  glass: {
    background: 'var(--glass-bg, rgba(255,255,255,0.05))',
    backdropFilter: 'blur(var(--glass-blur, 12px))',
    WebkitBackdropFilter: 'blur(var(--glass-blur, 12px))',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.08))',
  },
  elevated: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--elevation-2, var(--shadow-lg))',
  },
}

export default function Card({
  children,
  className = '',
  hover = false,
  onClick,
  padding = 'md',
  variant = 'default',
  glowOnHover = false,
}: CardProps) {
  const isInteractive = hover || !!onClick

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={`${paddingMap[padding]} ${isInteractive ? 'card-interactive' : ''} ${glowOnHover ? 'card-glow-hover' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        ...variantStyles[variant],
        borderRadius: 'var(--radius-lg, 12px)',
        transition: 'all 0.25s ease',
      }}
    >
      {children}

      <style>{`
        .card-interactive:hover {
          transform: translateY(-2px);
          border-color: var(--border-accent) !important;
          box-shadow: var(--shadow-lg), var(--shadow-glow-sm);
        }

        .card-interactive:active {
          transform: translateY(0);
        }

        .card-glow-hover:hover {
          box-shadow: var(--card-glow, 0 0 20px rgba(129,140,248,0.15)) !important;
        }
      `}</style>
    </div>
  )
}
