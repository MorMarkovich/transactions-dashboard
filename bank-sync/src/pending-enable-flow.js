// Explicit interactive operation, never called by sync/server. Entire discovery,
// review and registry write are serialized by the caller's local lock.
import {prepareDiscoveredPendingBinding,invalidatePendingBinding} from './pending-binding.js'
export async function enablePendingForAccount({account,userId,client,credentials,options,discover,approveDiscovery,chooseCard,approveBinding,writeAccount}){
 if(account?.provider!=='isracard')throw Error('pending_binding_invalid')
 const auth=await client.auth.getUser();if(auth.error||auth.data.user?.id!==userId)throw Error('pending_owner_invalid')
 if(!await approveDiscovery())return{enabled:false}
 // Credentials and registry account are passed to ONE scraper invocation. No
 // caller-supplied response/cached card list is accepted as discovery evidence.
 const observed=await discover(account.provider,credentials,{...options,pendingTarget:null,pendingDiscovery:true,keepBrowserOpen:false})
 if(observed.pending?.success!==true||!Array.isArray(observed.pending.cards)||!observed.pending.cards.length)throw Error('pending_discovery_unavailable')
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
