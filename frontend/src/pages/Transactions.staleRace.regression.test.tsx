// Review probe: chip clicked INSIDE the 300ms search debounce window.
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Transactions from './Transactions'
import { FilterProvider } from '../context/FilterContext'
import { transactionsApi } from '../services/api'

vi.mock('../lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'qa@example.com' }, session: null }) }))
vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../services/supabaseApi', () => ({ supabaseApi: new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }) }))
vi.mock('../services/api', () => ({
  transactionsApi: {
    getCategories: vi.fn().mockResolvedValue(['מזון']),
    getCategoryCatalog: vi.fn().mockResolvedValue({ subcategories: {} }),
    scopeSession: vi.fn().mockImplementation(async (id: string) => id),
    getTransactions: vi.fn().mockResolvedValue({ transactions: [], total: 0, total_amount: 0, avg_transaction: 0, expense_count: 0, income_count: 0, total_expenses: 0, total_income: 0, median_transaction: 0, max_transaction: null, min_transaction: null, category_breakdown: [], date_from: null, date_to: null }),
    exportTransactions: vi.fn().mockResolvedValue(new Blob(['x'])),
  },
}))
const api = transactionsApi as unknown as { getTransactions: ReturnType<typeof vi.fn> }
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear()
  if (!window.matchMedia) { window.matchMedia = (q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as any } })
function lastCallFilters() { const c = api.getTransactions.mock.calls; return c[c.length - 1][1] as Record<string, unknown> }

describe('stale debounce race', () => {
  it('chip clicked within the search debounce window still wins', async () => {
    render(<MemoryRouter initialEntries={['/transactions?session_id=s1']}><FilterProvider><Transactions /></FilterProvider></MemoryRouter>)
    await waitFor(() => expect(api.getTransactions).toHaveBeenCalled())
    // Type, then click the chip *immediately* (well inside 300ms).
    fireEvent.change(screen.getByPlaceholderText('חיפוש עסקאות...'), { target: { value: 'סו' } })
    fireEvent.click(screen.getByRole('button', { name: 'החודש' }))
    // Let the debounce fire and the resulting fetch land.
    await waitFor(() => expect(lastCallFilters().search).toBe('סו'), { timeout: 2000 })
    await new Promise((r) => setTimeout(r, 400))
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    expect(lastCallFilters().start_date).toBe(expected)
  })
})
