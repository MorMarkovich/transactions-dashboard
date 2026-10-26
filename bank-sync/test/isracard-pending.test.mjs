import test from 'node:test'
import assert from 'node:assert/strict'
import {nextRequest,parseIlsPending,replacePending} from '../src/isracard-pending.js'
const card={cardSuffix:'1234',isActive:true,isPartner:false,companyCode:'11',cardChargeNext:{billingDate:'15/10/2026',period:'Next'}}
const request=()=>nextRequest(card,'verified-account-card-A')
const row=(overrides={})=>({confirmationLocation:1,seqConfirmationNumber:'001',confirmationTimeStamp:'opaque:001',purchaseDate:'25/10/2026',businessName:'Synthetic cafe',currencyIso:'ILS',originalAmount:7.55,...overrides})
const response=(rows)=>({isSuccess:true,errorCode:'0',data:{approvals:{approvedTransactions:rows,totalEstimatedAmount:0},currentTransactionsList:null,israelAbroadVouchers:null}})
test('Next is discovered even when billing month is current calendar month',()=>assert.equal(request().body.isNextBillingDate,true))
test('missing Next period fails closed',()=>assert.throws(()=>nextRequest({...card,cardChargeNext:{billingDate:'15/10/2026'}},'A')))
test('unknown company is never defaulted',()=>assert.throws(()=>nextRequest({...card,companyCode:'99'},'A')))
test('date validated without timezone day shift',()=>assert.equal(parseIlsPending(response([row()]),request()).rows[0].date,'2026-10-25'))
test('ILS authorization exact minor units, not a billed charge',()=>assert.equal(parseIlsPending(response([row()]),request()).rows[0].authorizationMinor,755))
test('negative original amount retained, not classified as refund',()=>assert.equal(parseIlsPending(response([row({originalAmount:-5})]),request()).rows[0].authorizationMinor,-500))
test('unsupported FX fails closed',()=>assert.throws(()=>parseIlsPending(response([row({currencyIso:'USD'})]),request())))
test('bad precision fails closed',()=>assert.throws(()=>parseIlsPending(response([row({originalAmount:0.001})]),request())))
test('duplicate identical purchases with distinct native tuple preserved',()=>assert.equal(parseIlsPending(response([row(),row({seqConfirmationNumber:'002'})]),request()).rows.length,2))
test('colliding native tuple never silently deduped',()=>assert.throws(()=>parseIlsPending(response([row(),row()]),request())))
test('invalid calendar date rejected',()=>assert.throws(()=>parseIlsPending(response([row({purchaseDate:'31/02/2026'})]),request())))
test('root section error does not clear prior pending',()=>assert.throws(()=>parseIlsPending({...response([]),errorCode:'13'},request())))
test('missing approval property not confused with explicit empty',()=>assert.throws(()=>parseIlsPending({isSuccess:true,data:{}},request())))
test('explicit empty approvals accepted within same successful scope',()=>assert.equal(parseIlsPending(response([]),request()).rows.length,0))
test('failed fresh fetch retains prior as stale',()=>assert.equal(replacePending({scope:'A',rows:[row()]},null).state,'stale'))
test('rollover retains unresolved prior rather than declaring it posted',()=>assert.equal(replacePending({scope:'A',rows:[row()]},{scope:'B',rows:[],success:true}).state,'rollover_review'))
test('no posted dataset accepted or mutated by contract',()=>assert.deepEqual(Object.keys(replacePending(null,{scope:'A',rows:[],success:true})),['snapshot','state']))

