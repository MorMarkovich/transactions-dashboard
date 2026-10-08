/** Choose a non-future billing cycle without overriding a remembered valid choice. */
export function defaultMonth(months: string[], remembered: string | null, now = new Date()): string | null {
  if (remembered && months.includes(remembered)) return remembered
  const current = new Intl.DateTimeFormat('en-GB', {month:'2-digit',year:'numeric',timeZone:'Asia/Jerusalem'}).format(now)
  const key = (value:string) => { const [m,y] = value.split('/'); return Number(y)*12+Number(m) }
  return months.filter(m=>key(m)<=key(current)).sort((a,b)=>key(a)-key(b)).at(-1) ?? [...months].sort((a,b)=>key(a)-key(b)).at(-1) ?? null
}
