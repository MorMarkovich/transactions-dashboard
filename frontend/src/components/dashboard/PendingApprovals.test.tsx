import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PendingApprovals from './PendingApprovals'
import type { PendingCard } from '../../services/pendingApprovals'

const { read } = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('../../services/pendingApprovals', () => ({ readPendingCards: read, isPendingStale: (card: PendingCard) => card.state === 'stale' }))
const key = 'synthetic-card', scope = `${key}|2026-11`
function fixture(): PendingCard {
  return { key, company: '11', suffix: '1234', state: 'current', checkedAt: '2026-10-26T10:00:00Z', unresolved: [],
    current: { cardKey: key, scope, success: true, observedAt: '2026-10-26T10:00:00Z', rows: Array.from({ length: 4 }, (_, i) => ({ identity: `${i}`, date: '2026-10-25', merchant: `עסקת דוגמה ${i + 1}`, authorizationMinor: 1000 + i, currency: 'ILS', status: 'pending' })) } }
}
beforeEach(() => read.mockReset())
afterEach(cleanup)
it('shows four approvals, scope and exclusion from posted totals', async () => {
  read.mockResolvedValue([fixture()]); render(<PendingApprovals userId="synthetic"/>)
  expect(await screen.findByText('4 עסקאות בתצפית האחרונה')).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(4)
  expect(screen.getByText(/אינם נכללים בהוצאות/)).toBeInTheDocument()
  expect(screen.getByText('11/2026')).toBeInTheDocument()
})
it('a failed refresh retains prior rows but explicitly removes the freshness claim', async () => {
  read.mockResolvedValueOnce([fixture()]).mockRejectedValueOnce(Error('synthetic'))
  render(<PendingApprovals userId="synthetic"/>)
  await screen.findByText('4 עסקאות בתצפית האחרונה')
  fireEvent.click(screen.getByRole('button', { name: 'רענן תצוגה' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('מהקריאה הקודמת')
  expect(screen.getAllByRole('listitem')).toHaveLength(4)
  expect(screen.queryByText('4 עסקאות בתצפית האחרונה')).not.toBeInTheDocument()
})
it('an invalidated binding hides all former current and unresolved rows', async () => {
  const card = fixture(); card.state = 'unknown'; card.unresolved = [card.current!]
  read.mockResolvedValue([card]); render(<PendingApprovals userId="synthetic"/>)
  await screen.findByText(/החיבור אינו מאומת/)
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})
it('rollover keeps old rows in a separate unresolved section', async () => {
  const card = fixture(); card.state = 'rollover_review'; card.unresolved = [{ ...card.current!, scope: `${key}|2026-10` }]; card.current = { ...card.current!, rows: [] }
  read.mockResolvedValue([card]); render(<PendingApprovals userId="synthetic"/>)
  await screen.findByText('0 עסקאות בתצפית האחרונה')
  expect(screen.getByText(/תקופות קודמות שטרם הוכרעו/)).toBeInTheDocument()
  expect(screen.getByText(/אין אישור שהעסקאות האלו חויבו או בוטלו/)).toBeInTheDocument()
})
it('a user switch discards the former state and ignores a late response', async () => {
  let finish!: (cards: PendingCard[]) => void
  read.mockReturnValueOnce(new Promise<PendingCard[]>(resolve => { finish = resolve })).mockResolvedValueOnce([])
  const view = render(<PendingApprovals key="user-a" userId="user-a"/>)
  view.rerender(<PendingApprovals key="user-b" userId="user-b"/>)
  await screen.findByText(/טרם התקבלו נתוני/)
  finish([fixture()]); await waitFor(() => expect(screen.queryByRole('listitem')).not.toBeInTheDocument())
})
