/**
 * Domain24 audit (2026-11-06): pagination state transitions on the
 * Transactions page. Synthetic mocked API, jsdom. Tests that document bugs
 * are written against the CORRECT behavior, so they FAIL on the current
 * build and pass once fixed:
 *   B - restored page must survive re-entering the page
 *   C - subcategory change must reset/clamp the page
 * Passing today (positive regressions):
 *   A - a real filter change resets the page to 1
 */
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../lib/AuthContext', async () => {
  const { createContext } = await import('react')
  return {
    useAuth: () => ({ user: { id: 'u1', email: 'qa@example.com' }, session: null }),
    AuthContext: createContext({ user: { id: 'u1', email: 'qa@example.com' } }),
  }
})
vi.mock('../lib/supabase', () => ({ supabase: {} }))
import Transactions from './Transactions'
import { FilterProvider, useDashboardFilters } from '../context/FilterContext'

// ---- jsdom polyfills -------------------------------------------------------
if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as unknown as typeof window.matchMedia)
}
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver

// ---- synthetic dataset + faithful mini-server ------------------------------
interface Row { id: number; תאריך: string; תיאור: string; סכום: number; סכום_מוחלט: number; קטגוריה: string; קטגוריה_משנה: string }
const ROWS: Row[] = []
for (let n = 0; n < 120; n++) {
  ROWS.push({
    id: n,
    תאריך: `2026-10-${String(30 - Math.floor(n / 4)).padStart(2, '0')}`,
    תיאור: `עסקה ${String(n).padStart(3, '0')}`,
    סכום: -(n + 10),
    סכום_מוחלט: n + 10,
    קטגוריה: n < 60 ? 'מזון וצריכה' : 'שונות',
    קטגוריה_משנה: n < 60 ? (n < 10 ? 'סופר גדול' : 'סופרים קטנים') : 'אחר',
  })
}
let scopedSubs: string[] = []

vi.mock('../services/api', () => ({
  transactionsApi: {
    getCategories: vi.fn(async () => ['מזון וצריכה', 'שונות']),
    getCategoryCatalog: vi.fn(async () => ({ subcategories: { 'מזון וצריכה': [{ name: 'סופר גדול' }, { name: 'סופרים קטנים' }] } })),
    scopeSession: vi.fn(async (_sid: string, _a: unknown, _s: unknown, _cat: string, subs: string[]) => { scopedSubs = subs ?? []; return 'scoped' }),
    exportTransactions: vi.fn(),
    getTransactions: vi.fn(async (_sid: string, f: { page: number; page_size: number; category?: string; search?: string; start_date?: string; end_date?: string }) => {
      let rows = [...ROWS]
      if (f.category) rows = rows.filter((r) => r['קטגוריה'] === f.category)
      if (scopedSubs.length) rows = rows.filter((r) => scopedSubs.includes(r['קטגוריה_משנה']))
      if (f.search) rows = rows.filter((r) => r['תיאור'].includes(f.search!))
      rows.sort((a, b) => (a['תאריך'] < b['תאריך'] ? 1 : -1)) // server default: date desc
      const total = rows.length
      const start = (f.page - 1) * f.page_size
      return {
        transactions: rows.slice(start, start + f.page_size),
        total, total_amount: 0, avg_transaction: 0, expense_count: total, income_count: 0,
        total_expenses: 0, total_income: 0, median_transaction: 0,
        max_transaction: null, min_transaction: null, category_breakdown: [],
        date_from: '2026-10-01', date_to: '2026-10-30', page: f.page, page_size: f.page_size,
      }
    }),
  },
}))

vi.mock('../components/table/TransactionDrawer', () => ({ default: () => null }))

import { transactionsApi } from '../services/api'
const getTransactions = transactionsApi.getTransactions as unknown as ReturnType<typeof vi.fn>

let ctx: { setCategory: (v: string) => void; setSubcategories: (v: string[]) => void }
function Harness() {
  const c = useDashboardFilters()
  // eslint-disable-next-line react-hooks/globals -- audit harness: capture the live filter context from the rendered tree for assertions
  ctx = c
  return <Transactions />
}
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/transactions?session_id=test']}>
      <FilterProvider><Harness /></FilterProvider>
    </MemoryRouter>,
  )
}
const lastPage = () => (getTransactions.mock.calls.at(-1)?.[1] as { page: number }).page

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  scopedSubs = []
  getTransactions.mockClear()
})

