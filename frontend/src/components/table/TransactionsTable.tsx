import type { Transaction } from '../../services/types'
import './TransactionsTable.css'

interface TransactionsTableProps {
  transactions: Transaction[]
  loading?: boolean
}

export default function TransactionsTable({ transactions, loading }: TransactionsTableProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatAmount = (amount: number) => {
    return `₪${Math.abs(amount).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (loading) {
    return <div className="loading">טוען...</div>
  }

  if (transactions.length === 0) {
    return <div className="empty-message">לא נמצאו עסקאות</div>
  }

  return (
    <div className="table-scroll">
      <table className="transactions-table">
        <thead>
          <tr>
            <th>תאריך</th>
            <th>בית עסק</th>
            <th>קטגוריה</th>
            <th>סכום</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => (
            <tr key={index}>
              <td className="col-date">{formatDate(transaction.תאריך)}</td>
              <td>{transaction.תיאור}</td>
              <td className="col-category">{transaction.קטגוריה}</td>
              <td className="col-amount">{formatAmount(transaction.סכום)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
