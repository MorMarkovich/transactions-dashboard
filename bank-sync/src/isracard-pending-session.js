// No login, browser launch, retries, evasion, logging or disk writes.
// Only explicit authorized existing-page capabilities can invoke this module.
import {PENDING_ENDPOINTS,collectPending} from './isracard-pending-collector.js'
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const TRANSACTIONS_PAGE='https://web.isracard.co.il/transactions'
// The installed scraper stays on digital.isracard.co.il. Its page cannot make
// credentialed cross-origin JSON requests to the new web application. Follow
// the issuer's ordinary transactions navigation in the SAME browser session.
export async function preparePendingPage(page){
 if(!page||typeof page.url!=='function')throw sessionError('pending_session_failed')
 let url
 try{url=new URL(page.url())}catch{throw sessionError('pending_session_failed')}
 if(url.origin==='https://web.isracard.co.il'&&/^\/transactions\/?$/.test(url.pathname))return
 if(url.origin!=='https://digital.isracard.co.il'||typeof page.goto!=='function')throw sessionError('pending_session_failed')
 let response,timer
 try{
  response=await Promise.race([
   page.goto(TRANSACTIONS_PAGE,{waitUntil:'domcontentloaded',timeout:15_000}),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(sessionError('pending_outer_timeout')),15_000)}),
  ])
 }catch(error){throw sessionError(error?.code==='pending_outer_timeout'?'pending_outer_timeout':'pending_session_failed')}
 finally{clearTimeout(timer)}
 const status=response?.status()
 if(status===429)throw sessionError('pending_rate_limited')
 if(status===401||status===403)throw sessionError('pending_auth_required')
 if(status!==200)throw sessionError('pending_http_failed')
 try{url=new URL(page.url())}catch{throw sessionError('pending_session_failed')}
 if(url.origin!=='https://web.isracard.co.il'||!/^\/transactions\/?$/.test(url.pathname))throw sessionError('pending_auth_required')
}
function validateRequest(request) {
  if (!object(request) || request.method!=='POST' || !Object.values(PENDING_ENDPOINTS).includes(request.url) || !object(request.body)) throw Error('pending_request_rejected')
  const body=request.body
  const keys=Object.keys(body).sort().join(',')
  if(request.url===PENDING_ENDPOINTS.cards) {
    if(keys!=='cardSuffixLength,companyCode'||body.cardSuffixLength!==4||body.companyCode!=='99') throw Error('pending_request_rejected')
  } else if(keys!=='billingMonth,card4Number,cardStatus,companyCode,isNextBillingDate,isPartner'
    ||!/^\d{4}$/.test(body.card4Number)||!/^01\/(0[1-9]|1[0-2])\/\d{4}$/.test(body.billingMonth)
    ||body.isNextBillingDate!==true||![0,1].includes(body.cardStatus)||![11,77].includes(body.companyCode)||typeof body.isPartner!=='boolean') throw Error('pending_request_rejected')
}
// This serializable callback executes inside the already authenticated page.
// No outer closure or module references; limits and allowlist enforced again here.
export async function boundedIssuerPost(input) {
  const urls=[
    'https://web.isracard.co.il/ocp/transactions/DigitalV3.Transactions/GetCardList',
    'https://web.isracard.co.il/ocp/transactions/DigitalV3.Transactions/GetTransactionsList',
  ]
  if(!input||!urls.includes(input.url)||!input.body||typeof input.body!=='object'||Array.isArray(input.body)) return {ok:false,code:'pending_request_rejected'}
  const keys=Object.keys(input.body).sort().join(',')
  const body=input.body
  if(input.url===urls[0]) {
    if(keys!=='cardSuffixLength,companyCode'||body.cardSuffixLength!==4||body.companyCode!=='99') return {ok:false,code:'pending_request_rejected'}
  } else if(keys!=='billingMonth,card4Number,cardStatus,companyCode,isNextBillingDate,isPartner'
    ||!/^\d{4}$/.test(body.card4Number)||!/^01\/(0[1-9]|1[0-2])\/\d{4}$/.test(body.billingMonth)
    ||body.isNextBillingDate!==true||![0,1].includes(body.cardStatus)||![11,77].includes(body.companyCode)||typeof body.isPartner!=='boolean') return {ok:false,code:'pending_request_rejected'}
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),20_000)
  let reader
  try {
    const response=await fetch(input.url,{method:'POST',credentials:'include',redirect:'error',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(input.body)})
    if(response.status===429) return {ok:false,code:'pending_rate_limited'}
    if(response.status===401||response.status===403) return {ok:false,code:'pending_auth_required'}
    if(!response.ok||response.redirected||response.url!==input.url) return {ok:false,code:'pending_http_failed'}
    if(!/^application\/(?:[a-z0-9.+-]*\+)?json(?:;|$)/i.test(response.headers.get('content-type')||'')) return {ok:false,code:'pending_non_json'}
    const length=response.headers.get('content-length')
    if(length!==null&&(!/^\d+$/.test(length)||Number(length)>2_000_000)) return {ok:false,code:'pending_response_limit'}
    if(!response.body?.getReader) return {ok:false,code:'pending_stream_unavailable'}
    reader=response.body.getReader()
    const decoder=new TextDecoder();let total=0,text=''
    while(true) {
      const chunk=await reader.read()
      if(chunk.done) break
      total+=chunk.value.byteLength
      if(total>2_000_000) {controller.abort();return {ok:false,code:'pending_response_limit'}}
      text+=decoder.decode(chunk.value,{stream:true})
    }
    text+=decoder.decode()
    let payload
    try {payload=JSON.parse(text)} catch {return {ok:false,code:'pending_non_json'}}
    return {ok:true,payload}
  } catch {return {ok:false,code:controller.signal.aborted?'pending_timeout':'pending_network_failed'}}
  finally {
    clearTimeout(timer)
    if(reader) {try {await reader.cancel()} catch { /* no raw failures */ }}
  }
}
const SESSION_CODES=new Set(['pending_request_rejected','pending_rate_limited','pending_auth_required',
  'pending_http_failed','pending_non_json','pending_response_limit','pending_stream_unavailable',
  'pending_timeout','pending_network_failed','pending_outer_timeout','pending_session_failed','pending_session_stopped'])
