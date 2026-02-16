import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Receipt, Hash, DollarSign, Calculator } from 'lucide-react'
import TransactionsTable from '../components/table/TransactionsTable'
import TransactionDrawer from '../components/table/TransactionDrawer'
import AdvancedFilters from '../components/table/AdvancedFilters'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import { transactionsApi } from '../services/api'
import { formatCurrency } from '../utils/formatting'
import type { Transaction, TransactionFilters } from '../services/types'

// ---------------------------------------------------------------------------
// Date chip configuration
// ---------------------------------------------------------------------------
interface DateChip {
  label: string
  key: string
  getRange: () => { startDate?: string; endDate?: string }
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

const DATE_CHIPS: DateChip[] = [
  {
    label: 'הכל',
    key: 'all',
    getRange: () => ({}),
  },
  {
    label: 'היום',
    key: 'today',
    getRange: () => {
      const today = toISODate(new Date())
      return { startDate: today, endDate: today }
    },
  },
  {
    label: 'השבוע',
    key: 'week',
    getRange: () => {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const start = new Date(now)
      start.setDate(now.getDate() - dayOfWeek)
      return { startDate: toISODate(start), endDate: toISODate(now) }
    },
  },
  {
    label: 'החודש',
    key: 'month',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startDate: toISODate(start), endDate: toISODate(now) }
    },
  },
  {
    label: '3 חודשים',
    key: '3months',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      return { startDate: toISODate(start), endDate: toISODate(now) }
    },
  },
]

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
  const [filters, setFilters] = useState<{
    search?: string
    category?: string
    startDate?: string
    endDate?: string
    minAmount?: number
    maxAmount?: number
  }>({})

  // Date chip state
  const [activeDateChip, setActiveDateChip] = useState('all')

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
        start_date: filters.startDate,
        end_date: filters.endDate,
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

  // ---- Computed stats -------------------------------------------------------
  const stats = useMemo(() => {
    const totalAmount = transactions.reduce((sum, tx) => sum + Math.abs(tx['סכום'] ?? 0), 0)
    const count = total
    const avg = count > 0 ? totalAmount / Math.min(count, transactions.length) : 0
    return { count, totalAmount, avg }
  }, [transactions, total])

  // ---- Handlers -----------------------------------------------------------

  const handleFilterChange = useCallback(
    (newFilters: { search?: string; category?: string; startDate?: string; endDate?: string; minAmount?: number; maxAmount?: number }) => {
      setFilters(newFilters)
      setPage(1) // reset to first page on filter change
      // If user manually changes date in advanced filters, reset the chip
      setActiveDateChip('all')
    },
    [],
  )

  const handleDateChipClick = useCallback(
    (chip: DateChip) => {
      setActiveDateChip(chip.key)
      const range = chip.getRange()
      setFilters((prev) => ({
        ...prev,
        startDate: range.startDate,
        endDate: range.endDate,
      }))
      setPage(1)
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
      <PageHeader
        title="עסקאות"
        subtitle="צפייה וניהול העסקאות שלך"
        icon={Receipt}
      />

      {/* ── Compact Stats Row ─────────────────────────────────────────── */}
      <div className="card-grid-responsive" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="stat-card-compact glass-card">
          <div className="stat-icon" style={{ background: 'var(--gradient-stat-blue, linear-gradient(135deg, #4facfe, #00f2fe))' }}>
            <Hash size={18} color="#fff" />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.count.toLocaleString('he-IL')}</div>
            <div className="stat-label">סה"כ עסקאות</div>
          </div>
        </div>
        <div className="stat-card-compact glass-card">
          <div className="stat-icon" style={{ background: 'var(--gradient-stat-green, linear-gradient(135deg, #43e97b, #38f9d7))' }}>
            <DollarSign size={18} color="#fff" />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats.totalAmount)}</div>
            <div className="stat-label">סכום כולל</div>
          </div>
        </div>
        <div className="stat-card-compact glass-card">
          <div className="stat-icon" style={{ background: 'var(--gradient-stat-purple, linear-gradient(135deg, #667eea, #764ba2))' }}>
            <Calculator size={18} color="#fff" />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats.avg)}</div>
            <div className="stat-label">ממוצע לעסקה</div>
          </div>
        </div>
      </div>

      <AdvancedFilters
        onFilterChange={handleFilterChange}
        onExport={handleExport}
        categories={categories}
        loading={loading}
      />

      {/* ── Quick Date Filter Chips ───────────────────────────────────── */}
      <div className="filter-chips" style={{ marginTop: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
        {DATE_CHIPS.map((chip) => (
          <button
            key={chip.key}
            className={`filter-chip${activeDateChip === chip.key ? ' active' : ''}`}
            onClick={() => handleDateChipClick(chip)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="section-header-v2">
        <span>רשימת עסקאות</span>
      </div>

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
