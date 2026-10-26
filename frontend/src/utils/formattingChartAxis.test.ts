import { describe, expect, it } from 'vitest'
import { currentMonthKey, monthKeyNum, niceCeil } from './formatting'

describe('niceCeil', () => {
  it('rounds up to nice 1/1.2/1.5/2/2.5/3/4/5/6/8/10 steps', () => {
    expect(niceCeil(33472.61)).toBe(40000) // auditor case: no more 8.5K/17K/25.5K/34K ticks
    expect(niceCeil(1000)).toBe(1000)
    expect(niceCeil(1001)).toBe(1200)
    expect(niceCeil(21000)).toBe(25000)
    expect(niceCeil(7)).toBe(8)
    expect(niceCeil(0)).toBe(1)
    expect(niceCeil(-5)).toBe(1)
  })
})

describe('monthKeyNum / currentMonthKey', () => {
  it('parses MM/YYYY into a comparable key', () => {
    expect(monthKeyNum('03/2026')).toBe(2026 * 12 + 3)
    expect(monthKeyNum('11/2026')).toBeGreaterThan(monthKeyNum('03/2026')!)
    expect(monthKeyNum('bad')).toBeNull()
  })
  it('current month parses to a key', () => {
    expect(monthKeyNum(currentMonthKey(new Date('2026-10-26T10:00:00+02:00')))).toBe(2026 * 12 + 10)
  })
})
