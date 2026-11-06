// D31 review: scopeSession rejection must clear the loading state, not stick
// the page on skeletons or leak an unhandled rejection.
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import Transactions from './Transactions'
import { FilterProvider } from '../context/FilterContext'
import { transactionsApi } from '../services/api'

vi.mock('../lib/AuthContext', async () => {
  const { createContext } = await import('react')
  return {
    useAuth: () => ({ user: { id: 'u1', email: 'qa@example.com' }, session: null }),
    // FilterContext reads the raw context to tolerate a missing provider.
    AuthContext: createContext(undefined),
  }
})
vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../services/supabaseApi', () => ({ supabaseApi: new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }) }))
vi.mock('../services/api', () => ({
  transactionsApi: {
    getCategories: vi.fn().mockResolvedValue(['מזון']),
    getCategoryCatalog: vi.fn().mockResolvedValue({ subcategories: {} }),
    scopeSession: vi.fn(),
    getTransactions: vi.fn().mockResolvedValue({ transactions: [], total: 0, total_amount: 0, avg_transaction: 0, expense_count: 0, income_count: 0, total_expenses: 0, total_income: 0, median_transaction: 0, max_transaction: null, min_transaction: null, category_breakdown: [], date_from: null, date_to: null }),
    exportTransactions: vi.fn().mockResolvedValue(new Blob(['x'])),
  },
}))
const api = transactionsApi as unknown as {
  scopeSession: ReturnType<typeof vi.fn>
  getTransactions: ReturnType<typeof vi.fn>
}

let consoleError: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  if (!window.matchMedia) { window.matchMedia = (q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as unknown as typeof window.matchMedia }
})
afterEach(() => { consoleError.mockRestore() })

describe('scope request failure (D31)', () => {
  it('a 500 from /api/session/scope clears loading and keeps the page alive', async () => {
    api.scopeSession.mockRejectedValue(new Error('Request failed with status code 500'))
    const { container } = render(
      <MemoryRouter initialEntries={['/transactions?session_id=s1']}>
        <FilterProvider><Transactions /></FilterProvider>
      </MemoryRouter>,
    )

    // The scope request must actually have fired - otherwise this is a false pass.
    await waitFor(() => expect(api.scopeSession).toHaveBeenCalled())
    expect(api.getTransactions).not.toHaveBeenCalled()

    // Loading skeletons clear after the rejection is caught.
    await waitFor(() => expect(container.querySelectorAll('.skeleton-card').length).toBe(0), { timeout: 3000 })

    // Page still renders, error was handled (logged), not thrown.
    expect(screen.getByText('רשימת עסקאות')).toBeInTheDocument()
    expect(consoleError).toHaveBeenCalledWith('Error loading transactions:', expect.any(Error))
  })

  it('recovery: a later filter change retries and renders data', async () => {
    api.scopeSession
      .mockRejectedValueOnce(new Error('Request failed with status code 500'))
      .mockImplementation(async (id: string) => id)
    const { container } = render(
      <MemoryRouter initialEntries={['/transactions?session_id=s1']}>
        <FilterProvider><Transactions /></FilterProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(container.querySelectorAll('.skeleton-card').length).toBe(0), { timeout: 3000 })

    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByRole('button', { name: 'החודש' }))
    await waitFor(() => expect(api.getTransactions).toHaveBeenCalled())
  })
})
