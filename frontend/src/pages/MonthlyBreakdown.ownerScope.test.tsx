import {act, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach, expect, it, vi} from 'vitest'
import {MemoryRouter} from 'react-router-dom'
import MonthlyBreakdown from './MonthlyBreakdown'
import {FilterProvider} from '../context/FilterContext'
import {transactionsApi} from '../services/api'

vi.mock('../services/api', () => {
  const comparison = {
    months: ['10/2026'],
    month_totals: {'10/2026': 1000},
    grand_total: 1000,
    categories: [
      {
        name: 'מזון',
        total: 950,
        pct_of_grand: 95,
        months: {'10/2026': {amount: 950, pct_of_month: 95, delta: null, delta_pct: null}},
      },
    ],
  }
  return {
    transactionsApi: {
      getOwners: vi.fn().mockResolvedValue(['Mor', 'Shelly']),
      getCategoryCatalog: vi.fn().mockResolvedValue({subcategories: {}}),
      getMetrics: vi.fn().mockResolvedValue({has_billing_date: false}),
      getCategoryMonthlyComparison: vi.fn().mockResolvedValue(comparison),
      getIndustryMonthly: vi.fn().mockResolvedValue({months: ['10/2026'], series: []}),
      getSubcategoryMonthly: vi.fn().mockResolvedValue({
        months: ['10/2026'],
        series: [{name: 'סופר גדול', data: [900]}],
      }),
      scopeSession: vi.fn().mockImplementation((sessionId: string, owner?: string | null) =>
        Promise.resolve(owner ? `${sessionId}::owner=${owner}` : sessionId)),
    },
  }
})

const mocked = vi.mocked(transactionsApi)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/monthly?session_id=base1']}>
      <FilterProvider>
        <MonthlyBreakdown />
      </FilterProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

it('loads the subcategory split through the owner-scoped session so totals match the category row', async () => {
  const user = userEvent.setup()
  renderPage()

  // The comparison data auto-selects the first category, firing the subcategory fetch.
  await waitFor(() => expect(mocked.getSubcategoryMonthly).toHaveBeenCalled())
  expect(mocked.getSubcategoryMonthly).toHaveBeenLastCalledWith(
    'base1', 'מזון', 'billing', expect.anything(),
  )

  // Pick the per-person filter — the drilldown must follow the same scope as
  // the category comparison above it, or the two contradict on screen.
  await user.click(await screen.findByRole('button', {name: 'Shelly'}))

  await waitFor(() =>
    expect(mocked.getSubcategoryMonthly).toHaveBeenLastCalledWith(
      'base1::owner=Shelly', 'מזון', 'billing', expect.anything(),
    ),
  )
})


it('a superseded owner request never overwrites the newer owner data', async () => {
  const user = userEvent.setup()
  type SubcategoryData = Awaited<ReturnType<typeof transactionsApi.getSubcategoryMonthly>>
  let resolveFirst!: (value: SubcategoryData) => void
  // First (unscoped) call hangs in flight; the owner switch supersedes it.
  mocked.getSubcategoryMonthly.mockImplementationOnce(
    () => new Promise<SubcategoryData>((resolve) => { resolveFirst = resolve }),
  )
  mocked.getSubcategoryMonthly.mockResolvedValueOnce({
    months: ['10/2026'],
    series: [{name: 'נתוני שלי', data: [700]}],
  })
  renderPage()

  await waitFor(() => expect(mocked.getSubcategoryMonthly).toHaveBeenCalledTimes(1))
  await user.click(await screen.findByRole('button', {name: 'Shelly'}))

  // The scoped request resolves first and renders Shelly's split.
  expect(await screen.findByText('נתוני שלי')).toBeInTheDocument()

  // The superseded unscoped response finally arrives — it must not clobber
  // the newer scoped data.
  await act(async () => {
    resolveFirst({months: ['10/2026'], series: [{name: 'נתוני כולם', data: [900]}]})
  })
  expect(screen.queryByText('נתוני כולם')).toBeNull()
  expect(screen.getByText('נתוני שלי')).toBeInTheDocument()
})
