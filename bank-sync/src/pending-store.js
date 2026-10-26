// User-scoped isolated pending persistence. No credentials, raw bank payloads,
// posted ledger calls, server-role key, retries or arbitrary error messages.
import {updatePendingBook} from './isracard-pending-collector.js'
const TABLE='pending_card_snapshots'
const states=new Set(['current','stale','unknown','rollover_review','retention_limit'])
const failures=new Set(['pending_discovery_unavailable','pending_transport_unavailable','pending_contract_unsupported',
 'pending_rate_limited','pending_auth_required','pending_timeout','pending_outer_timeout','pending_response_limit',
 'pending_session_failed','pending_session_unavailable','pending_not_observed','pending_review_backlog_full'])
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
function owner(userId,cardKey){if(typeof userId!=='string'||!/^[0-9a-f-]{36}$/i.test(userId)||typeof cardKey!=='string'||!cardKey||cardKey.length>512)throw Error('pending_store_target_invalid')}
function rows(values){return Array.isArray(values)&&values.length<=1000&&new Set(values.map(r=>r?.identity)).size===values.length&&values.every(r=>object(r)&&Object.keys(r).sort().join(',')==='authorizationMinor,currency,date,identity,merchant,status'&&typeof r.identity==='string'&&r.identity.length<=2048&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&typeof r.merchant==='string'&&r.merchant.length<=500&&Number.isSafeInteger(r.authorizationMinor)&&r.currency==='ILS'&&r.status==='pending')}
function snapshot(v,cardKey){return object(v)&&Object.keys(v).sort().join(',')==='cardKey,observedAt,rows,scope,success'&&v.success===true&&v.cardKey===cardKey&&typeof v.scope==='string'&&v.scope.length<=1024&&typeof v.observedAt==='string'&&Number.isFinite(Date.parse(v.observedAt))&&rows(v.rows)}
export function validatePendingState(value,cardKey){
 if(!object(value)||!states.has(value.state)||!['current','unresolved','state','checkedAt','error'].every(k=>!Object.hasOwn(value,k)||value[k]!==undefined)||typeof value.checkedAt!=='string'||!Number.isFinite(Date.parse(value.checkedAt)))throw Error('pending_store_shape_invalid')
 if(value.current!==null&&!snapshot(value.current,cardKey))throw Error('pending_store_shape_invalid')
 if(!Array.isArray(value.unresolved)||value.unresolved.length>12||!value.unresolved.every(s=>snapshot(s,cardKey)))throw Error('pending_store_shape_invalid')
 if(value.error!==undefined&&!failures.has(value.error))throw Error('pending_store_shape_invalid')
 const projected={current:value.current,unresolved:value.unresolved,state:value.state,checkedAt:value.checkedAt,...(value.error?{error:value.error}:{})}
 if(Buffer.byteLength(JSON.stringify(projected),'utf8')>262_144)throw Error('pending_store_size_limit')
 return structuredClone(projected)
}
export async function readPendingCard(client,userId,cardKey){
 owner(userId,cardKey)
 let result
 try{result=await client.from(TABLE).select('version,data').eq('user_id',userId).eq('card_key',cardKey).maybeSingle()}catch{throw Error('pending_store_read_failed')}
 if(result.error)throw Error('pending_store_read_failed')
 if(!result.data)return{version:0,data:null}
 if(!Number.isSafeInteger(result.data.version)||result.data.version<1)throw Error('pending_store_shape_invalid')
 return{version:result.data.version,data:validatePendingState(result.data.data,cardKey)}
}
export async function savePendingObservation(client,{userId,cardKey,previous,fresh,checkedAt}){
 owner(userId,cardKey)
 if(!previous||!Number.isSafeInteger(previous.version)||previous.version<0)throw Error('pending_store_version_invalid')
 if(previous.data)validatePendingState(previous.data,cardKey)
 if(fresh?.success===true&&!snapshot(fresh,cardKey))throw Error('pending_store_shape_invalid')
 const book=updatePendingBook(previous.data?{version:1,cards:{[cardKey]:previous.data}}:null,cardKey,fresh,checkedAt)
 const state=book.cards[cardKey]
 if(!Array.isArray(state.unresolved))state.unresolved=[]
 if(fresh?.success!==true){let code='pending_contract_unsupported';try{if(failures.has(fresh?.error))code=fresh.error}catch{};state.error=code}
 const data=validatePendingState(state,cardKey)
 const nextVersion=previous.version+1
 if(!Number.isSafeInteger(nextVersion))throw Error('pending_store_version_invalid')
 let result
 try{
  result=await client.rpc('write_pending_card_snapshot',{
   p_card_key:cardKey,p_expected_version:previous.version,p_data:data,
  })
 }catch{throw Error('pending_store_write_failed')}
 if(result.error){if(['P0002','23505'].includes(result.error.code))throw Error('pending_store_conflict');throw Error('pending_store_write_failed')}
 if(result.data!==nextVersion)throw Error('pending_store_conflict')
 return{version:nextVersion,data}
}

// Staleness is based on successful observation time, not mutable label/check time.
// Default24h reflects a user-triggered daily-ish sync, not unattended monitoring.
export function pendingDisplayState(state,now=Date.now(),maxAgeMs=86_400_000){
 if(!state?.current)return'unknown'
 const observed=Date.parse(state.current.observedAt)
 if(!Number.isFinite(observed)||observed>now+300_000||now-observed>maxAgeMs)return'stale'
 return states.has(state.state)?state.state:'unknown'
}
