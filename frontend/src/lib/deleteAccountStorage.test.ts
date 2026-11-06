import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({}),
    },
  },
}))
import { clearDeletedAccountStorage } from './deleteAccountStorage'
import { scoped, LAST_SESSION_BASE, SNAPSHOT_SEEN_BASE, FILTERS_BASE, PRESETS_BASE } from './userStorage'

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

  it('clears the account\'s scoped view state and legacy globals, keeping other users\' scoped keys', () => {
    for (const base of [LAST_SESSION_BASE, SNAPSHOT_SEEN_BASE, FILTERS_BASE, PRESETS_BASE]) {
      localStorage.setItem(scoped(base, 'gone'), 'private')
      localStorage.setItem(scoped(base, 'other'), 'keep')
      localStorage.setItem(base, 'legacy')
    }
    clearDeletedAccountStorage('gone')
    for (const base of [LAST_SESSION_BASE, SNAPSHOT_SEEN_BASE, FILTERS_BASE, PRESETS_BASE]) {
      expect(localStorage.getItem(scoped(base, 'gone'))).toBeNull()
      expect(localStorage.getItem(base)).toBeNull()
      expect(localStorage.getItem(scoped(base, 'other'))).toBe('keep')
    }
  })

  it('still finds budget/savings keys via a legacy (unscoped) remembered session', () => {
    localStorage.setItem(LAST_SESSION_BASE, 'sess-9')
    localStorage.setItem('budget-goals-sess-9', 'private')
    localStorage.setItem('savings-goals-sess-9', 'private')
    clearDeletedAccountStorage('gone')
    expect(localStorage.getItem('budget-goals-sess-9')).toBeNull()
    expect(localStorage.getItem('savings-goals-sess-9')).toBeNull()
  })
})
