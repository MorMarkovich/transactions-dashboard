// Local-calendar YYYY-MM-DD. Do NOT use d.toISOString() here: it converts to
// UTC, which shifts local-midnight dates back a day in UTC+ timezones (e.g.
// 00:30 in Asia/Jerusalem serializes as yesterday, and the 1st of the month
// as the last day of the previous month).
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
