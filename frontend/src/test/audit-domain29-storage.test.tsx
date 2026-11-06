/**
 * Domain29 positive regressions — per-user local-state isolation.
 * Real AuthProvider + FilterProvider, mocked Supabase auth lifecycle A→B.
 * These FAIL on the pre-fix build and PASS on the fix.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

type FakeSession = { user: { id: string }; access_token: string } | null
let currentSession: FakeSession = null
let authListener: ((event: string, session: FakeSession) => void) | null = null

function publishSession(event: string, session: FakeSession) {
  currentSession = session
  authListener?.(event, session)
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: currentSession } }),
      onAuthStateChange: (cb: (event: string, session: FakeSession) => void) => {
        authListener = cb
        return { data: { subscription: { unsubscribe: () => { authListener = null } } } }
      },
      signOut: () => Promise.resolve({}),
    },
  },
}))

// Ownership validation of the legacy remembered session goes through the API.
const getMetrics = vi.fn()
vi.mock('../services/api', () => ({
  transactionsApi: { getMetrics: (...a: unknown[]) => getMetrics(...a) },
  SESSION_EXPIRED_KEY: 'transactions-dashboard:session-expired',
  invalidateApiCache: () => {},
}))

import { AuthProvider } from '../lib/AuthContext'
import { FilterProvider, useDashboardFilters } from '../context/FilterContext'
import {
  migrateUserState, scoped, quarantineKey,
  FILTERS_BASE, LAST_SESSION_BASE, SNAPSHOT_SEEN_BASE, PRESETS_BASE,
} from '../lib/userStorage'

function Probe() {
  const { category, subcategories, setCategory } = useDashboardFilters()
  return (
    <div>
      <span data-testid="value">{category}/{subcategories.join(',')}</span>
      <button onClick={() => setCategory('מזון')}>pick-food</button>
    </div>
  )
}

afterEach(() => cleanup())

beforeEach(() => {
  currentSession = null
  authListener = null
  getMetrics.mockReset()
  localStorage.clear()
  sessionStorage.clear()
})

describe('per-user filter isolation', () => {
  it('user B never sees user A\'s category filter; A\'s state is preserved, not deleted', async () => {
    // ── User A signs in and picks a filter ──
    publishSession('SIGNED_IN', { user: { id: 'user-A' }, access_token: 'ta' })
    const first = render(<AuthProvider><FilterProvider><Probe /></FilterProvider></AuthProvider>)
    const user = userEvent.setup()
    await screen.findByText('pick-food')
    await user.click(screen.getByText('pick-food'))
    expect(screen.getByTestId('value')).toHaveTextContent('מזון/')
    expect(localStorage.getItem(scoped(FILTERS_BASE, 'user-A'))).toContain('מזון')
    expect(localStorage.getItem(FILTERS_BASE)).toBeNull() // no global key
    first.unmount()

    // ── A signs out: scoped state stays on disk for A's return ──
    await act(async () => { publishSession('SIGNED_OUT', null) })
    expect(localStorage.getItem(scoped(FILTERS_BASE, 'user-A'))).toContain('מזון')

    // ── User B signs in on the same browser: clean slate, no inheritance ──
    await act(async () => { publishSession('SIGNED_IN', { user: { id: 'user-B' }, access_token: 'tb' }) })
    render(<AuthProvider><FilterProvider><Probe /></FilterProvider></AuthProvider>)
    expect(await screen.findByTestId('value')).toHaveTextContent('/')
    expect(localStorage.getItem(scoped(FILTERS_BASE, 'user-A'))).toContain('מזון')
  }, 15000)
})

describe('legacy globals with unknowable owners', () => {
  it('quarantines unattributed filters/presets instead of letting the first login claim them', async () => {
    localStorage.setItem(FILTERS_BASE, '{"category":"מזון","subcategories":["מסעדות"]}')
    localStorage.setItem(PRESETS_BASE, '[{"name":"p"}]')
    localStorage.setItem('notification-dismissed-ids', '["n1"]')

    await migrateUserState('user-A')
    // No claiming: A's scoped keys stay empty, legacy values move to quarantine.
    expect(localStorage.getItem(scoped(FILTERS_BASE, 'user-A'))).toBeNull()
    expect(localStorage.getItem(scoped(PRESETS_BASE, 'user-A'))).toBeNull()
    expect(localStorage.getItem(FILTERS_BASE)).toBeNull()
    expect(localStorage.getItem(PRESETS_BASE)).toBeNull()
    expect(localStorage.getItem(quarantineKey(FILTERS_BASE))).toContain('מסעדות')
    expect(localStorage.getItem(quarantineKey(PRESETS_BASE))).toBe('[{"name":"p"}]')
    // Re-derivable dismissal state is dropped, not inherited.
    expect(localStorage.getItem('notification-dismissed-ids')).toBeNull()

    // And B, authenticating later, likewise inherits nothing.
    await migrateUserState('user-B')
    expect(localStorage.getItem(scoped(FILTERS_BASE, 'user-B'))).toBeNull()
    expect(localStorage.getItem(quarantineKey(FILTERS_BASE))).toContain('מסעדות')
  })

  it('legacy unknown-owner filter does NOT load for the first authenticated user through the real providers', async () => {
    localStorage.setItem(FILTERS_BASE, JSON.stringify({ category: 'מזון', subcategory: 'סופר קטן' }))
    publishSession('INITIAL_SESSION', { user: { id: 'user-B' }, access_token: 'tb' })
    render(<AuthProvider><FilterProvider><Probe /></FilterProvider></AuthProvider>)
    await act(async () => {}) // drain mount getSession (fires migrate for user-B)
    expect(await screen.findByTestId('value')).toHaveTextContent('/')
    // A blank default may be persisted for B — the inherited values are the bug.
    expect(localStorage.getItem(scoped(FILTERS_BASE, 'user-B')) ?? '').not.toContain('מזון')
    expect(localStorage.getItem(scoped(FILTERS_BASE, 'user-B')) ?? '').not.toContain('סופר קטן')
    expect(localStorage.getItem(quarantineKey(FILTERS_BASE))).toContain('סופר קטן')
  }, 15000)
})

describe('legacy remembered-session validation (server binds sessions to owners)', () => {
  it('migrates last-session + snapshot-seen only after the backend confirms ownership', async () => {
    localStorage.setItem(LAST_SESSION_BASE, 'sess-mine')
    localStorage.setItem(SNAPSHOT_SEEN_BASE, '2026-11-05T10:00:00Z')
    getMetrics.mockResolvedValue({ data: {} })
    await migrateUserState('user-A')
    expect(getMetrics).toHaveBeenCalledWith('sess-mine')
    expect(localStorage.getItem(LAST_SESSION_BASE)).toBeNull()
    expect(localStorage.getItem(scoped(LAST_SESSION_BASE, 'user-A'))).toBe('sess-mine')
    expect(localStorage.getItem(scoped(SNAPSHOT_SEEN_BASE, 'user-A'))).toBe('2026-11-05T10:00:00Z')
  })

  it('drops a foreign or dead legacy session id (404) instead of inheriting it', async () => {
    localStorage.setItem(LAST_SESSION_BASE, 'sess-foreign')
    localStorage.setItem(SNAPSHOT_SEEN_BASE, '2026-11-05T10:00:00Z')
    getMetrics.mockRejectedValue({ response: { status: 404 } })
    await migrateUserState('user-B')
    expect(localStorage.getItem(scoped(LAST_SESSION_BASE, 'user-B'))).toBeNull()
    expect(localStorage.getItem(scoped(SNAPSHOT_SEEN_BASE, 'user-B'))).toBeNull()
    expect(localStorage.getItem(LAST_SESSION_BASE)).toBeNull()
    expect(localStorage.getItem(SNAPSHOT_SEEN_BASE)).toBeNull()
  })

  it('never calls the backend for scoped or junk legacy ids, and never overwrites an existing scoped pointer', async () => {
    localStorage.setItem(LAST_SESSION_BASE, 'sess::owner=x')
    await migrateUserState('user-A')
    expect(getMetrics).not.toHaveBeenCalled()
    expect(localStorage.getItem(scoped(LAST_SESSION_BASE, 'user-A'))).toBeNull()

    localStorage.setItem(scoped(LAST_SESSION_BASE, 'user-A'), 'current')
    localStorage.setItem(LAST_SESSION_BASE, 'sess-old')
    getMetrics.mockResolvedValue({ data: {} })
    await migrateUserState('user-A')
    expect(localStorage.getItem(scoped(LAST_SESSION_BASE, 'user-A'))).toBe('current')
  })
})
