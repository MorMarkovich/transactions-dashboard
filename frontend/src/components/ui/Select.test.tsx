import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Select from './Select'

const FEW_OPTIONS = [
  { value: '', label: 'כל המקורות' },
  { value: 'a', label: 'בנק פועלים משכורת' },
  { value: 'b', label: 'ישראכרט מש משכורת' },
]

const MANY_OPTIONS = Array.from({ length: 20 }, (_, i) => ({
  value: `src-${i}`,
  label: i === 7 ? 'מקור עם שם ארוך מאוד שלא נכנס בשורה אחת בשום פנים וצריך להיארך' : `מקור ${i}`,
}))

function Harness({ many = false, disabled = false }: { many?: boolean; disabled?: boolean }) {
  const [value, setValue] = useState(many ? '' : 'a')
  return (
    <Select
      ariaLabel="מקור"
      options={many ? MANY_OPTIONS : FEW_OPTIONS}
      value={value}
      onChange={setValue}
      placeholder="בחר מקור"
      disabled={disabled}
    />
  )
}

describe('Select', () => {
  it('keeps the search row outside the scrollable options region (scroll-leak regression)', async () => {
    const user = userEvent.setup()
    render(<Harness many />)
    await user.click(screen.getByRole('combobox', { name: 'מקור' }))
    const menu = screen.getByRole('listbox', { name: 'מקור' })
    const scroller = menu.querySelector('.ui-select-options')
    expect(scroller).not.toBeNull()
    // Every option lives inside the scroll region...
    for (const opt of screen.getAllByRole('option')) {
      expect(scroller!.contains(opt)).toBe(true)
    }
    // ...and the search row lives outside it, so scrolled options can
    // never slide behind or above the search field.
    const search = screen.getByRole('combobox', { name: 'חיפוש בתוך מקור' })
    expect(scroller!.contains(search)).toBe(false)
    expect(menu.contains(search)).toBe(true)
  })

  it('shows the selected option label on the closed trigger', () => {
    render(<Harness />)
    expect(screen.getByRole('combobox', { name: 'מקור' })).toHaveTextContent('בנק פועלים משכורת')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens on click, selects an option and closes', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('combobox', { name: 'מקור' }))
    expect(screen.getByRole('listbox', { name: 'מקור' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'ישראכרט מש משכורת' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'מקור' })).toHaveTextContent('ישראכרט מש משכורת')
  })

  it('marks the selected option with aria-selected', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('combobox', { name: 'מקור' }))
    expect(screen.getByRole('option', { name: 'בנק פועלים משכורת' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'ישראכרט מש משכורת' })).toHaveAttribute('aria-selected', 'false')
  })

  it('supports full keyboard flow: open, move, select, escape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('combobox', { name: 'מקור' })
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveTextContent('ישראכרט מש משכורת')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes when clicking outside', async () => {
    const user = userEvent.setup()
    render(<div><Harness /><button>בחוץ</button></div>)
    await user.click(screen.getByRole('combobox', { name: 'מקור' }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'בחוץ' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('offers search for long lists and filters options', async () => {
    const user = userEvent.setup()
    render(<Harness many />)
    await user.click(screen.getByRole('combobox', { name: 'מקור' }))
    const search = screen.getByRole('combobox', { name: 'חיפוש בתוך מקור' })
    expect(search).toHaveFocus()
    expect(screen.getAllByRole('option')).toHaveLength(20)
    await user.type(search, 'שם ארוך')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'מקור' })).toHaveTextContent('מקור עם שם ארוך')
  })

  it('shows an empty state when the search matches nothing', async () => {
    const user = userEvent.setup()
    render(<Harness many />)
    await user.click(screen.getByRole('combobox', { name: 'מקור' }))
    await user.type(screen.getByRole('combobox', { name: 'חיפוש בתוך מקור' }), 'zzz')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('אין תוצאות תואמות')).toBeInTheDocument()
  })

  it('does not open while disabled', async () => {
    const user = userEvent.setup()
    render(<Harness disabled />)
    const trigger = screen.getByRole('combobox', { name: 'מקור' })
    expect(trigger).toBeDisabled()
    await user.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
