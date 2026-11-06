// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}))
vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))
vi.mock('./RefreshFromBanks', () => ({ default: () => null }))
vi.mock('../../services/supabaseApi', () => ({
  supabaseApi: {
    getCategoryRules: vi.fn(async () => []),
    getTransactionOverrides: vi.fn(async () => []),
    getUserCategories: vi.fn(async () => []),
    getTransactionNotes: vi.fn(async () => []),
    saveTransactions: vi.fn(async () => undefined),
  },
}))

const uploadFile = vi.fn()
const getTransactions = vi.fn()
const restoreSession = vi.fn()
vi.mock('../../services/api', () => ({
  transactionsApi: {
    uploadFile: (...args: unknown[]) => uploadFile(...args),
    getTransactions: (...args: unknown[]) => getTransactions(...args),
    restoreSession: (...args: unknown[]) => restoreSession(...args),
  },
}))

import Sidebar from './Sidebar'

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Sidebar isOpen={true} />
    </MemoryRouter>,
  )
}

async function uploadOneFile() {
  const input = document.getElementById('sidebar-file-upload') as HTMLInputElement
  const file = new File(['x'], 'october.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  fireEvent.change(input, { target: { files: [file] } })
}

describe('Sidebar dropped-rows surfacing (D27 UI)', () => {
  beforeEach(() => {
    uploadFile.mockReset()
    getTransactions.mockReset()
    restoreSession.mockReset()
    getTransactions.mockResolvedValue({ transactions: [{ id: 1 }] })
    restoreSession.mockResolvedValue({ success: true, session_id: 'sess-1' })
  })
  afterEach(() => cleanup())

  it('shows a persistent warning with counts when invalid rows are rejected', async () => {
    uploadFile.mockResolvedValue({
      success: true, message: 'ok', session_id: 's0',
      dropped_rows: { invalid_amount: 2, invalid_date: 1, blank: 4 },
    })
    renderSidebar()
    await uploadOneFile()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('3')
    expect(alert.textContent).toContain('סכום לא תקין')
    expect(alert.textContent).toContain('תאריך לא תקין')
    expect(alert.textContent).toContain('4')
    // persistent: still there after the upload flow fully settles
    await waitFor(() => expect(restoreSession).toHaveBeenCalled())
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('shows quiet info (not a warning) for routine-only drops', async () => {
    uploadFile.mockResolvedValue({
      success: true, message: 'ok', session_id: 's0',
      dropped_rows: { summary: 3, blank: 2 },
    })
    renderSidebar()
    await uploadOneFile()
    const status = await screen.findByRole('status', {}, { timeout: 3000 })
    expect(status.textContent).toContain('5')
    expect(status.textContent).toContain('תקין')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows nothing when the backend reports no dropped rows', async () => {
    uploadFile.mockResolvedValue({ success: true, message: 'ok', session_id: 's0' })
    renderSidebar()
    await uploadOneFile()
    await waitFor(() => expect(restoreSession).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/שורות/)).toBeNull()
  })

  it('dismisses on the close button', async () => {
    uploadFile.mockResolvedValue({
      success: true, message: 'ok', session_id: 's0',
      dropped_rows: { invalid_amount: 2 },
    })
    renderSidebar()
    await uploadOneFile()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByLabelText('סגור'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('aggregates dropped rows across multiple files', async () => {
    uploadFile
      .mockResolvedValueOnce({ success: true, message: 'ok', session_id: 's0', dropped_rows: { invalid_amount: 2 } })
      .mockResolvedValueOnce({ success: true, message: 'ok', session_id: 's1', dropped_rows: { invalid_amount: 3 } })
    renderSidebar()
    const input = document.getElementById('sidebar-file-upload') as HTMLInputElement
    const f1 = new File(['a'], 'a.xlsx')
    const f2 = new File(['b'], 'b.xlsx')
    fireEvent.change(input, { target: { files: [f1, f2] } })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('5')
  })
})
