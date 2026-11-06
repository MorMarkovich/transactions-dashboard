// Regression tests for R11 (date chips off-by-one) and R12 (chip dates lost).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// --- R11: toISODate must use the local calendar, not UTC ---
import { toISODate } from '../utils/date'

describe('toISODate (R11)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('00:30 in Asia/Jerusalem is still today, not yesterday', () => {
    vi.setSystemTime(new Date('2026-11-06T00:30:00+02:00'))
    expect(toISODate(new Date())).toBe('2026-11-06')
  })

  it('local midnight on the 1st of a month stays the 1st', () => {
    vi.setSystemTime(new Date('2026-11-15T12:00:00+02:00'))
    expect(toISODate(new Date(2026, 10, 1))).toBe('2026-11-01')
  })
})

// --- R12: AdvancedFilters must keep parent-driven (chip) dates on emit ---
import AdvancedFilters from '../components/table/AdvancedFilters'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../services/supabaseApi', () => ({
  supabaseApi: new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }),
}))

function Harness({ onEmit }: { onEmit: (f: Record<string, unknown>) => void }) {
  // Mimics the Transactions page: a date chip sets dates outside the child,
  // then the user types a search term.
  const [initial, setInitial] = useState<Record<string, string> | undefined>(undefined)
  return (
    <>
      <button onClick={() => setInitial({ startDate: '2026-11-01', endDate: '2026-11-06' })}>
        chip-month
      </button>
      <AdvancedFilters
        initial={initial}
        onFilterChange={onEmit}
        categories={['אוכל']}
      />
    </>
  )
}

describe('AdvancedFilters chip-date retention (R12)', () => {
  it('search emit keeps dates that were set by a date chip', async () => {
    const emitted: Record<string, unknown>[] = []
    render(<Harness onEmit={(f) => emitted.push(f)} />)
    const user = userEvent.setup()
    await user.click(screen.getByText('chip-month'))
    await user.type(screen.getByPlaceholderText(/חיפוש|חפש/), 'temu')
    await waitFor(
      () => {
        const last = emitted[emitted.length - 1]
        expect(last).toBeTruthy()
        expect(last.search).toBe('temu')
        expect(last.startDate).toBe('2026-11-01')
        expect(last.endDate).toBe('2026-11-06')
      },
      { timeout: 2000 },
    )
  })
})
