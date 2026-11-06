/**
 * Domain-10 audit regressions (2026-11-06): positive assertions of the
 * DESIRED behavior. Red before the fix, green after.
 * F1: raw English Supabase errors must never render - mapped Hebrew instead.
 * F2: switching login/register/reset moves focus to the new page heading.
 * F3: register success (needsConfirmation) clears the password fields.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

const signInWithPassword = vi.fn()
const signUp = vi.fn()
const resetPasswordForEmail = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      signUp: (...a: unknown[]) => signUp(...a),
      resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))
import { AuthProvider, useAuth, authErrorMessage } from '../lib/AuthContext'
import Login from './Login'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>
const HEBREW = /[א-ת]/

describe('F1: authErrorMessage mapping', () => {
  it('maps malformed email to Hebrew', () => {
    expect(authErrorMessage({ message: 'Unable to validate email address: invalid format' })).toBe('כתובת המייל אינה תקינה')
  })
  it('maps rate limits to Hebrew', () => {
    expect(authErrorMessage({ message: 'Request rate limit reached' })).toBe('יותר מדי ניסיונות. נסו שוב בעוד כמה דקות')
    expect(authErrorMessage({ message: 'Email rate limit exceeded' })).toBe('יותר מדי ניסיונות. נסו שוב בעוד כמה דקות')
  })
  it('keeps the specific Hebrew mappings', () => {
    expect(authErrorMessage({ message: 'Invalid login credentials' })).toBe('מייל או סיסמה שגויים')
    expect(authErrorMessage({ message: 'Email not confirmed' })).toContain('יש לאשר')
    expect(authErrorMessage({ message: 'User already registered' })).toBe('המייל כבר רשום')
  })
  it('never returns raw English for unknown errors', () => {
    for (const m of ['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'something unexpected']) {
      const out = authErrorMessage({ message: m })!
      expect(out).not.toBe(m)
      expect(out).toMatch(HEBREW)
    }
  })
  it('returns null for no error', () => {
    expect(authErrorMessage(null)).toBeNull()
  })
})

describe('F1 via context methods', () => {
  it('signIn returns generic Hebrew for network failure', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Failed to fetch' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    const { error } = await result.current.signIn('a@b.co', 'x')
    expect(error).toMatch(HEBREW)
    expect(error).not.toBe('Failed to fetch')
  })
  it('signUp maps rate limit to Hebrew', async () => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'Request rate limit reached' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect((await result.current.signUp('a@b.co', 'secret1', 'A')).error).toBe('יותר מדי ניסיונות. נסו שוב בעוד כמה דקות')
  })
  it('resetPassword maps rate limit to Hebrew', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect((await result.current.resetPassword('a@b.co')).error).toBe('יותר מדי ניסיונות. נסו שוב בעוד כמה דקות')
  })
})

describe('F2: focus moves to the new heading on auth page switch', () => {
  function renderLogin() {
    return render(<MemoryRouter><AuthProvider><Login /></AuthProvider></MemoryRouter>)
  }
  it('forgot-password switch focuses its heading', async () => {
    renderLogin()
    fireEvent.click(await screen.findByRole('button', { name: 'שכחתי סיסמה' }))
    const heading = await screen.findByRole('heading', { name: /איפוס סיסמה/ })
    await waitFor(() => expect(document.activeElement).toBe(heading))
  })
  it('register switch focuses its heading', async () => {
    renderLogin()
    fireEvent.click(await screen.findByRole('button', { name: 'צור חשבון חדש' }))
    const heading = await screen.findByRole('heading', { name: /יצירת חשבון/ })
    await waitFor(() => expect(document.activeElement).toBe(heading))
  })
  it('back-to-login switch focuses the login heading', async () => {
    renderLogin()
    fireEvent.click(await screen.findByRole('button', { name: 'שכחתי סיסמה' }))
    fireEvent.click(await screen.findByRole('button', { name: 'חזור' }))
    const heading = await screen.findByRole('heading', { name: /ברוך הבא/ })
    await waitFor(() => expect(document.activeElement).toBe(heading))
  })
})

describe('F3: register confirmation clears passwords', () => {
  it('password fields are emptied and email kept after needsConfirmation', async () => {
    signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null })
    render(<MemoryRouter><AuthProvider><Login /></AuthProvider></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'צור חשבון חדש' }))
    fireEvent.change(await screen.findByLabelText('שם מלא'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('כתובת אימייל'), { target: { value: 't@example.com' } })
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'secret1' } })
    fireEvent.change(screen.getByLabelText('אימות סיסמה'), { target: { value: 'secret1' } })
    fireEvent.click(screen.getByRole('button', { name: 'צור חשבון' }))
    await screen.findByText(/שלחנו מייל אימות/)
    expect((screen.getByLabelText('סיסמה') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('אימות סיסמה') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('כתובת אימייל') as HTMLInputElement).value).toBe('t@example.com')
  })
})
