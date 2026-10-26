import test from 'node:test'
import assert from 'node:assert/strict'
import {boundedIssuerPost,createPendingSessionTransport,attachPendingSessionHook} from '../src/isracard-pending-session.js'
import {PENDING_ENDPOINTS} from '../src/isracard-pending-collector.js'
const request={url:PENDING_ENDPOINTS.cards,method:'POST',body:{companyCode:11,cardSuffixLength:4}}
const response=(overrides={})=>({status:200,ok:true,redirected:false,url:request.url,headers:new Headers({'content-type':'application/json'}),body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"isSuccess":true}'));c.close()}}),...overrides})
async function withFetch(fake,fn){const prior=globalThis.fetch;globalThis.fetch=fake;try{return await fn()}finally{globalThis.fetch=prior}}
test('bounded callback sends fixed POST credentials only to issuer, redirect error, abort signal',()=>withFetch(async(url,init)=>{assert.equal(url,request.url);assert.equal(init.method,'POST');assert.equal(init.redirect,'error');assert.equal(init.credentials,'include');assert.ok(init.signal);return response()},async()=>assert.equal((await boundedIssuerPost(request)).ok,true)))
test('unlisted URL never invokes fetch',()=>withFetch(async()=>{throw Error('should not call')},async()=>assert.equal((await boundedIssuerPost({...request,url:'https://untrusted.invalid'})).code,'pending_request_rejected')))
for(const [status,code] of [[429,'pending_rate_limited'],[401,'pending_auth_required'],[403,'pending_auth_required'],[500,'pending_http_failed']]) test(`status${status} fails closed`,()=>withFetch(async()=>response({status,ok:false}),async()=>assert.equal((await boundedIssuerPost(request)).code,code)))
test('HTML challenge never parsed/reflected',()=>withFetch(async()=>response({headers:new Headers({'content-type':'text/html'})}),async()=>assert.deepEqual(await boundedIssuerPost(request),{ok:false,code:'pending_non_json'})))
test('oversized Content-Length blocked before streaming',()=>withFetch(async()=>response({headers:new Headers({'content-type':'application/json','content-length':'2000001'})}),async()=>assert.equal((await boundedIssuerPost(request)).code,'pending_response_limit')))
test('actual stream byte limit enforced without declared length',()=>withFetch(async()=>response({body:new ReadableStream({start(c){c.enqueue(new Uint8Array(2_000_001));c.close()}})}),async()=>assert.equal((await boundedIssuerPost(request)).code,'pending_response_limit')))
test('redirected response blocked',()=>withFetch(async()=>response({redirected:true}),async()=>assert.equal((await boundedIssuerPost(request)).code,'pending_http_failed')))
test('malformed JSON never includes raw content/error',()=>withFetch(async()=>response({body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('PRIVATE_SECRET'));c.close()}})}),async()=>assert.deepEqual(await boundedIssuerPost(request),{ok:false,code:'pending_non_json'})))
test('thrown network error never includes raw exception',()=>withFetch(async()=>{throw Error('PRIVATE_SECRET')},async()=>assert.deepEqual(await boundedIssuerPost(request),{ok:false,code:'pending_network_failed'})))
test('session transport rejects arbitrary body keys before evaluate',async()=>{let n=0;const transport=createPendingSessionTransport({evaluate:async()=>{n++}});await assert.rejects(transport({...request,body:{...request.body,password:'private'}}));assert.equal(n,0)})
test('session stops after any failure, no retry',async()=>{let n=0;const transport=createPendingSessionTransport({evaluate:async()=>{n++;return{ok:false,code:'pending_rate_limited'}}});await assert.rejects(transport(request));await assert.rejects(transport(request));assert.equal(n,1)})
const target={accountKey:'isracard-2',cardSuffix:'1234',companyCode:'11',isPartner:false}
const cardList={isSuccess:true,errorCode:'0',data:{cardsList:[{...target,isActive:true,cardChargeNext:{billingDate:'15/11/2026',period:'Next'}}]}}
const approvals={isSuccess:true,errorCode:'0',data:{approvals:{approvedTransactions:[],totalEstimatedAmount:0},currentTransactionsList:null,israelAbroadVouchers:null}}
test('same-session lifecycle preserves exact posted object, collects before terminate, no extra login',async()=>{
 const events=[];const posted={success:true,accounts:[{txns:[{date:'unchanged'}]}]}
 const scraper={page:{evaluate:async(fn,arg)=>{events.push(arg.url);return{ok:true,payload:arg.url===PENDING_ENDPOINTS.cards?cardList:approvals}}},fetchData:async()=>{events.push('posted');return posted},terminate:async()=>events.push('terminate')}
 const original=scraper.fetchData;const hook=attachPendingSessionHook(scraper,target)
 assert.equal(await scraper.fetchData(),posted);await scraper.terminate()
 assert.deepEqual(events,['posted',PENDING_ENDPOINTS.cards,PENDING_ENDPOINTS.transactions,'terminate'])
 assert.equal(hook.getResult().success,true);assert.equal('pending' in posted,false)
 hook.detach();assert.equal(scraper.fetchData,original)
})
test('posted failure never accesses session',async()=>{
 let n=0;const posted={success:false};const scraper={fetchData:async()=>posted,terminate:async()=>{},page:{evaluate:async()=>{n++}}}
 const hook=attachPendingSessionHook(scraper,target);assert.equal(await scraper.fetchData(),posted);assert.equal(n,0);assert.equal(hook.getResult().success,false)
})
test('pending transport failure does not change posted result or terminate cleanup',async()=>{
 let closed=false;const posted={success:true,accounts:[]};const scraper={fetchData:async()=>posted,terminate:async()=>{closed=true},page:{evaluate:async()=>{throw Error('PRIVATE')}}}
 const hook=attachPendingSessionHook(scraper,target);assert.equal(await scraper.fetchData(),posted);await scraper.terminate();assert.equal(closed,true);assert.equal(hook.getResult().success,false);assert.equal(JSON.stringify(hook.getResult()).includes('PRIVATE'),false)
})
test('original extraction throw retains existing cleanup ownership and no pending attempt',async()=>{
 let n=0;const scraper={fetchData:async()=>{throw Error('posted failed')},terminate:async()=>{},page:{evaluate:async()=>{n++}}};attachPendingSessionHook(scraper,target);await assert.rejects(scraper.fetchData());assert.equal(n,0)
})
test('incompatible lifecycle rejected offline',()=>assert.throws(()=>attachPendingSessionHook({scrape:()=>{}},target)))

