// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}))
const user = { id: 'user-r10' }
vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user }),
}))
vi.mock('./RefreshFromBanks', () => ({ default: () => null }))

const deleteAllTransactions = vi.fn()
const saveTransactions = vi.fn()
vi.mock('../../services/supabaseApi', () => ({
  supabaseApi: {
    getCategoryRules: vi.fn(async () => []),
    getTransactionOverrides: vi.fn(async () => []),
    getUserCategories: vi.fn(async () => []),
    getTransactionNotes: vi.fn(async () => []),
    saveTransactions: (...args: unknown[]) => saveTransactions(...args),
    deleteAllTransactions: (...args: unknown[]) => deleteAllTransactions(...args),
    getLatestSnapshotAt: vi.fn(async () => '2026-11-06T00:00:00Z'),
  },
}))

vi.mock('../../services/api', () => ({
  transactionsApi: {
    uploadFile: vi.fn(async () => ({ success: true, message: 'ok', session_id: 's0' })),
    getTransactions: vi.fn(async () => ({ transactions: [{ id: 1 }] })),
    restoreSession: vi.fn(async () => ({ success: true, session_id: 'sess-1' })),
  },
}))

import Sidebar from './Sidebar'

async function uploadOneFile() {
  const input = document.getElementById('sidebar-file-upload') as HTMLInputElement
  const file = new File(['x'], 'october.xlsx')
  fireEvent.change(input, { target: { files: [file] } })
}

describe('Sidebar snapshot save ordering (R10)', () => {
  beforeEach(() => {
    deleteAllTransactions.mockReset()
    saveTransactions.mockReset()
  })
  afterEach(() => cleanup())

  it('never pre-deletes the durable snapshot on upload', async () => {
    saveTransactions.mockResolvedValue(undefined)
    render(<MemoryRouter initialEntries={['/']}><Sidebar isOpen={true} /></MemoryRouter>)
    await uploadOneFile()
    await waitFor(() => expect(saveTransactions).toHaveBeenCalledTimes(1))
    expect(saveTransactions.mock.calls[0][0]).toBe('user-r10')
    expect(deleteAllTransactions).not.toHaveBeenCalled()
  })

  it('a failing save leaves the prior snapshot untouched (no delete issued)', async () => {
    saveTransactions.mockRejectedValue(new Error('network down'))
    render(<MemoryRouter initialEntries={['/']}><Sidebar isOpen={true} /></MemoryRouter>)
    await uploadOneFile()
    await waitFor(() => expect(saveTransactions).toHaveBeenCalledTimes(1))
    expect(deleteAllTransactions).not.toHaveBeenCalled()
    // upload itself still succeeded locally; only the durable backup is deferred
    await waitFor(() => expect(screen.queryByText('שגיאה במיזוג הקבצים')).toBeNull())
  })
})
