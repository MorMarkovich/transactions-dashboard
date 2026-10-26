// Opt-in runtime seam; legacy accounts remain posted-only. Never enabled by env.
import {scrapeProviderDetailed,scrapeProvider} from './scrape.js'
import {resolvePendingBinding,bindingCardKey} from './pending-binding.js'
import {readPendingCard,savePendingObservation} from './pending-store.js'
export async function scrapeAccountWithPending({account,credentials,options,client,userId},deps={scrapeProviderDetailed,scrapeProvider,readPendingCard,savePendingObservation}){
 let target
 try{target=resolvePendingBinding(account,userId)}catch{return {transactions:await deps.scrapeProvider(account.provider,credentials,options),pendingStatus:'pending_binding_invalid'}}
 if(!target)return {transactions:await deps.scrapeProvider(account.provider,credentials,options),pendingStatus:null}
 const cardKey=bindingCardKey(target)
 // Verify identity and capture prestate BEFORE issuer work; missing migration,
 // wrong dashboard login or malformed state must not cause extra issuer requests.
 let previous
 try{const auth=await client.auth.getUser();if(auth.error||auth.data.user?.id!==userId)throw Error();previous=await deps.readPendingCard(client,userId,cardKey)}catch{return {transactions:await deps.scrapeProvider(account.provider,credentials,options),pendingStatus:'pending_store_unavailable'}}
 let detailed
 try{detailed=await deps.scrapeProviderDetailed(account.provider,credentials,{...options,pendingTarget:target})}catch(error){
  try{await deps.savePendingObservation(client,{userId,cardKey,previous,fresh:{success:false,error:'pending_session_unavailable'},checkedAt:new Date().toISOString()})}catch{/* original bank failure remains authoritative */}
  throw error
 }
 try{await deps.savePendingObservation(client,{userId,cardKey,previous,fresh:detailed.pending,checkedAt:new Date().toISOString()});return {transactions:detailed.transactions,pendingStatus:detailed.pending?.success===true?'pending_observed':'pending_unverified'}}
 catch{return {transactions:detailed.transactions,pendingStatus:'pending_store_failed'}}
}
