import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import TransactionsTable from '../components/table/TransactionsTable'
import TableFilters from '../components/table/TableFilters'
import { transactionsApi } from '../services/api'
import type { Transaction, TransactionFilters } from '../services/types'

export default function Transactions() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('session_id')
  
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<TransactionFilters>({
    page: 1,
    page_size: 100,
  })

  useEffect(() => {
    if (!sessionId) return

    const loadTransactions = async () => {
      setLoading(true)
      try {
        const [response, cats] = await Promise.all([
          transactionsApi.getTransactions(sessionId, filters),
          transactionsApi.getCategories(sessionId)
        ])
        setTransactions(response.transactions)
        setTotal(response.total)
        setCategories(cats)
      } catch (error: any) {
        console.error('Error loading transactions:', error)
        if (error.response?.status === 404) {
          navigate('/', { replace: true })
        }
      } finally {
        setLoading(false)
      }
    }

    loadTransactions()
  }, [sessionId, filters])

  const handleFilterChange = (newFilters: Partial<TransactionFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }))
  }

  const handleExport = async () => {
    if (!sessionId) return
    
    try {
      const blob = await transactionsApi.exportTransactions(sessionId, {
        start_date: filters.start_date,
        end_date: filters.end_date,
        category: filters.category,
      })
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'transactions.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting:', error)
    }
  }

  if (!sessionId) {
    return <div className="empty-message">נא להעלות קובץ תחילה</div>
  }

  return (
    <div>
      <div className="section-title">
        <span>📋</span> רשימת עסקאות
      </div>

      <TableFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onExport={handleExport}
        total={total}
        categories={categories}
      />

      <TransactionsTable transactions={transactions} loading={loading} />

      {total > 0 && (
        <div style={{ marginTop: 'var(--space-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>
          מציג {transactions.length} מתוך {total} עסקאות
        </div>
      )}
    </div>
  )
}
