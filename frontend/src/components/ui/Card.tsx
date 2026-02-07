import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingMap: Record<NonNullable<CardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
}

export default function Card({
  children,
  className = '',
  hover = false,
  onClick,
  padding = 'md',
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
      className={`${paddingMap[padding]} ${isInteractive ? 'card-interactive' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        transition: 'all 0.2s ease',
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
      `}</style>
    </div>
  )
}
