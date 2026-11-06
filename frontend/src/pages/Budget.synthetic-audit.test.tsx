/**
 * SYNTHETIC AUDIT - Domain 35: Budget state integrity.
 * Local-only tests with mocked APIs and seeded localStorage. No production data.
 * Assertions express DESIRED behavior; failures document confirmed bugs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Budget from './Budget'

const authState = vi.hoisted(() => ({ user: { id: 'user-1', email: 'u1@example.com' } as { id: string; email: string } | null }))
vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}))

const mockGetMetrics = vi.fn()
const mockGetDonut = vi.fn()
const mockGetSnapshot = vi.fn()

vi.mock('../services/api', () => ({
  transactionsApi: {
    getMetrics: (...args: unknown[]) => mockGetMetrics(...args),
    getDonutChartV2: (...args: unknown[]) => mockGetDonut(...args),
    getCategorySnapshot: (...args: unknown[]) => mockGetSnapshot(...args),
  },
}))

const USER_KEY = 'budget-goals-user-user-1'

const METRICS = { total_expenses: -1000, total_income: 5000, average_transaction: -100, total_transactions: 10 }
const DONUT = { categories: [{ name: 'מזון', value: 800 }], total: 800 }
const SNAPSHOT = {
  categories: [
    { name: 'מזון', total: 800 },
    { name: 'דלק', total: 200 },
  ],
  total: 1000,
  total_count: 5,
  month_count: 2,
}

function renderBudget() {
  return render(
    <MemoryRouter initialEntries={['/budget?session_id=sess1']}>
      <Budget />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  cleanup()
  authState.user = { id: 'user-1', email: 'u1@example.com' }
  localStorage.clear()
  vi.clearAllMocks()
  mockGetMetrics.mockResolvedValue(METRICS)
  mockGetDonut.mockResolvedValue(DONUT)
  mockGetSnapshot.mockResolvedValue(SNAPSHOT)
})

describe('budget state integrity - persistence', () => {
  it('roundtrip: saved goal survives remount under the per-user key', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify([{ id: 'g1', category: 'מזון', limit: 1000 }]))
    const first = renderBudget()
    expect(await screen.findByText('מזון')).toBeInTheDocument()
    first.unmount()
    renderBudget()
    expect(await screen.findByText('מזון')).toBeInTheDocument()
  })

  it('migrates legacy session-keyed goals into the per-user key', async () => {
    localStorage.setItem('budget-goals-sess1', JSON.stringify([{ id: 'g9', category: 'מזון', limit: 500 }]))
    renderBudget()
    expect(await screen.findByText('מזון')).toBeInTheDocument()
    expect(localStorage.getItem(USER_KEY)).toContain('מזון')
  })
})

describe('budget state integrity - malformed stored state', () => {
  it('stored JSON object instead of array must not crash the page', async () => {
    localStorage.setItem(USER_KEY, '{}')
    renderBudget()
    expect(await screen.findByText(/יעדי תקציב \(0\)/)).toBeInTheDocument()
  })

  it('stored goal missing limit is discarded safely (no crash, no NaN)', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify([{ id: 'g1', category: 'מזון' }]))
    renderBudget()
    expect(await screen.findByText(/יעדי תקציב \(0\)/)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('NaN')
  })

  it('stored goal with string limit must not string-concatenate totals', async () => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify([
        { id: 'g1', category: 'מזון', limit: '1000' },
        { id: 'g2', category: 'דלק', limit: '500' },
      ]),
    )
    renderBudget()
    await screen.findByText('מזון')
    // totalBudget must be 1500, never "01000500"-style concatenation
    expect(document.body.textContent).toContain('1,500')
    expect(document.body.textContent).not.toMatch(/01000|1000500/)
  })

  it('unparseable storage falls back to empty (control)', async () => {
    localStorage.setItem(USER_KEY, 'not json {')
    renderBudget()
    expect(await screen.findByText(/יעדי תקציב \(0\)/)).toBeInTheDocument()
  })

  it('dropped/coerced entries: original raw value is preserved under a backup key before any repair write', async () => {
    const raw = JSON.stringify([
      { id: 'g1', category: 'מזון', limit: '1000' },
      { id: 'g2', category: 'broken' },
    ])
    localStorage.setItem(USER_KEY, raw)
    renderBudget()
    await screen.findByText('מזון')
    // Repair happened in memory (string limit coerced, broken entry dropped)...
    expect(document.body.textContent).toContain('1,000')
    // ...the main key still holds the ORIGINAL raw until a real save...
    expect(localStorage.getItem(USER_KEY)).toBe(raw)
    // ...and a recoverable copy exists under the backup key.
    expect(localStorage.getItem(`${USER_KEY}-corrupt-backup`)).toBe(raw)
  })

  it('non-array storage: original raw preserved under backup key', async () => {
    localStorage.setItem(USER_KEY, '{}')
    renderBudget()
    expect(await screen.findByText(/יעדי תקציב \(0\)/)).toBeInTheDocument()
    expect(localStorage.getItem(`${USER_KEY}-corrupt-backup`)).toBe('{}')
    expect(localStorage.getItem(USER_KEY)).toBe('{}')
  })

  it('well-formed storage writes NO backup (control)', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify([{ id: 'g1', category: 'מזון', limit: 1000 }]))
    renderBudget()
    await screen.findByText('מזון')
    expect(localStorage.getItem(`${USER_KEY}-corrupt-backup`)).toBeNull()
  })
})

describe('budget state integrity - add validation', () => {
  it('limit above the 10,000,000 max gives feedback instead of a silent no-op', async () => {
    const user = userEvent.setup()
    renderBudget()
    const addToggle = await screen.findByRole('button', { name: /הוסף יעד/ })
    await waitFor(() => expect(addToggle).not.toBeDisabled())
    await user.click(addToggle)
    await user.click(screen.getByRole('combobox', { name: 'קטגוריה' }))
    await user.click(screen.getByRole('option', { name: 'דלק' }))
    await user.type(screen.getByRole('spinbutton', { name: 'תקציב (₪)' }), '20000000')
    const submit = screen.getByRole('button', { name: 'הוסף' })
    // Bug indicator: the submit button is enabled although addGoal will silently refuse
    if (!submit.hasAttribute('disabled')) {
      await user.click(submit)
      const stored = JSON.parse(localStorage.getItem(USER_KEY) ?? '[]')
      const accepted = Array.isArray(stored) && stored.some((g: { category: string }) => g.category === 'דלק')
      const feedback = document.body.textContent?.match(/מקסימום|גבול|לא תקין|שגיאה/)
      expect(accepted || feedback, 'over-max limit silently swallowed: no goal saved, no error shown').toBeTruthy()
    }
  })

  it('duplicate category cannot be added twice via the form options', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify([{ id: 'g1', category: 'מזון', limit: 1000 }]))
    const user = userEvent.setup()
    renderBudget()
    const addToggle = await screen.findByRole('button', { name: /הוסף יעד/ })
    await user.click(addToggle)
    await user.click(screen.getByRole('combobox', { name: 'קטגוריה' }))
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).not.toContain('מזון')
    expect(options).toContain('דלק')
  })
})

describe('budget state integrity - raw backup versioning and save blocking', () => {
  it('a new corrupt raw never overwrites the first backup: versioned copies', async () => {
    localStorage.setItem(USER_KEY, 'garbage-one')
    const first = renderBudget()
    await screen.findByText(/יעדי תקציב \(0\)/)
    expect(localStorage.getItem(`${USER_KEY}-corrupt-backup`)).toBe('garbage-one')
    first.unmount()
    localStorage.setItem(USER_KEY, 'garbage-two')
    renderBudget()
    await screen.findByText(/יעדי תקציב \(0\)/)
    expect(localStorage.getItem(`${USER_KEY}-corrupt-backup`)).toBe('garbage-one')
    expect(localStorage.getItem(`${USER_KEY}-corrupt-backup-2`)).toBe('garbage-two')
  })

  it('same raw re-loaded: no duplicate version written', async () => {
    localStorage.setItem(USER_KEY, 'garbage-one')
    const first = renderBudget()
    await screen.findByText(/יעדי תקציב \(0\)/)
    first.unmount()
    renderBudget()
    await screen.findByText(/יעדי תקציב \(0\)/)
    expect(localStorage.getItem(`${USER_KEY}-corrupt-backup-2`)).toBeNull()
  })

  it('backup write failing (but main write fine) BLOCKS saving until the raw is backed up, then succeeds', async () => {
    const realSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k.includes('-corrupt-backup')) throw new DOMException('quota', 'QuotaExceededError')
      return realSetItem.call(this, k, v)
    }
    const corrupt = JSON.stringify([{ id: 'g0', category: 'מזון', limit: '900' }])
    localStorage.setItem(USER_KEY, corrupt) // seeded before breakage is fine (uses real proto? no - broken now)
    renderBudget()
    await screen.findByText('מזון')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /הוסף יעד/ }))
    await user.click(screen.getByRole('combobox', { name: 'קטגוריה' }))
    await user.click(screen.getByRole('option', { name: 'דלק' }))
    await user.type(screen.getByRole('spinbutton', { name: 'תקציב (₪)' }), '300')
    await user.click(screen.getByRole('button', { name: 'הוסף' }))
    // Blocked: no commit, explicit error, main key untouched
    expect(await screen.findByRole('alert')).toHaveTextContent(/שגיאה בשמירת/)
    expect(screen.queryByRole('heading', { name: 'דלק' })).not.toBeInTheDocument()
    expect(localStorage.getItem(USER_KEY)).toBe(corrupt)
    // Unblock backup writes, retry the same add: backup written first, then save commits
    Storage.prototype.setItem = realSetItem
    await user.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(await screen.findByRole('heading', { name: 'דלק' })).toBeInTheDocument()
    expect(localStorage.getItem(`${USER_KEY}-corrupt-backup`)).toBe(corrupt)
    const saved = JSON.parse(localStorage.getItem(USER_KEY)!)
    expect(saved.map((g: { category: string }) => g.category)).toEqual(['מזון', 'דלק'])
    expect(saved[0].limit).toBe(900) // coerced from string
  })

  it('account deletion wipes raw backups + pending marker but not other users\' keys', async () => {
    const { clearDeletedAccountStorage } = await import('../lib/deleteAccountStorage')
    const { getPendingRawBackup, preserveRawCopy } = await import('../lib/budgetRawBackup')
    localStorage.setItem(USER_KEY, 'x')
    localStorage.setItem(`${USER_KEY}-corrupt-backup`, 'x')
    localStorage.setItem(`${USER_KEY}-corrupt-backup-2`, 'y')
    localStorage.setItem('budget-goals-user-other', 'keep')
    localStorage.setItem('budget-goals-user-other-corrupt-backup', 'keep')
    // Force a pending marker for user-1's key (backup write blocked)
    const realSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError') }
    expect(preserveRawCopy(USER_KEY, 'pending-raw')).toBe(false)
    Storage.prototype.setItem = realSetItem
    expect(getPendingRawBackup()?.key).toBe(USER_KEY)
    clearDeletedAccountStorage('user-1')
    expect(localStorage.getItem(USER_KEY)).toBeNull()
    expect(localStorage.getItem(`${USER_KEY}-corrupt-backup`)).toBeNull()
    expect(localStorage.getItem(`${USER_KEY}-corrupt-backup-2`)).toBeNull()
    expect(getPendingRawBackup()).toBeNull()
    expect(localStorage.getItem('budget-goals-user-other')).toBe('keep')
    expect(localStorage.getItem('budget-goals-user-other-corrupt-backup')).toBe('keep')
  })

  it('account switch A->B without unmount: no A flash, no save of A goals into B key', async () => {
    const rawA = JSON.stringify([{ id: 'g1', category: 'מזון', limit: 1000 }])
    localStorage.setItem(USER_KEY, rawA)
    const user = userEvent.setup()
    const tree = () => (
      <MemoryRouter initialEntries={['/budget?session_id=sess1']}>
        <Budget />
      </MemoryRouter>
    )
    const utils = render(tree())
    await screen.findByRole('heading', { name: 'מזון' })
    // Mid-mount account switch (D29's intentional path): no unmount
    authState.user = { id: 'user-2', email: 'u2@example.com' }
    utils.rerender(tree())
    // B never sees A's goals
    expect(screen.queryByRole('heading', { name: 'מזון' })).not.toBeInTheDocument()
    expect(await screen.findByText(/יעדי תקציב \(0\)/)).toBeInTheDocument()
    // B adds a goal: lands only in B's key, A's raw untouched
    await user.click(screen.getByRole('button', { name: /הוסף יעד/ }))
    await user.click(screen.getByRole('combobox', { name: 'קטגוריה' }))
    await user.click(screen.getByRole('option', { name: 'דלק' }))
    await user.type(screen.getByRole('spinbutton', { name: 'תקציב (₪)' }), '300')
    await user.click(screen.getByRole('button', { name: 'הוסף' }))
    await screen.findByRole('heading', { name: 'דלק' })
    expect(JSON.parse(localStorage.getItem('budget-goals-user-user-2')!).map((g: { category: string }) => g.category)).toEqual(['דלק'])
    expect(localStorage.getItem(USER_KEY)).toBe(rawA)
  })
})

describe('budget state integrity - save failures', () => {
  const realSetItem = Storage.prototype.setItem
  afterEach(() => {
    Storage.prototype.setItem = realSetItem
  })
  function breakSetItem() {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError')
    }
  }

  it('failed add: no state commit, no UI claim of save, explicit error, original storage intact', async () => {
    const raw = JSON.stringify([{ id: 'g1', category: 'מזון', limit: 1000 }])
    localStorage.setItem(USER_KEY, raw)
    breakSetItem()
    const user = userEvent.setup()
    renderBudget()
    await screen.findByText('מזון')
    await user.click(screen.getByRole('button', { name: /הוסף יעד/ }))
    await user.click(screen.getByRole('combobox', { name: 'קטגוריה' }))
    await user.click(screen.getByRole('option', { name: 'דלק' }))
    await user.type(screen.getByRole('spinbutton', { name: 'תקציב (₪)' }), '300')
    await user.click(screen.getByRole('button', { name: 'הוסף' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/שגיאה בשמירת/)
    // Goal NOT committed to state (no goal card for it)
    expect(screen.queryByRole('heading', { name: 'דלק' })).not.toBeInTheDocument()
    // Original storage untouched
    expect(localStorage.getItem(USER_KEY)).toBe(raw)
  })

  it('failed delete: goal stays, explicit error shown', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify([{ id: 'g1', category: 'מזון', limit: 1000 }]))
    breakSetItem()
    const user = userEvent.setup()
    renderBudget()
    await screen.findByRole('heading', { name: 'מזון' })
    await user.click(screen.getByTitle('מחק יעד'))
    expect(await screen.findByRole('alert')).toHaveTextContent(/שגיאה בשמירת/)
    expect(screen.getByRole('heading', { name: 'מזון' })).toBeInTheDocument()
  })
})

describe('budget state integrity - API failure path', () => {
  it('load failure with existing goals surfaces an error/retry instead of zero spend', async () => {
    mockGetMetrics.mockRejectedValue(new Error('network down'))
    mockGetDonut.mockRejectedValue(new Error('network down'))
    mockGetSnapshot.mockRejectedValue(new Error('network down'))
    localStorage.setItem(USER_KEY, JSON.stringify([{ id: 'g1', category: 'מזון', limit: 1000 }]))
    renderBudget()
    await screen.findByText('מזון')
    // The page currently renders "everything unspent" as if it were true data.
    const errorShown = /שגיאה|נסה שוב|לא ניתן לטעון/.test(document.body.textContent ?? '')
    expect(errorShown, 'on load failure there is no error or retry').toBe(true)
    // No misleading figures anywhere: not per-goal, not in the summary cards
    expect(document.body.textContent).not.toContain('נותרו')
    expect(document.body.textContent).not.toContain('מהתקציב נוצל')
    expect(document.body.textContent).not.toContain('בריאות תקציב')
    expect(document.body.textContent).toContain('אין נתוני הוצאות לחישוב')
    expect(document.body.textContent).toContain('לא זמין')
  })

  it('retry after a failed load recovers real spend data', async () => {
    mockGetMetrics.mockRejectedValueOnce(new Error('network down'))
    mockGetDonut.mockRejectedValueOnce(new Error('network down'))
    mockGetSnapshot.mockRejectedValueOnce(new Error('network down'))
    localStorage.setItem(USER_KEY, JSON.stringify([{ id: 'g1', category: 'מזון', limit: 1000 }]))
    const user = userEvent.setup()
    renderBudget()
    const retry = await screen.findByRole('button', { name: 'נסה שוב' })
    await user.click(retry)
    // After recovery the error banner is gone and real spend (₪800 of ₪1,000) shows
    await waitFor(() => expect(screen.queryByRole('button', { name: 'נסה שוב' })).not.toBeInTheDocument())
    expect(document.body.textContent).toContain('800')
    expect(document.body.textContent).toContain('200')
  })

  it('load failure with no goals is distinguishable from a genuine empty state', async () => {
    mockGetMetrics.mockRejectedValue(new Error('network down'))
    mockGetDonut.mockRejectedValue(new Error('network down'))
    mockGetSnapshot.mockRejectedValue(new Error('network down'))
    renderBudget()
    await waitFor(() => expect(mockGetSnapshot).toHaveBeenCalled())
    const emptyState = /עדיין לא הגדרת יעדי תקציב/.test(document.body.textContent ?? '')
    const errorShown = /שגיאה|נסה שוב|לא ניתן לטעון/.test(document.body.textContent ?? '')
    expect(errorShown || !emptyState, 'API failure renders the exact same empty state as a user with no budgets').toBe(true)
  })
})

describe('budget state integrity - thresholds and scope label', () => {
  const THRESH_DONUT = {
    categories: [
      { name: 'ק75', value: 750 },
      { name: 'ק85', value: 850 },
      { name: 'ק105', value: 1050 },
    ],
    total: 2650,
  }
  const THRESH_SNAPSHOT = {
    categories: [
      { name: 'ק75', total: 750 },
      { name: 'ק85', total: 850 },
      { name: 'ק105', total: 1050 },
    ],
    total: 2650,
    total_count: 30,
    month_count: 3,
  }

  function ringStrokeOf(heading: string): string | null {
    const h = screen.getByRole('heading', { name: heading })
    const card = h.closest('.glass-card')!
    const circles = card.querySelectorAll('svg circle')
    return circles[1]?.getAttribute('stroke')
  }

  it('badge and ring use one scheme: >80 warning, >100 over', async () => {
    mockGetDonut.mockResolvedValue(THRESH_DONUT)
    mockGetSnapshot.mockResolvedValue(THRESH_SNAPSHOT)
    localStorage.setItem(
      USER_KEY,
      JSON.stringify([
        { id: 'g1', category: 'ק75', limit: 1000 },
        { id: 'g2', category: 'ק85', limit: 1000 },
        { id: 'g3', category: 'ק105', limit: 1000 },
      ]),
    )
    renderBudget()
    await screen.findByRole('heading', { name: 'ק75' })
    const text = document.body.textContent ?? ''
    expect(text).toContain('נותרו') // 75%: ok badge
    expect(text).toContain('מהתקציב נוצל') // 85%: warning badge
    expect(text).toContain('חריגה של') // 105%: over badge
    expect(ringStrokeOf('ק75')).toBe('var(--success)')
    expect(ringStrokeOf('ק85')).toBe('var(--warning)')
    expect(ringStrokeOf('ק105')).toBe('var(--danger)')
  })

  it('page labels its spend basis as all-time', async () => {
    renderBudget()
    await screen.findByText(/ההוצאה מצטברת על כל תקופת הנתונים/)
  })
})

describe('budget state integrity - filter consistency', () => {
  it('documents the spend window: snapshot is requested with no month range (all-time)', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify([{ id: 'g1', category: 'מזון', limit: 1000 }]))
    renderBudget()
    await waitFor(() => expect(mockGetSnapshot).toHaveBeenCalled())
    const args = mockGetSnapshot.mock.calls[0]
    // Signature: (sessionId, signal, monthFrom?, monthTo?, dateType?)
    expect(args[0]).toBe('sess1')
    expect(args[2]).toBeUndefined()
    expect(args[3]).toBeUndefined()
  })

  it('delete removes only the chosen goal and persists', async () => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify([
        { id: 'g1', category: 'מזון', limit: 1000 },
        { id: 'g2', category: 'דלק', limit: 500 },
      ]),
    )
    const user = userEvent.setup()
    renderBudget()
    await screen.findByText('מזון')
    const deleteButtons = screen.getAllByTitle('מחק יעד')
    await user.click(deleteButtons[1])
    await waitFor(() => expect(screen.queryByText('דלק')).not.toBeInTheDocument())
    expect(screen.getByText('מזון')).toBeInTheDocument()
    const stored = JSON.parse(localStorage.getItem(USER_KEY)!)
    expect(stored).toHaveLength(1)
    expect(stored[0].category).toBe('מזון')
  })
})
