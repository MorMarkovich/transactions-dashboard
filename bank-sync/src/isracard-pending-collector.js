// Collected within the existing session only for an explicitly enabled binding.
// Caller supplies an already-authorized session transport. No auth acquisition,
// retries, redirects, credentials, cookies, raw response persistence or logging.
import { nextRequest, parseIlsPending } from './isracard-pending.js'

export const PENDING_ENDPOINTS = Object.freeze({
  cards: 'https://web.isracard.co.il/ocp/transactions/DigitalV3.Transactions/GetCardList',
  transactions: 'https://web.isracard.co.il/ocp/transactions/DigitalV3.Transactions/GetTransactionsList',
})
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const ok = v => object(v) && v.isSuccess === true && ['0',0,null,undefined].includes(v.errorCode)

/**
 * One successful GetCardList response and explicit local account identify target.
 * No suffix-only selection, calendar month guess or screenshot issuer inference.
 * companyCode/isPartner/suffix together must uniquely select discovered card.
 */
export function discoverPendingRequest(envelope, target) {
  if (!object(target) || typeof target.accountKey !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(target.accountKey)
    || !/^\d{4}$/.test(target.cardSuffix) || !['11','77'].includes(String(target.companyCode)) || typeof target.isPartner !== 'boolean') throw Error('invalid_target')
  if (!ok(envelope) || !Array.isArray(envelope.data?.cardsList)) throw Error('card_discovery_failed')
  const matches = envelope.data.cardsList.filter(c => object(c) && c.cardSuffix === target.cardSuffix && String(c.companyCode) === String(target.companyCode) && c.isPartner === target.isPartner)
  if (matches.length !== 1) throw Error('ambiguous_or_missing_card')
  const card = matches[0]
  // Session GUID is intentionally not persisted or treated as a stable ID.
  const cardKey = JSON.stringify(['isracard',target.accountKey,String(card.companyCode),card.isPartner,card.cardSuffix])
  const request = nextRequest(card, cardKey)
  return {...request, cardKey}
}

/**
 * requestInSession must implement bounded POST to the exact URL, no redirects
 * or retry. It must not log bank payloads. The application must independently
 * validate account permission before passing this capability. This function
 * never discovers a transport, starts Chrome, signs in or writes a snapshot.
 */
export async function collectPending({cardList, target, requestInSession, observedAt}) {
  let request
  if (typeof requestInSession !== 'function') throw Error('missing_session_transport')
  if (typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt))) throw Error('invalid_observation_time')
  try { request = discoverPendingRequest(cardList, target) }
  catch { return {success:false,state:'unknown',error:'pending_discovery_unavailable',scope:null,observedAt} }
  let response
  try {
    response = await requestInSession({url:PENDING_ENDPOINTS.transactions,method:'POST',body:request.body,redirect:'error',maxBytes:2_000_000,timeoutMs:20_000,retries:0})
  } catch(error) {
    const codes=new Set(['pending_rate_limited','pending_auth_required','pending_timeout','pending_outer_timeout','pending_response_limit'])
    let code='pending_transport_unavailable'
    try {if(codes.has(error?.code)) code=error.code} catch { /* never read hostile error text */ }
    return {success:false,state:'unknown',error:code,scope:request.scope,observedAt}
  }
  try { return {...parseIlsPending(response, request),cardKey:request.cardKey,observedAt} }
  catch {
    return {success:false,state:'unknown',error:'pending_contract_unsupported',scope:request.scope,observedAt}
  }
}

/**
 * Pure per-card store update. Posted transactions are never accepted here.
 * Failed/partial runs retain prior pending as stale. Rollover retains old scope
 * separately as unresolved, never as current approvals or inferred posted rows.
 * `book` is a JSON object with cards indexed by cardKey, each holding current and
 * unresolved snapshots. This model is deliberately outside saved_transactions.
 */
export function updatePendingBook(book, cardKey, fresh, checkedAt) {
  if (typeof cardKey !== 'string' || !cardKey || typeof checkedAt !== 'string' || !Number.isFinite(Date.parse(checkedAt))) throw Error('invalid_book_update')
  const cards = structuredClone(object(book?.cards) ? book.cards : {})
  const previous = Object.hasOwn(cards,cardKey) && object(cards[cardKey]) ? cards[cardKey] : null
  const priorCurrent = previous?.current ?? null
  if (fresh?.success !== true || fresh.cardKey !== cardKey || typeof fresh.scope !== 'string' || !Array.isArray(fresh.rows)) {
    cards[cardKey] = {...previous,current:priorCurrent,state:priorCurrent?'stale':'unknown',checkedAt}
  } else {
    const unresolved = [...(Array.isArray(previous?.unresolved) ? previous.unresolved : [])]
    if (priorCurrent && priorCurrent.scope !== fresh.scope && priorCurrent.rows.length) {
      if (!unresolved.some(s => s.scope === priorCurrent.scope)) {
        // Never silently prune unresolved money. Stop refreshing this card when
        // the bounded review backlog is full, retain all prior evidence, and
        // expose a fixed blocking state requiring explicit resolution.
        if (unresolved.length >= 12) {
          cards[cardKey] = {...previous,current:priorCurrent,state:'retention_limit',checkedAt,error:'pending_review_backlog_full'}
          return {version:1,cards}
        }
        unresolved.push(priorCurrent)
      }
    }
    cards[cardKey] = {current:structuredClone(fresh),unresolved,state:unresolved.length?'rollover_review':'current',checkedAt}
  }
  return {version:1,cards}
}
