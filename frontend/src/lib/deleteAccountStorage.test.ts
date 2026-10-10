import { beforeEach, describe, expect, it } from 'vitest'
import { clearDeletedAccountStorage } from './deleteAccountStorage'
describe('account-local cleanup', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
  it('clears deleted account financial settings without clearing another account', () => {
    localStorage.setItem('budget-goals-user-gone', 'private')
    localStorage.setItem('budget-goals-user-other', 'keep')
    localStorage.setItem('customCats:gone', 'private')
    localStorage.setItem('dashboard-views:gone', 'private')
    sessionStorage.setItem('tx-view:v1:session', 'private')
    sessionStorage.setItem('dash-month', 'private')
    clearDeletedAccountStorage('gone')
    expect(localStorage.getItem('budget-goals-user-gone')).toBeNull()
    expect(localStorage.getItem('customCats:gone')).toBeNull()
    expect(localStorage.getItem('dashboard-views:gone')).toBeNull()
    expect(localStorage.getItem('budget-goals-user-other')).toBe('keep')
    expect(sessionStorage.getItem('tx-view:v1:session')).toBeNull()
    expect(sessionStorage.getItem('dash-month')).toBeNull()
  })
})
