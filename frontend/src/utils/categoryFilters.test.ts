import { describe, it, expect } from 'vitest'
import {
  filterAndSortCategories,
  countActiveFilters,
  type CategoryFilterOptions,
} from './categoryFilters'
import type { CategorySnapshotItem } from '../services/types'

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeCategory(overrides: Partial<CategorySnapshotItem> = {}): CategorySnapshotItem {
  return {
    name: 'מסעדות',
    total: 1000,
    count: 10,
    percent: 25,
    avg_transaction: 100,
    monthly_avg: 500,
    months_active: 2,
    month_change: 10,
    top_merchant: 'שופרסל',
    top_merchant_total: 300,
    sparkline: [400, 600],
    ...overrides,
  }
}

const defaultOpts: CategoryFilterOptions = {
  search: '',
  excluded: new Set(),
  minAmount: 0,
  maxAmount: 0,
  selectedCategories: null,
  sort: 'amount',
}

const sampleCategories: CategorySnapshotItem[] = [
  makeCategory({ name: 'מסעדות', total: 5000, count: 50, avg_transaction: 100, month_change: 15, top_merchant: 'מקדונלדס' }),
  makeCategory({ name: 'סופרמרקט', total: 3000, count: 80, avg_transaction: 37.5, month_change: -20, top_merchant: 'שופרסל' }),
  makeCategory({ name: 'תחבורה', total: 1500, count: 30, avg_transaction: 50, month_change: 5, top_merchant: 'רכבת ישראל' }),
  makeCategory({ name: 'בידור', total: 800, count: 5, avg_transaction: 160, month_change: -50, top_merchant: 'סינמה סיטי' }),
  makeCategory({ name: 'ביטוח', total: 400, count: 2, avg_transaction: 200, month_change: 0, top_merchant: null, top_merchant_total: 0 }),
]

// ---------------------------------------------------------------------------
// 1. Empty / null inputs (negative tests)
// ---------------------------------------------------------------------------

describe('filterAndSortCategories — empty inputs', () => {
  it('returns empty array for empty categories', () => {
    const result = filterAndSortCategories([], defaultOpts)
    expect(result).toEqual([])
  })

  it('returns empty array when all categories are excluded', () => {
    const excluded = new Set(sampleCategories.map(c => c.name))
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, excluded })
    expect(result).toEqual([])
  })

  it('returns empty when search matches nothing', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, search: 'xyz-no-match-zzz' })
    expect(result).toEqual([])
  })

  it('returns empty when minAmount exceeds all totals', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, minAmount: 999999 })
    expect(result).toEqual([])
  })

  it('returns empty when maxAmount is below all totals', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, maxAmount: 1 })
    expect(result).toEqual([])
  })

  it('returns empty when selectedCategories is empty set', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, selectedCategories: new Set() })
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 2. Search filter (negative + positive)
// ---------------------------------------------------------------------------

describe('filterAndSortCategories — search', () => {
  it('is case-insensitive', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, search: 'מסעדות' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('מסעדות')
  })

  it('matches by top_merchant name', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, search: 'שופרסל' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('סופרמרקט')
  })

  it('does not crash when top_merchant is null', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, search: 'ביטוח' })
    expect(result).toHaveLength(1)
    expect(result[0].top_merchant).toBeNull()
  })

  it('handles whitespace-only search as no filter', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, search: '   ' })
    expect(result).toHaveLength(sampleCategories.length)
  })

  it('partial match works', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, search: 'מסע' })
    expect(result).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 3. Exclusion filter
// ---------------------------------------------------------------------------

describe('filterAndSortCategories — exclusion', () => {
  it('excludes specific categories by name', () => {
    const result = filterAndSortCategories(sampleCategories, {
      ...defaultOpts,
      excluded: new Set(['מסעדות', 'בידור']),
    })
    expect(result).toHaveLength(3)
    expect(result.map(c => c.name)).not.toContain('מסעדות')
    expect(result.map(c => c.name)).not.toContain('בידור')
  })

  it('excluding a non-existent name has no effect', () => {
    const result = filterAndSortCategories(sampleCategories, {
      ...defaultOpts,
      excluded: new Set(['doesNotExist']),
    })
    expect(result).toHaveLength(sampleCategories.length)
  })
})

// ---------------------------------------------------------------------------
// 4. Category multi-select filter
// ---------------------------------------------------------------------------

