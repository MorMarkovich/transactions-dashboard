import { beforeEach, describe, expect, it } from 'vitest'
import { canUseBankSync } from './bankSyncAccess'

describe('bank-sync access', () => {
  beforeEach(() => localStorage.clear())

  it('is visible for the owner account, case-insensitively', () => {
    expect(canUseBankSync('markovich23@gmail.com')).toBe(true)
    expect(canUseBankSync(' Markovich23@Gmail.com ')).toBe(true)
  })

  it('is hidden for every other user and when signed out', () => {
    expect(canUseBankSync('someone@example.com')).toBe(false)
    expect(canUseBankSync(null)).toBe(false)
    expect(canUseBankSync(undefined)).toBe(false)
  })

  it('stays visible where the sync token was already stored', () => {
    localStorage.setItem('bankSyncToken', 'x')
    expect(canUseBankSync('someone@example.com')).toBe(true)
  })
})
