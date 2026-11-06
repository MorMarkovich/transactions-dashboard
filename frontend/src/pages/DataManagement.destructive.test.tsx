// Regressions for the destructive flows beyond R14 (D40):
//  - last-file delete must wipe the durable snapshot too (resurrection gap)
//  - deleteAllTransactions must not report success when the backend session
//    purge fails (ghost session) and must clear the remembered session key
//  - deleteAllIncomes must not kill a live session that still holds rows (F3)
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const saveTransactions = vi.fn()
const deleteAllTransactions = vi.fn()
const deleteAllIncomes = vi.fn()
const deleteSessionFile = vi.fn()
const deleteSession = vi.fn()
const getTransactions = vi.fn()
const getStorageInfo = vi.fn()

const authUser = { id: 'user-d40' }
vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}))
vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../services/supabaseApi', () => ({
  supabaseApi: {
    saveTransactions: (...a: unknown[]) => saveTransactions(...a),
    deleteAllTransactions: (...a: unknown[]) => deleteAllTransactions(...a),
    deleteAllIncomes: (...a: unknown[]) => deleteAllIncomes(...a),
    getManualIncomes: vi.fn().mockResolvedValue([]),
    getIncomes: vi.fn().mockResolvedValue([{ id: 'i1' }]),
    getStorageInfo: (...a: unknown[]) => getStorageInfo(...a),
    getLatestSnapshotAt: vi.fn().mockResolvedValue(null),
  },
}))
vi.mock('../services/api', () => ({
  transactionsApi: {
    getSessionInfo: vi.fn().mockResolvedValue({ transaction_count: 20, total_rows: 20, total_expenses: 300, total_income: 110, expense_count: 17, income_count: 3, date_from: '2026-01-01', date_to: '2026-02-28', has_billing_date: false, months: ['2026-01','2026-02'], columns: ['date','description','amount'], categories: [] }),
    getSessionFiles: vi.fn().mockResolvedValue({
      files: [{ name: 'bank-a.xlsx', transaction_count: 10, expense_count: 8, income_count: 2, total_expenses: 100, total_income: 50, date_from: '2026-01-01', date_to: '2026-01-31' }],
    }),
    deleteSessionFile: (...a: unknown[]) => deleteSessionFile(...a),
    getTransactions: (...a: unknown[]) => getTransactions(...a),
    deleteSession: (...a: unknown[]) => deleteSession(...a),
  },
}))

import DataManagement from './DataManagement'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/data?session_id=sess-d40']}>
      <DataManagement />
    </MemoryRouter>,
  )
}

describe('DataManagement destructive flows (D40: F1-last-file, F2, F3)', () => {
  beforeEach(() => {
    localStorage.clear()
    saveTransactions.mockReset().mockResolvedValue(undefined)
    deleteAllTransactions.mockReset().mockResolvedValue(undefined)
    deleteAllIncomes.mockReset().mockResolvedValue(undefined)
    deleteSessionFile.mockReset().mockResolvedValue({ success: true, removed: 10, remaining: 0, message: 'ok' })
    deleteSession.mockReset().mockResolvedValue({})
    getTransactions.mockReset().mockResolvedValue({ transactions: [] })
    getStorageInfo.mockReset().mockResolvedValue({ transactionSets: 1, incomeCount: 1, uploads: [] })
  })

  it('last-file delete wipes the durable snapshot, not only the session', async () => {
    renderPage()
    const user = userEvent.setup()
    const btn = await screen.findByTitle('מחק bank-a.xlsx')
    await user.click(btn)
    await waitFor(() => expect(deleteSessionFile).toHaveBeenCalledWith('sess-d40', 'bank-a.xlsx'))
    await waitFor(() => expect(deleteAllTransactions).toHaveBeenCalledWith('user-d40'))
    await waitFor(() => expect(deleteSession).toHaveBeenCalledWith('sess-d40'))
    // No partial persist of an empty set — the data is meant to be gone.
    expect(saveTransactions).not.toHaveBeenCalled()
  })

  it('deleteAllTransactions with a failing session purge warns instead of claiming success, and clears the remembered session', async () => {
    localStorage.setItem('transactions-dashboard:last-session', 'sess-d40')
    deleteSession.mockRejectedValue(Object.assign(new Error('server error'), { response: { status: 500 } }))
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('אזור מסוכן'))
    await user.click(await screen.findByText('מחק את כל העסקאות'))
    await user.click(await screen.findByText('מחק הכל'))
    await waitFor(() => expect(deleteAllTransactions).toHaveBeenCalledWith('user-d40'))
    await waitFor(() => expect(deleteSession).toHaveBeenCalledWith('sess-d40'))
    await screen.findByText(/ניקוי הסשן בשרת נכשל/)
    expect(screen.queryByText('כל העסקאות נמחקו בהצלחה')).toBeNull()
    expect(localStorage.getItem('transactions-dashboard:last-session')).toBeNull()
  })

  it('a 404 on session purge counts as success (session already gone)', async () => {
    deleteSession.mockRejectedValue(Object.assign(new Error('not found'), { response: { status: 404 } }))
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('אזור מסוכן'))
    await user.click(await screen.findByText('מחק את כל העסקאות'))
    await user.click(await screen.findByText('מחק הכל'))
    await screen.findByText('כל העסקאות נמחקו בהצלחה')
  })

  it('deleteAllIncomes keeps a live session that still holds transaction rows (F3)', async () => {
    getStorageInfo.mockResolvedValue({ transactionSets: 0, incomeCount: 1, uploads: [] })
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('אזור מסוכן'))
    await user.click(await screen.findByText('מחק את כל ההכנסות'))
    await user.click(await screen.findByText('מחק הכל'))
    await waitFor(() => expect(deleteAllIncomes).toHaveBeenCalledWith('user-d40'))
    // sessionInfo.total_rows is 20 in the mock — the session must survive.
    await new Promise((r) => setTimeout(r, 300))
    expect(deleteSession).not.toHaveBeenCalled()
  })
})
