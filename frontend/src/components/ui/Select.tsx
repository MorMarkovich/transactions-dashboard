import { useId } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectProps {
  label?: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function Select({
  label,
  options,
  value,
  onChange,
  placeholder,
  className = '',
}: SelectProps) {
  const generatedId = useId()

  return (
    <div className={`ui-select-wrapper ${className}`} style={{ width: '100%' }}>
      {label && (
        <label
          htmlFor={generatedId}
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
        <select
          id={generatedId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="ui-select"
          style={{
            width: '100%',
            padding: '10px 40px 10px 14px',
            background: 'var(--bg-elevated, #334155)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: value ? 'var(--text-primary)' : 'var(--text-muted)',
            fontFamily: "'Heebo', sans-serif",
            fontSize: '0.875rem',
            fontWeight: 500,
            direction: 'rtl',
            textAlign: 'right',
            appearance: 'none',
            outline: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={16}
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        />
      </div>

      <style>{`
        .ui-select:focus {
          border-color: var(--accent-primary) !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        .ui-select:hover:not(:focus) {
          border-color: var(--border-color-hover);
        }

        .ui-select option {
          background: var(--bg-card);
          color: var(--text-primary);
          padding: 8px;
        }
      `}</style>
    </div>
  )
}
