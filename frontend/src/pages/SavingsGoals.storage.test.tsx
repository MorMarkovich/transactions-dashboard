import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
// Storage-integrity tests for SavingsGoals: corrupt/malformed localStorage data
// must never crash the app or render NaN, valid entries are recovered, the
// original raw value is preserved under a backup key, and a failed persist is
// never shown as saved. (Domain-36 audit, 2026-11-06.)
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-storage-1' } }),
}))

import SavingsGoals from './SavingsGoals'

const KEY = 'savings-goals-user-user-storage-1'
const BACKUP_KEY = `${KEY}-corrupt-backup`

const validGoal = {
  id: 'g1', name: 'חופשה', target_amount: 1000, current_amount: 800,
  category: 'חופשה', color: '#34d399', created_at: '2026-01-01T00:00:00.000Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SavingsGoals />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  cleanup()
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('SavingsGoals storage integrity', () => {
  it('loads valid stored goals and keeps them across remounts', () => {
    localStorage.setItem(KEY, JSON.stringify([validGoal]))
    const first = renderPage()
    expect(screen.getByRole('heading', { name: 'חופשה' })).toBeTruthy()
    first.unmount()
    renderPage()
    expect(screen.getByRole('heading', { name: 'חופשה' })).toBeTruthy()
    expect(screen.getAllByText(/₪800\.00/).length).toBeGreaterThan(0)
  })

  it('valid-JSON non-array value: no crash, empty state, original raw preserved, not overwritten', () => {
    localStorage.setItem(KEY, '{}')
    renderPage()
    expect(screen.getByText('עדיין לא הגדרת יעדי חיסכון')).toBeTruthy()
    expect(localStorage.getItem(KEY)).toBe('{}') // original untouched
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{}') // preserved for recovery
  })

  it('unparseable JSON: no crash, empty state, raw preserved in backup', () => {
    localStorage.setItem(KEY, 'not-json{{{')
    renderPage()
    expect(screen.getByText('עדיין לא הגדרת יעדי חיסכון')).toBeTruthy()
    expect(localStorage.getItem(KEY)).toBe('not-json{{{')
    expect(localStorage.getItem(BACKUP_KEY)).toBe('not-json{{{')
  })

  it('recovers valid entries from a partially malformed array; no NaN anywhere; raw backed up', () => {
    const raw = JSON.stringify([validGoal, { id: 'x', name: 'שבור' }])
    localStorage.setItem(KEY, raw)
    renderPage()
    expect(screen.getByRole('heading', { name: 'חופשה' })).toBeTruthy()
    expect(screen.queryByText('שבור')).toBeNull()
    expect(screen.queryByText(/NaN/)).toBeNull()
    expect(screen.getAllByText(/₪800\.00/).length).toBeGreaterThan(0) // amounts intact
    expect(localStorage.getItem(BACKUP_KEY)).toBe(raw)
  })

  it('drops null-amount entries (JSON-round-tripped NaN/Infinity) without rendering NaN', () => {
    localStorage.setItem(KEY, JSON.stringify([validGoal, { ...validGoal, id: 'g2', target_amount: null }]))
    renderPage()
    expect(screen.getByText('יעדים (1)')).toBeTruthy()
    expect(screen.queryByText(/NaN/)).toBeNull()
  })

  it('after corrupt load, adding a goal persists it and the original backup stays intact', async () => {
    localStorage.setItem(KEY, '{}')
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /הוסף יעד/ }))
    await user.type(screen.getByLabelText('שם היעד'), 'יעד חדש')
    await user.type(screen.getByLabelText(/סכום יעד/), '500')
    await user.click(screen.getByRole('button', { name: /^הוסף$/ }))
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('יעד חדש')
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{}') // original preserved
  })

  it('a different later corrupt raw is preserved under a versioned backup key, earlier backup untouched', () => {
    localStorage.setItem(KEY, '{}')
    const first = renderPage()
    first.unmount()
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{}')
    localStorage.setItem(KEY, '42')
    renderPage()
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{}') // earlier backup untouched
    expect(localStorage.getItem(`${KEY}-corrupt-backup-2`)).toBe('42') // new raw also preserved
    expect(localStorage.getItem(KEY)).toBe('42') // main key never overwritten
  })

  it('same corrupt raw reloaded does not duplicate backups', () => {
    localStorage.setItem(KEY, '{}')
    const first = renderPage()
    first.unmount()
    renderPage()
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{}')
    expect(localStorage.getItem(`${KEY}-corrupt-backup-2`)).toBeNull()
  })

  it('backup write fails at load, then a later save retries and preserves the original before writing', async () => {
    localStorage.setItem(KEY, '{}')
    // key-specific intermittent failure: only backup writes fail at load time
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k: string) => {
      if (k.includes('corrupt-backup')) throw new DOMException('QuotaExceededError')
    })
    renderPage()
    expect(screen.getByText('עדיין לא הגדרת יעדי חיסכון')).toBeTruthy()
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull() // backup genuinely failed
    spy.mockRestore() // quota freed later
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /הוסף יעד/ }))
    await user.type(screen.getByLabelText('שם היעד'), 'יעד חדש')
    await user.type(screen.getByLabelText(/סכום יעד/), '500')
    await user.click(screen.getByRole('button', { name: /^הוסף$/ }))
    // original raw preserved first, then the new goal saved - no silent loss
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{}')
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('יעד חדש')
    expect(screen.queryByText(/השמירה נכשלה/)).toBeNull()
  })

  it('save refused while the corrupt original cannot be preserved: error shown, original raw intact', async () => {
    localStorage.setItem(KEY, '{}')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k: string) => {
      if (k.includes('corrupt-backup')) throw new DOMException('QuotaExceededError')
    })
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /הוסף יעד/ }))
    await user.type(screen.getByLabelText('שם היעד'), 'לא יישמר')
    await user.type(screen.getByLabelText(/סכום יעד/), '500')
    await user.click(screen.getByRole('button', { name: /^הוסף$/ }))
    expect(screen.getByText(/השמירה נכשלה/)).toBeTruthy()
    expect(localStorage.getItem(KEY)).toBe('{}') // original raw NOT overwritten
    expect(screen.queryByRole('heading', { name: 'לא יישמר' })).toBeNull()
  })

  it('persist failure on add-goal: error shown, goal NOT shown as saved', async () => {
    renderPage()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /הוסף יעד/ }))
    await user.type(screen.getByLabelText('שם היעד'), 'לא יישמר')
    await user.type(screen.getByLabelText(/סכום יעד/), '500')
    await user.click(screen.getByRole('button', { name: /^הוסף$/ }))
    expect(screen.getByText(/השמירה נכשלה/)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'לא יישמר' })).toBeNull()
  })

  it('persist failure on add-funds: error shown, amount not applied, editor stays open', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ ...validGoal, current_amount: 0 }]))
    renderPage()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /הוסף כסף/ }))
    await user.type(screen.getByPlaceholderText('סכום'), '250')
    await user.click(screen.getByTitle('אישור'))
    expect(screen.getByRole('alert').textContent).toContain('השמירה נכשלה')
    expect(screen.getByPlaceholderText('סכום')).toBeTruthy() // editor still open
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]')
    expect(stored[0].current_amount).toBe(0) // stored amount unchanged
  })

  it('persist failure on delete: goal kept, error shown', async () => {
    localStorage.setItem(KEY, JSON.stringify([validGoal]))
    renderPage()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    const user = userEvent.setup()
    await user.click(screen.getByTitle('מחק יעד'))
    await user.click(screen.getByRole('button', { name: 'למחוק?' }))
    expect(screen.getByRole('alert').textContent).toContain('השמירה נכשלה')
    expect(screen.getByRole('heading', { name: 'חופשה' })).toBeTruthy()
  })
})
