import { describe, it, expect } from 'vitest'
import { formatCompactShekel, ltrIsolate } from './formatting'

// Focused cases for the compact axis formatter used by BarChart, MerchantChart
// and LineChart. All expectations account for the bidi isolate wrapper.
describe('formatCompactShekel', () => {
  it('formats zero', () => {
    expect(formatCompactShekel(0)).toBe(ltrIsolate('₪0'))
  })

  it('passes through sub-threshold values untouched', () => {
    expect(formatCompactShekel(999)).toBe(ltrIsolate('₪999'))
    expect(formatCompactShekel(12.5)).toBe(ltrIsolate('₪12.5'))
  })

  it('formats thousands at and above the K threshold', () => {
    expect(formatCompactShekel(1000)).toBe(ltrIsolate('₪1K'))
    expect(formatCompactShekel(1500)).toBe(ltrIsolate('₪1.5K'))
    expect(formatCompactShekel(999_999)).toBe(ltrIsolate('₪1000K'))
  })

  it('formats millions with the M tier (regression: was ₪1500K)', () => {
    expect(formatCompactShekel(1_000_000)).toBe(ltrIsolate('₪1M'))
    expect(formatCompactShekel(1_500_000)).toBe(ltrIsolate('₪1.5M'))
    expect(formatCompactShekel(2_340_000)).toBe(ltrIsolate('₪2.3M'))
  })

  it('preserves the sign on negative values across tiers', () => {
    expect(formatCompactShekel(-800)).toBe(ltrIsolate('-₪800'))
    expect(formatCompactShekel(-1_200)).toBe(ltrIsolate('-₪1.2K'))
    expect(formatCompactShekel(-2_000_000)).toBe(ltrIsolate('-₪2M'))
  })

  it('renders non-finite input as ₪0 instead of NaN/Infinity text', () => {
    expect(formatCompactShekel(NaN)).toBe(ltrIsolate('₪0'))
    expect(formatCompactShekel(Infinity)).toBe(ltrIsolate('₪0'))
    expect(formatCompactShekel(-Infinity)).toBe(ltrIsolate('₪0'))
  })
})
