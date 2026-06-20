// Salary detection + income-month attribution.
//
// Salaries that land near a month boundary (e.g. a spouse's pay arriving 27th-
// 2nd) otherwise fall into inconsistent calendar months. This shifts a detected
// salary to the intended month so each month shows the right income.

export const SALARY_KEYWORDS = [
  'משכורת', 'שכר', 'העברת שכר', 'העב שכר', 'שכר עבודה',
  'הפקדת שכר', 'תשלום שכר', 'משכ', 'salary', 'payroll',
]

const pad2 = (n) => String(n).padStart(2, '0')

// Salary-like income: a positive amount that either matches a salary keyword or
// is a sizeable deposit (the spouse's pay may not carry a clear keyword).
export function isSalary(t, salaryMin = 4000) {
  const amt = Number(t['סכום']) || 0
  if (amt <= 0) return false
  const desc = String(t['תיאור'] || '').toLowerCase()
  return SALARY_KEYWORDS.some((k) => desc.includes(k)) || amt >= salaryMin
}

/**
 * Re-attribute salaries to a consistent month, in place.
 *  - direction 'next': pay on/after `cutoffDay` (default 25) → the FOLLOWING month
 *  - direction 'prev': pay on/before `cutoffDay` (default 3)  → the PREVIOUS month
 *  - direction 'none': do nothing
 * Only the month fields (חודש / חודש_חיוב / תאריך_חיוב) move; the real תאריך is
 * left intact. Idempotent — re-running doesn't shift an already-shifted row.
 * Returns how many rows changed.
 */
export function applyIncomeMonthShift(txns, { direction = 'next', cutoffDay, salaryMin = 4000 } = {}) {
  if (direction === 'none') return 0
  const cut = cutoffDay ?? (direction === 'next' ? 25 : 3)
  let changed = 0
  for (const t of txns) {
    if (!isSalary(t, salaryMin)) continue
    const ymd = String(t['תאריך'] || '')
    if (ymd.length < 10) continue
    const [Y, M, D] = ymd.split('-').map(Number)
    let ty = Y
    let tm = M // 1-12
    if (direction === 'next' && D >= cut) { tm = M + 1; if (tm > 12) { tm = 1; ty = Y + 1 } }
    else if (direction === 'prev' && D <= cut) { tm = M - 1; if (tm < 1) { tm = 12; ty = Y - 1 } }
    else continue

    const newMonth = `${pad2(tm)}/${ty}`
    if (t['חודש'] === newMonth && t['_income_shifted'] === true) continue
    t['חודש'] = newMonth
    // Keep the billing-date view in agreement (1st of the target month).
    t['תאריך_חיוב'] = `${ty}-${pad2(tm)}-01`
    t['חודש_חיוב'] = newMonth
    t['_income_shifted'] = true
    changed++
  }
  return changed
}