test('browser callback independently rejects secret/unlisted body keys before fetch',()=>withFetch(async()=>{throw Error('should not call')},async()=>assert.equal((await boundedIssuerPost({...request,body:{...request.body,password:'PRIVATE'}})).code,'pending_request_rejected')))
test('invalid target rejected before any hook/session mutation',()=>{const scraper={fetchData:async()=>({success:true}),terminate:async()=>{}};const original=scraper.fetchData;assert.throws(()=>attachPendingSessionHook(scraper,{...target,companyCode:'bad'}));assert.equal(scraper.fetchData,original)})
test('browser callback rejects malformed transaction body independently',()=>withFetch(async()=>{throw Error('should not call')},async()=>assert.equal((await boundedIssuerPost({url:PENDING_ENDPOINTS.transactions,body:{card4Number:'1234'}})).code,'pending_request_rejected')))

test('outer deadline releases never-settling renderer evaluation and prohibits next request',async()=>{
 let calls=0;const transport=createPendingSessionTransport({evaluate:()=>{calls++;return new Promise(()=>{})}},{outerTimeoutMs:10})
 await assert.rejects(transport(request),{code:'pending_outer_timeout'})
 await assert.rejects(transport(request),{code:'pending_session_stopped'});assert.equal(calls,1)
})
test('hung pending evaluate still returns exact posted object and permits normal cleanup',async()=>{
 let closed=false;const posted={success:true,accounts:[]}
 const scraper={fetchData:async()=>posted,terminate:async()=>{closed=true},page:{evaluate:()=>new Promise(()=>{})}}
 const hook=attachPendingSessionHook(scraper,target,{outerTimeoutMs:10})
 assert.equal(await scraper.fetchData(),posted);await scraper.terminate();assert.equal(closed,true)
 assert.equal(hook.getResult().error,'pending_outer_timeout')
})
test('fixed rate limit diagnostic survives transport and hook without raw payload',async()=>{
 const scraper={fetchData:async()=>({success:true}),terminate:async()=>{},page:{evaluate:async()=>({ok:false,code:'pending_rate_limited',message:'PRIVATE'})}}
 const hook=attachPendingSessionHook(scraper,target);await scraper.fetchData();assert.equal(hook.getResult().error,'pending_rate_limited');assert.equal(JSON.stringify(hook.getResult()).includes('PRIVATE'),false)
})
test('arbitrary page diagnostic is never reflected',async()=>{
 const transport=createPendingSessionTransport({evaluate:async()=>({ok:false,code:'PRIVATE'})})
 await assert.rejects(transport(request),{code:'pending_session_failed'})
})
test('outer deadline cannot be disabled or expanded',()=>{for(const outerTimeoutMs of [0,Infinity,25001]) assert.throws(()=>createPendingSessionTransport({evaluate:()=>{}},{outerTimeoutMs}))})

