import test from 'node:test'
import assert from 'node:assert/strict'
import {createProviderAdapter} from '../src/scrape.js'
import {PENDING_ENDPOINTS} from '../src/isracard-pending-collector.js'
const target={accountKey:'isracard-2',cardSuffix:'1234',companyCode:'11',isPartner:false}
const cards={isSuccess:true,errorCode:'0',data:{cardsList:[{...target,isActive:true,cardChargeNext:{billingDate:'15/11/2026',period:'Next'}}]}}
const approvals={isSuccess:true,errorCode:'0',data:{approvals:{approvedTransactions:[],totalEstimatedAmount:0},currentTransactionsList:null,israelAbroadVouchers:null}}
function fake({pendingFailure=false,postedFailure=false}={}){
 const events=[];const posted={date:'2026-10-25',description:'unchanged',chargedAmount:-10};let options
 const scraper={page:{evaluate:async(_,request)=>{events.push(request.url);if(pendingFailure)throw Error('PRIVATE');return{ok:true,payload:request.url===PENDING_ENDPOINTS.cards?cards:approvals}}},
 fetchData:async()=>{events.push('posted');return postedFailure?{success:false,errorType:'ACCOUNT_BLOCKED',errorMessage:'PRIVATE'}:{success:true,accounts:[{txns:[posted]}]}},
 terminate:async()=>events.push('terminate'),
 async scrape(){events.push('login');const result=await this.fetchData();await this.terminate();return result}}
 const original=scraper.fetchData
 const adapter=createProviderAdapter(async()=>({CompanyTypes:{isracard:'isracard',discount:'discount'},createScraper:o=>{options=o;return scraper}}))
 return {adapter,events,scraper,original,posted,get options(){return options}}
}
test('explicit detailed wiring uses one scraper/login and separates pending from exact posted values',async()=>{
 const f=fake();const result=await f.adapter('isracard',{password:'PRIVATE'},{pendingTarget:target})
 assert.equal(result.transactions[0],f.posted);assert.equal(result.pending.success,true)
 assert.deepEqual(f.events,['login','posted',PENDING_ENDPOINTS.cards,PENDING_ENDPOINTS.transactions,'terminate'])
 assert.equal(f.scraper.fetchData,f.original);assert.equal(f.options.skipCloseBrowser,undefined);assert.equal(f.options.storeFailureScreenShotPath,undefined)
})
test('default detailed entry does not enable pending',async()=>{const f=fake();const result=await f.adapter('isracard',{},{});assert.equal(result.pending,null);assert.deepEqual(f.events,['login','posted','terminate'])})
test('pending failure preserves posted transaction result/cleanup and fixed status only',async()=>{const f=fake({pendingFailure:true});const result=await f.adapter('isracard',{}, {pendingTarget:target});assert.equal(result.transactions[0],f.posted);assert.equal(result.pending.success,false);assert.ok(f.events.includes('terminate'));assert.equal(JSON.stringify(result).includes('PRIVATE'),false)})
test('posted failure maps fixed code, detaches hook, never triggers pending fetch',async()=>{const f=fake({postedFailure:true});await assert.rejects(f.adapter('isracard',{}, {pendingTarget:target}),{code:'BANK_BLOCKED'});assert.equal(f.scraper.fetchData,f.original);assert.deepEqual(f.events,['login','posted','terminate'])})
test('wrong provider or keep-open rejected before any login',async()=>{for(const options of [{pendingTarget:target,keepBrowserOpen:true},{pendingTarget:target}]){const f=fake();await assert.rejects(f.adapter(options.keepBrowserOpen?'isracard':'discount',{},options),{code:'BANK_PENDING_OPTIONS_INVALID'});assert.deepEqual(f.events,[])}})
test('bad target rejected before scrape or hook mutation',async()=>{const f=fake();await assert.rejects(f.adapter('isracard',{}, {pendingTarget:{...target,cardSuffix:'bad'}}),{code:'BANK_PENDING_OPTIONS_INVALID'});assert.equal(f.scraper.fetchData,f.original);assert.deepEqual(f.events,[])})
test('debug rejected before loader and never echoes environment',async()=>{const old=process.env.DEBUG;process.env.DEBUG='PRIVATE';let loaded=false;const adapter=createProviderAdapter(async()=>{loaded=true});try{await assert.rejects(adapter('isracard',{}),{code:'BANK_DEBUG_DISABLED_REQUIRED'});assert.equal(loaded,false)}finally{if(old===undefined)delete process.env.DEBUG;else process.env.DEBUG=old}})