describe('filterAndSortCategories — selectedCategories', () => {
  it('null means all selected (no filter)', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, selectedCategories: null })
    expect(result).toHaveLength(sampleCategories.length)
  })

  it('only includes explicitly selected categories', () => {
    const result = filterAndSortCategories(sampleCategories, {
      ...defaultOpts,
      selectedCategories: new Set(['מסעדות', 'תחבורה']),
    })
    expect(result).toHaveLength(2)
    expect(result.map(c => c.name).sort()).toEqual(['מסעדות', 'תחבורה'].sort())
  })

  it('selectedCategories and excluded interact correctly', () => {
    // Select מסעדות and תחבורה, but exclude מסעדות → only תחבורה
    const result = filterAndSortCategories(sampleCategories, {
      ...defaultOpts,
      selectedCategories: new Set(['מסעדות', 'תחבורה']),
      excluded: new Set(['מסעדות']),
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('תחבורה')
  })
})

// ---------------------------------------------------------------------------
// 5. Amount range filters
// ---------------------------------------------------------------------------

describe('filterAndSortCategories — amount range', () => {
  it('minAmount filters out categories below threshold', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, minAmount: 1000 })
    expect(result.every(c => c.total >= 1000)).toBe(true)
    expect(result).toHaveLength(3)  // 5000, 3000, 1500
  })

  it('maxAmount filters out categories above threshold', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, maxAmount: 1000 })
    expect(result.every(c => c.total <= 1000)).toBe(true)
    expect(result).toHaveLength(2)  // 800, 400
  })

  it('minAmount and maxAmount combined', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, minAmount: 500, maxAmount: 2000 })
    expect(result).toHaveLength(2)  // 1500, 800
  })

  it('minAmount = 0 and maxAmount = 0 means no amount filter', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, minAmount: 0, maxAmount: 0 })
    expect(result).toHaveLength(sampleCategories.length)
  })
})

// ---------------------------------------------------------------------------
// 6. Sorting
// ---------------------------------------------------------------------------

describe('filterAndSortCategories — sorting', () => {
  it('sort by amount (default) → descending by total', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, sort: 'amount' })
    const totals = result.map(c => c.total)
    expect(totals).toEqual([...totals].sort((a, b) => b - a))
  })

  it('sort by count → descending by count', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, sort: 'count' })
    const counts = result.map(c => c.count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })

  it('sort by avg → descending by avg_transaction', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, sort: 'avg' })
    const avgs = result.map(c => c.avg_transaction)
    expect(avgs).toEqual([...avgs].sort((a, b) => b - a))
  })

  it('sort by change → descending by |month_change|', () => {
    const result = filterAndSortCategories(sampleCategories, { ...defaultOpts, sort: 'change' })
    const absChanges = result.map(c => Math.abs(c.month_change))
    expect(absChanges).toEqual([...absChanges].sort((a, b) => b - a))
  })

  it('does not mutate the original array', () => {
    const original = [...sampleCategories]
    filterAndSortCategories(sampleCategories, { ...defaultOpts, sort: 'count' })
    expect(sampleCategories).toEqual(original)
  })
})

// ---------------------------------------------------------------------------
// 7. Combined filter + sort interactions
// ---------------------------------------------------------------------------

describe('filterAndSortCategories — combined', () => {
  it('search + sort + minAmount all work together', () => {
    // Search for categories/merchants containing "ס" (should match סופרמרקט, מסעדות, סינמה סיטי)
    // Min amount 1000 (filters out בידור)
    // Sort by count
    const result = filterAndSortCategories(sampleCategories, {
      ...defaultOpts,
      search: 'ס',
      minAmount: 1000,
      sort: 'count',
    })
    expect(result.every(c => c.total >= 1000)).toBe(true)
    const counts = result.map(c => c.count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })
})

// ---------------------------------------------------------------------------
// 8. countActiveFilters
// ---------------------------------------------------------------------------

describe('countActiveFilters', () => {
  it('returns 0 for default options', () => {
    expect(countActiveFilters(defaultOpts)).toBe(0)
  })

  it('counts each active filter', () => {
    expect(countActiveFilters({ ...defaultOpts, search: 'test' })).toBe(1)
    expect(countActiveFilters({ ...defaultOpts, minAmount: 100 })).toBe(1)
    expect(countActiveFilters({ ...defaultOpts, maxAmount: 500 })).toBe(1)
    expect(countActiveFilters({ ...defaultOpts, excluded: new Set(['a']) })).toBe(1)
    expect(countActiveFilters({ ...defaultOpts, selectedCategories: new Set(['a']) })).toBe(1)
  })

  it('counts multiple filters', () => {
    expect(countActiveFilters({
      ...defaultOpts,
      search: 'test',
      minAmount: 100,
      excluded: new Set(['a']),
    })).toBe(3)
  })

  it('whitespace-only search is not counted', () => {
    expect(countActiveFilters({ ...defaultOpts, search: '   ' })).toBe(0)
  })
})
