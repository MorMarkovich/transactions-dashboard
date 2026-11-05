import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const updateUser = vi.fn()
const getSession = vi.fn()
let authCallback: ((event: string) => void) | null = null

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: (...a: unknown[]) => updateUser(...a),
      getSession: () => getSession(),
      onAuthStateChange: (cb: (event: string) => void) => {
        authCallback = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  },
}))

import ResetPassword from './ResetPassword'

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>
  )
}

describe('ResetPassword', () => {
  beforeEach(() => {
    updateUser.mockReset()
    getSession.mockReset()
    getSession.mockResolvedValue({ data: { session: null } })
    authCallback = null
    window.location.hash = ''
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in the verifying state', () => {
    renderPage()
    expect(screen.getByText('מאמת את הקישור…')).toBeTruthy()
  })

  it('shows the new-password form after a PASSWORD_RECOVERY event', async () => {
    renderPage()
    act(() => authCallback?.('PASSWORD_RECOVERY'))
    expect(await screen.findByText('בחירת סיסמה חדשה 🔑')).toBeTruthy()
  })

  it('falls back to the recovery hash when the event fired before mount', async () => {
    window.location.hash = '#access_token=abc&type=recovery'
    getSession.mockResolvedValue({ data: { session: { access_token: 'abc' } } })
    renderPage()
    expect(await screen.findByText('בחירת סיסמה חדשה 🔑')).toBeTruthy()
  })

  it('marks a link with no recovery event as invalid', async () => {
    vi.useFakeTimers()
    renderPage()
    await act(async () => { vi.advanceTimersByTime(6000) })
    expect(screen.getByText('הקישור לא תקין 🔑')).toBeTruthy()
  })

  it('rejects mismatched passwords without calling updateUser', async () => {
    renderPage()
    act(() => authCallback?.('PASSWORD_RECOVERY'))
    await screen.findByText('בחירת סיסמה חדשה 🔑')
    fireEvent.change(screen.getByLabelText('סיסמה חדשה'), { target: { value: 'secret1' } })
    fireEvent.change(screen.getByLabelText('אימות סיסמה חדשה'), { target: { value: 'secret2' } })
    fireEvent.click(screen.getByRole('button', { name: 'שמור סיסמה חדשה' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('הסיסמאות לא תואמות')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('rejects a too-short password', async () => {
    renderPage()
    act(() => authCallback?.('PASSWORD_RECOVERY'))
    await screen.findByText('בחירת סיסמה חדשה 🔑')
    fireEvent.change(screen.getByLabelText('סיסמה חדשה'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText('אימות סיסמה חדשה'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: 'שמור סיסמה חדשה' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('6+')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('saves the new password and shows the success state', async () => {
    updateUser.mockResolvedValue({ error: null })
    renderPage()
    act(() => authCallback?.('PASSWORD_RECOVERY'))
    await screen.findByText('בחירת סיסמה חדשה 🔑')
    fireEvent.change(screen.getByLabelText('סיסמה חדשה'), { target: { value: 'secret1' } })
    fireEvent.change(screen.getByLabelText('אימות סיסמה חדשה'), { target: { value: 'secret1' } })
    fireEvent.click(screen.getByRole('button', { name: 'שמור סיסמה חדשה' }))
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'secret1' }))
    expect(await screen.findByText('הסיסמה עודכנה ✓')).toBeTruthy()
  })

  it('surfaces a Supabase error to the user', async () => {
    updateUser.mockResolvedValue({ error: { message: 'weak password' } })
    renderPage()
    act(() => authCallback?.('PASSWORD_RECOVERY'))
    await screen.findByText('בחירת סיסמה חדשה 🔑')
    fireEvent.change(screen.getByLabelText('סיסמה חדשה'), { target: { value: 'secret1' } })
    fireEvent.change(screen.getByLabelText('אימות סיסמה חדשה'), { target: { value: 'secret1' } })
    fireEvent.click(screen.getByRole('button', { name: 'שמור סיסמה חדשה' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('weak password')
  })
})
