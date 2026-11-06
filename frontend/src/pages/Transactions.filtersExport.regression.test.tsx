// Domain-3 audit: transaction filters & exports (synthetic, local).
// These tests assert CORRECT behavior. Failures demonstrate live bugs in main.
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Transactions from './Transactions'
import { FilterProvider } from '../context/FilterContext'
import { transactionsApi } from '../services/api'

vi.mock('../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'qa@example.com' }, session: null }) }))

// The page tree pulls in supabaseApi; keep the client construction out of jsdom.
vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../services/supabaseApi', () => ({
  supabaseApi: new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }),
}))

vi.mock('../services/api', () => ({
  transactionsApi: {
    getCategories: vi.fn().mockResolvedValue(['מזון', 'שונות']),
    getCategoryCatalog: vi.fn().mockResolvedValue({ subcategories: {} }),
    scopeSession: vi.fn().mockImplementation(async (id: string) => id),
    getTransactions: vi.fn().mockResolvedValue({
      transactions: [], total: 0, total_amount: 0, avg_transaction: 0,
      expense_count: 0, income_count: 0, total_expenses: 0, total_income: 0,
      median_transaction: 0, max_transaction: null, min_transaction: null,
      category_breakdown: [], date_from: null, date_to: null,
    }),
    exportTransactions: vi.fn().mockResolvedValue(new Blob(['x'])),
  },
}))

const api = transactionsApi as unknown as {
  getTransactions: ReturnType<typeof vi.fn>
  exportTransactions: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  localStorage.clear()
  if (!window.matchMedia) {
    window.matchMedia = (q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })
  }
  window.URL.createObjectURL = vi.fn(() => 'blob:mock')
  window.URL.revokeObjectURL = vi.fn()
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/transactions?session_id=s1']}>
      <FilterProvider>
        <Transactions />
      </FilterProvider>
    </MemoryRouter>,
  )
}

function lastCallFilters() {
  const calls = api.getTransactions.mock.calls
  return calls[calls.length - 1][1] as Record<string, unknown>
}

describe('combined filters: date chip + search', () => {
  it('keeps the date range when the user types a search after picking a date chip', async () => {
    renderPage()
    await waitFor(() => expect(api.getTransactions).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'החודש' }))
    await waitFor(() => expect(lastCallFilters().start_date).toBeTruthy())
    const chipStart = lastCallFilters().start_date
    const chipEnd = lastCallFilters().end_date

    fireEvent.change(screen.getByPlaceholderText('חיפוש עסקאות...'), { target: { value: 'סופר' } })
    await waitFor(() => expect(lastCallFilters().search).toBe('סופר'), { timeout: 2000 })

    // CORRECT behavior: date range from the chip must survive the search.
    expect(lastCallFilters().start_date).toBe(chipStart)
    expect(lastCallFilters().end_date).toBe(chipEnd)
  })

  it('keeps the date range when applying amount filters from the advanced panel after a chip', async () => {
    renderPage()
    await waitFor(() => expect(api.getTransactions).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'החודש' }))
    await waitFor(() => expect(lastCallFilters().start_date).toBeTruthy())
    const chipStart = lastCallFilters().start_date

    fireEvent.click(screen.getByRole('button', { name: /מתקדם/ }))
    fireEvent.change(screen.getByPlaceholderText('מינימום'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'החל סינון' }))
    await waitFor(() => expect(lastCallFilters().min_amount).toBe(100))

    expect(lastCallFilters().start_date).toBe(chipStart)
  })
})

describe('export parity', () => {
  it('exports exactly the filtered set the user sees (search/date/amount filters included)', async () => {
    renderPage()
    await waitFor(() => expect(api.getTransactions).toHaveBeenCalled())

    fireEvent.change(screen.getByPlaceholderText('חיפוש עסקאות...'), { target: { value: 'סופר' } })
    await waitFor(() => expect(lastCallFilters().search).toBe('סופר'), { timeout: 2000 })

    fireEvent.click(screen.getByRole('button', { name: /מתקדם/ }))
    fireEvent.change(screen.getByPlaceholderText('מינימום'), { target: { value: '50' } })
    fireEvent.change(screen.getByPlaceholderText('מקסימום'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'החל סינון' }))
    await waitFor(() => expect(lastCallFilters().min_amount).toBe(50))

    fireEvent.click(screen.getByRole('button', { name: /ייצוא/ }))
    await waitFor(() => expect(api.exportTransactions).toHaveBeenCalled())

    const exportFilters = api.exportTransactions.mock.calls[0][1] as Record<string, unknown>
    // CORRECT behavior: export carries the same active filters as the list.
    expect(exportFilters).toMatchObject({ search: 'סופר' })
    expect(exportFilters).toMatchObject({ min_amount: 50, max_amount: 500 })
  })
})

describe('date chips use the local calendar day', () => {
  it('chip החודש starts on the first of the current LOCAL month', async () => {
    renderPage()
    await waitFor(() => expect(api.getTransactions).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'החודש' }))
    await waitFor(() => expect(lastCallFilters().start_date).toBeTruthy())
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    expect(lastCallFilters().start_date).toBe(expected)
  })

  it('chip היום sends the current LOCAL day', async () => {
    renderPage()
    await waitFor(() => expect(api.getTransactions).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'היום' }))
    await waitFor(() => expect(lastCallFilters().start_date).toBeTruthy())
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(lastCallFilters().start_date).toBe(expected)
    expect(lastCallFilters().end_date).toBe(expected)
  })
})
