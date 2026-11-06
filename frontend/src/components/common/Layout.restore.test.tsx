import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import Layout from './Layout'
import { FilterProvider } from '../../context/FilterContext'
import { markSampleSession, getSampleSessionId } from '../../lib/sampleMode'
import { transactionsApi } from '../../services/api'
import { supabaseApi } from '../../services/supabaseApi'

// Keep the shell light: these children are exercised by their own tests.
vi.mock('./Header', () => ({ default: () => <div data-testid="header" /> }))
vi.mock('./Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }))
vi.mock('./CommandPalette', () => ({ default: () => <div data-testid="palette" /> }))
// Mutable auth so a test can switch the signed-in user mid-flight.
vi.mock('../../lib/AuthContext', async () => {
  const { createContext } = await import('react')
  return {
    AuthContext: createContext(null),
    useAuth: () => ({ user: (window as unknown as { __TEST_USER?: unknown }).__TEST_USER, loading: false }),
  }
})
vi.mock('../../services/api', () => ({
  transactionsApi: {
    getMetrics: vi.fn(),
    restoreSession: vi.fn(),
    aiStatus: vi.fn(),
    aiProgress: vi.fn(),
    aiCategorize: vi.fn(),
    aiSubcategorizeAll: vi.fn(),
    aiAudit: vi.fn(),
    setMerchantCategory: vi.fn(),
  },
}))
vi.mock('../../services/supabaseApi', () => ({
  supabaseApi: {
    getLatestSnapshotAt: vi.fn(),
    getLatestTransactions: vi.fn(),
    getCategoryRules: vi.fn(),
    getTransactionOverrides: vi.fn(),
    getUserCategories: vi.fn(),
    getTransactionNotes: vi.fn(),
    upsertAutomaticCategoryRules: vi.fn(),
  },
}))

const getMetrics = vi.mocked(transactionsApi.getMetrics)
const restoreSession = vi.mocked(transactionsApi.restoreSession)
const getLatestTransactions = vi.mocked(supabaseApi.getLatestTransactions)

const USER_A = { id: 'user-a', email: 'a@example.com' }
const USER_B = { id: 'user-b', email: 'b@example.com' }
function setUser(u: unknown) {
  ;(window as unknown as { __TEST_USER?: unknown }).__TEST_USER = u
}

const locations: string[] = []
function Probe() {
  const loc = useLocation()
  locations.push(`${loc.pathname}${loc.search}${loc.hash}`)
  return null
}

function NavButton({ to, label }: { to: string; label: string }) {
  const nav = useNavigate()
  return <button onClick={() => nav(to)}>{label}</button>
}

function renderAt(url: string, extra?: React.ReactNode) {
  locations.length = 0
  return render(
    <MemoryRouter initialEntries={[url]}>
      <FilterProvider>
        {extra /* outside Layout: stays clickable while children are gated by validation */}
        <Probe />
        <Layout>
          <div>PAGE</div>
        </Layout>
      </FilterProvider>
    </MemoryRouter>,
  )
}

const notFound = () => ({ response: { status: 404 } })

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  setUser(USER_A)
  vi.mocked(supabaseApi.getLatestSnapshotAt).mockResolvedValue(null)
  vi.mocked(supabaseApi.getCategoryRules).mockResolvedValue([])
  vi.mocked(supabaseApi.getTransactionOverrides).mockResolvedValue([])
  vi.mocked(supabaseApi.getUserCategories).mockResolvedValue([])
  vi.mocked(supabaseApi.getTransactionNotes).mockResolvedValue([])
  vi.mocked(transactionsApi.aiStatus).mockResolvedValue({
    free_only: true, configured: false, paid_fallback: false, monthly_spend_limit_usd: null,
  })
})

