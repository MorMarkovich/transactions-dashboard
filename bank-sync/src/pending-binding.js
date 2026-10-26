// Explicit reviewed local binding. No credentials or inferred owner/card matches.
import {randomUUID} from 'node:crypto'
import {readPendingCard} from './pending-store.js'
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
export function createPendingScope(){return `pending-${randomUUID()}`}
export function resolvePendingBinding(account,userId){
 const b=account?.pending
 if(!b||b.enabled!==true)return null
 if(account.provider!=='isracard'||!uuid(b.scopeId?.slice(8))||!b.scopeId.startsWith('pending-')||b.dashboardUserId!==userId||!/^\d{4}$/.test(b.cardSuffix)||!['11','77'].includes(b.companyCode)||typeof b.isPartner!=='boolean'||typeof b.verifiedAt!=='string'||!Number.isFinite(Date.parse(b.verifiedAt)))throw Error('pending_binding_invalid')
 return {accountKey:b.scopeId,cardSuffix:b.cardSuffix,companyCode:b.companyCode,isPartner:b.isPartner}
}
export function bindingCardKey(target){return JSON.stringify(['isracard',target.accountKey,target.companyCode,target.isPartner,target.cardSuffix])}
// Before changing credentials/removing an account, mark its old cloud data unknown.
// CAS failure aborts the local change; no retries or silent loss of prior evidence.
export async function invalidatePendingBinding(client,account,userId,checkedAt=new Date().toISOString()){
 if(!account?.pending)return
 const target=resolvePendingBinding({...account,pending:{...account.pending,enabled:true}},userId)
 const cardKey=bindingCardKey(target),previous=await readPendingCard(client,userId,cardKey)
 const data={...(previous.data??{current:null,unresolved:[]}),state:'unknown',checkedAt,error:'pending_not_observed'}
 let result
 try{result=await client.rpc('write_pending_card_snapshot',{p_card_key:cardKey,p_expected_version:previous.version,p_data:data})}catch{throw Error('pending_invalidation_failed')}
 if(result.error||result.data!==previous.version+1)throw Error('pending_invalidation_failed')
}

// Called only after separately authorized authenticated discovery and review.
// The selected tuple must be in that exact account's session response. This
// function does not authenticate that provenance; the controller owns it.
export function prepareDiscoveredPendingBinding(account,userId,selected,discovered,verifiedAt=new Date().toISOString()){
 if(account?.provider!=='isracard'||!/^\w[\w-]{0,99}$/.test(account.key)||!/^[0-9a-f-]{36}$/i.test(userId)||!Array.isArray(discovered?.data?.cardsList)||discovered.isSuccess!==true)throw Error('pending_binding_invalid')
 const matches=discovered.data.cardsList.filter(c=>c?.cardSuffix===selected?.cardSuffix&&String(c?.companyCode)===selected?.companyCode&&c?.isPartner===selected?.isPartner)
 if(matches.length!==1)throw Error('pending_binding_invalid')
 const pending={enabled:false,scopeId:createPendingScope(),dashboardUserId:userId,cardSuffix:selected.cardSuffix,companyCode:selected.companyCode,isPartner:selected.isPartner,verifiedAt}
 resolvePendingBinding({...account,pending:{...pending,enabled:true}},userId)
 return {...account,pending}
}
