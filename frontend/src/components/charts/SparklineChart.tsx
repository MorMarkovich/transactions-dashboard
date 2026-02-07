import React, { useMemo } from 'react'

interface SparklineChartProps {
  data: number[]
  color?: string
  width?: number
  height?: number
  strokeWidth?: number
  filled?: boolean
  className?: string
}

const SparklineChart: React.FC<SparklineChartProps> = React.memo(function SparklineChart({
  data,
  color = 'var(--accent-primary, #818cf8)',
  width = 80,
  height = 28,
  strokeWidth = 1.5,
  filled = true,
  className = '',
}) {
  const pathData = useMemo(() => {
    if (!data || data.length < 2) return { line: '', area: '' }

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const padding = 2

    const points = data.map((val, i) => ({
      x: padding + (i / (data.length - 1)) * (width - padding * 2),
      y: padding + (1 - (val - min) / range) * (height - padding * 2),
    }))

    // Smooth curve using quadratic bezier
    let line = `M ${points[0].x},${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const cpx = (prev.x + curr.x) / 2
      line += ` Q ${cpx},${prev.y} ${curr.x},${curr.y}`
    }

    // Area path (line + close to bottom)
    const last = points[points.length - 1]
    const first = points[0]
    const area = `${line} L ${last.x},${height} L ${first.x},${height} Z`

    return { line, area }
  }, [data, width, height])

  const gradientId = useMemo(() => `spark-grad-${Math.random().toString(36).slice(2, 8)}`, [])

  if (!data || data.length < 2) return null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled && pathData.area && (
        <path d={pathData.area} fill={`url(#${gradientId})`} />
      )}
      {pathData.line && (
        <path
          d={pathData.line}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
})

export default SparklineChart
