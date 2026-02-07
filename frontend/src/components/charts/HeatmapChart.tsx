import React, { useState, useCallback, useMemo } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HeatmapChartProps {
  categories: string[]
  months: string[]
  data: number[][] // data[categoryIdx][monthIdx]
}

interface HoveredCell {
  category: string
  month: string
  value: number
  x: number
  y: number
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatShekel = (v: number): string =>
  `₪${Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

/**
 * Compute opacity for a cell based on its value relative to the max.
 * Returns a value between 0.08 (near-transparent) and 1.0 (fully saturated).
 */
function cellOpacity(value: number, max: number): number {
  if (max === 0) return 0.08
  const ratio = value / max
  return 0.08 + ratio * 0.92
}

/* ------------------------------------------------------------------ */
/*  Styles (CSS-in-JS with theme vars)                                 */
/* ------------------------------------------------------------------ */

const styles = {
  wrapper: {
    direction: 'rtl' as const,
    fontFamily: 'var(--font-family)',
    position: 'relative' as const,
    overflowX: 'auto' as const,
  },
  grid: (cols: number) => ({
    display: 'grid',
    gridTemplateColumns: `minmax(100px, auto) repeat(${cols}, 1fr)`,
    gap: 2,
  }),
  headerCell: {
    padding: '6px 8px',
    fontSize: 11,
    fontWeight: 600 as const,
    color: 'var(--text-secondary)',
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
  },
  categoryLabel: {
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 500 as const,
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  },
  cell: (opacity: number) => ({
    backgroundColor: `var(--accent)`,
    opacity,
    borderRadius: 'var(--radius-sm)',
    minHeight: 32,
    cursor: 'pointer',
    transition: 'opacity var(--transition-fast), transform var(--transition-fast)',
  }),
  tooltip: {
    position: 'fixed' as const,
    zIndex: 'var(--z-tooltip)' as unknown as number,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 14px',
    boxShadow: 'var(--shadow-lg)',
    direction: 'rtl' as const,
    fontFamily: 'var(--font-family)',
    pointerEvents: 'none' as const,
  },
  emptyCorner: {
    // top-right corner (RTL) - empty spacer
  },
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const HeatmapChart: React.FC<HeatmapChartProps> = React.memo(function HeatmapChart({
  categories,
  months,
  data,
}) {
  const [hovered, setHovered] = useState<HoveredCell | null>(null)

  // Pre-compute global max for color scaling
  const maxValue = useMemo(() => {
    let m = 0
    for (const row of data) {
      for (const v of row) {
        if (v > m) m = v
      }
    }
    return m
  }, [data])

  const handleMouseEnter = useCallback(
    (category: string, month: string, value: number, e: React.MouseEvent) => {
      setHovered({ category, month, value, x: e.clientX, y: e.clientY })
    },
    [],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (hovered) {
        setHovered((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))
      }
    },
    [hovered],
  )

  const handleMouseLeave = useCallback(() => setHovered(null), [])

  if (!categories.length || !months.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        אין נתונים להצגה
      </div>
    )
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.grid(months.length)}>
        {/* Header row: empty corner + month labels */}
        <div style={styles.emptyCorner} />
        {months.map((month) => (
          <div key={month} style={styles.headerCell}>
            {month}
          </div>
        ))}

        {/* Data rows */}
        {categories.map((category, catIdx) => (
          <React.Fragment key={category}>
            {/* Category label (right side in RTL) */}
            <div style={styles.categoryLabel} title={category}>
              {category}
            </div>

            {/* Value cells */}
            {months.map((month, monthIdx) => {
              const value = data[catIdx]?.[monthIdx] ?? 0
              return (
                <div
                  key={`${catIdx}-${monthIdx}`}
                  style={styles.cell(cellOpacity(value, maxValue))}
                  onMouseEnter={(e) => handleMouseEnter(category, month, value, e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />
              )
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Floating tooltip */}
      {hovered && (
        <div
          style={{
            ...styles.tooltip,
            left: hovered.x + 12,
            top: hovered.y - 60,
          }}
        >
          <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)' }}>
            {hovered.category}
          </p>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 'var(--text-sm)' }}>
            {hovered.month} &middot; {formatShekel(hovered.value)}
          </p>
        </div>
      )}
    </div>
  )
})

export default HeatmapChart