import {discoverPendingRequest, collectPending, updatePendingBook, PENDING_ENDPOINTS} from '../src/isracard-pending-collector.js'
const target={accountKey:'isracard-2',cardSuffix:'1234',companyCode:'11',isPartner:false}
const cardList=()=>({isSuccess:true,errorCode:'0',data:{cardsList:[card]}})
const instant='2026-10-26T10:00:00Z'
test('target binds local account, company, partner and card',()=>assert.match(discoverPendingRequest(cardList(),target).cardKey,/isracard-2/))
test('same card and approval values from two local accounts remain distinct',()=>assert.notEqual(discoverPendingRequest(cardList(),target).scope,discoverPendingRequest(cardList(),{...target,accountKey:'isracard-3'}).scope))
test('duplicate discovered suffix/company/partner fails closed',()=>assert.throws(()=>discoverPendingRequest({isSuccess:true,data:{cardsList:[card,card]}},target)))
test('different company card cannot satisfy target',()=>assert.throws(()=>discoverPendingRequest(cardList(),{...target,companyCode:'77'})))
test('suffix-only target rejected',()=>assert.throws(()=>discoverPendingRequest(cardList(),{cardSuffix:'1234'})))
test('successful collector uses exactly one fixed-origin POST, no credential',async()=>{
 const calls=[]
 const result=await collectPending({cardList:cardList(),target,observedAt:instant,requestInSession:async req=>{calls.push(req);return response([row()])}})
 assert.equal(result.success,true);assert.equal(calls.length,1)
 assert.equal(calls[0].url,PENDING_ENDPOINTS.transactions);assert.equal(calls[0].redirect,'error');assert.equal(calls[0].retries,0)
 assert.deepEqual(Object.keys(calls[0].body).sort(),['billingMonth','card4Number','cardStatus','companyCode','isNextBillingDate','isPartner'])
})
test('ambiguous discovery makes no outbound calls',async()=>{
 let calls=0;const result=await collectPending({cardList:{isSuccess:false},target,observedAt:instant,requestInSession:async()=>{calls++;return response([])}})
 assert.equal(calls,0);assert.equal(result.success,false)
})
test('transport error content never escapes collector',async()=>{
 const result=await collectPending({cardList:cardList(),target,observedAt:instant,requestInSession:async()=>{throw Error('sensitive-bank-payload')}})
 assert.equal(JSON.stringify(result).includes('sensitive-bank-payload'),false)
})
test('cardGuid is not stable identity or retained raw',()=>{
 const list=cardList();list.data.cardsList[0]={...card,cardGuid:'sensitive-session-guid',holderName:'private-name'}
 assert.equal(JSON.stringify(discoverPendingRequest(list,target)).includes('sensitive-session-guid'),false)
 assert.equal(JSON.stringify(discoverPendingRequest(list,target)).includes('private-name'),false)
})
test('separate book replaces current scope, preserves other accounts and never mutates inputs',()=>{
 const key='cardA';const fresh={success:true,scope:'A:2026-10',cardKey:key,rows:[{identity:'tuple1'}]}
 const first=updatePendingBook(null,key,fresh,instant)
 const second=updatePendingBook(first,'cardB',{...fresh,cardKey:'cardB',scope:'B:2026-10'},instant)
 assert.equal(Object.keys(first.cards).length,1);assert.equal(Object.keys(second.cards).length,2)
 const empty=updatePendingBook(second,key,{...fresh,rows:[]},instant)
 assert.equal(empty.cards[key].current.rows.length,0);assert.equal(second.cards[key].current.rows.length,1);assert.equal(empty.cards.cardB.current.rows.length,1)
})
test('failed/partial response keeps previous pending stale, not empty',()=>{
 const fresh={success:true,scope:'A:2026-10',cardKey:'A',rows:[{identity:'one'}]}
 const previous=updatePendingBook(null,'A',fresh,instant)
 const next=updatePendingBook(previous,'A',{success:false},instant)
 assert.equal(next.cards.A.state,'stale');assert.equal(next.cards.A.current.rows.length,1)
})
test('scope rollover keeps old approvals unresolved, does not mix them with current',()=>{
 const prior=updatePendingBook(null,'A',{success:true,scope:'A:2026-10',cardKey:'A',rows:[{identity:'one'}]},instant)
 const next=updatePendingBook(prior,'A',{success:true,scope:'A:2026-11',cardKey:'A',rows:[]},instant)
 assert.equal(next.cards.A.state,'rollover_review');assert.equal(next.cards.A.unresolved.length,1);assert.equal(next.cards.A.current.rows.length,0)
})
test('returned rows project only financial display fields, not arbitrary response descendants',()=>{
 const parsed=parseIlsPending(response([row({password:'secret',holderId:'secret',arbitrary:{value:'secret'}})]),request())
 assert.equal(JSON.stringify(parsed).includes('secret'),false)
})

