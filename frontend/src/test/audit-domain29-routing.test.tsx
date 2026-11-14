/**
 * Domain29 positive regressions — routing & auth round-trip.
 * These FAIL on the pre-fix build and PASS on the fix.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { ReactNode } from 'react'

const authState: { user: { id: string } | null; loading: boolean } = { user: null, loading: false }

vi.mock('../lib/AuthContext', async () => {
  const React = await import('react')
  return {
    // The real context object: FilterProvider reads it via useContext and must
    // tolerate an empty value (treated as signed-out there).
    AuthContext: React.createContext(undefined),
    useAuth: () => ({
      user: authState.user,
      session: authState.user ? { access_token: 'synthetic' } : null,
      loading: authState.loading,
      signIn: vi.fn(async () => ({ error: null })),
      signUp: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => {}),
      resetPassword: vi.fn(async () => ({ error: null })),
      updatePassword: vi.fn(async () => ({ error: null })),
      updateEmail: vi.fn(async () => ({ error: null })),
      updateDisplayName: vi.fn(async () => ({ error: null })),
    }),
    AuthProvider: ({ children }: { children: ReactNode }) => React.createElement(React.Fragment, null, children),
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      refreshSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({}),
      signInWithPassword: vi.fn(),
    },
    from: () => { throw new Error('no-network-in-audit') },
  },
}))

import App from '../App'
import { safeReturnTo } from '../lib/returnTo'

beforeEach(() => {
  authState.user = null
  authState.loading = false
  localStorage.clear()
  sessionStorage.clear()
  window.history.pushState({}, '', '/')
})

describe('deep links survive the auth round-trip', () => {
  it('logged-out deep link returns to its target after login', async () => {
    window.history.pushState({}, '', '/transactions?session_id=abc123')
    const app = render(<App />)
    await vi.waitFor(() => expect(window.location.pathname).toBe('/login'))

    authState.user = { id: 'user-synthetic' }
    await act(async () => { app.rerender(<App />) })

    await vi.waitFor(() => expect(window.location.pathname).toBe('/transactions'))
    expect(window.location.search).toBe('?session_id=abc123')
  }, 20000)

  it('a signed-in user landing on /login without a guard target goes to the dashboard', async () => {
    authState.user = { id: 'user-synthetic' }
    window.history.pushState({}, '', '/login')
    render(<App />)
    await vi.waitFor(() => expect(window.location.pathname).toBe('/'))
  }, 20000)
})

describe('/login while auth is resolving', () => {
  it('shows the loader, not the login form, while loading', async () => {
    authState.loading = true
    window.history.pushState({}, '', '/login')
    render(<App />)
    expect(await screen.findByText('...טוען')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('אימייל')).not.toBeInTheDocument()
  }, 20000)
})

describe('safeReturnTo', () => {
  it('honors internal relative targets', () => {
    expect(safeReturnTo('/transactions?session_id=x')).toBe('/transactions?session_id=x')
    expect(safeReturnTo('/monthly')).toBe('/monthly')
  })
  it('rejects external and protocol-relative URLs', () => {
    expect(safeReturnTo('https://evil.example')).toBe('/')
    expect(safeReturnTo('//evil.example')).toBe('/')
    expect(safeReturnTo('javascript:alert(1)')).toBe('/')
  })
  it('rejects normalization tricks: backslashes and encoded separators', () => {
    expect(safeReturnTo('/\\evil.example')).toBe('/')       // /\host → //host in URL parsers
    expect(safeReturnTo('/%5C%5Cevil.example')).toBe('/')     // encoded backslashes
    expect(safeReturnTo('%2F%2Fevil.example')).toBe('/')      // encoded protocol-relative
    expect(safeReturnTo('/%2f%2fevil.example')).toBe('/')
    expect(safeReturnTo('/%09/evil.example')).toBe('/')
    expect(safeReturnTo('/%zz')).toBe('/')                    // malformed encoding
    expect(safeReturnTo('')).toBe('/')
  })
  it('keeps legitimate Hebrew and encoded query targets', () => {
    expect(safeReturnTo('/monthly?cat=%D7%9E%D7%96%D7%95%D7%9F')).toBe('/monthly?cat=%D7%9E%D7%96%D7%95%D7%9F')
    expect(safeReturnTo('/transactions?search=קפה')).toBe('/transactions?search=קפה')
  })
  it('rejects loops into auth pages and non-strings', () => {
    expect(safeReturnTo('/login')).toBe('/')
    expect(safeReturnTo('/login?x=1')).toBe('/')
    expect(safeReturnTo('/reset-password')).toBe('/')
    expect(safeReturnTo('/x/../AUTH/callback/?code=example')).toBe('/')
    expect(safeReturnTo('/transactions?search=cafe#access_token=example')).toBe('/transactions?search=cafe')
    expect(safeReturnTo(undefined)).toBe('/')
    expect(safeReturnTo(42)).toBe('/')
  })
})
