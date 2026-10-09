import { categoryColor } from '../../utils/chartPalette'
import { ltrIsolate } from '../../utils/formatting'
import React, { useCallback } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import useMediaQuery from '../../hooks/useMediaQuery'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DonutChartProps {
  data: { name: string; value: number }[]
  total: number
}

interface PayloadEntry {
  name: string
  value: number
  payload: { name: string; value: number }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const formatShekel = (v: number): string =>
  ltrIsolate(`${v < 0 ? '-' : ''}₪${Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

/* ------------------------------------------------------------------ */
/*  Custom tooltip                                                     */
/* ------------------------------------------------------------------ */

interface TooltipProps {
  active?: boolean
  payload?: PayloadEntry[]
  total: number
}

function ChartTooltip({ active, payload, total }: TooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        boxShadow: 'var(--shadow-lg)',
        direction: 'rtl',
        fontFamily: 'var(--font-family)',
      }}
    >
      <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)' }}>
        {entry.name}
      </p>
      <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 'var(--text-sm)' }}>
        {formatShekel(entry.value)} &middot; {pct}%
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Custom label on slices                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Center label (total) — HTML overlay centered over the donut hole   */
/* ------------------------------------------------------------------ */

function CenterLabel({ total, compact = false }: { total: number; compact?: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 1,
        textAlign: 'center',
        fontFamily: 'var(--font-family)',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', fontSize: compact ? 11 : 13 }}>{'סה"כ'}</div>
      <div style={{ color: 'var(--text-primary)', fontSize: compact ? 16 : 20, fontWeight: 700, direction: 'ltr' }}>
        {formatShekel(total)}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const DonutChart: React.FC<DonutChartProps> = React.memo(function DonutChart({
  data,
  total,
}) {
  const isCompact = useMediaQuery('(max-width: 640px)')
  const tooltipContent = useCallback(
    (props: { active?: boolean; payload?: PayloadEntry[] }) => (
      <ChartTooltip {...props} total={total} />
    ),
    [total],
  )

  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        אין נתונים להצגה
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height={isCompact ? 240 : 280}>
        <PieChart accessibilityLayer={false}>
          <Pie
            rootTabIndex={-1}
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="85%"
            outerRadius="95%"
            paddingAngle={2}
            isAnimationActive={false}
            label={false}
            labelLine={false}
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={categoryColor(entry.name)} stroke="var(--bg-card)" strokeWidth={1} />
            ))}
          </Pie>

          {/* The HTML center label is a sibling overlay. Keep the tooltip above it,
              and do not animate between sectors while the pointer moves. */}
          <Tooltip
            content={tooltipContent as any}
            wrapperStyle={{ zIndex: 2, pointerEvents: 'none' }}
            isAnimationActive={false}
          />
        </PieChart>
      </ResponsiveContainer>
      <CenterLabel total={total} compact={isCompact} />
    </div>
  )
})

export default DonutChart
