import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

const signUp = vi.fn()
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signUp: (...a: unknown[]) => signUp(...a),
      signInWithPassword: vi.fn(),
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
