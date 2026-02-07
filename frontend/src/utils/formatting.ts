/**
 * Shared formatting utilities for the Hebrew RTL transactions dashboard.
 */

const currencyFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('he-IL')

/**
 * Format a number as Israeli Shekel currency (e.g. ₪1,234.56).
 * Handles negative numbers, zero, and positive values.
 */
export function formatCurrency(amount: number): string {
  if (amount === 0) return '₪0'
  return currencyFormatter.format(amount)
}

/**
 * Format a date string for Hebrew display as DD/MM/YYYY.
 * Accepts ISO strings (YYYY-MM-DD) and other Date-parseable formats.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

/**
 * Format a number as a percentage string.
 * @param value   - The numeric value (e.g. 0.75 for 75%, or 75 for 75%)
 * @param decimals - Number of decimal places (default: 1)
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format a number with thousand separators using he-IL locale.
 */
export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/**
 * Truncate text to a maximum length, appending an ellipsis if truncated.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '...'
}
