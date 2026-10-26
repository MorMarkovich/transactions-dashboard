// Explicit interactive operation, never called by sync/server. Entire discovery,
// review and registry write are serialized by the caller's local lock.
import {prepareDiscoveredPendingBinding,invalidatePendingBinding} from './pending-binding.js'
import {safeError} from './safe-errors.js'
const discoveryCodes=Object.freeze({
 pending_auth_required:'BANK_PENDING_AUTH_REQUIRED',
 pending_rate_limited:'BANK_PENDING_RATE_LIMITED',
 pending_timeout:'BANK_PENDING_TIMEOUT',
 pending_outer_timeout:'BANK_PENDING_TIMEOUT',
 pending_contract_unsupported:'BANK_PENDING_CONTRACT_UNSUPPORTED',
 pending_non_json:'BANK_PENDING_CONTRACT_UNSUPPORTED',
 pending_network_failed:'BANK_PENDING_NETWORK_FAILED',
 pending_http_failed:'BANK_PENDING_HTTP_FAILED',
 pending_session_failed:'BANK_PENDING_SESSION_FAILED',
 pending_session_stopped:'BANK_PENDING_SESSION_FAILED',
 pending_response_limit:'BANK_PENDING_RESPONSE_LIMIT',
 pending_stream_unavailable:'BANK_PENDING_SESSION_FAILED',
 pending_request_rejected:'BANK_PENDING_REQUEST_REJECTED',
 pending_not_observed:'BANK_PENDING_NOT_OBSERVED',
})
export async function enablePendingForAccount({account,userId,client,credentials,options,discover,approveDiscovery,chooseCard,approveBinding,writeAccount}){
 if(account?.provider!=='isracard')throw Error('pending_binding_invalid')
 const auth=await client.auth.getUser();if(auth.error||auth.data.user?.id!==userId)throw Error('pending_owner_invalid')
 if(!await approveDiscovery())return{enabled:false}
 // Credentials and registry account are passed to ONE scraper invocation. No
 // caller-supplied response/cached card list is accepted as discovery evidence.
 const observed=await discover(account.provider,credentials,{...options,pendingTarget:null,pendingDiscovery:true,keepBrowserOpen:false})
 if(observed.pending?.success!==true||!Array.isArray(observed.pending.cards)){
  const code=observed.pending?.error
  throw safeError(Object.hasOwn(discoveryCodes,code)?discoveryCodes[code]:'BANK_PENDING_DISCOVERY_UNAVAILABLE')
 }
 if(!observed.pending.cards.length)throw safeError('BANK_PENDING_NO_CARDS')
 const chosen=await chooseCard(structuredClone(observed.pending.cards))
 if(!Number.isInteger(chosen)||chosen<0||chosen>=observed.pending.cards.length)throw Error('pending_binding_invalid')
 const selected=observed.pending.cards[chosen]
 const candidate=prepareDiscoveredPendingBinding(account,userId,selected,{isSuccess:true,data:{cardsList:observed.pending.cards}})
 if(!await approveBinding(candidate.pending))return{enabled:false}
 await invalidatePendingBinding(client,account,userId)
 const next={...candidate,pending:{...candidate.pending,enabled:true}}
 await writeAccount(next)
 return {enabled:true,scopeId:next.pending.scopeId}
}
