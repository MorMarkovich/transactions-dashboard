/**
 * Shared formatting utilities for the Hebrew RTL transactions dashboard.
 */

const numberFormatter = new Intl.NumberFormat('he-IL')

// U+200E LEFT-TO-RIGHT MARK — bracketing the currency string forces the whole
// run to render as a single LTR unit even inside RTL paragraphs. Without it
// the minus sign and ₪ symbol can swap sides on bidi reordering.
const LRM = '‎'

/**
 * Format a number as Israeli Shekel currency (e.g. ₪1,234.56).
 *
 * Layout invariants the formatter guarantees so currency is unambiguous
 * across the app:
 *   - Always `[sign]₪[digits]` with the sign immediately before the ₪
 *     (never after, never split). Positive amounts include no plus sign;
 *     callers that want a leading `+` should add it themselves.
 *   - No space between the sign / ₪ / digits — tight token.
 *   - Wrapped in LRM marks so RTL bidi can't reorder the parts.
 */
export function formatCurrency(amount: number): string {
  if (amount === 0) return `${LRM}₪0.00${LRM}`
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  // Use the typographic minus (U+2212) instead of ASCII hyphen so the
  // glyph isn't reordered by RTL shaping (which sometimes ends up on the
  // wrong side of ₪ on Windows).
  const body = amount < 0 ? `−₪${formatted}` : `₪${formatted}`
  return `${LRM}${body}${LRM}`
}

/**
 * Format a date string for Hebrew display as DD/MM/YYYY.
 * Accepts ISO date-only strings (YYYY-MM-DD) and other Date-parseable formats.
 * For YYYY-MM-DD inputs, parses as a calendar date so a date doesn't shift by
 * one day in timezones west of UTC (where `new Date('2026-05-11')` is UTC
 * midnight and getDate() then returns the previous day).
 */
export function formatDate(dateStr: string): string {
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (isoDateOnly) {
    return `${isoDateOnly[3]}/${isoDateOnly[2]}/${isoDateOnly[1]}`
  }

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
  if (value > 0 && value < 1) return '<1%'
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
