import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {expect, it, vi} from 'vitest'
import CategoryTransactionsDrawer from './CategoryTransactionsDrawer'
import type {Transaction} from '../../services/types'

const tx = {id: 1, תיאור: 'עסק לדוגמה', תאריך: '2026-10-01', סכום: -12, קטגוריה: 'אוכל', קטגוריה_משנה: 'סופרים קטנים'} as Transaction

function propsFor(extra: Partial<Parameters<typeof CategoryTransactionsDrawer>[0]> = {}) {
  return {
    isOpen: true, onClose: vi.fn(), category: 'אוכל', month: '10/2026',
    transactions: [tx], total: 12,
    onCategoryChange: vi.fn().mockResolvedValue(undefined),
    onSubcategoryChange: vi.fn().mockResolvedValue(undefined),
    subcategoryOptions: ['סופרים קטנים', 'קניות גדולות'],
    ...extra,
  }
}

it('re-clicking a staged subcategory chip unstages it (nothing is saved)', async () => {
  const user = userEvent.setup()
  const props = propsFor()
  render(<CategoryTransactionsDrawer {...props} />)
  await user.click(screen.getByRole('button', {name: /ערוך קטגוריה:/}))
  await user.click(screen.getByRole('button', {name: /קניות גדולות/}))
  await user.click(screen.getByRole('button', {name: /קניות גדולות/}))
  // Back to the original state: nothing dirty -> save disabled.
  expect(screen.getByRole('button', {name: 'שמור שינויים'})).toBeDisabled()
  expect(props.onSubcategoryChange).not.toHaveBeenCalled()
})

it('after picking a new category, the old subcategory is not shown as selected', async () => {
  const user = userEvent.setup()
  const props = propsFor()
  render(<CategoryTransactionsDrawer {...props} />)
  await user.click(screen.getByRole('button', {name: /ערוך קטגוריה:/}))
  // Old sub selected under the current parent:
  expect(screen.getByRole('button', {name: /נקה תת-קטגוריה/})).toBeInTheDocument()
  await user.click(screen.getByRole('button', {name: /בילויים/}))
  // Now the old sub must not be offered/selected under the new parent:
  expect(screen.queryByRole('button', {name: /נקה תת-קטגוריה/})).not.toBeInTheDocument()
  expect(screen.queryByRole('button', {name: /סופרים קטנים/})).not.toBeInTheDocument()
})

it('unlocking a pinned row without other changes saves the unpin', async () => {
  const user = userEvent.setup()
  const locked = {...tx, _locked: true} as Transaction
  const props = propsFor({transactions: [locked]})
  render(<CategoryTransactionsDrawer {...props} />)
  await user.click(screen.getByRole('button', {name: /ערוך קטגוריה:/}))
  const pinBox = screen.getByRole('checkbox')
  expect(pinBox).toBeChecked()
  await user.click(pinBox) // unpin only
  const save = screen.getByRole('button', {name: 'שמור שינויים'})
  expect(save).toBeEnabled()
  await user.click(save)
  expect(props.onCategoryChange).toHaveBeenCalledWith(locked, 'אוכל', false)
})

it('pinning an unpinned row without other changes pins exactly the current state', async () => {
  const user = userEvent.setup()
  const props = propsFor()
  render(<CategoryTransactionsDrawer {...props} />)
  await user.click(screen.getByRole('button', {name: /ערוך קטגוריה:/}))
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', {name: 'שמור שינויים'}))
  // subcategory pin path preserves the current subcategory:
  expect(props.onSubcategoryChange).toHaveBeenCalledWith(tx, 'סופרים קטנים', true)
  expect(props.onCategoryChange).not.toHaveBeenCalled()
})

it('the classification search is cleared when switching to edit another row', async () => {
  const user = userEvent.setup()
  const tx2 = {id: 2, תיאור: 'עסק שני', תאריך: '2026-10-02', סכום: -5, קטגוריה: 'אוכל', קטגוריה_משנה: ''} as Transaction
  const props = propsFor({transactions: [tx, tx2]})
  render(<CategoryTransactionsDrawer {...props} />)
  await user.click(screen.getByRole('button', {name: /ערוך קטגוריה: עסק לדוגמה/}))
  await user.type(screen.getByRole('textbox', {name: 'חיפוש קטגוריות ותתי קטגוריות'}), 'קפה')
  await user.click(screen.getByRole('button', {name: /בטל/}))
  await user.click(screen.getByRole('button', {name: /ערוך קטגוריה: עסק שני/}))
  expect(screen.getByRole('textbox', {name: 'חיפוש קטגוריות ותתי קטגוריות'})).toHaveValue('')
})

it("free-text category named 'אחר' is rejected with an inline error", async () => {
  const user = userEvent.setup()
  const props = propsFor()
  render(<CategoryTransactionsDrawer {...props} />)
  await user.click(screen.getByRole('button', {name: /ערוך קטגוריה:/}))
  await user.type(screen.getByPlaceholderText('שם קטגוריה חדשה'), 'אחר{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('שמורה לסיכום')
  expect(props.onCategoryChange).not.toHaveBeenCalled()
  // a normal custom name still stages fine (the rejected text stays in the
  // input so the user can fix it — clear it here):
  await user.clear(screen.getByPlaceholderText('שם קטגוריה חדשה'))
  await user.type(screen.getByPlaceholderText('שם קטגוריה חדשה'), 'קטגוריה שלי{Enter}')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', {name: 'שמור שינויים'}))
  expect(props.onCategoryChange).toHaveBeenCalledWith(tx, 'קטגוריה שלי', false)
})