describe('Transactions pagination state (domain24 audit)', () => {
  it('A - a real filter change (date chip) resets the page to 1', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('עמוד 1 מתוך 3')
    await user.click(screen.getByRole('button', { name: 'עמוד הבא' }))
    await screen.findByText('עמוד 2 מתוך 3')
    await user.click(screen.getByRole('button', { name: 'החודש' }))
    await waitFor(() => expect(lastPage()).toBe(1))
    await screen.findByText('עמוד 1 מתוך 3')
  })

  it('B - re-entering the page preserves the saved page (REGRESSION, fails today)', async () => {
    sessionStorage.setItem('tx-view:v1:test', JSON.stringify({ page: 2, filters: {}, chip: 'all' }))
    renderPage()
    // Bug: the mount-time [category] effect calls setPage(1) and wipes the restored page.
    await waitFor(() => expect(lastPage()).toBe(2), { timeout: 1500 })
    await screen.findByText('עמוד 2 מתוך 3')
  })

  it('C - shrinking the filtered set via subcategory resets the page (REGRESSION, fails today)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('עמוד 1 מתוך 3')
    act(() => ctx.setCategory('מזון וצריכה'))
    await screen.findByText('עמוד 1 מתוך 2')
    await user.click(screen.getByRole('button', { name: 'עמוד הבא' }))
    await screen.findByText('עמוד 2 מתוך 2')
    // 10 rows match this subcategory -> exactly 1 page. Page must reset/clamp.
    act(() => ctx.setSubcategories(['סופר גדול']))
    await waitFor(() => expect(lastPage()).toBe(1), { timeout: 1500 })
    await screen.findByText('עמוד 1 מתוך 1')
  })

  it('C2 - after a shrink the pager never shows an impossible page and the rows render', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('עמוד 1 מתוך 3')
    act(() => ctx.setCategory('מזון וצריכה'))
    await screen.findByText('עמוד 1 מתוך 2')
    await user.click(screen.getByRole('button', { name: 'עמוד הבא' }))
    await screen.findByText('עמוד 2 מתוך 2')
    act(() => ctx.setSubcategories(['סופר גדול']))
    await screen.findByText('עמוד 1 מתוך 1')
    expect(document.querySelectorAll('tbody tr')).toHaveLength(10)
    expect(screen.queryByText(/עמוד [2-9] מתוך 1/)).not.toBeInTheDocument()
})

  it('D - arriving with a saved page beyond the shrunk filtered total clamps to the last valid page', async () => {
    // D29 v4: filters persist under the per-user scoped key; the mocked user is u1.
    localStorage.setItem('transactions-dashboard:filters:v1:u1', JSON.stringify({ category: 'מזון וצריכה', subcategories: ['סופר גדול'] }))
    sessionStorage.setItem('tx-view:v1:test', JSON.stringify({ page: 3, filters: { category: 'מזון וצריכה' }, chip: 'all' }))
    renderPage()
    await screen.findByText('עמוד 1 מתוך 1')
    await waitFor(() => expect(lastPage()).toBe(1))
    expect(document.querySelectorAll('tbody tr')).toHaveLength(10)
  })

  it('E - re-entering preserves a saved category filter when the global filter is empty (D17 overlap)', async () => {
    sessionStorage.setItem('tx-view:v1:test', JSON.stringify({ page: 1, filters: { category: 'מזון וצריכה' }, chip: 'all' }))
    renderPage()
    await screen.findByText('עמוד 1 מתוך 2')
    await waitFor(() => {
      const f = getTransactions.mock.calls.at(-1)?.[1] as { category?: string }
      expect(f.category).toBe('מזון וצריכה')
    })
  })

  it('F - an actual global category change still replaces the scope and resets the page', async () => {
    renderPage()
    await screen.findByText('עמוד 1 מתוך 3')
    act(() => ctx.setCategory('מזון וצריכה'))
    await screen.findByText('עמוד 1 מתוך 2')
    await waitFor(() => expect((getTransactions.mock.calls.at(-1)?.[1] as { category?: string }).category).toBe('מזון וצריכה'))
    act(() => ctx.setCategory('שונות'))
    await waitFor(() => expect((getTransactions.mock.calls.at(-1)?.[1] as { category?: string }).category).toBe('שונות'))
    await waitFor(() => expect(lastPage()).toBe(1))
  })
})
