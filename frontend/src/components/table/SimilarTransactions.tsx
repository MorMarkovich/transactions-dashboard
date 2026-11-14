import { useEffect, useId, useState } from 'react'
import { History } from 'lucide-react'
import { transactionsApi } from '../../services/api'
import type { SimilarTransaction, Transaction } from '../../services/types'
import { formatCurrency, formatDate } from '../../utils/formatting'
import Button from '../ui/Button'
import './TransactionHistory.css'

export default function SimilarTransactions({ sessionId, transactionId, owner, onEdit }: {
  sessionId: string; transactionId: number; owner: string | null; onEdit: (tx: Transaction) => void;
}) {
  const contentId = useId()
  const [expanded, setExpanded] = useState(false)
  const [retry, setRetry] = useState(0)
  const [history, setHistory] = useState<SimilarTransaction[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!expanded || history !== null) return
    const controller = new AbortController()
    transactionsApi.getSimilarTransactions(sessionId, transactionId, owner, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setHistory(data) })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [expanded, history, owner, retry, sessionId, transactionId])

  return (
    <section className="similar-transactions">
      <Button
        type="button"
        variant="secondary"
        icon={<History size={17} />}
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => { setFailed(false); setExpanded(!expanded) }}
        fullWidth
      >
        {expanded ? 'הסתרת עסקאות דומות' : 'הצגת עסקאות דומות'}
      </Button>
      <div id={contentId} hidden={!expanded}>
        {expanded && (
          failed ? (
            <>
              <p role="alert">טעינת העסקאות הדומות נכשלה.</p>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setFailed(false); setRetry((value) => value + 1) }}>
                נסו שוב
              </Button>
            </>
          ) : history === null ? (
            <p role="status">טוען עסקאות דומות…</p>
          ) : history.length === 0 ? (
            <p role="status">אין עסקאות קודמות מבית העסק הזה.</p>
          ) : (
            <ol aria-label="עסקאות קודמות לפי תאריך חיוב">
              {history.map(({ transaction, ...row }, index) => (
                <li key={transaction?.id ?? index}>
                  <time dateTime={row.date}><bdi>{formatDate(row.date)}</bdi></time>
                  <bdi className="similar-transaction-amount">{formatCurrency(row.amount)}</bdi>
                  <span className="similar-transaction-description">{row.description}</span>
                  {transaction?.id != null && <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(transaction)}>
                    שנה קטגוריה
                  </Button>}
                </li>
              ))}
            </ol>
          )
        )}
      </div>
    </section>
  )
}
