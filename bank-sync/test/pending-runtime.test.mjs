import test from 'node:test'
import assert from 'node:assert/strict'
import {scrapeAccountWithPending} from '../src/pending-runtime.js'
import {resolvePendingBinding,bindingCardKey,createPendingScope,invalidatePendingBinding} from '../src/pending-binding.js'
const userId='11111111-1111-4111-8111-111111111111'
const account={key:'isracard-2',provider:'isracard',pending:{enabled:true,scopeId:createPendingScope(),dashboardUserId:userId,companyCode:'11',isPartner:false,cardSuffix:'1234',verifiedAt:'2026-10-26T10:00:00Z'}}
const client={auth:{getUser:async()=>({data:{user:{id:userId}}})}}
const input={account,credentials:{},options:{},client,userId}
function fake(){const calls=[];return{calls,scrapeProvider:async()=>{calls.push('posted');return ['posted']},scrapeProviderDetailed:async()=>{calls.push('detailed');return {transactions:['posted'],pending:{success:true}}},readPendingCard:async()=>{calls.push('read');return {version:0,data:null}},savePendingObservation:async()=>{calls.push('write')}}}
test('default off never reads or requests pending',async()=>{const d=fake();assert.equal((await scrapeAccountWithPending({...input,account:{key:'isracard'}},d)).pendingStatus,null);assert.deepEqual(d.calls,['posted'])})
test('optin user scoped pre-read detailed scrape and separate persistence',async()=>{const d=fake();assert.deepEqual((await scrapeAccountWithPending(input,d)).transactions,['posted']);assert.deepEqual(d.calls,['read','detailed','write'])})
test('bad binding or wrong owner never requests pending',async()=>{for(const a of [{...account,pending:{...account.pending,dashboardUserId:'other'}},{...account,pending:{...account.pending,scopeId:'isracard-2'}}]){const d=fake();await scrapeAccountWithPending({...input,account:a},d);assert.deepEqual(d.calls,['posted'])}})
test('storage/schema unavailable fails pending closed before extra issuer calls',async()=>{const d=fake();d.readPendingCard=async()=>{throw Error('PRIVATE')};assert.equal((await scrapeAccountWithPending(input,d)).pendingStatus,'pending_store_unavailable');assert.deepEqual(d.calls,['posted'])})
test('pending storage failure preserves posted result with fixed status',async()=>{const d=fake();d.savePendingObservation=async()=>{throw Error('PRIVATE')};const r=await scrapeAccountWithPending(input,d);assert.deepEqual(r.transactions,['posted']);assert.equal(r.pendingStatus,'pending_store_failed')})
test('scope not ordinal identity; key reuse generates distinct keys',()=>{const a=resolvePendingBinding(account,userId);const b=resolvePendingBinding({...account,pending:{...account.pending,scopeId:createPendingScope()}},userId);assert.notEqual(bindingCardKey(a),bindingCardKey(b))})
test('invalidation writes unknown tombstone even before first snapshot',async()=>{let args;const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:null})};await invalidatePendingBinding({from:()=>q,rpc:async(_,a)=>{args=a;return{data:1}}},account,userId);assert.equal(args.p_expected_version,0);assert.equal(args.p_data.state,'unknown');assert.equal(args.p_data.current,null)})
test('invalidation CAS failure aborts change',async()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:null})};await assert.rejects(invalidatePendingBinding({from:()=>q,rpc:async()=>({error:{message:'PRIVATE'}})},account,userId),{message:'pending_invalidation_failed'})})
test('discovery preparation default disabled and never uses suffix-only selection',async()=>{
 const {prepareDiscoveredPendingBinding}=await import('../src/pending-binding.js')
 const selected={cardSuffix:'1234',companyCode:'11',isPartner:false},discovered={isSuccess:true,data:{cardsList:[selected]}}
 const prepared=prepareDiscoveredPendingBinding(account,userId,selected,discovered)
 assert.equal(prepared.pending.enabled,false);assert.equal(resolvePendingBinding(prepared,userId),null)
 assert.throws(()=>prepareDiscoveredPendingBinding(account,userId,{cardSuffix:'1234'},discovered))
 assert.throws(()=>prepareDiscoveredPendingBinding(account,userId,selected,{...discovered,data:{cardsList:[selected,selected]}}))
})
test('setup mutation boundary invalidates then removes binding before changing credentials',async()=>{
 const {readFileSync}=await import('node:fs');const s=readFileSync(new URL('../src/setup.js',import.meta.url),'utf8')
 assert.match(s,/await invalidateBeforeChange\(acct\)[\s\S]*delete acct.pending[\s\S]*await setAccounts\(accounts\)[\s\S]*await setJSON\(credKey\(acct.key\), creds\)/)
 assert.match(s,/oldAuth\?\.email!==email\|\|oldAuth\?\.password!==password/)
 assert.match(s,/signOut\(\{scope:'local'\}\)/)
 assert.match(s,/withLocalSyncLock\(main\)/)
})
test('posted fetch failure marks previous pending stale without overriding bank error',async()=>{const d=fake(),error=new Error('bank');d.scrapeProviderDetailed=async()=>{throw error};await assert.rejects(scrapeAccountWithPending(input,d),e=>e===error);assert.deepEqual(d.calls,['read','write'])})
