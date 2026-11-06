// Positive regression for R14 (F10): per-file delete must persist the reduced
// transaction set insert-first, so the deletion survives the next restore.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const saveTransactions = vi.fn()
const deleteAllTransactions = vi.fn()
const deleteSessionFile = vi.fn()
const getTransactions = vi.fn()

// Stable identity: a fresh object per render would retrigger the mount effect
// on every render (effect deps include `user`), starving timers and hanging.
const authUser = { id: 'user-f10' }
vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}))
vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../services/supabaseApi', () => ({
  supabaseApi: {
    saveTransactions: (...a: unknown[]) => saveTransactions(...a),
    deleteAllTransactions: (...a: unknown[]) => deleteAllTransactions(...a),
    getManualIncomes: vi.fn().mockResolvedValue([]),
    getIncomes: vi.fn().mockResolvedValue([]),
    getStorageInfo: vi.fn().mockResolvedValue(null),
    getLatestSnapshotAt: vi.fn().mockResolvedValue(null),
  },
}))
vi.mock('../services/api', () => ({
  transactionsApi: {
    getSessionInfo: vi.fn().mockResolvedValue({ transaction_count: 20, total_rows: 20, total_expenses: 300, total_income: 110, expense_count: 17, income_count: 3, date_from: '2026-01-01', date_to: '2026-02-28', has_billing_date: false, months: ['2026-01','2026-02'], columns: ['date','description','amount'], categories: [] }),
    getSessionFiles: vi.fn().mockResolvedValue({
      files: [
        { name: 'bank-a.xlsx', transaction_count: 10, expense_count: 8, income_count: 2, total_expenses: 100, total_income: 50, date_from: '2026-01-01', date_to: '2026-01-31' },
        { name: 'bank-b.xlsx', transaction_count: 10, expense_count: 9, income_count: 1, total_expenses: 200, total_income: 60, date_from: '2026-02-01', date_to: '2026-02-28' },
      ],
    }),
    deleteSessionFile: (...a: unknown[]) => deleteSessionFile(...a),
    getTransactions: (...a: unknown[]) => getTransactions(...a),
    deleteSession: vi.fn().mockResolvedValue({}),
    getStorageInfo: vi.fn().mockRejectedValue(new Error('n/a')),
  },
}))

import DataManagement from './DataManagement'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/data?session_id=sess-f10']}>
      <DataManagement />
    </MemoryRouter>,
  )
}

describe('DataManagement per-file delete persistence (R14)', () => {
  beforeEach(() => {
    saveTransactions.mockReset().mockResolvedValue(undefined)
    deleteAllTransactions.mockReset().mockResolvedValue(undefined)
    deleteSessionFile.mockReset().mockResolvedValue({ success: true, removed: 10, remaining: 10, message: 'ok' })
    getTransactions.mockReset().mockResolvedValue({ transactions: [{ id: 't1' }, { id: 't2' }] })
  })

  it('persists the reduced set insert-first after deleting one file', async () => {
    renderPage()
    const user = userEvent.setup()
    const btn = await screen.findByTitle('מחק bank-a.xlsx')
    await user.click(btn)
    await waitFor(() => expect(deleteSessionFile).toHaveBeenCalledWith('sess-f10', 'bank-a.xlsx'))
    await waitFor(() => expect(saveTransactions).toHaveBeenCalledWith('user-f10', [{ id: 't1' }, { id: 't2' }]))
    expect(deleteAllTransactions).not.toHaveBeenCalled()
  })

  it('a persist failure keeps the previous snapshot and warns the user', async () => {
    saveTransactions.mockRejectedValue(new TypeError('Failed to fetch'))
    renderPage()
    const user = userEvent.setup()
    const btn = await screen.findByTitle('מחק bank-a.xlsx')
    await user.click(btn)
    await waitFor(() => expect(saveTransactions).toHaveBeenCalled())
    expect(deleteAllTransactions).not.toHaveBeenCalled()
    await screen.findByText(/השמירה נכשלה/)
  })
})
