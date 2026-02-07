import { useMemo } from 'react'
import { ChevronRight, ChevronLeft, Inbox } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
}

export default function TransactionsTable({
  transactions,
  total,
  page,
  pageSize,
  onPageChange,
}: TransactionsTableProps) {
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  )

  const canGoPrev = page > 1
  const canGoNext = page < totalPages

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
      <div className="table-scroll">
        <table
          className="transactions-table"
          role="table"
          aria-label="טבלת עסקאות"
        >
          <thead>
            <tr>
              <th scope="col">תאריך</th>
              <th scope="col">תיאור</th>
              <th scope="col">קטגוריה</th>
              <th scope="col">סכום</th>
            </tr>
          </thead>

          <AnimatePresence mode="popLayout">
            <tbody>
              {transactions.map((tx, index) => {
                const amount = tx.סכום
                const isPositive = amount > 0

                return (
                  <motion.tr
                    key={`${tx.תאריך}-${tx.תיאור}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: index * 0.02,
                    }}
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
                        color: isPositive
                          ? 'var(--success)'
                          : 'var(--danger)',
                      }}
                    >
                      {formatCurrency(amount)}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </AnimatePresence>
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
