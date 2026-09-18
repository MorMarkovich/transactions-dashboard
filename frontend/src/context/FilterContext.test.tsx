import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterProvider, useDashboardFilters } from './FilterContext'

function Probe() {
  const { category, subcategory, setCategory, setSubcategory } = useDashboardFilters()
  return <div>
    <span data-testid="value">{category}/{subcategory}</span>
    <button onClick={() => setCategory('מזון')}>category</button>
    <button onClick={() => setSubcategory('סופר קטן')}>subcategory</button>
    <button onClick={() => setCategory('תחבורה')}>change category</button>
  </div>
}

describe('FilterProvider', () => {
  beforeEach(() => localStorage.clear())

  it('persists category and subcategory across remount/navigation', async () => {
    const user = userEvent.setup()
    const first = render(<FilterProvider><Probe /></FilterProvider>)
    await user.click(screen.getByText('category'))
    await user.click(screen.getByText('subcategory'))
    expect(screen.getByTestId('value')).toHaveTextContent('מזון/סופר קטן')
    first.unmount()
    render(<FilterProvider><Probe /></FilterProvider>)
    expect(screen.getByTestId('value')).toHaveTextContent('מזון/סופר קטן')
  })

  it('clears an incompatible subcategory when the category changes', async () => {
    const user = userEvent.setup()
    render(<FilterProvider><Probe /></FilterProvider>)
    await user.click(screen.getByText('category'))
    await user.click(screen.getByText('subcategory'))
    await user.click(screen.getByText('change category'))
    expect(screen.getByTestId('value')).toHaveTextContent('תחבורה/')
  })
})
