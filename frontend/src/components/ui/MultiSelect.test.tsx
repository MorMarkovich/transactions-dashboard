import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MultiSelect from './MultiSelect'

function Harness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState<string[]>([])
  return <MultiSelect
    options={['סופר קטן', 'סופר גדול', 'תת קטגוריה עם שם ארוך במיוחד לבדיקת גלישה במובייל']}
    value={value}
    onChange={setValue}
    placeholder="כל תתי-הקטגוריות"
    ariaLabel="בחירת מספר תתי-קטגוריות"
    disabled={disabled}
  />
}

describe('MultiSelect', () => {
  it('selects several items and deselects one independently', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'בחירת מספר תתי-קטגוריות' }))
    await user.click(screen.getByRole('option', { name: /סופר קטן/ }))
    await user.click(screen.getByRole('option', { name: /סופר גדול/ }))
    expect(screen.getByText('2 נבחרו')).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: /סופר קטן/ }))
    expect(screen.getByText('1 נבחרו')).toBeInTheDocument()
  })

  it('clears all selected items', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'בחירת מספר תתי-קטגוריות' }))
    await user.click(screen.getByRole('option', { name: /סופר קטן/ }))
    await user.click(screen.getByRole('button', { name: /ניקוי הבחירה/ }))
    expect(screen.getByText('כל תתי-הקטגוריות')).toBeInTheDocument()
  })

  it('does not open while its category is unavailable', async () => {
    const user = userEvent.setup()
    render(<Harness disabled />)
    const trigger = screen.getByRole('button', { name: 'בחירת מספר תתי-קטגוריות' })
    expect(trigger).toBeDisabled()
    await user.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