describe('Layout session restore — dead session in URL', () => {
  it('drops a dead sample session (backend restart) instead of looping on errors', async () => {
    markSampleSession('sample-xyz')
    getMetrics.mockRejectedValue(notFound())
    getLatestTransactions.mockResolvedValue([]) // new user: nothing saved to rebuild from

    renderAt('/?session_id=sample-xyz')

    await waitFor(() => expect(screen.getByText('PAGE')).toBeTruthy())
    await waitFor(() => expect(locations.at(-1)).toBe('/'))
    expect(getSampleSessionId()).toBeNull() // sample marker cleared
    expect(restoreSession).not.toHaveBeenCalled()
  })

  it('removes only session_id and preserves other params and the hash', async () => {
    getMetrics.mockRejectedValue(notFound())
    getLatestTransactions.mockResolvedValue([])

    renderAt('/transactions?session_id=dead-real&month=10%2F2026#frag')

    await waitFor(() => expect(screen.getByText('PAGE')).toBeTruthy())
    await waitFor(() => expect(locations.at(-1)).toBe('/transactions?month=10%2F2026#frag'))
    expect(restoreSession).not.toHaveBeenCalled()
  })

  it('keeps the live id (and the sample marker) when a user switch made the restore stale', async () => {
    markSampleSession('a-dead-sample')
    getMetrics.mockImplementation((sid: string) =>
      sid === 'b-live' ? Promise.resolve({} as never) : Promise.reject(notFound()))
    const slow = deferred<never[]>()
    getLatestTransactions.mockReturnValue(slow.promise)

    renderAt('/?session_id=a-dead-sample', <NavButton to="/?session_id=b-live" label="switch" />)

    // A's restore is in flight; B signs in and lands on B's live session.
    await waitFor(() => expect(getLatestTransactions).toHaveBeenCalled())
    setUser(USER_B)
    act(() => screen.getByText('switch').click())
    await waitFor(() => expect(locations.at(-1)).toBe('/?session_id=b-live'))

    // A's restore finishes late: it must not touch B's URL or the marker.
    act(() => slow.resolve([]))
    await new Promise((r) => setTimeout(r, 50))
    expect(locations.at(-1)).toBe('/?session_id=b-live')
    expect(getSampleSessionId()).toBe('a-dead-sample')
    expect(restoreSession).not.toHaveBeenCalled()
  })

  it('still rebuilds the session from saved data when the URL id is dead (positive)', async () => {
    getMetrics.mockRejectedValue(notFound())
    getLatestTransactions.mockResolvedValue([{ 'סכום': -10 }] as never)
    restoreSession.mockResolvedValue({ success: true, session_id: 'new-9' } as never)

    renderAt('/?session_id=dead-real')

    await waitFor(() => expect(locations.at(-1)).toBe('/?session_id=new-9'))
    expect(restoreSession).toHaveBeenCalledTimes(1)
  })

  it('leaves a healthy URL session untouched and skips restore (positive)', async () => {
    getMetrics.mockResolvedValue({} as never)

    renderAt('/?session_id=ok-1')

    await waitFor(() => expect(screen.getByText('PAGE')).toBeTruthy())
    await waitFor(() => expect(locations.at(-1)).toBe('/?session_id=ok-1'))
    expect(getLatestTransactions).not.toHaveBeenCalled()
    expect(restoreSession).not.toHaveBeenCalled()
  })
})

describe('Layout session restore — remembered session boot (reload recovery)', () => {
  const LAST = 'transactions-dashboard:last-session:user-a' // v4: per-user scoped key

  it('reuses the remembered session on a bare reload when it is still alive', async () => {
    localStorage.setItem(LAST, 'rem-1')
    getMetrics.mockResolvedValue({} as never)

    renderAt('/')

    await waitFor(() => expect(locations.at(-1)).toBe('/?session_id=rem-1'))
    expect(getLatestTransactions).not.toHaveBeenCalled()
    expect(restoreSession).not.toHaveBeenCalled()
  })

  it('rebuilds from Supabase when the remembered session died (backend cold start)', async () => {
    localStorage.setItem(LAST, 'rem-dead')
    getMetrics.mockRejectedValue(notFound())
    getLatestTransactions.mockResolvedValue([{ 'סכום': -10 }] as never)
    restoreSession.mockResolvedValue({ success: true, session_id: 'new-1' } as never)

    renderAt('/')

    await waitFor(() => expect(locations.at(-1)).toBe('/?session_id=new-1'))
    expect(restoreSession).toHaveBeenCalledTimes(1)
  })

  it('new user, no URL session and nothing remembered: lands on empty state, no loop', async () => {
    getLatestTransactions.mockResolvedValue([])

    renderAt('/')

    await waitFor(() => expect(screen.getByText('PAGE')).toBeTruthy())
    await waitFor(() => expect(locations.at(-1)).toBe('/'))
    expect(getMetrics).not.toHaveBeenCalled()
    expect(restoreSession).not.toHaveBeenCalled()
  })
})

describe('Layout session restore — 429 retry keeps validating (no empty-state flash)', () => {
  it('holds the skeleton until the awaited retry completes, then restores', async () => {
    getMetrics.mockRejectedValue(notFound())
    getLatestTransactions.mockResolvedValue([{ 'סכום': -10 }] as never)
    restoreSession
      .mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '2' } } })
      .mockResolvedValueOnce({ success: true, session_id: 'r2' } as never)

    renderAt('/?session_id=dead-real')

    // Mid-wait: still validating — children (and the sample/upload entry points) stay hidden.
    await new Promise((r) => setTimeout(r, 500))
    expect(screen.queryByText('PAGE')).toBeNull()

    await waitFor(() => expect(locations.at(-1)).toBe('/?session_id=r2'), { timeout: 8000 })
    expect(screen.getByText('PAGE')).toBeTruthy()
    expect(restoreSession).toHaveBeenCalledTimes(2)
  }, 15000)

  it('shows the retry screen (not the empty state) when the retry also fails', async () => {
    getMetrics.mockRejectedValue(notFound())
    getLatestTransactions.mockResolvedValue([{ 'סכום': -10 }] as never)
    restoreSession
      .mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '2' } } })
      .mockRejectedValueOnce({ response: { status: 500 } })

    renderAt('/?session_id=dead-real')

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy(), { timeout: 8000 })
    expect(screen.getByRole('alert').textContent).toContain('לא הצלחנו לטעון')
    expect(screen.queryByText('PAGE')).toBeNull()
    expect(restoreSession).toHaveBeenCalledTimes(2)
  }, 15000)
})