test('explicit null approvals accepted only with complete recognized sibling envelope',()=>{ const r=response([]);r.data.approvals=null;assert.equal(parseIlsPending(r,request()).rows.length,0);delete r.data.currentTransactionsList;assert.throws(()=>parseIlsPending(r,request())) })

test('observed current summary object accepted without manufacturing merchant rows',()=>{
 const r=response([]);r.data.currentTransactionsList={currentTransactionsBillingMonth:[{currentBillingMonth:'15/11/2026',totalTransactionsCurrency:[{transactionsCount:1,transactionsCurrency:0,transactionsSymbol:'ILS',transactionsTotal:20}]}]}
 assert.equal(parseIlsPending(r,request()).rows.length,0)
})
test('arbitrary summary array is unsupported rather than successful empty',()=>{const r=response([]);r.data.currentTransactionsList=[];assert.throws(()=>parseIlsPending(r,request()))})
test('missing root section status never becomes successful empty',()=>{const r=response([]);delete r.errorCode;assert.throws(()=>parseIlsPending(r,request()))})
test('missing observed approval total fails closed',()=>{const r=response([]);delete r.data.approvals.totalEstimatedAmount;assert.throws(()=>parseIlsPending(r,request()))})

test('unsafe numeric sequence and timestamp rejected rather than rounded/stringified',()=>{
 for(const field of ['seqConfirmationNumber','confirmationTimeStamp']) assert.throws(()=>parseIlsPending(response([row({[field]:9007199254740993})]),request()))
})
test('unsafe numeric location rejected rather than rounded',()=>assert.throws(()=>parseIlsPending(response([row({confirmationLocation:9007199254740993})]),request())))
test('leading zeros and opaque separators in string native tuple preserved exactly',()=>{
 const parsed=parseIlsPending(response([row({seqConfirmationNumber:'00001',confirmationTimeStamp:'001:002-03'})]),request())
 assert.match(parsed.rows[0].identity,/00001/);assert.match(parsed.rows[0].identity,/001:002-03/)
})
test('returned book shares no prior nested references on failure',()=>{
 const prior=updatePendingBook(null,'A',{success:true,scope:'A:2026-10',cardKey:'A',rows:[{identity:'one'}]},instant)
 const next=updatePendingBook(prior,'A',{success:false},instant)
 next.cards.A.current.rows[0].identity='changed'
 assert.equal(prior.cards.A.current.rows[0].identity,'one')
})
test('returned book shares no unrelated card references',()=>{
 const prior=updatePendingBook(null,'A',{success:true,scope:'A:2026-10',cardKey:'A',rows:[{identity:'one'}]},instant)
 const next=updatePendingBook(prior,'B',{success:false},instant)
 next.cards.A.current.rows[0].identity='changed'
 assert.equal(prior.cards.A.current.rows[0].identity,'one')
})
test('unresolved rollover backlog bounded by explicit blocking, never silent loss',()=>{
 const unresolved=Array.from({length:12},(_,i)=>({scope:`old:${i}`,rows:[{identity:`old${i}`}]}))
 const prior={version:1,cards:{A:{current:{scope:'current',rows:[{identity:'one'}]},unresolved}}}
 const next=updatePendingBook(prior,'A',{success:true,scope:'new',cardKey:'A',rows:[{identity:'new'}]},instant)
 assert.equal(next.cards.A.state,'retention_limit');assert.equal(next.cards.A.current.scope,'current');assert.equal(next.cards.A.unresolved.length,12)
 assert.equal(next.cards.A.error,'pending_review_backlog_full')
})
test('collector has distinct fixed discovery/transport/contract failures',async()=>{
 const base={target,observedAt:instant,cardList:cardList()}
 const discovery=await collectPending({...base,cardList:null,requestInSession:async()=>response([])})
 const transport=await collectPending({...base,requestInSession:async()=>{throw Error('private')}})
 const contract=await collectPending({...base,requestInSession:async()=>({isSuccess:false})})
 assert.deepEqual([discovery.error,transport.error,contract.error],['pending_discovery_unavailable','pending_transport_unavailable','pending_contract_unsupported'])
})
