import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RefreshFromBanks from './RefreshFromBanks'
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: { email: 'synthetic@example.invalid' } }) }))
vi.mock('../../lib/bankSyncAccess', () => ({ canUseBankSync: () => true }))
beforeEach(() => { localStorage.setItem('bankSyncToken', 'synthetic-token') })
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })
it('surfaces pending failure while still refreshing successfully saved posted data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ added: 2, pendingStatuses: { synthetic: 'pending_store_failed' } }) }))
  const onSynced = vi.fn()
  render(<RefreshFromBanks onSynced={onSynced}/>)
  fireEvent.click(screen.getByRole('button', { name: 'רענן מהבנקים' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('לא ניתן לאמת את עדכון העסקאות הממתינות')
  expect(onSynced).toHaveBeenCalledOnce()
})
it('explains the cleanup block without exposing an arbitrary backend error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'BANK_CLEANUP_REQUIRED', message: 'PRIVATE' }) }))
  const onSynced = vi.fn()
  render(<RefreshFromBanks onSynced={onSynced}/>)
  fireEvent.click(screen.getByRole('button', { name: 'רענן מהבנקים' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('לא ניתן לוודא שתהליך הדפדפן נסגר')
  expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument()
  expect(onSynced).not.toHaveBeenCalled()
})
it('does not imply all accounts succeeded when the server reports partial failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ added: 0, errors: { synthetic: 'BANK_TIMEOUT' } }) }))
  render(<RefreshFromBanks/>)
  fireEvent.click(screen.getByRole('button', { name: 'רענן מהבנקים' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('חלק מהחשבונות לא עודכנו')
})
