import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

const signUp = vi.fn()
const resetPasswordForEmail = vi.fn()
const updateUser = vi.fn()
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signUp: (...a: unknown[]) => signUp(...a),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
    },
  },
}))

import { AuthProvider, useAuth } from './AuthContext'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

describe('signUp result handling', () => {
  beforeEach(() => signUp.mockReset())

  it('reports needsConfirmation when Supabase returns no session', async () => {
    signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(await result.current.signUp('a@b.co', 'secret1', 'A')).toEqual({ error: null, needsConfirmation: true })
  })

  it('does not ask for confirmation when a session comes back (confirm email off)', async () => {
    signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: { access_token: 't' } }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(await result.current.signUp('a@b.co', 'secret1', 'A')).toEqual({ error: null, needsConfirmation: false })
  })

  it('maps the obfuscated already-registered response to an error', async () => {
    signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect((await result.current.signUp('a@b.co', 'secret1', 'A')).error).toBe('המייל כבר רשום')
  })
})

describe('resetPassword', () => {
  beforeEach(() => resetPasswordForEmail.mockReset())

  it('sends the recovery email with a redirect to the reset page', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await result.current.resetPassword('a@b.co')
    expect(resetPasswordForEmail).toHaveBeenCalledWith('a@b.co', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  })
})

describe('account updates', () => {
  beforeEach(() => updateUser.mockReset())

  it('updatePassword calls updateUser with the new password', async () => {
    updateUser.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await result.current.updatePassword('secret1')
    expect(updateUser).toHaveBeenCalledWith({ password: 'secret1' })
  })

  it('updateDisplayName writes full_name to user metadata', async () => {
    updateUser.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await result.current.updateDisplayName('Mor')
    expect(updateUser).toHaveBeenCalledWith({ data: { full_name: 'Mor' } })
  })

  it('updateEmail passes the new address through', async () => {
    updateUser.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect((await result.current.updateEmail('n@b.co')).error).toBeNull()
    expect(updateUser).toHaveBeenCalledWith({ email: 'n@b.co' })
  })

  it('updateEmail maps an already-registered error to Hebrew', async () => {
    updateUser.mockResolvedValue({ error: { message: 'Email address already registered' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect((await result.current.updateEmail('n@b.co')).error).toBe('המייל כבר רשום')
  })
})
