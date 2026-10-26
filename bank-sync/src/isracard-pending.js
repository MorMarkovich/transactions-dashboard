// Pending contract used only for an explicitly enabled, verified local binding.
// Contract verified against public issuer frontend. Reject unknown shapes.
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v)
function date(value) {
  if (typeof value !== 'string') throw Error('invalid_date')
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!m) throw Error('invalid_date')
  const iso = `${m[3]}-${m[2]}-${m[1]}`
  const d = new Date(`${iso}T12:00:00Z`)
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== iso) throw Error('invalid_date')
  return iso
}
function nonblank(value) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) throw Error('invalid_text')
  return value
}
function minorIls(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error('invalid_amount')
  const n = Math.round(value * 100)
  if (!Number.isSafeInteger(n) || Math.abs(n / 100 - value) > 1e-9) throw Error('invalid_precision')
  return n
}
function summary(value) {
  if (value === null) return true
  return record(value) && Array.isArray(value.currentTransactionsBillingMonth)
    && value.currentTransactionsBillingMonth.every(month => record(month)
      && typeof month.currentBillingMonth === 'string'
      && Array.isArray(month.totalTransactionsCurrency)
      && month.totalTransactionsCurrency.every(total => record(total)
        && Number.isSafeInteger(total.transactionsCount) && total.transactionsCount >= 0
        && typeof total.transactionsCurrency === 'number'
        && typeof total.transactionsSymbol === 'string'
        && typeof total.transactionsTotal === 'number' && Number.isFinite(total.transactionsTotal)))
}
export function nextRequest(card, verifiedCardKey) {
  nonblank(verifiedCardKey)
  if (!record(card) || !/^\d{4}$/.test(card.cardSuffix) || typeof card.isActive !== 'boolean' || typeof card.isPartner !== 'boolean') throw Error('invalid_card')
  const period = card.cardChargeNext
  if (!record(period) || period.period !== 'Next') throw Error('undiscovered_next_period')
  const iso = date(period.billingDate)
  // Company membership must come from discovery, never from the screenshot.
  const companyCode = String(card.companyCode)
  if (!['11','77'].includes(companyCode)) throw Error('unknown_company')
  return {
    scope: `${verifiedCardKey}|${iso.slice(0,7)}`,
    body: {card4Number: card.cardSuffix, isNextBillingDate: true,
      cardStatus: card.isActive ? 0 : 1, billingMonth: `01/${iso.slice(5,7)}/${iso.slice(0,4)}`,
      companyCode: Number(companyCode), isPartner: card.isPartner},
  }
}
export function parseIlsPending(envelope, request) {
  // Narrow first slice: ILS rows only. Do not misrepresent FX authorizations as ILS.
  if (!request?.body?.isNextBillingDate || typeof request.scope !== 'string') throw Error('invalid_scope')
  if (!record(envelope) || envelope.isSuccess !== true || !['0',0].includes(envelope.errorCode)) throw Error('application_failure')
  const data = envelope.data
  if (!record(data) || !['approvals','currentTransactionsList','israelAbroadVouchers'].every(k => Object.hasOwn(data,k)) || (data.israelAbroadVouchers !== null && !record(data.israelAbroadVouchers)) || !summary(data.currentTransactionsList)) throw Error('unknown_envelope')
  const approvals = data.approvals
  if (approvals !== null && (!record(approvals) || !Array.isArray(approvals.approvedTransactions) || typeof approvals.totalEstimatedAmount !== 'number' || !Number.isFinite(approvals.totalEstimatedAmount))) throw Error('unknown_approvals')
  if ((approvals?.approvedTransactions?.length ?? 0) > 10000) throw Error('response_limit')
  const rows = []; const ids = new Set()
  for (const row of approvals?.approvedTransactions ?? []) {
    if (!record(row) || row.currencyIso !== 'ILS' || !Number.isSafeInteger(row.confirmationLocation) || row.confirmationLocation < 0) throw Error('unsupported_row')
    const identity = JSON.stringify([request.scope, row.confirmationLocation, nonblank(row.seqConfirmationNumber), nonblank(row.confirmationTimeStamp)])
    if (ids.has(identity)) throw Error('colliding_identity')
    ids.add(identity)
    rows.push({identity, date: date(row.purchaseDate), merchant: nonblank(row.businessName),
      authorizationMinor: minorIls(row.originalAmount), currency: 'ILS', status:'pending'})
  }
  // Signed source amount is retained, not silently interpreted as a settled charge.
  return {scope:request.scope, rows, success:true}
}
export function replacePending(prior, fresh) {
  if (!fresh || fresh.success !== true || !Array.isArray(fresh.rows)) return {snapshot:prior, state:'stale'}
  if (prior && prior.scope !== fresh.scope) return {snapshot:fresh, unresolvedPrior:prior, state:'rollover_review'}
  return {snapshot:fresh, state:'current'}
}
