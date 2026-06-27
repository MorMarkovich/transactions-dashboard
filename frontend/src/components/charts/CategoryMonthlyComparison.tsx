import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { CategoryMonthlyComparisonData } from '../../services/types'
import { get_icon } from '../../utils/constants'

interface CategoryMonthlyComparisonProps {
  data: CategoryMonthlyComparisonData
  dateType: 'transaction' | 'billing'
  hasBillingDate?: boolean
  onCategoryClick?: (category: string) => void
}

const shekel = (v: number): string => `₪${Math.round(v).toLocaleString('he-IL')}`

// Heat tint for a cell, scaled by its share of the month's total expenses.
function heatBg(pct: number): string {
  const a = Math.min(Math.max(pct, 0) / 100, 1) * 0.32
  return `rgba(129, 140, 248, ${a.toFixed(3)})`
}

export default function CategoryMonthlyComparison({
  data,
  dateType,
  hasBillingDate = false,
  onCategoryClick,
}: CategoryMonthlyComparisonProps) {
  const [display, setDisplay] = useState<'amount' | 'pct'>('amount')
  // Which months to show (default all). Always keep at least one selected.
  const [selectedMonths, setSelectedMonths] = useState<Set<string> | null>(null)

  const months = useMemo(() => {
    if (!selectedMonths) return data.months
    const filtered = data.months.filter((m) => selectedMonths.has(m))
    return filtered.length ? filtered : data.months
  }, [data.months, selectedMonths])

  const toggleMonth = (m: string) => {
    setSelectedMonths((prev) => {
      const base = prev ?? new Set(data.months)
      const next = new Set(base)
      if (next.has(m)) {
        if (next.size > 1) next.delete(m)
      } else {
        next.add(m)
      }
      return next
    })
  }

  if (!data.months.length || !data.categories.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        אין נתונים להשוואה
      </div>
    )
  }

  const cellText = (amount: number, pct: number): { primary: string; secondary: string } => {
    if (display === 'pct') {
      return { primary: `${pct.toFixed(1)}%`, secondary: amount > 0 ? shekel(amount) : '' }
    }
    return { primary: amount > 0 ? shekel(amount) : '—', secondary: amount > 0 ? `${pct.toFixed(1)}%` : '' }
  }

  return (
    <div>
      {/* ── Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {(['amount', 'pct'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setDisplay(mode)}
              style={{
                padding: '5px 14px',
                fontSize: '0.8125rem',
                border: 'none',
                cursor: 'pointer',
                background: display === mode ? 'var(--accent)' : 'transparent',
                color: display === mode ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
              }}
            >
              {mode === 'amount' ? '₪ סכום' : '% מסך החודש'}
            </button>
          ))}
        </div>
        {hasBillingDate && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            לפי {dateType === 'billing' ? 'תאריך חיוב' : 'תאריך עסקה'}
          </span>
        )}
        {/* Month subset chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginInlineStart: 'auto' }}>
          {data.months.map((m) => {
            const on = months.includes(m)
            return (
              <button
                key={m}
                onClick={() => toggleMonth(m)}
                style={{
                  padding: '3px 9px',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent-muted, rgba(129,140,248,0.15))' : 'transparent',
                  color: on ? 'var(--accent)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {m}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: 460 }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              <th
                style={{
                  position: 'sticky',
                  insetInlineStart: 0,
                  zIndex: 2,
                  background: 'var(--bg-elevated)',
                  textAlign: 'start',
                  padding: '10px 12px',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  minWidth: 150,
                }}
              >
                קטגוריה
              </th>
              {months.map((m) => (
                <th key={m} style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 700, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  {m}
                </th>
              ))}
              <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                סה&quot;כ
              </th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((cat) => (
              <tr
                key={cat.name}
                onClick={onCategoryClick ? () => onCategoryClick(cat.name) : undefined}
                style={{
                  borderTop: '1px solid var(--border)',
                  cursor: onCategoryClick ? 'pointer' : 'default',
                }}
              >
                <td
                  style={{
                    position: 'sticky',
                    insetInlineStart: 0,
                    zIndex: 1,
                    background: 'var(--bg-card, var(--bg-elevated))',
                    padding: '8px 12px',
                    textAlign: 'start',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ marginInlineEnd: 6 }}>{get_icon(cat.name)}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cat.name}</span>
                </td>
                {months.map((m) => {
                  const cell = cat.months[m] ?? { amount: 0, pct_of_month: 0, delta_abs: 0, delta_pct: 0 }
                  const { primary, secondary } = cellText(cell.amount, cell.pct_of_month)
                  const up = cell.delta_abs > 0.5
                  const down = cell.delta_abs < -0.5
                  return (
                    <td
                      key={m}
                      style={{
                        padding: '8px 12px',
                        textAlign: 'center',
                        background: cell.amount > 0 ? heatBg(cell.pct_of_month) : 'transparent',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                        {up && <TrendingUp size={11} style={{ color: 'var(--danger, #f87171)' }} />}
                        {down && <TrendingDown size={11} style={{ color: 'var(--success, #34d399)' }} />}
                        {primary}
                      </div>
                      {secondary && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: 1 }}>{secondary}</div>
                      )}
                    </td>
                  )
                })}
                <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{shekel(cat.total)}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{cat.pct_of_grand.toFixed(1)}%</div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <td
                style={{
                  position: 'sticky',
                  insetInlineStart: 0,
                  zIndex: 1,
                  background: 'var(--bg-elevated)',
                  padding: '10px 12px',
                  textAlign: 'start',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                }}
              >
                סה&quot;כ חודשי
              </td>
              {months.map((m) => (
                <td key={m} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {shekel(data.month_totals[m] ?? 0)}
                </td>
              ))}
              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {shekel(data.grand_total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
