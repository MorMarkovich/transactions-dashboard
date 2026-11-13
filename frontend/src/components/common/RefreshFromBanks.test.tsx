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

function streamingSync() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(streamController) { controller = streamController },
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  })))
  const push = (text: string) => controller.enqueue(new TextEncoder().encode(text))
  return { push, close: () => controller.close() }
}

it('shows streamed percentages outside the closed sidebar and waits for dashboard restore before 100%', async () => {
  const stream = streamingSync()
  let finishRestore!: () => void
  const onSynced = vi.fn(() => new Promise<void>(resolve => { finishRestore = resolve }))
  const { rerender } = render(<RefreshFromBanks onSynced={onSynced}/>)
  fireEvent.click(screen.getByRole('button', { name: 'רענן מהבנקים' }))
  expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  stream.push('{"type":"progress","stage":"collect')
  stream.push('ing","percent":38,"account":2,"accounts":3}\n')
  expect(await screen.findByText('38%')).toBeVisible()
  expect(screen.getByText(/חשבון 2 מתוך 3/)).toBeVisible()

  rerender(<RefreshFromBanks onSynced={onSynced} sidebarClosed/>)
  expect(screen.getByRole('complementary')).toContainElement(screen.getByRole('progressbar'))
  stream.push('{"type":"result","result":{"success":true,"added":4}}\n')
  stream.close()
  expect(await screen.findByText('98%')).toBeVisible()
  expect(screen.queryByText('100%')).not.toBeInTheDocument()
  finishRestore()
  expect(await screen.findByText('100%')).toBeVisible()
  expect(screen.getByText('סונכרנו 4 עסקאות חדשות.')).toBeVisible()
})

it('does not complete when the stream drops before a result', async () => {
  const stream = streamingSync()
  const onSynced = vi.fn()
  render(<RefreshFromBanks onSynced={onSynced}/>)
  fireEvent.click(screen.getByRole('button', { name: 'רענן מהבנקים' }))
  stream.push('{"type":"progress","stage":"saving","percent":94}\n')
  expect(await screen.findByText('94%')).toBeVisible()
  stream.close()
  expect(await screen.findByRole('alert')).toHaveTextContent('לפני שהתקבל אישור סיום')
  expect(onSynced).not.toHaveBeenCalled()
  expect(screen.queryByText('100%')).not.toBeInTheDocument()
})
