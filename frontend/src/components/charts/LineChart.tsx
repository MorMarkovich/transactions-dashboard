import { ltrIsolate } from '../../utils/formatting'
import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import useMediaQuery from '../../hooks/useMediaQuery'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LineChartProps {
  data: { label: string; value: number }[]
  height?: number
  color?: string
  name?: string
}

interface PayloadEntry {
  name: string
  value: number
  payload: { label: string; value: number }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatShekel = (v: number): string =>
  ltrIsolate(`${v < 0 ? '-' : ''}₪${Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`)

const formatAxisShekel = (v: number): string => {
  const sign = v < 0 ? '-' : ''
  const a = Math.abs(v)
  if (a >= 1000) return ltrIsolate(`${sign}₪${(a / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}K`)
  return ltrIsolate(`${sign}₪${a}`)
}

/** Format a date label to DD/MM/YYYY for Hebrew locale display. */
const formatDateLabel = (label: string): string => {
  // Handle ISO dates like "2025-09-20"
  if (/^\d{4}-\d{2}-\d{2}/.test(label)) {
    const [y, m, d] = label.split('-')
    return `${d}/${m}/${y}`
  }
  return label
}


/** Parse a date label (ISO YYYY-MM-DD or DD/MM/YYYY) to a UTC ms timestamp. */
const parseDateTs = (label: string): number => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(label)
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3])
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(label)
  if (dmy) return Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1])
  return NaN
}

/** Short DD/MM axis tick from a time-scale timestamp. */
const formatTsTick = (ts: number): string => {
  const d = new Date(ts)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Full DD/MM/YYYY tooltip label from a time-scale timestamp. */
const formatTsFull = (ts: number): string => {
  const d = new Date(ts)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

const TICK_DAY_MS = 24 * 60 * 60 * 1000
const NICE_STEPS_MS = [1, 2, 3, 7, 14, 30, 61, 91, 182, 365, 732, 1827].map((d) => d * TICK_DAY_MS)

/**
 * Sparse, collision-free time ticks snapped to ACTUAL data timestamps.
 * tickCount alone lets recharts crowd labels in dense regions; here the step
 * is a nice day-unit chosen so at most maxTicks fit, each chosen tick sits on
 * a real point, and kept ticks are always >= 60% of the step apart.
 * First and last data timestamps are always included.
 */
export const sparseTimeTicks = (tsValues: number[], maxTicks: number): number[] => {
  if (!tsValues.length) return []
  const min = Math.min(...tsValues)
  const max = Math.max(...tsValues)
  const range = max - min
  if (range <= 0) return [min]
  const step = NICE_STEPS_MS.find((st) => range / st <= Math.max(maxTicks - 1, 1)) ?? NICE_STEPS_MS[NICE_STEPS_MS.length - 1]
  const nearest = (t: number) => tsValues.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a))
  const picked: number[] = [min]
  for (let t = min + step; t < max; t += step) {
    const n = nearest(t)
    if (n - picked[picked.length - 1] >= step * 0.6 && max - n >= step * 0.3 && !picked.includes(n)) {
      picked.push(n)
    }
  }
  if (max - picked[picked.length - 1] < step * 0.3 && picked.length > 1) {
    picked[picked.length - 1] = max
  } else if (picked[picked.length - 1] !== max) {
    picked.push(max)
  }
  return picked
}

/* ------------------------------------------------------------------ */
/*  Gradient definition                                                */
/* ------------------------------------------------------------------ */

const GRADIENT_ID = 'areaGradientFill'

function AreaGradient({ color }: { color: string }) {
  return (
    <defs>
      <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.18} />
        <stop offset="95%" stopColor={color} stopOpacity={0.02} />
      </linearGradient>
    </defs>
  )
}

/* ------------------------------------------------------------------ */
/*  Custom tooltip                                                     */
/* ------------------------------------------------------------------ */

interface TooltipContentProps {
  active?: boolean
  payload?: PayloadEntry[]
  label?: string | number
}

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null

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
        {label != null && label !== '' ? (typeof label === 'number' ? formatTsFull(label) : formatDateLabel(String(label))) : ''}
      </p>
      <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 'var(--text-sm)' }}>
        {payload[0].name ? `${payload[0].name}: ` : ''}{formatShekel(payload[0].value)}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Custom active dot (shown on hover)                                 */
/* ------------------------------------------------------------------ */

interface ActiveDotProps {
  cx?: number
  cy?: number
  stroke: string
}

function ActiveDot({ cx, cy, stroke }: ActiveDotProps) {
  // Recharts supplies the real coordinates on hover; without them (initial
  // render, pointer gaps) there is no dot to draw - never paint at (0,0).
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill={stroke} fillOpacity={0.2} stroke="none" />
      <circle cx={cx} cy={cy} r={3.5} fill={stroke} stroke="var(--bg-card)" strokeWidth={2} />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const LineChart: React.FC<LineChartProps> = React.memo(function LineChart({
  data,
  name,
  height = 300,
  color = 'var(--accent)',
}) {
  const isCompact = useMediaQuery('(max-width: 640px)')

  // True temporal axis: irregular dates must sit at their real time positions,
  // not equispaced categorical slots (which put tick labels under the wrong cursor).
  const timedData = data.map((d) => ({ ...d, ts: parseDateTs(d.label) }))
  const hasValidTs = timedData.every((d) => Number.isFinite(d.ts))
  const timeTicks = hasValidTs ? sparseTimeTicks(timedData.map((d) => d.ts), isCompact ? 4 : 7) : undefined

  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        אין נתונים להצגה
      </div>
    )
  }

  return (
    <div dir="ltr"><ResponsiveContainer width="100%" height={isCompact ? Math.min(height, 240) : height}>
      <AreaChart
        accessibilityLayer
        data={hasValidTs ? timedData : data}
        margin={isCompact ? { top: 12, right: 12, left: 12, bottom: 12 } : { top: 12, right: 20, left: 12, bottom: 12 }}
      >
        <AreaGradient color={color} />

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />

        {hasValidTs ? (
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTsTick}
            ticks={timeTicks}
            tick={{
              fill: 'var(--text-secondary)',
              fontSize: isCompact ? 10 : 12,
              fontFamily: 'var(--font-family)',
              direction:'ltr', unicodeBidi:'isolate',
            }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
        ) : (
          <XAxis
            dataKey="label"
            tickFormatter={formatDateLabel}
            tick={{
              fill: 'var(--text-secondary)',
              fontSize: isCompact ? 10 : 12,
              fontFamily: 'var(--font-family)',
              direction:'ltr', unicodeBidi:'isolate',
            }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            interval="preserveStartEnd"
          />
        )}

        <YAxis
          tickFormatter={formatAxisShekel}
          tick={{
            fill: 'var(--text-secondary)',
            fontSize: isCompact ? 10 : 12,
            fontFamily: 'var(--font-family)',
            direction:'ltr', unicodeBidi:'isolate',
          }}
          tickLine={false}
          axisLine={false}
          width={isCompact ? 60 : 68}
          orientation="left"
        />

        <Tooltip
          content={<ChartTooltip />}
          cursor={{ stroke: 'var(--border-hover)', strokeDasharray: '4 4' }}
        />

        <Area
          type="linear"
          dataKey="value"
          name={name}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${GRADIENT_ID})`}
          dot={false}
          activeDot={<ActiveDot stroke={color} />}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer></div>
  )
})

export default LineChart
