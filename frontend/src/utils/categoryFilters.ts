import type { CategorySnapshotItem } from '../services/types'

export type SnapshotSortKey = 'amount' | 'change' | 'count' | 'avg'

export interface CategoryFilterOptions {
  search: string
  excluded: Set<string>
  minAmount: number
  maxAmount: number
  selectedCategories: Set<string> | null  // null means "all selected"
  sort: SnapshotSortKey
}

/**
 * Filter and sort category snapshot items. Pure function — no side effects.
 */
export function filterAndSortCategories(
  categories: CategorySnapshotItem[],
  opts: CategoryFilterOptions,
): CategorySnapshotItem[] {
  const searchLower = opts.search.toLowerCase().trim()

  const filtered = categories.filter((c) => {
    // Excluded categories
    if (opts.excluded.has(c.name)) return false

    // Category multi-select (null = all selected)
    if (opts.selectedCategories !== null && !opts.selectedCategories.has(c.name)) return false

    // Text search (category name or top merchant)
    if (searchLower &&
        !c.name.toLowerCase().includes(searchLower) &&
        !(c.top_merchant && c.top_merchant.toLowerCase().includes(searchLower))) {
      return false
    }

    // Min amount
    if (opts.minAmount > 0 && c.total < opts.minAmount) return false

    // Max amount
    if (opts.maxAmount > 0 && c.total > opts.maxAmount) return false

    return true
  })

  // Sort
  const sorted = [...filtered]
  switch (opts.sort) {
    case 'change':
      return sorted.sort((a, b) => Math.abs(b.month_change) - Math.abs(a.month_change))
    case 'count':
      return sorted.sort((a, b) => b.count - a.count)
    case 'avg':
      return sorted.sort((a, b) => b.avg_transaction - a.avg_transaction)
    default:
      return sorted.sort((a, b) => b.total - a.total)
  }
}

/**
 * Count how many filters are actively applied.
 */
export function countActiveFilters(opts: CategoryFilterOptions): number {
  let count = 0
  if (opts.search.trim()) count++
  if (opts.excluded.size > 0) count++
  if (opts.minAmount > 0) count++
  if (opts.maxAmount > 0) count++
  if (opts.selectedCategories !== null) count++
  return count
}
