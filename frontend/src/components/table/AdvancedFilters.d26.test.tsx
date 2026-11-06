import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

let AdvancedFilters: typeof import('./AdvancedFilters').default
let isInvalidAmountInput: typeof import('./AdvancedFilters').isInvalidAmountInput
beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key')
  const m = await import('./AdvancedFilters')
  AdvancedFilters = m.default
  isInvalidAmountInput = m.isInvalidAmountInput
})

// Domain26 F5: amount-range input contract in handleApply.
// - negative or NaN amounts are rejected with an explicit Hebrew note and do NOT apply
// - max=0 is a VALID bound and applies
function setup() {
  const onFilterChange = vi.fn()
  render(<AdvancedFilters onFilterChange={onFilterChange} categories={['אוכל']} />)
  fireEvent.click(screen.getByText('מתקדם'))
  const min = screen.getByPlaceholderText('מינימום')
  const max = screen.getByPlaceholderText('מקסימום')
  const apply = screen.getByText('החל סינון')
  return { onFilterChange, min, max, apply }
}

describe('AdvancedFilters amount validation (D26 F5)', () => {
  it('rejects a negative min with a Hebrew note and does not apply', () => {
    const { onFilterChange, min, apply } = setup()
    fireEvent.change(min, { target: { value: '-50' } })
    fireEvent.click(apply)
    expect(screen.getByRole('status').textContent).toBe('נא להזין סכומים חיוביים תקינים')
    expect(onFilterChange).not.toHaveBeenCalled()
  })

  it('rejects a negative max and does not apply', () => {
    const { onFilterChange, max, apply } = setup()
    fireEvent.change(max, { target: { value: '-50' } })
    fireEvent.click(apply)
    expect(screen.getByRole('status').textContent).toBe('נא להזין סכומים חיוביים תקינים')
    expect(onFilterChange).not.toHaveBeenCalled()
  })

  it('isInvalidAmountInput flags NaN text (mobile keyboards that bypass type=number sanitizing)', () => {
    expect(isInvalidAmountInput('abc')).toBe(true)
    expect(isInvalidAmountInput('-5')).toBe(true)
    expect(isInvalidAmountInput('')).toBe(false)
    expect(isInvalidAmountInput('0')).toBe(false)
    expect(isInvalidAmountInput('12.34')).toBe(false)
  })

  it('applies max=0 as a valid bound', () => {
    const { onFilterChange, max, apply } = setup()
    fireEvent.change(max, { target: { value: '0' } })
    fireEvent.click(apply)
    expect(onFilterChange).toHaveBeenCalledTimes(1)
    expect(onFilterChange.mock.calls[0][0].maxAmount).toBe(0)
  })

  it('still swaps a reversed range with a note (existing behavior intact)', () => {
    const { onFilterChange, min, max, apply } = setup()
    fireEvent.change(min, { target: { value: '1000' } })
    fireEvent.change(max, { target: { value: '100' } })
    fireEvent.click(apply)
    expect(onFilterChange).toHaveBeenCalledTimes(1)
    const f = onFilterChange.mock.calls[0][0]
    expect(f.minAmount).toBe(100)
    expect(f.maxAmount).toBe(1000)
    expect(screen.getByRole('status').textContent).toContain('החלפנו')
  })
})
