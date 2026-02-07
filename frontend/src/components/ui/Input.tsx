import { type InputHTMLAttributes, type ReactNode, useId } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  icon?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '0.8125rem' },
  md: { padding: '10px 14px', fontSize: '0.875rem' },
  lg: { padding: '14px 18px', fontSize: '1rem' },
}

const iconPaddingMap: Record<string, string> = {
  sm: '32px',
  md: '40px',
  lg: '48px',
}

export default function Input({
  label,
  error,
  icon,
  size = 'md',
  className = '',
  type,
  id: externalId,
  style,
  ...rest
}: InputProps) {
  const generatedId = useId()
  const inputId = externalId ?? generatedId
  const errorId = error ? `${inputId}-error` : undefined

  const isEmailType = type === 'email' || type === 'url' || type === 'tel'

  return (
    <div className={`ui-input-wrapper ${className}`} style={{ width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          {label}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        {icon && (
          <span
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              right: isEmailType ? 'auto' : '12px',
              left: isEmailType ? '12px' : 'auto',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            {icon}
          </span>
        )}

        <input
          id={inputId}
          type={type}
          aria-label={label ?? rest['aria-label']}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="ui-input"
          style={{
            ...sizeStyles[size],
            width: '100%',
            background: 'var(--bg-elevated, #334155)',
            border: `1px solid ${error ? 'var(--accent-danger)' : 'var(--border-color)'}`,
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontFamily: "'Heebo', sans-serif",
            direction: isEmailType ? 'ltr' : 'rtl',
            textAlign: isEmailType ? 'left' : ('right' as const),
            paddingRight: icon && !isEmailType ? iconPaddingMap[size] : sizeStyles[size].padding?.toString().split(' ')[1],
            paddingLeft: icon && isEmailType ? iconPaddingMap[size] : sizeStyles[size].padding?.toString().split(' ')[1],
            outline: 'none',
            transition: 'all 0.2s ease',
            ...style,
          }}
          {...rest}
        />
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          style={{
            marginTop: '6px',
            fontSize: '0.8125rem',
            color: 'var(--accent-danger)',
            fontWeight: 500,
          }}
        >
          {error}
        </p>
      )}

      <style>{`
        .ui-input::placeholder {
          color: var(--text-muted);
        }

        .ui-input:focus {
          border-color: var(--accent-primary) !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }
      `}</style>
    </div>
  )
}
