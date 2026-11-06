import { beforeEach, describe, expect, it, vi } from 'vitest'
// Regression tests for SavingsGoals add-funds validation + delete confirmation.
// Converted from domain-8 audit DEFECT demonstrations (2026-11-06); defects fixed in this branch.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-reg-1' } }),
}))

import SavingsGoals from './SavingsGoals'

const KEY = 'savings-goals-user-user-reg-1'

function renderPage() {
  return render(
    <MemoryRouter>
      <SavingsGoals />
    </MemoryRouter>,
  )
}

async function createGoal(name = 'יעד-רגרסיה', target = '1000') {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /הוסף יעד/ }))
  await user.type(screen.getByLabelText('שם היעד'), name)
  await user.type(screen.getByLabelText(/סכום יעד/), target)
  await user.click(screen.getByRole('button', { name: /^הוסף$/ }))
  return user
}

beforeEach(() => localStorage.clear())

describe('SavingsGoals add-funds validation (R7, R8)', () => {
  it('rejects invalid add-funds amount with an explicit error, goal unchanged', async () => {
    renderPage()
    const user = await createGoal()
    await user.click(screen.getByRole('button', { name: /הוסף כסף/ }))
    await user.type(screen.getByPlaceholderText('סכום'), '-50')
    await user.click(screen.getByTitle('אישור'))
    expect(screen.getByRole('alert').textContent).toContain('סכום חיובי')
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]')
    expect(stored[0].current_amount).toBe(0)
  })

  it('rejects add-funds above remaining with explicit remaining message, no silent clamp', async () => {
    renderPage()
    const user = await createGoal('חירום', '1000')
    await user.click(screen.getByRole('button', { name: /הוסף כסף/ }))
    await user.type(screen.getByPlaceholderText('סכום'), '1500')
    await user.click(screen.getByTitle('אישור'))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('נשארו רק')
    expect(alert.textContent).toContain('1,000')
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]')
    expect(stored[0].current_amount).toBe(0)
  })

  it('accepts a valid amount and updates the goal', async () => {
    renderPage()
    const user = await createGoal('חירום', '1000')
    await user.click(screen.getByRole('button', { name: /הוסף כסף/ }))
    await user.type(screen.getByPlaceholderText('סכום'), '250')
    await user.click(screen.getByTitle('אישור'))
    expect(screen.queryByRole('alert')).toBeNull()
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]')
    expect(stored[0].current_amount).toBe(250)
  })

  it('accepts exactly the remaining amount and completes the goal', async () => {
    renderPage()
    const user = await createGoal('חירום', '1000')
    await user.click(screen.getByRole('button', { name: /הוסף כסף/ }))
    await user.type(screen.getByPlaceholderText('סכום'), '1000')
    await user.click(screen.getByTitle('אישור'))
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]')
    expect(stored[0].current_amount).toBe(1000)
  })
})

describe('SavingsGoals delete confirmation (R9)', () => {
  it('one tap on delete does NOT remove the goal; shows confirm + cancel', async () => {
    renderPage()
    const user = await createGoal()
    await user.click(screen.getByTitle('מחק יעד'))
    expect(screen.getByRole('heading', { name: 'יעד-רגרסיה' })).toBeTruthy()
    expect(JSON.parse(localStorage.getItem(KEY) || '[]')).toHaveLength(1)
    const confirmBtn = screen.getByRole('button', { name: 'למחוק?' })
    expect(confirmBtn).toBeTruthy()
    expect(within(confirmBtn.parentElement as HTMLElement).getByRole('button', { name: 'ביטול' })).toBeTruthy()
  })

  it('cancel restores the plain delete button and keeps the goal', async () => {
    renderPage()
    const user = await createGoal()
    await user.click(screen.getByTitle('מחק יעד'))
    const confirmBtn = screen.getByRole('button', { name: 'למחוק?' })
    await user.click(within(confirmBtn.parentElement as HTMLElement).getByRole('button', { name: 'ביטול' }))
    expect(screen.getByTitle('מחק יעד')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem(KEY) || '[]')).toHaveLength(1)
  })

  it('second tap (confirm) deletes the goal', async () => {
    renderPage()
    const user = await createGoal()
    await user.click(screen.getByTitle('מחק יעד'))
    await user.click(screen.getByRole('button', { name: 'למחוק?' }))
    expect(screen.queryByRole('heading', { name: 'יעד-רגרסיה' })).toBeNull()
    expect(JSON.parse(localStorage.getItem(KEY) || '[]')).toHaveLength(0)
  })
})
