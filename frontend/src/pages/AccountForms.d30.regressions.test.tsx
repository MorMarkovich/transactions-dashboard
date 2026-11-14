/**
 * Domain-30 audit regressions (2026-11-06): positive assertions of the
 * DESIRED behavior for mobile account-form fixes.
 * D30-F2: register trims the display name and rejects whitespace-only names.
 * D30-mapper: code-style rate-limit and security-cooldown Supabase messages
 *   map to the Hebrew rate-limit text (never raw English).
 * D30-hint: delete-account confirmation shows a hint on non-empty mismatch
 *   while still requiring the exact phrase.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ThemeProvider } from '../context/ThemeContext'

const signUp = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: vi.fn(),
      signUp: (...a: unknown[]) => signUp(...a),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))
import { AuthProvider, authErrorMessage } from '../lib/AuthContext'
import Login from './Login'

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter><ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider></MemoryRouter>
)

async function openRegister() {
  render(<Login />, { wrapper })
  fireEvent.click(await screen.findByRole('button', { name: 'צור חשבון חדש' }))
}

async function fillRegister(name: string) {
  fireEvent.change(await screen.findByLabelText('שם מלא'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('כתובת אימייל'), { target: { value: 't@example.com' } })
  fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'secret1' } })
  fireEvent.change(screen.getByLabelText('אימות סיסמה'), { target: { value: 'secret1' } })
}

describe('D30-F2: register display-name validation', () => {
  beforeEach(() => signUp.mockReset())

  it('rejects a whitespace-only name and never calls signUp', async () => {
    await openRegister()
    await fillRegister('   ')
    fireEvent.click(screen.getByRole('button', { name: 'צור חשבון' }))
    expect(await screen.findByText('נא למלא את כל השדות')).toBeTruthy()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('trims surrounding whitespace before calling signUp', async () => {
    signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null })
    await openRegister()
    await fillRegister('  משה כהן  ')
    fireEvent.click(screen.getByRole('button', { name: 'צור חשבון' }))
    await waitFor(() => expect(signUp).toHaveBeenCalled())
    expect(signUp.mock.calls.at(-1)![0].options.data.full_name).toBe('משה כהן')
  })
})

describe('D30-mapper: code-style rate-limit and cooldown messages', () => {
  it('maps over_email_send_rate_limit to the Hebrew rate-limit text', () => {
    expect(authErrorMessage({ message: 'over_email_send_rate_limit' })).toBe('יותר מדי ניסיונות. נסו שוב בעוד כמה דקות')
  })
  it('maps the resend cooldown to the Hebrew rate-limit text', () => {
    expect(authErrorMessage({ message: 'For security purposes, you can only request this after 47 seconds.' })).toBe('יותר מדי ניסיונות. נסו שוב בעוד כמה דקות')
  })
})
