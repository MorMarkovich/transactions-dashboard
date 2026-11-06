// Upload dropped-rows surfacing (D27 UI contract).
// The backend returns dropped_rows {summary, blank, invalid_date,
// invalid_amount, zero_amount} on file upload. Two classes:
// - invalid_date / invalid_amount: real data the user expects in reports was
//   rejected -> persistent warning.
// - summary / blank / zero_amount: structural rows (sheet totals, empty
//   lines, 0.00 placeholders) that exports routinely contain -> quiet info.

export interface DroppedRowsSummary {
  invalidCount: number
  routineCount: number
  level: 'warning' | 'info'
  text: string
}

const INVALID_LABELS: Record<string, string> = {
  invalid_amount: 'עם סכום לא תקין',
  invalid_date: 'עם תאריך לא תקין',
}

export function summarizeDroppedRows(dropped: Record<string, number>): DroppedRowsSummary | null {
  const invalidParts: string[] = []
  let invalidCount = 0
  for (const key of ['invalid_amount', 'invalid_date']) {
    const n = dropped[key] || 0
    if (n > 0) {
      invalidCount += n
      invalidParts.push(`${n} ${INVALID_LABELS[key]}`)
    }
  }
  const routineCount = (dropped.summary || 0) + (dropped.blank || 0) + (dropped.zero_amount || 0)
  if (invalidCount === 0 && routineCount === 0) return null

  if (invalidCount > 0) {
    const routineNote = routineCount > 0 ? `, ועוד ${routineCount} שורות מבניות שדולגו` : ''
    return {
      invalidCount,
      routineCount,
      level: 'warning',
      text: `שים לב: ${invalidCount} שורות מהקובץ לא נטענו (${invalidParts.join(', ')})${routineNote}. השורות האלה חסרות מכל הדוחות.`,
    }
  }
  return {
    invalidCount,
    routineCount,
    level: 'info',
    text: `דולגו ${routineCount} שורות מבניות (שורות סיכום, שורות ריקות או סכום אפס) — זה תקין ברוב קבצי הייצוא.`,
  }
}

export function mergeDroppedRows(target: Record<string, number>, add?: Record<string, number>): void {
  if (!add) return
  for (const [k, v] of Object.entries(add)) {
    if (typeof v === 'number' && v > 0) target[k] = (target[k] || 0) + v
  }
}