function sessionError(code) {const e=new Error(SESSION_CODES.has(code)?code:'pending_session_failed');e.code=e.message;return e}
export function createPendingSessionTransport(page,{outerTimeoutMs=25_000}={}) {
  if(!page||typeof page.evaluate!=='function') throw Error('pending_session_unavailable')
  if(!Number.isInteger(outerTimeoutMs)||outerTimeoutMs<1||outerTimeoutMs>25_000) throw Error('pending_timeout_invalid')
  const deadline=Date.now()+outerTimeoutMs
  let stopped=false
  return async request=>{
    if(stopped) throw sessionError('pending_session_stopped')
    validateRequest(request)
    const remaining=deadline-Date.now()
    if(remaining<=0) {stopped=true;throw sessionError('pending_outer_timeout')}
    let result,timer
    try {
      // Native AbortSignal does not protect against a hung renderer/CDP call.
      // An outer deadline releases posted completion; scraper terminate then
      // closes the owned page/browser. Late evaluate rejection is race-handled.
      result=await Promise.race([
        page.evaluate(boundedIssuerPost,{url:request.url,body:request.body}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(sessionError('pending_outer_timeout')),remaining)}),
      ])
    } catch(error) {
      stopped=true
      throw sessionError(error?.code==='pending_outer_timeout'?'pending_outer_timeout':'pending_session_failed')
    } finally {clearTimeout(timer)}
    if(!result?.ok) {stopped=true;throw sessionError(SESSION_CODES.has(result?.code)?result.code:'pending_session_failed')}
    return result.payload
  }
}
/**
 * Opt-in hook only; caller must verify pinned scraper API compatibility first.
 * Original posted extraction and terminate remain owned by existing scraper.
 * Returned pending result is separate, never attached to posted result/accounts.
 */
