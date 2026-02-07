import { formatCurrency } from '../../utils/formatting'

interface ChartTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
  formatter?: (value: number) => string
  showPercentage?: boolean
  total?: number
}

export default function ChartTooltip({
  active,
  payload,
  label,
  formatter = formatCurrency,
  showPercentage = false,
  total = 0,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const value = entry.value ?? 0
  const name = entry.name ?? label ?? ''
  const pct = showPercentage && total > 0 ? ((value / total) * 100).toFixed(1) : null

  return (
    <div
      style={{
        background: 'var(--glass-bg-hover, var(--bg-elevated))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--glass-border, var(--border-color))',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '10px 14px',
        boxShadow: 'var(--elevation-3, var(--shadow-lg))',
        direction: 'rtl',
        fontFamily: 'var(--font-family)',
        minWidth: '120px',
      }}
    >
      {name && (
        <p
          style={{
            color: 'var(--text-primary)',
            margin: 0,
            fontWeight: 600,
            fontSize: '0.8125rem',
            marginBottom: '4px',
          }}
        >
          {name}
        </p>
      )}
      <p
        style={{
          color: 'var(--text-secondary)',
          margin: 0,
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-mono, monospace)',
          direction: 'ltr',
          textAlign: 'right',
        }}
      >
        {formatter(value)}
        {pct && (
          <span style={{ marginRight: '6px', color: 'var(--text-muted)' }}>
            {pct}%
          </span>
        )}
      </p>
    </div>
  )
}
