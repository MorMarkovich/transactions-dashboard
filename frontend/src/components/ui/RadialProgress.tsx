import { useMemo } from 'react'

interface RadialProgressProps {
  value: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  label?: string
  showValue?: boolean
  className?: string
}

export default function RadialProgress({
  value,
  size = 120,
  strokeWidth = 8,
  color = 'var(--accent)',
  trackColor = 'var(--border)',
  label,
  showValue = true,
  className = '',
}: RadialProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  const { radius, circumference, offset } = useMemo(() => {
    const r = (size - strokeWidth) / 2
    const c = 2 * Math.PI * r
    const o = c - (clampedValue / 100) * c
    return { radius: r, circumference: c, offset: o }
  }, [size, strokeWidth, clampedValue])

  const center = size / 2

  return (
    <div className={`radial-progress-wrapper ${className}`} style={{ width: size, height: size, position: 'relative' }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        {/* Progress */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: `drop-shadow(0 0 6px ${color})`,
            ['--circumference' as string]: circumference,
            animation: 'radialFill 1s ease-out',
          }}
        />
      </svg>
      {(showValue || label) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          {showValue && (
            <span
              style={{
                fontSize: size * 0.22,
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
              }}
            >
              {Math.round(clampedValue)}%
            </span>
          )}
          {label && (
            <span
              style={{
                fontSize: Math.max(10, size * 0.1),
                color: 'var(--text-secondary)',
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
