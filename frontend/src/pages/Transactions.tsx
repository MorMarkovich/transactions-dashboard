import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { List } from 'lucide-react'
import TransactionsTable from '../components/table/TransactionsTable'
import TransactionDrawer from '../components/table/TransactionDrawer'
import AdvancedFilters from '../components/table/AdvancedFilters'
import EmptyState from '../components/common/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import { transactionsApi } from '../services/api'
import type { Transaction, TransactionFilters } from '../services/types'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Transactions() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<string[]>([])

  // Filter / pagination state
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [filters, setFilters] = useState<{ search?: string; category?: string }>({})

  // Drawer state
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // UI state
  const [loading, setLoading] = useState(false)

  // ---- Effect 1: fetch categories once on sessionId change ----------------
  useEffect(() => {
    if (!sessionId) return

    const controller = new AbortController()

    transactionsApi
      .getCategories(sessionId, controller.signal)
      .then(setCategories)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('Error loading categories:', err)
      })

    return () => controller.abort()
  }, [sessionId])

  // ---- Effect 2: fetch transactions on sessionId, filters, page change ----
  useEffect(() => {
    if (!sessionId) return

    const controller = new AbortController()

    const fetchTransactions = async () => {
      setLoading(true)

      const apiFilters: TransactionFilters = {
        page,
        page_size: pageSize,
        search: filters.search,
        category: filters.category,
      }

      try {
        const response = await transactionsApi.getTransactions(
          sessionId,
          apiFilters,
          controller.signal,
        )
        setTransactions(response.transactions)
        setTotal(response.total)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('Error loading transactions:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()

    return () => controller.abort()
  }, [sessionId, filters, page, pageSize])

  // ---- Handlers -----------------------------------------------------------

  const handleFilterChange = useCallback(
    (newFilters: { search?: string; category?: string; startDate?: string; endDate?: string; minAmount?: number; maxAmount?: number }) => {
      setFilters(newFilters)
      setPage(1) // reset to first page on filter change
    },
    [],
  )

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handleExport = useCallback(async () => {
    if (!sessionId) return

    try {
      const blob = await transactionsApi.exportTransactions(sessionId, {
        category: filters.category,
      })

      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'transactions.xlsx'
      anchor.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting:', err)
    }
  }, [sessionId, filters.category])

  // ---- No session: empty state --------------------------------------------
  if (!sessionId) {
    return (
      <EmptyState
        icon={'\u{1F4CB}'}
        title={'\u05E8\u05E9\u05D9\u05DE\u05EA \u05E2\u05E1\u05E7\u05D0\u05D5\u05EA'}
        text={'\u05D4\u05E2\u05DC\u05D4 \u05E7\u05D5\u05D1\u05E5 \u05DB\u05D3\u05D9 \u05DC\u05E6\u05E4\u05D5\u05EA \u05D1\u05E2\u05E1\u05E7\u05D0\u05D5\u05EA'}
      />
    )
  }

  // ---- Render -------------------------------------------------------------
  return (
    <div>
      <div className="section-title">
        <List size={20} />
        <span>{'\u05E8\u05E9\u05D9\u05DE\u05EA \u05E2\u05E1\u05E7\u05D0\u05D5\u05EA'}</span>
      </div>

      <AdvancedFilters
        onFilterChange={handleFilterChange}
        onExport={handleExport}
        categories={categories}
        loading={loading}
      />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'var(--space-md)' }}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} variant="rectangular" height={48} />
          ))}
        </div>
      ) : (
        <TransactionsTable
          transactions={transactions}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onRowClick={(tx) => { setSelectedTransaction(tx); setDrawerOpen(true) }}
        />
      )}

      <TransactionDrawer
        transaction={selectedTransaction}
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedTransaction(null) }}
      />
    </div>
  )
}
