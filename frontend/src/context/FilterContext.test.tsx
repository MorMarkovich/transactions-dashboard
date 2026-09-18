import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterProvider, useDashboardFilters } from './FilterContext'

function Probe() {
  const { category, subcategories, setCategory, setSubcategories } = useDashboardFilters()
  return <div>
    <span data-testid="value">{category}/{subcategories.join(',')}</span>
    <button onClick={() => setCategory('מזון')}>category</button>
    <button onClick={() => setSubcategories(['סופר קטן', 'סופר גדול'])}>subcategories</button>
    <button onClick={() => setCategory('תחבורה')}>change category</button>
  </div>
}

describe('FilterProvider', () => {
  beforeEach(() => localStorage.clear())

  it('persists multiple subcategories across remount/navigation', async () => {
    const user = userEvent.setup()
    const first = render(<FilterProvider><Probe /></FilterProvider>)
    await user.click(screen.getByText('category'))
    await user.click(screen.getByText('subcategories'))
    expect(screen.getByTestId('value')).toHaveTextContent('מזון/סופר קטן,סופר גדול')
    first.unmount()
    render(<FilterProvider><Probe /></FilterProvider>)
    expect(screen.getByTestId('value')).toHaveTextContent('מזון/סופר קטן,סופר גדול')
  })

  it('migrates the previous singular saved filter', () => {
    localStorage.setItem('transactions-dashboard:filters:v1', JSON.stringify({ category: 'מזון', subcategory: 'סופר קטן' }))
    render(<FilterProvider><Probe /></FilterProvider>)
    expect(screen.getByTestId('value')).toHaveTextContent('מזון/סופר קטן')
  })

  it('clears incompatible subcategories when the category changes', async () => {
    const user = userEvent.setup()
    render(<FilterProvider><Probe /></FilterProvider>)
    await user.click(screen.getByText('category'))
    await user.click(screen.getByText('subcategories'))
    await user.click(screen.getByText('change category'))
    expect(screen.getByTestId('value')).toHaveTextContent('תחבורה/')
  })
})
