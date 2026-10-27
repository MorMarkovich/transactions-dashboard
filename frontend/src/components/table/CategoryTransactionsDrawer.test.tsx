import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {expect, it, vi} from 'vitest'
import CategoryTransactionsDrawer from './CategoryTransactionsDrawer'
import type {Transaction} from '../../services/types'

it('keeps a failed category save open and retries even after the session refreshed', async () => {
  const user = userEvent.setup()
  const save = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(undefined)
  const tx = {id: 1, תיאור: 'עסק לדוגמה', תאריך: '2026-10-01', סכום: -12, קטגוריה: 'אוכל'} as Transaction
  const props = {isOpen: true, onClose: vi.fn(), category: 'אוכל', month: '10/2026', transactions: [tx], total: 12, onCategoryChange: save}
  const view = render(<CategoryTransactionsDrawer {...props} />)
  await user.click(screen.getByRole('button', {name: /ערוך קטגוריה:/}))
  await user.click(screen.getByRole('button', {name: /קניות/}))
  await user.click(screen.getByRole('button', {name: 'שמור שינויים'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('לא הצלחנו לשמור')
  view.rerender(<CategoryTransactionsDrawer {...props} transactions={[{...tx, קטגוריה: 'קניות'}]} />)
  await user.click(screen.getByRole('button', {name: 'שמור שינויים'}))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
})
