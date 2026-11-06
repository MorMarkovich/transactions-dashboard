import { describe, expect, it } from 'vitest'
import { mergeDroppedRows, summarizeDroppedRows } from './droppedRows'

describe('summarizeDroppedRows', () => {
  it('warns on invalid_amount with the count and Hebrew reason', () => {
    const s = summarizeDroppedRows({ invalid_amount: 3 })
    expect(s?.level).toBe('warning')
    expect(s?.invalidCount).toBe(3)
    expect(s?.text).toContain('3')
    expect(s?.text).toContain('סכום לא תקין')
    expect(s?.text).toContain('חסרות מכל הדוחות')
  })

  it('warns on invalid_date and combines both invalid reasons', () => {
    const s = summarizeDroppedRows({ invalid_amount: 2, invalid_date: 1 })
    expect(s?.level).toBe('warning')
    expect(s?.invalidCount).toBe(3)
    expect(s?.text).toContain('סכום לא תקין')
    expect(s?.text).toContain('תאריך לא תקין')
  })

  it('mentions routine rows as secondary when invalid rows exist', () => {
    const s = summarizeDroppedRows({ invalid_amount: 1, blank: 5 })
    expect(s?.level).toBe('warning')
    expect(s?.routineCount).toBe(5)
    expect(s?.text).toContain('5')
  })

  it('stays informational for routine-only drops (summary/blank/zero)', () => {
    const s = summarizeDroppedRows({ summary: 4, blank: 2, zero_amount: 1 })
    expect(s?.level).toBe('info')
    expect(s?.invalidCount).toBe(0)
    expect(s?.routineCount).toBe(7)
    expect(s?.text).toContain('תקין')
  })

  it('returns null when nothing was dropped', () => {
    expect(summarizeDroppedRows({})).toBeNull()
    expect(summarizeDroppedRows({ blank: 0, invalid_amount: 0 })).toBeNull()
  })
})

describe('mergeDroppedRows', () => {
  it('sums counts across files and skips junk', () => {
    const acc: Record<string, number> = {}
    mergeDroppedRows(acc, { invalid_amount: 2, blank: 1 })
    mergeDroppedRows(acc, { invalid_amount: 1, summary: 3 })
    mergeDroppedRows(acc, undefined)
    mergeDroppedRows(acc, { blank: -5 })
    expect(acc).toEqual({ invalid_amount: 3, blank: 1, summary: 3 })
  })
})
