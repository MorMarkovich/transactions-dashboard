export interface MonthLegendItem { name: string; value: number; aggregate?: boolean }
export function groupMonthCategories(items: MonthLegendItem[]): MonthLegendItem[] {
  return items.length > 7 ? [...items.slice(0, 6), { name: 'יתר הקטגוריות', value: items.slice(6).reduce((sum, item) => sum + item.value, 0), aggregate: true }] : items
}
