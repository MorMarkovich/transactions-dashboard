import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

// Filters are persisted per signed-in user; drive the real AuthProvider with a
// mocked Supabase session.
const currentSession: { user: { id: string }; access_token: string } | null =
  { user: { id: 'test-user' }, access_token: 't' }

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: currentSession } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))

import { AuthProvider } from '../lib/AuthContext'
import { FilterProvider, useDashboardFilters } from './FilterContext'
import { scoped, quarantineKey, FILTERS_BASE } from '../lib/userStorage'

function Probe() {
  const { category, subcategories, setCategory, setSubcategories } = useDashboardFilters()
  return <div>
    <span data-testid="value">{category}/{subcategories.join(',')}</span>
    <button onClick={() => setCategory('מזון')}>category</button>
    <button onClick={() => setSubcategories(['סופר קטן', 'סופר גדול'])}>subcategories</button>
    <button onClick={() => setCategory('תחבורה')}>change category</button>
  </div>
}

const renderAuthed = async (ui: ReactNode) => {
  const view = render(<AuthProvider>{ui}</AuthProvider>)
  await act(async () => {}) // resolve the mocked getSession
  return view
}

describe('FilterProvider (signed-in)', () => {
  beforeEach(() => { cleanup(); localStorage.clear() })

  it('persists multiple subcategories across remount/navigation, under the user-scoped key', async () => {
    const user = userEvent.setup()
    const first = await renderAuthed(<FilterProvider><Probe /></FilterProvider>)
    await user.click(screen.getByText('category'))
    await user.click(screen.getByText('subcategories'))
    expect(screen.getByTestId('value')).toHaveTextContent('מזון/סופר קטן,סופר גדול')
    expect(localStorage.getItem(scoped(FILTERS_BASE, 'test-user'))).toContain('סופר גדול')
    expect(localStorage.getItem(FILTERS_BASE)).toBeNull()
    first.unmount()
    await renderAuthed(<FilterProvider><Probe /></FilterProvider>)
    expect(screen.getByTestId('value')).toHaveTextContent('מזון/סופר קטן,סופר גדול')
  })

  it('does not inherit the legacy global key (unknown owner); it is quarantined', async () => {
    localStorage.setItem(FILTERS_BASE, JSON.stringify({ category: 'מזון', subcategory: 'סופר קטן' }))
    await renderAuthed(<FilterProvider><Probe /></FilterProvider>)
    await waitFor(() => expect(screen.getByTestId('value')).toBeInTheDocument())
    expect(screen.getByTestId('value')).toHaveTextContent('/')
    expect(localStorage.getItem(FILTERS_BASE)).toBeNull()
    expect(localStorage.getItem(quarantineKey(FILTERS_BASE))).toContain('סופר קטן')
  })

  it('still normalizes the old singular subcategory shape in a user-scoped key', async () => {
    localStorage.setItem(scoped(FILTERS_BASE, 'test-user'), JSON.stringify({ category: 'מזון', subcategory: 'סופר קטן' }))
    await renderAuthed(<FilterProvider><Probe /></FilterProvider>)
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('מזון/סופר קטן'))
  })

  it('clears incompatible subcategories when the category changes', async () => {
    const user = userEvent.setup()
    await renderAuthed(<FilterProvider><Probe /></FilterProvider>)
    await user.click(screen.getByText('category'))
    await user.click(screen.getByText('subcategories'))
    await user.click(screen.getByText('change category'))
    expect(screen.getByTestId('value')).toHaveTextContent('תחבורה/')
  })
})

describe('FilterProvider (no auth)', () => {
  beforeEach(() => { cleanup(); localStorage.clear() })

  it('works in memory without an AuthProvider and persists nothing', async () => {
    const user = userEvent.setup()
    render(<FilterProvider><Probe /></FilterProvider>)
    await user.click(screen.getByText('category'))
    expect(screen.getByTestId('value')).toHaveTextContent('מזון/')
    expect(localStorage.length).toBe(0)
  })
})
