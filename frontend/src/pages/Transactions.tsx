import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Receipt, Hash, DollarSign, Calculator, TrendingDown, TrendingUp, ArrowDownRight, ArrowUpRight, BarChart3 } from 'lucide-react'
import TransactionsTable from '../components/table/TransactionsTable'
import TransactionDrawer from '../components/table/TransactionDrawer'
import AdvancedFilters from '../components/table/AdvancedFilters'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import { transactionsApi } from '../services/api'
import { formatCurrency, formatNumber, formatPercent, formatDate } from '../utils/formatting'
import { get_icon } from '../utils/constants'
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
  const [serverTotalAmount, setServerTotalAmount] = useState(0)
  const [serverAvg, setServerAvg] = useState(0)
  const [expenseCount, setExpenseCount] = useState(0)
  const [incomeCount, setIncomeCount] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [totalIncome, setTotalIncome] = useState(0)
  const [medianTransaction, setMedianTransaction] = useState(0)
  const [maxTransaction, setMaxTransaction] = useState<{ description: string; amount: number } | null>(null)
  const [minTransaction, setMinTransaction] = useState<{ description: string; amount: number } | null>(null)
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ name: string; total: number; count: number; percent: number }[]>([])
  const [dateFrom, setDateFrom] = useState<string | null>(null)
  const [dateTo, setDateTo] = useState<string | null>(null)
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
        setServerTotalAmount(response.total_amount ?? 0)
        setServerAvg(response.avg_transaction ?? 0)
        setExpenseCount(response.expense_count ?? 0)
        setIncomeCount(response.income_count ?? 0)
        setTotalExpenses(response.total_expenses ?? 0)
        setTotalIncome(response.total_income ?? 0)
        setMedianTransaction(response.median_transaction ?? 0)
        setMaxTransaction(response.max_transaction ?? null)
        setMinTransaction(response.min_transaction ?? null)
        setCategoryBreakdown(response.category_breakdown ?? [])
        setDateFrom(response.date_from ?? null)
        setDateTo(response.date_to ?? null)
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
  const stats = useMemo(() => ({
    count: total,
    totalAmount: serverTotalAmount,
    avg: serverAvg,
    expenseCount,
    incomeCount,
    totalExpenses,
    totalIncome,
    medianTransaction,
  }), [total, serverTotalAmount, serverAvg, expenseCount, incomeCount, totalExpenses, totalIncome, medianTransaction])

  // ---- Handlers -----------------------------------------------------------

  const handleFilterChange = useCallback(
    (newFilters: { search?: string; category?: string; startDate?: string; endDate?: string; minAmount?: number; maxAmount?: number }) => {
      setFilters(newFilters)
      setPage(1)
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

  const handleUpdateTransaction = useCallback(
    (updated: Transaction) => {
      setTransactions((prev) =>
        prev.map((tx) => (tx.id !== undefined && tx.id === updated.id ? updated : tx)),
      )
      setSelectedTransaction(updated)
    },
    [],
  )

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
        subtitle="צפייה וניתוח מעמיק של העסקאות שלך"
        icon={Receipt}
      />

      {/* ── Primary Stats Row ─────────────────────────────────────────── */}
      <div className="card-grid-responsive" style={{ marginBottom: 'var(--space-sm)' }}>
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
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f87171, #ef4444)' }}>
            <TrendingDown size={18} color="#fff" />
          </div>
          <div className="stat-content">
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{formatCurrency(stats.totalExpenses)}</div>
            <div className="stat-label">{formatNumber(stats.expenseCount)} הוצאות</div>
          </div>
        </div>
        <div className="stat-card-compact glass-card">
          <div className="stat-icon" style={{ background: 'var(--gradient-stat-green, linear-gradient(135deg, #43e97b, #38f9d7))' }}>
            <TrendingUp size={18} color="#fff" />
          </div>
          <div className="stat-content">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(stats.totalIncome)}</div>
            <div className="stat-label">{formatNumber(stats.incomeCount)} הכנסות</div>
          </div>
        </div>
      </div>

      {/* ── Secondary Stats Row ───────────────────────────────────────── */}
      <div className="card-grid-responsive" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="stat-card-compact glass-card">
          <div className="stat-icon" style={{ background: 'var(--gradient-stat-purple, linear-gradient(135deg, #667eea, #764ba2))' }}>
            <Calculator size={18} color="#fff" />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats.avg)}</div>
            <div className="stat-label">ממוצע לעסקה</div>
          </div>
        </div>
        <div className="stat-card-compact glass-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <DollarSign size={18} color="#fff" />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats.medianTransaction)}</div>
            <div className="stat-label">חציון עסקה</div>
          </div>
        </div>
        <div className="stat-card-compact glass-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}>
            <DollarSign size={18} color="#fff" />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats.totalAmount)}</div>
            <div className="stat-label">סכום כולל (מוחלט)</div>
          </div>
        </div>
      </div>

      {/* ── Extremes + Date Range ─────────────────────────────────────── */}
      {(maxTransaction || minTransaction || dateFrom) && (
        <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 'var(--space-md)', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', fontSize: '0.8125rem' }}>
          {maxTransaction && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowUpRight size={16} style={{ color: 'var(--danger)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>הוצאה גבוהה:</span>
              <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(maxTransaction.amount)}</span>
              <span style={{ color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                ({maxTransaction.description})
              </span>
            </div>
          )}
          {minTransaction && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowDownRight size={16} style={{ color: 'var(--success)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>הוצאה נמוכה:</span>
              <span style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(minTransaction.amount)}</span>
              <span style={{ color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                ({minTransaction.description})
              </span>
            </div>
          )}
          {dateFrom && dateTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
              <span style={{ color: 'var(--text-muted)' }}>טווח:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(dateFrom)} — {formatDate(dateTo)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Category Breakdown ────────────────────────────────────────── */}
      {categoryBreakdown.length > 0 && (
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <div className="section-header-v2" style={{ marginBottom: '8px' }}>
            <BarChart3 size={18} />
            <span>פירוט לפי קטגוריה</span>
          </div>
          <div className="glass-card" style={{ padding: '16px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={catThStyle}>קטגוריה</th>
                  <th style={catThStyle}>עסקאות</th>
                  <th style={catThStyle}>סה"כ</th>
                  <th style={catThStyle}>אחוז</th>
                  <th style={{ ...catThStyle, width: '35%' }}>חלק יחסי</th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map((cat, idx) => (
                  <tr key={cat.name} style={{ borderBottom: idx < categoryBreakdown.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                    <td style={catTdStyle}>
                      <span style={{ marginLeft: '6px' }}>{get_icon(cat.name)}</span>
                      {cat.name}
                    </td>
                    <td style={{ ...catTdStyle, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                      {formatNumber(cat.count)}
                    </td>
                    <td style={{ ...catTdStyle, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--danger)', direction: 'ltr', textAlign: 'center' }}>
                      {formatCurrency(cat.total)}
                    </td>
                    <td style={{ ...catTdStyle, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                      {formatPercent(cat.percent)}
                    </td>
                    <td style={catTdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--border-color)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${cat.percent}%`,
                            height: '100%',
                            borderRadius: '3px',
                            background: `hsl(${220 + idx * 30}, 70%, 60%)`,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
          showBillingDate={transactions.some((tx) => !!tx.תאריך_חיוב)}
        />
      )}

      <TransactionDrawer
        transaction={selectedTransaction}
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedTransaction(null) }}
        sessionId={sessionId}
        onUpdateTransaction={handleUpdateTransaction}
      />
    </div>
  )
}

const catThStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'right',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
}

const catTdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontSize: '0.8125rem',
}
