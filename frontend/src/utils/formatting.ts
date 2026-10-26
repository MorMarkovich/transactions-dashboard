/**
 * Shared formatting utilities for the Hebrew RTL transactions dashboard.
 */

const numberFormatter = new Intl.NumberFormat('he-IL')

/**
 * Wrap a formatted amount in Unicode bidi isolates (LRI…PDI) so the whole
 * token renders left-to-right even inside RTL text. Without this, a leading
 * minus/plus detaches under the bidi algorithm and shows up on the wrong
 * side of the digits (e.g. "-₪120" became "₪120-" in RTL table cells).
 */
export function ltrIsolate(text: string): string {
  return `\u2066${text}\u2069`
}

/**
 * Format a number as Israeli Shekel currency (e.g. ₪1,234.56).
 * Always places ₪ first; a sign sits between the symbol and the digits
 * (₪-1,234.56), and the result is bidi-isolated so the token renders
 * left-to-right in both RTL and LTR containers.
 * Pass explicitPlus to show ₪+ on positive amounts (e.g. net balance).
 */
export function formatCurrency(amount: number, explicitPlus = false): string {
  if (amount === 0) return ltrIsolate('₪0')
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const sign = amount < 0 ? '-' : explicitPlus ? '+' : ''
  return ltrIsolate(`${sign}₪${formatted}`)
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

  return ltrIsolate(`${day}/${month}/${year}`)
}

/**
 * Format a number as a percentage string.
 * @param value   - The numeric value (e.g. 0.75 for 75%, or 75 for 75%)
 * @param decimals - Number of decimal places (default: 1)
 */
export function formatPercent(value: number, decimals: number = 1): string {
  if (value > 0 && value < 1) return '<1%'
  return ltrIsolate(`${value.toFixed(decimals)}%`)
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

/** Show the owner "joint" in Hebrew everywhere ("ישראכרט (joint)" -> "ישראכרט (משותף)"). */
export function hebOwner(text: string | null | undefined): string {
  return (text ?? '').replace(/\bjoint\b/gi, 'משותף')
}

/** Round a chart axis maximum up to a "nice" 1/1.2/1.5/2/2.5/3/4/5/6/8/10 × 10^n value. */
export function niceCeil(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const d = v / p
  for (const step of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (d <= step) return step * p
  }
  return 10 * p
}

/** Numeric key for an 'MM/YYYY' month label; null when it does not parse. */
export function monthKeyNum(month: string): number | null {
  const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(month)
  if (!m) return null
  return Number(m[2]) * 12 + Number(m[1])
}

/** Current calendar month as 'MM/YYYY' in the user's timezone. */
export function currentMonthKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { month: '2-digit', year: 'numeric', timeZone: 'Asia/Jerusalem' }).format(now)
}
