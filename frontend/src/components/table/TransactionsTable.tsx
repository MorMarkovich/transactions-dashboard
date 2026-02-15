import { useMemo, useState, useRef, useEffect, useCallback, memo } from 'react'
import { ChevronRight, ChevronLeft, Inbox, ArrowUpDown } from 'lucide-react'
import type { Transaction } from '../../services/types'
import { formatDate, formatCurrency } from '../../utils/formatting'
import { get_icon } from '../../utils/constants'
import Button from '../ui/Button'
import './TransactionsTable.css'

interface TransactionsTableProps {
  transactions: Transaction[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onRowClick?: (transaction: Transaction) => void
}

// ─── Constants ─────────────────────────────────────────────────────────
const ROW_HEIGHT = 48
const OVERSCAN = 5

// ─── Memoized table row ───────────────────────────────────────────────
const TableRow = memo(function TableRow({
  tx,
  onClick,
  style,
}: {
  tx: Transaction
  onClick?: (tx: Transaction) => void
  style?: React.CSSProperties
}) {
  const amount = tx.סכום
  const isPositive = amount > 0

  return (
    <tr
      onClick={() => onClick?.(tx)}
      style={{ cursor: onClick ? 'pointer' : undefined, ...style }}
    >
      <td className="col-date">{formatDate(tx.תאריך)}</td>
      <td>{tx.תיאור}</td>
      <td className="col-category">
        <span style={{ marginLeft: '6px' }}>
          {get_icon(tx.קטגוריה)}
        </span>
        {tx.קטגוריה}
      </td>
      <td
        className="col-amount"
        style={{
          color: isPositive ? 'var(--success)' : 'var(--danger)',
        }}
      >
        {formatCurrency(amount)}
      </td>
    </tr>
  )
})

// ─── Sortable column header ───────────────────────────────────────────
type SortField = 'תאריך' | 'סכום' | 'קטגוריה' | 'תיאור'
type SortDir = 'asc' | 'desc'

// ─── Sort header component ────────────────────────────────────────────
function SortHeader({
  field,
  label,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField
  label: string
  sortField: SortField | null
  sortDir: SortDir
  onSort: (field: SortField) => void
}) {
  return (
    <th
      scope="col"
      onClick={() => onSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {label}
        <ArrowUpDown
          size={12}
          style={{
            opacity: sortField === field ? 1 : 0.3,
            transform: sortField === field && sortDir === 'desc' ? 'scaleY(-1)' : undefined,
            transition: 'opacity 0.15s, transform 0.15s',
          }}
        />
      </span>
    </th>
  )
}

export default function TransactionsTable({
  transactions,
  total,
  page,
  pageSize,
  onPageChange,
  onRowClick,
}: TransactionsTableProps) {
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  )

  const canGoPrev = page > 1
  const canGoNext = page < totalPages

  // Local sort state
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Virtual scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(500)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Client-side sort
  const sortedTransactions = useMemo(() => {
    if (!sortField) return transactions
    const sorted = [...transactions].sort((a, b) => {
      const valA = a[sortField]
      const valB = b[sortField]
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA
      }
      const strA = String(valA ?? '')
      const strB = String(valB ?? '')
      return sortDir === 'asc' ? strA.localeCompare(strB, 'he') : strB.localeCompare(strA, 'he')
    })
    return sorted
  }, [transactions, sortField, sortDir])

  // Virtual scroll calculations
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(
    sortedTransactions.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN,
  )
  const visibleTransactions = sortedTransactions.slice(startIndex, endIndex)
  const useVirtualScroll = sortedTransactions.length > 100

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return field
      }
      setSortDir('asc')
      return field
    })
  }, [])

  if (transactions.length === 0 && total === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 'var(--space-2xl) var(--space-lg)',
        }}
      >
        <Inbox
          size={48}
          style={{
            color: 'var(--text-muted)',
            marginBottom: 'var(--space-md)',
          }}
        />
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '1.1rem',
            fontWeight: 500,
          }}
        >
          לא נמצאו עסקאות
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          נסו לשנות את הסינון או לטעון קובץ חדש
        </p>
      </div>
    )
  }

  return (
    <div>
      <div
        ref={scrollContainerRef}
        className="table-scroll"
        onScroll={useVirtualScroll ? handleScroll : undefined}
        style={useVirtualScroll ? { maxHeight: '600px', overflow: 'auto' } : undefined}
      >
        <table
          className="transactions-table"
          role="table"
          aria-label="טבלת עסקאות"
        >
          <thead>
            <tr>
              <SortHeader field="תאריך" label="תאריך" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortHeader field="תיאור" label="תיאור" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortHeader field="קטגוריה" label="קטגוריה" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortHeader field="סכום" label="סכום" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>

          <tbody>
            {useVirtualScroll ? (
              <>
                {startIndex > 0 && (
                  <tr style={{ height: startIndex * ROW_HEIGHT }} aria-hidden="true">
                    <td colSpan={4} style={{ padding: 0, border: 'none' }} />
                  </tr>
                )}
                {visibleTransactions.map((tx, i) => (
                  <TableRow
                    key={`${tx.תאריך}-${tx.תיאור}-${startIndex + i}`}
                    tx={tx}
                    onClick={onRowClick}
                    style={{ height: ROW_HEIGHT }}
                  />
                ))}
                {endIndex < sortedTransactions.length && (
                  <tr
                    style={{ height: (sortedTransactions.length - endIndex) * ROW_HEIGHT }}
                    aria-hidden="true"
                  >
                    <td colSpan={4} style={{ padding: 0, border: 'none' }} />
                  </tr>
                )}
              </>
            ) : (
              sortedTransactions.map((tx, index) => (
                <TableRow
                  key={`${tx.תאריך}-${tx.תיאור}-${index}`}
                  tx={tx}
                  onClick={onRowClick}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-md) var(--space-sm)',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
        }}
      >
        <span
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          סה&quot;כ {total.toLocaleString('he-IL')} עסקאות
        </span>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
          }}
        >
          <Button
            variant="secondary"
            size="sm"
            icon={<ChevronRight size={16} />}
            disabled={!canGoPrev}
            onClick={() => onPageChange(page - 1)}
            aria-label="עמוד קודם"
          >
            הקודם
          </Button>

          <span
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              minWidth: '100px',
              textAlign: 'center',
            }}
          >
            עמוד {page} מתוך {totalPages}
          </span>

          <Button
            variant="secondary"
            size="sm"
            icon={<ChevronLeft size={16} />}
            disabled={!canGoNext}
            onClick={() => onPageChange(page + 1)}
            aria-label="עמוד הבא"
          >
            הבא
          </Button>
        </div>
      </div>
    </div>
  )
}
