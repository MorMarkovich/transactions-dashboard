import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  fullWidth?: boolean
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: '6px 14px', fontSize: '0.8125rem', gap: '6px' },
  md: { padding: '10px 20px', fontSize: '0.875rem', gap: '8px' },
  lg: { padding: '14px 28px', fontSize: '1rem', gap: '10px' },
}

const iconSizeMap: Record<string, number> = {
  sm: 14,
  md: 16,
  lg: 18,
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: 'var(--gradient-primary)',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 2px 6px -1px rgba(99, 102, 241, 0.4)',
  },
  secondary: {
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    boxShadow: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
    boxShadow: 'none',
  },
  danger: {
    background: 'var(--gradient-danger)',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 2px 6px -1px rgba(239, 68, 68, 0.35)',
  },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  disabled,
  className = '',
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading
  const iconSize = iconSizeMap[size]

  return (
    <>
      <button
        disabled={isDisabled}
        className={`ui-btn ui-btn-${variant} ${className}`}
        style={{
          ...variantStyles[variant],
          ...sizeStyles[size],
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          borderRadius: '8px',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.55 : 1,
          width: fullWidth ? '100%' : undefined,
          transition: 'all 0.2s ease',
          fontFamily: "'Heebo', sans-serif",
          whiteSpace: 'nowrap',
          lineHeight: 1.4,
          ...style,
        }}
        {...rest}
      >
        {loading ? (
          <Loader2
            size={iconSize}
            style={{
              animation: 'spin 1s linear infinite',
            }}
          />
        ) : icon ? (
          <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
        ) : null}
        {children && <span>{children}</span>}
      </button>
    </>
  )
}
