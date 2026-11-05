import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const updateDisplayName = vi.fn()
const updateEmail = vi.fn()
const updatePassword = vi.fn()
const signOut = vi.fn()

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'mor@example.com', user_metadata: { full_name: 'Mor M' } },
    updateDisplayName,
    updateEmail,
    updatePassword,
    signOut,
  }),
}))

import AccountSettings from './AccountSettings'

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountSettings />
    </MemoryRouter>
  )
}

describe('AccountSettings', () => {
  beforeEach(() => {
    updateDisplayName.mockReset()
    updateEmail.mockReset()
    updatePassword.mockReset()
    updateDisplayName.mockResolvedValue({ error: null })
    updateEmail.mockResolvedValue({ error: null })
    updatePassword.mockResolvedValue({ error: null })
    signOut.mockReset()
    signOut.mockResolvedValue(undefined)
  })

  it('shows the current name and email', () => {
    renderPage()
    expect(screen.getByText('Mor M')).toBeTruthy()
    expect(screen.getAllByText('mor@example.com').length).toBeGreaterThan(0)
  })

  it('saves a changed display name', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('שם מלא'), { target: { value: 'Mor New' } })
    fireEvent.click(screen.getByRole('button', { name: 'שמור' }))
    await waitFor(() => expect(updateDisplayName).toHaveBeenCalledWith('Mor New'))
    expect(await screen.findByText('השם עודכן')).toBeTruthy()
  })

  it('rejects an unchanged display name', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'שמור' }))
    expect(await screen.findByText('השם לא השתנה')).toBeTruthy()
    expect(updateDisplayName).not.toHaveBeenCalled()
  })

  it('submits an email change and explains the confirmation step', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('כתובת מייל חדשה'), { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'עדכן מייל' }))
    await waitFor(() => expect(updateEmail).toHaveBeenCalledWith('new@example.com'))
    expect(await screen.findByText(/נשלחו מיילי אימות גם לכתובת הנוכחית/)).toBeTruthy()
  })

  it('rejects a password change when the confirmation does not match', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('סיסמה חדשה'), { target: { value: 'secret1' } })
    fireEvent.change(screen.getByLabelText('אימות סיסמה חדשה'), { target: { value: 'secret2' } })
    fireEvent.click(screen.getByRole('button', { name: 'עדכן סיסמה' }))
    expect(await screen.findByText('הסיסמאות לא תואמות')).toBeTruthy()
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('saves a valid new password', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('סיסמה חדשה'), { target: { value: 'secret1' } })
    fireEvent.change(screen.getByLabelText('אימות סיסמה חדשה'), { target: { value: 'secret1' } })
    fireEvent.click(screen.getByRole('button', { name: 'עדכן סיסמה' }))
    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('secret1'))
    expect(await screen.findByText('הסיסמה עודכנה')).toBeTruthy()
  })

  it('signs out from the page header action', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'התנתק' }))
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce())
  })

  it('points to Data Management for account deletion', () => {
    renderPage()
    const link = screen.getByRole('link', { name: 'ניהול מידע' })
    expect(link.getAttribute('href')).toBe('/data-management')
  })
})