export function attachPendingSessionHook(scraper,target,{observedAt=()=>new Date().toISOString(),outerTimeoutMs=25_000}={}) {
  if(!scraper||typeof scraper.fetchData!=='function'||typeof scraper.terminate!=='function') throw Error('pending_hook_incompatible')
  if(!target||typeof target.accountKey!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(target.accountKey)||!/^\d{4}$/.test(target.cardSuffix)||!['11','77'].includes(String(target.companyCode))||typeof target.isPartner!=='boolean') throw Error('pending_target_invalid')
  const ownDescriptor=Object.getOwnPropertyDescriptor(scraper,'fetchData')
  const original=scraper.fetchData
  let pending={success:false,state:'unknown',error:'pending_not_observed'}
  let called=false
  const wrapped=async function(...args) {
    const posted=await original.apply(this,args)
    if(called||posted?.success!==true) return posted
    called=true
    try {
      await preparePendingPage(this.page)
      const transport=createPendingSessionTransport(this.page,{outerTimeoutMs})
      const cardList=await transport({url:PENDING_ENDPOINTS.cards,method:'POST',body:{companyCode:'99',cardSuffixLength:4}})
      pending=await collectPending({cardList,target,requestInSession:transport,observedAt:observedAt()})
    } catch(error) {pending={success:false,state:'unknown',error:SESSION_CODES.has(error?.code)?error.code:'pending_session_unavailable'}}
    return posted
  }
  scraper.fetchData=wrapped
  return {
    getResult:()=>structuredClone(pending),
    detach:()=>{if(scraper.fetchData===wrapped) {if(ownDescriptor) Object.defineProperty(scraper,'fetchData',ownDescriptor);else delete scraper.fetchData}},
  }
}

// Discovery-only hook: no approval request, no bank payload persistence. The
// result closes over this exact authenticated scraper instance and account run.
export function attachPendingDiscoveryHook(scraper,{outerTimeoutMs=25_000}={}){
 if(!scraper||typeof scraper.fetchData!=='function')throw Error('pending_hook_incompatible')
 const descriptor=Object.getOwnPropertyDescriptor(scraper,'fetchData'),original=scraper.fetchData
 let result={success:false,cards:[],error:'pending_not_observed'},called=false
 scraper.fetchData=async function(...args){
  const posted=await original.apply(this,args)
  if(called||posted?.success!==true)return posted
  called=true
  try{
   await preparePendingPage(this.page)
   const transport=createPendingSessionTransport(this.page,{outerTimeoutMs}),cards=[]
   // Match the issuer UI's combined list. Asking for a company with no cards can
   // reject discovery even when the user's intended card was already found.
   const response=await transport({url:PENDING_ENDPOINTS.cards,method:'POST',body:{companyCode:'99',cardSuffixLength:4}})
   if(!object(response)||response.isSuccess!==true||!['0',0,null,undefined].includes(response.errorCode)||!Array.isArray(response.data?.cardsList))throw Error()
   for(const c of response.data.cardsList){
    if(!/^\d{4}$/.test(c?.cardSuffix)||!['11','77'].includes(String(c?.companyCode))||typeof c?.isPartner!=='boolean')throw Error()
    cards.push({cardSuffix:c.cardSuffix,companyCode:String(c.companyCode),isPartner:c.isPartner})
   }
   if(cards.length>20||new Set(cards.map(c=>JSON.stringify(c))).size!==cards.length)throw Error()
   result={success:true,cards}
  }catch(error){result={success:false,cards:[],error:SESSION_CODES.has(error?.code)?error.code:'pending_contract_unsupported'}}
  return posted
 }
 const wrapped=scraper.fetchData
 return{getResult:()=>structuredClone(result),detach:()=>{if(scraper.fetchData===wrapped){if(descriptor)Object.defineProperty(scraper,'fetchData',descriptor);else delete scraper.fetchData}}}
}