test('outer budget covers pair of calls together, not a fresh timeout per call',async(t)=>{
 t.mock.timers.enable({apis:['Date','setTimeout']})
 let calls=0;const transport=createPendingSessionTransport({evaluate:async()=>{calls++;await new Promise(r=>setTimeout(r,20));return{ok:true,payload:{}}}},{outerTimeoutMs:30})
 const first=transport(request);t.mock.timers.tick(20);await first
 const second=assert.rejects(transport(request),{code:'pending_outer_timeout'});t.mock.timers.tick(10);await second;assert.equal(calls,2)
})
test('second call fixed auth failure survives collector, no raw response',async()=>{
 let calls=0;const scraper={fetchData:async()=>({success:true}),terminate:async()=>{},page:{evaluate:async()=>++calls===1?{ok:true,payload:cardList}:{ok:false,code:'pending_auth_required',message:'PRIVATE'}}}
 const hook=attachPendingSessionHook(scraper,target);await scraper.fetchData();assert.equal(hook.getResult().error,'pending_auth_required')
})

test('detach removes override when original fetchData inherited',()=>{const proto={fetchData:async()=>({success:true}),terminate:async()=>{}};const scraper=Object.create(proto);const hook=attachPendingSessionHook(scraper,target);assert.equal(Object.hasOwn(scraper,'fetchData'),true);hook.detach();assert.equal(Object.hasOwn(scraper,'fetchData'),false);assert.equal(scraper.fetchData,proto.fetchData)})
test('detach restores exact own-property descriptor',()=>{const scraper={terminate:async()=>{}};const fn=async()=>({success:true});Object.defineProperty(scraper,'fetchData',{value:fn,writable:true,enumerable:false,configurable:true});const before=Object.getOwnPropertyDescriptor(scraper,'fetchData');const hook=attachPendingSessionHook(scraper,target);hook.detach();assert.deepEqual(Object.getOwnPropertyDescriptor(scraper,'fetchData'),before)})
test('discovery hook returns only exact allowlisted card tuple fields in same scraper session',async()=>{
 const {attachPendingDiscoveryHook}=await import('../src/isracard-pending-session.js')
 const events=[],scraper={fetchData:async()=>({success:true}),page:{evaluate:async(_,r)=>{events.push(r);return{ok:true,payload:{isSuccess:true,errorCode:'0',data:{cardsList:[{cardSuffix:r.body.companyCode===11?'1234':'5678',companyCode:r.body.companyCode,isPartner:false,PRIVATE:'never returned'}]}}}}}}
 const original=scraper.fetchData,hook=attachPendingDiscoveryHook(scraper);await scraper.fetchData();assert.equal(events.length,2);assert.deepEqual(hook.getResult(),{success:true,cards:[{cardSuffix:'1234',companyCode:'11',isPartner:false},{cardSuffix:'5678',companyCode:'77',isPartner:false}]});hook.detach();assert.equal(scraper.fetchData,original)
})
