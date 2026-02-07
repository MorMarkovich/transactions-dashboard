interface ProgressBarProps {
  value: number
  color?: string
  height?: number
  showLabel?: boolean
  animated?: boolean
}

export default function ProgressBar({
  value,
  color = 'var(--gradient-primary)',
  height = 8,
  showLabel = false,
  animated = true,
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value))

  const isGradient = color.includes('gradient')

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {/* Track */}
        <div
          style={{
            flex: 1,
            height: `${height}px`,
            background: 'var(--bg-secondary, #1e293b)',
            borderRadius: '9999px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Fill */}
          <div
            className={animated ? 'progress-bar-fill' : undefined}
            style={{
              width: `${clampedValue}%`,
              height: '100%',
              background: isGradient ? color : color,
              backgroundColor: isGradient ? undefined : color,
              borderRadius: '9999px',
              transition: animated ? 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
              position: 'relative',
            }}
          >
            {/* Shimmer overlay for animated bars */}
            {animated && clampedValue > 0 && (
              <div
                className="progress-bar-shimmer"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '9999px',
                }}
              />
            )}
          </div>
        </div>

        {/* Label */}
        {showLabel && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              minWidth: '36px',
              textAlign: 'left',
              direction: 'ltr',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(clampedValue)}%
          </span>
        )}
      </div>

      <style>{`
        .progress-bar-shimmer {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.15) 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: progress-shimmer 2s ease-in-out infinite;
        }

        @keyframes progress-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
