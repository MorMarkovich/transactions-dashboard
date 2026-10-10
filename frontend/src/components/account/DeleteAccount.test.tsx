import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DeleteAccount from './DeleteAccount'

const state = vi.hoisted(() => ({ user: { id: 'test-user', email: 'test@example.com' } as { id: string; email: string } | null, sample: false, rpc: vi.fn(), signOut: vi.fn() }))
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: state.rpc, auth: { signOut: state.signOut } } }))
vi.mock('../../lib/sampleMode', () => ({ isSampleActive: () => state.sample, clearSampleSession: vi.fn() }))

describe('DeleteAccount safeguards', () => {
  beforeEach(() => { state.user = { id: 'test-user', email: 'test@example.com' }; state.sample = false; state.rpc.mockReset(); state.signOut.mockReset() })
  it.each(['markovich23@gmail.com', ' MARKOVICH23@GMAIL.COM '])('hides the owner %s', email => {
    state.user = { id: 'test-user', email }; render(<DeleteAccount />); expect(screen.queryByText('מחק את החשבון')).not.toBeInTheDocument()
  })
  it('hides in sample mode', () => { state.sample = true; render(<DeleteAccount />); expect(screen.queryByText('מחק את החשבון')).not.toBeInTheDocument() })
  it('hides when signed out', () => { state.user = null; render(<DeleteAccount />); expect(screen.queryByText('מחק את החשבון')).not.toBeInTheDocument() })
  it('requires exact typed confirmation and supports cancel', async () => {
    render(<DeleteAccount />); fireEvent.click(screen.getByText('מחק את החשבון'))
    expect(screen.getByRole('button', { name: 'מחק לצמיתות' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('אישור מחיקת חשבון'), { target: { value: 'delete' } })
    expect(screen.getByRole('button', { name: 'מחק לצמיתות' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' })); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it('calls only the self RPC, blocks duplicate calls and keeps Hebrew errors', async () => {
    let resolve: (value: { error: { message: string } }) => void = () => {}
    state.rpc.mockImplementation(() => new Promise(r => { resolve = r }))
    render(<DeleteAccount />); fireEvent.click(screen.getByText('מחק את החשבון'))
    fireEvent.change(screen.getByLabelText('אישור מחיקת חשבון'), { target: { value: 'מחק את החשבון' } })
    const button = screen.getByRole('button', { name: 'מחק לצמיתות' }); fireEvent.click(button); fireEvent.click(button)
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith('delete_my_account')
    expect(button).toBeDisabled(); expect(screen.getByRole('button', { name: 'ביטול' })).toBeDisabled()
    resolve({ error: { message: 'database internal details' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('לא הצלחנו למחוק')
    expect(screen.queryByText('database internal details')).not.toBeInTheDocument()
    expect(state.signOut).not.toHaveBeenCalled()
  })
})
