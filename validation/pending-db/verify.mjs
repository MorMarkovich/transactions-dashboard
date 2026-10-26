// Native PostgreSQL + real PostgREST, restricted to a disposable loopback DB.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHmac, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'
import { readPendingCard, savePendingObservation } from '../../bank-sync/src/pending-store.js'
const requireBank = createRequire(new URL('../../bank-sync/package.json', import.meta.url))
const { createClient } = requireBank('@supabase/supabase-js')
const database = new URL(process.env.PINKAS_TEST_DB_URL || '')
const api = new URL(process.env.PINKAS_TEST_API_URL || '')
assert.ok(['localhost','127.0.0.1'].includes(database.hostname))
assert.ok(['postgres:','postgresql:'].includes(database.protocol))
assert.match(database.pathname, /^\/pinkas_isolated(?:_[a-z0-9]+)?$/)
assert.equal(api.protocol,'http:'); assert.ok(['localhost','127.0.0.1'].includes(api.hostname))
const secret = process.env.PINKAS_TEST_JWT_SECRET
assert.ok(secret?.startsWith('pinkas-isolated-') && secret.length >= 32)
const admin = new pg.Client({ connectionString: database.href, query_timeout: 10000 })
const report = []
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const key = () => JSON.stringify(['isracard',`pending-${randomUUID()}`,'11',false,'1234'])
const timestamp='2026-10-26T12:00:00.000Z'
function state(cardKey) {
  const scope=cardKey+'|2026-11'
  return { state:'current',checkedAt:timestamp,unresolved:[],current:{success:true,cardKey,scope,observedAt:timestamp,
    rows:Array.from({length:4},(_,i)=>({identity:JSON.stringify([scope,1,`000${i}`,`synthetic-${i}`]),date:'2026-10-25',merchant:`Synthetic ${i}`,authorizationMinor:1000+i,currency:'ILS',status:'pending'}))} }
}
function token(userId,role='authenticated') {
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned=encode({alg:'HS256',typ:'JWT'})+'.'+encode({role,...(userId?{sub:userId}:{}),exp:Math.floor(Date.now()/1000)+600})
  return unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url')
}
async function request(path,{user=A,role='authenticated',method='GET',body}={}) {
  const response=await fetch(new URL(path,api),{method,headers:{Authorization:`Bearer ${token(user,role)}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)})
  const text=await response.text(); let data;try{data=JSON.parse(text)}catch{data=text}
  return {status:response.status,data}
}
const rpc=(cardKey,version,data,options={})=>request('/rpc/write_pending_card_snapshot',{...options,method:'POST',body:{p_card_key:cardKey,p_expected_version:version,p_data:data}})
async function check(name,fn) {await fn();report.push(name);console.log('PASS',name)}
async function sqlClient(user) {
  const client=new pg.Client({connectionString:database.href,query_timeout:10000});await client.connect()
  await client.query('BEGIN');await client.query('SET LOCAL ROLE authenticated')
  await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:'authenticated',sub:user})])
  return client
}
await admin.connect()
try {
  const prepared=process.argv.includes('--prepared')
  if(!prepared)await admin.query(await readFile(new URL('./bootstrap.sql',import.meta.url),'utf8'))
  const before=(await admin.query("SELECT pg_get_functiondef('public.delete_my_account()'::regprocedure) AS body")).rows[0].body
  if(!prepared){
    await admin.query(await readFile(new URL('../../supabase/migrations/20261026211104_pending_card_snapshots.sql',import.meta.url),'utf8'))
    assert.equal((await admin.query("SELECT pg_get_functiondef('public.delete_my_account()'::regprocedure) AS body")).rows[0].body,before)
    await admin.query('INSERT INTO auth.users(id) VALUES($1),($2)',[A,B])
    await admin.query('INSERT INTO public.saved_transactions VALUES($1,$3),($2,$3)',[A,B,JSON.stringify([{amount:99,description:'synthetic posted'}])])
  }
  if(process.argv.includes('--prepare')){await admin.end();console.log('Isolated schema prepared; deletion function unchanged');process.exit(0)}
  await admin.query("NOTIFY pgrst,'reload schema'")
  for(let i=0;i<100;i++){const ready=await request('/pending_card_snapshots?select=card_key').catch(()=>null);if(ready?.status===200)break;if(i===99)throw Error('PostgREST not ready');await delay(100)}
  const cardKey=key(), value=state(cardKey)
  await check('migration preserves existing deletion function and grants least privilege',async()=>{
    assert.equal((await admin.query("SELECT pg_get_functiondef('public.delete_my_account()'::regprocedure) AS body")).rows[0].body,before)
    const r=(await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.pending_card_snapshots'::regclass")).rows[0]
    assert.equal(r.relrowsecurity,true);assert.equal(r.relforcerowsecurity,true)
    const fn=(await admin.query("SELECT p.prosecdef,n.nspname,p.proconfig FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE p.proname='write_pending_card_snapshot' ORDER BY n.nspname")).rows
    assert.equal(fn.find(f=>f.nspname==='public').prosecdef,false)
    assert.equal(fn.find(f=>f.nspname==='pinkas_private').prosecdef,true)
    assert.ok(fn.every(f=>f.proconfig.includes('search_path=""')))
  })
  await check('four pending rows written by RPC; another owner sees none',async()=>{
    assert.deepEqual(await rpc(cardKey,0,value),{status:200,data:1})
    assert.equal((await request('/pending_card_snapshots')).data[0].data.current.rows.length,4)
    assert.deepEqual((await request('/pending_card_snapshots',{user:B})).data,[])
    assert.deepEqual(await rpc(cardKey,0,value,{user:B}),{status:200,data:1})
    assert.equal((await request('/pending_card_snapshots')).data.length,1)
  })
  for(const role of ['anon','service_role'])await check(`${role} cannot read or invoke writes`,async()=>{
    assert.ok([401,403].includes((await request('/pending_card_snapshots',{role})).status))
    assert.ok([401,403].includes((await rpc(cardKey,1,value,{role})).status))
  })
  await check('authenticated direct insert/update/delete and private helper access denied',async()=>{
    for(const method of ['POST','PATCH','DELETE'])assert.equal((await request('/pending_card_snapshots',{method,body:method==='DELETE'?undefined:{user_id:A,card_key:cardKey,version:99,data:value}})).status,403)
    assert.equal((await request('/rpc/pending_snapshot_valid',{method:'POST',body:{p:value,p_card_key:cardKey}})).status,404)
    assert.equal((await rpc(cardKey,1,value,{user:null})).status,403)
  })
  await check('forged owner parameter rejected and stale CAS cannot overwrite',async()=>{
    const response=await request('/rpc/write_pending_card_snapshot',{method:'POST',body:{p_card_key:cardKey,p_expected_version:1,p_data:value,user_id:B}})
    assert.equal(response.status,404)
    assert.equal((await rpc(cardKey,0,value)).data.code,'P0002')
  })
  await check('eight simultaneous writers produce one winner, seven conflicts',async()=>{
    const results=await Promise.all(Array.from({length:8},()=>rpc(cardKey,1,value)))
    assert.equal(results.filter(r=>r.status===200&&r.data===2).length,1)
    assert.equal(results.filter(r=>r.data.code==='P0002').length,7)
  })
  const mutations={
    'wrong source':d=>d.current.cardKey='other', 'wrong billing scope':d=>d.current.scope+='bad',
    'cross-scope identity':d=>d.current.rows[0].identity=JSON.stringify(['other',1,'x','t']),
    'numeric merchant':d=>d.current.rows[0].merchant=123, 'blank merchant':d=>d.current.rows[0].merchant=' ',
    'invalid date':d=>d.current.rows[0].date='2026-02-31','FX':d=>d.current.rows[0].currency='USD',
    'fractional minor units':d=>d.current.rows[0].authorizationMinor=1.1,
    'unsafe amount':d=>d.current.rows[0].authorizationMinor=9007199254740992,
    'duplicate identity':d=>d.current.rows[1].identity=d.current.rows[0].identity,
    'extra raw payload':d=>d.current.rows[0].password='synthetic',
    'unknown current':d=>d.current=null, 'too many unresolved':d=>d.unresolved=Array(13).fill(d.current),
    'duplicate unresolved':d=>d.unresolved=Array(2).fill(d.current),
    'empty snapshot object':d=>d.current={}, 'invalid timestamp':d=>d.checkedAt='infinity',
    'oversized payload':d=>d.current.rows=Array.from({length:1000},(_,i)=>({...d.current.rows[0],merchant:'x'.repeat(500),identity:JSON.stringify([d.current.scope,1,String(i),'t'])})),
  }
  for(const [name,mutate]of Object.entries(mutations))await check(`reject malformed state: ${name}`,async()=>{
    const data=structuredClone(value);mutate(data)
    assert.equal((await rpc(cardKey,2,data)).data.code,'22023')
  })
  await check('actual application store round-trip, stale retention, empty and rollover',async()=>{
    const sdk=createClient(api.origin,'synthetic-only',{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token(A)}`},fetch:(url,options)=>{
      const target=new URL(url);assert.equal(target.origin,api.origin);target.pathname=target.pathname.replace(/^\/rest\/v1/,'')
      return fetch(target,{...options,signal:AbortSignal.timeout(10000)})
    }}})
    let previous=await readPendingCard(sdk,A,cardKey)
    assert.equal(previous.version,2)
    previous=await savePendingObservation(sdk,{userId:A,cardKey,previous,fresh:{success:false,error:'pending_timeout'},checkedAt:timestamp})
    assert.equal(previous.data.state,'stale');assert.equal(previous.data.current.rows.length,4)
    const next=structuredClone(value.current);next.scope=cardKey+'|2026-12';next.rows=[]
    previous=await savePendingObservation(sdk,{userId:A,cardKey,previous,fresh:next,checkedAt:timestamp})
    assert.equal(previous.data.unresolved[0].rows.length,4);assert.equal(previous.data.current.rows.length,0)
    assert.deepEqual(await readPendingCard(sdk,A,cardKey),previous)
  })
  await check('invalidation tombstone blocks stale writer resurrection',async()=>{
    const k=key(),d=state(k)
    assert.equal((await rpc(k,0,{state:'unknown',checkedAt:timestamp,current:null,unresolved:[],error:'pending_not_observed'})).status,200)
    assert.equal((await rpc(k,0,d)).data.code,'P0002')
  })
  await check('owner quota is atomic with concurrent new cards',async()=>{
    const user=randomUUID();await admin.query('INSERT INTO auth.users VALUES($1)',[user])
    for(let i=0;i<19;i++){const k=key();assert.equal((await rpc(k,0,state(k),{user})).status,200)}
    const results=await Promise.all([key(),key()].map(k=>rpc(k,0,state(k),{user})))
    assert.equal(results.filter(r=>r.status===200).length,1)
    assert.equal(results.filter(r=>r.data.code==='54000').length,1)
  })
  await check('pending writes leave posted snapshots unchanged',async()=>{
    const rows=(await admin.query('SELECT data FROM public.saved_transactions')).rows
    assert.equal(rows.length,2);assert.ok(rows.every(r=>r.data[0].amount===99&&r.data.length===1))
  })
  await check('account deletion cascades only that owner; old JWT cannot resurrect rows',async()=>{
    assert.equal((await request('/rpc/delete_my_account',{method:'POST',body:{}})).status,204)
    assert.deepEqual((await request('/pending_card_snapshots')).data,[])
    assert.equal((await request('/pending_card_snapshots',{user:B})).data.length,1)
    const k=key();assert.equal((await rpc(k,0,state(k))).status,403)
    assert.equal((await admin.query('SELECT user_id FROM public.saved_transactions')).rows[0].user_id,B)
  })
  for(const order of ['write-first','delete-first'])await check(`concurrent account deletion: ${order}`,async()=>{
    const user=randomUUID(),k=key(),d=state(k);await admin.query('INSERT INTO auth.users VALUES($1)',[user])
    const writer=await sqlClient(user),deleter=await sqlClient(user)
    try{
      if(order==='write-first'){
        await writer.query('SELECT public.write_pending_card_snapshot($1,0,$2)',[k,d])
        const deleting=deleter.query('SELECT public.delete_my_account()')
        await delay(50);await writer.query('COMMIT');await deleting;await deleter.query('COMMIT')
      }else{
        await deleter.query('SELECT public.delete_my_account()')
        const writing=assert.rejects(writer.query('SELECT public.write_pending_card_snapshot($1,0,$2)',[k,d]),{code:'42501'})
        await delay(50);await deleter.query('COMMIT');await writing;await writer.query('ROLLBACK')
      }
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM public.pending_card_snapshots WHERE user_id=$1',[user])).rows[0].n,0)
    }finally{await writer.end();await deleter.end()}
  })
  const result={passed:report.length,tests:report,postgres:(await admin.query('SHOW server_version')).rows[0].server_version,postgrest:'16.5',syntheticOnly:true}
  if(process.env.PINKAS_TEST_REPORT)await writeFile(process.env.PINKAS_TEST_REPORT,JSON.stringify(result,null,2)+'\n')
  console.log(`PASS ${report.length} native database/API checks`)
} finally {await admin.end()}
