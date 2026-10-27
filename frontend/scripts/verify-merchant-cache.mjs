// Real PostgreSQL/WASM: atomic lookup reservations, RLS, durable reuse and quotas.
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {createServer} from 'node:http'
import assert from 'node:assert/strict'
const {PGlite}=await import(pathToFileURL(process.argv[2]))
const db=new PGlite()
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002'
await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
INSERT INTO auth.users VALUES('${owner}'),('${other}');`)
await db.exec(await readFile(new URL('../../supabase/migrations/20261027102401_merchant_identification_cache.sql',import.meta.url),'utf8'))
const query=(user,sql,params=[])=>db.transaction(async(tx)=>{
 await tx.exec('SET LOCAL ROLE '+(user?'authenticated':'anon'))
 await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user||''])
 return tx.query(sql,params)
})
const claim=async(user,merchant)=>(await query(user,'SELECT public.claim_merchant_lookup($1) AS result',[merchant])).rows[0].result
const verdict={category:'אוכל',subcategory:'קניות גדולות',confidence:.95,source_url:'https://merchant.example/about'}
const finish=async(user,m,lease,result=verdict,state='resolved')=>(await query(user,'SELECT public.finish_merchant_lookup($1,$2,$3,$4) AS saved',[m,lease,result,state])).rows[0].saved
const a=await claim(owner,'fixture')
assert.equal(a.status,'claimed')
assert.equal((await claim(owner,'fixture')).status,'deferred')
assert.equal(await finish(other,'fixture',a.lease_token),false)
assert.equal(await finish(owner,'fixture',a.lease_token),true)
assert.deepEqual((await claim(owner,'fixture')).result,verdict)
assert.equal((await claim(other,'fixture')).status,'claimed')
await assert.rejects(claim(null,'fixture'),/permission denied/)
await assert.rejects(query(other,"UPDATE merchant_identifications SET user_id=$1 WHERE merchant='fixture'",[owner]),/row-level security/)
assert.equal((await query(owner,'SELECT attempts FROM merchant_lookup_usage')).rows[0].attempts,1)
const pending=await claim(owner,'expired')
await query(owner,"UPDATE merchant_identifications SET retry_after=now()-interval '1 minute' WHERE merchant='expired'")
const renewed=await claim(owner,'expired')
assert.notEqual(pending.lease_token,renewed.lease_token)
assert.equal(await finish(owner,'expired',pending.lease_token),false)
assert.equal(await finish(owner,'expired',renewed.lease_token,{},'unresolved'),true)
assert.equal((await claim(owner,'expired')).status,'deferred')
await query(owner,'UPDATE merchant_lookup_usage SET day_attempts=100')
assert.equal((await claim(owner,'daily quota')).status,'quota')
assert.equal((await claim(owner,'fixture')).status,'cached')
await query(owner,"UPDATE merchant_lookup_usage SET usage_day=usage_day-1")
assert.equal((await claim(owner,'new day')).status,'claimed')
assert.equal((await query(owner,'SELECT day_attempts FROM merchant_lookup_usage')).rows[0].day_attempts,1)
await query(owner,'UPDATE merchant_lookup_usage SET attempts=900')
assert.equal((await claim(owner,'monthly quota')).status,'quota')
await query(owner,"UPDATE merchant_lookup_usage SET month_start=(date_trunc('month',now() at time zone 'UTC')-interval '1 month')::date")
assert.equal((await claim(owner,'new month')).status,'claimed')
// Restore only synthetic counters for the HTTP integration phase.
await query(owner,'UPDATE merchant_lookup_usage SET attempts=0,day_attempts=0')
console.log('PASS: durable cache, leases, owner isolation, cooldowns and quota boundaries')
if(!process.argv.includes('--serve')){await db.close();process.exit(0)}
let requests=0
const server=createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data))}
 try{
  const user=req.headers.authorization==='Bearer synthetic-owner'?owner:null
  const url=new URL(req.url,'http://127.0.0.1')
  requests++
  if(req.method==='GET'&&url.pathname==='/rest/v1/merchant_identifications'){
   assert.equal(url.searchParams.get('user_id'),'eq.'+owner)
   const merchant=url.searchParams.get('merchant').slice(3)
   const result=await query(user,"SELECT result FROM merchant_identifications WHERE merchant=$1 AND state='resolved'",[merchant])
   return send(200,result.rows)
  }
  if(req.method==='POST'){
   const chunks=[];for await(const c of req)chunks.push(c)
   const body=JSON.parse(Buffer.concat(chunks))
   if(url.pathname==='/rest/v1/rpc/claim_merchant_lookup')return send(200,await claim(user,body.p_merchant))
   if(url.pathname==='/rest/v1/rpc/finish_merchant_lookup')return send(200,await finish(user,body.p_merchant,body.p_lease_token,body.p_result,body.p_state))
  }
  send(501,{message:'Unmodelled request'})
 }catch{send(400,{message:'Synthetic storage error'})}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
console.log(JSON.stringify({listening:`http://127.0.0.1:${server.address().port}`}))
process.on('SIGINT',()=>server.close(async()=>{console.log(JSON.stringify({requests}));await db.close();process.exit(0)}))
