import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import BitImport from './BitImport'

const api = vi.hoisted(() => ({
  getOwners: vi.fn().mockResolvedValue(['חשבון א', 'חשבון ב']),
  previewBitImport: vi.fn(),
  applyBitImport: vi.fn(),
}))
vi.mock('../../services/api', () => ({ transactionsApi: api }))

it('previews the selected owner’s Bit export and saves only the checked matches', async () => {
  api.previewBitImport.mockResolvedValue({
    counts: { total: 3, ambiguous: 1 },
    proposals: [
      { txn_key: 'one', transaction_date: '2026-10-06', reason: 'מתנה ליום הולדת', amount: -50, category: 'אירועים ומתנות' },
      { txn_key: 'two', transaction_date: '2026-10-07', reason: 'שכר דירה', amount: -100, category: 'הוצאות שוטפות' },
    ],
  })
  api.applyBitImport.mockResolvedValue({ updated: 1, skipped: 0 })
  const user = userEvent.setup()
  render(<BitImport sessionId="base" />)
  const file = new File(['sample'], 'bit.csv', { type: 'text/csv' })
  await user.upload(screen.getByLabelText('קובץ CSV מ־Bit'), file)
  const read = screen.getByRole('button', { name: 'הצג התאמות' })
  expect(read).toBeDisabled()
  await user.selectOptions(await screen.findByLabelText('בעל החשבון של Bit'), 'חשבון א')
  await user.click(read)
  expect(api.previewBitImport).toHaveBeenCalledWith('base', file, 'חשבון א')
  await user.click(await screen.findByRole('checkbox', { name: /שכר דירה/ }))
  await user.click(screen.getByRole('button', { name: 'שמור את הסיווגים שנבחרו' }))
  expect(api.applyBitImport).toHaveBeenCalledWith('base', file, 'חשבון א', ['one'])
  expect(await screen.findByText('עסקה אחת סווגה.')).toBeVisible()
})
