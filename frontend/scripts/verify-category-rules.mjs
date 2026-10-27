// Isolated Postgres/WASM + real Supabase HTTP client. Synthetic data only.
// Pass an installed @electric-sql/pglite module entry path as the sole argument.
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {createServer} from 'node:http'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {persistManualRules, persistAutomaticRules} from '../src/services/categoryRuleStore.ts'
const {PGlite} = await import(pathToFileURL(process.argv[2]))
const db = new PGlite()
const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
await db.exec(`
 CREATE ROLE authenticated;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.sub',true)::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO authenticated;
 CREATE TABLE public.user_category_rules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,
 merchant text NOT NULL,category text NOT NULL,subcategory text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(user_id,merchant));
 ALTER TABLE public.user_category_rules ENABLE ROW LEVEL SECURITY;
 CREATE POLICY own_rules ON public.user_category_rules FOR ALL TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
 GRANT ALL ON public.user_category_rules TO authenticated;
`)
await db.query('INSERT INTO user_category_rules(user_id,merchant,category) VALUES ($1,$2,$3)',[owner,'legacy','אוכל'])
const policiesBefore = await db.query('SELECT * FROM pg_policies')
await db.exec(await readFile(new URL('../../supabase/migrations/20261027090358_category_rule_source.sql',import.meta.url),'utf8'))
assert.deepEqual(await db.query('SELECT * FROM pg_policies'),policiesBefore)
assert.equal((await db.query('SELECT source FROM user_category_rules')).rows[0].source,'legacy')
await assert.rejects(db.query('UPDATE user_category_rules SET source=$1',['invalid']),/check constraint/)
let requests=0, beforePatch=null
const allowed = new Set(['user_id','merchant','category','subcategory','source','updated_at'])
const server=createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(data===null?'':JSON.stringify(data))}
 try{
   const url = new URL(req.url,'http://127.0.0.1')
   if(url.pathname!='/rest/v1/user_category_rules' || !['POST','PATCH'].includes(req.method)) return send(501,{message:'unmodelled'})
   const chunks=[]; for await(const chunk of req) chunks.push(chunk)
   const body=JSON.parse(Buffer.concat(chunks))
   requests++
   // Inject the user's save after automatic insertion, before its conditional update.
   if(req.method==='PATCH' && beforePatch){const callback=beforePatch;beforePatch=null;await callback()}
   await db.transaction(async(tx)=>{
     await tx.exec('SET LOCAL ROLE authenticated')
     await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[req.headers.authorization==='Bearer other'?other:owner])
     if(req.method==='POST'){
       assert.equal(url.searchParams.get('on_conflict'),'user_id,merchant')
       for(const row of Array.isArray(body)?body:[body]){
         const keys=Object.keys(row); assert(keys.every(k=>allowed.has(k)))
         const columns=keys.map(k=>'"'+k+'"').join(',')
         const params=keys.map((_,i)=>'$'+(i+1)).join(',')
         const ignore=req.headers.prefer?.includes('resolution=ignore-duplicates')
         const conflict=ignore?'NOTHING':'UPDATE SET '+keys.map(k=>'"'+k+'"=excluded."'+k+'"').join(',')
         await tx.query(`INSERT INTO user_category_rules(${columns}) VALUES(${params}) ON CONFLICT(user_id,merchant) DO ${conflict}`,keys.map(k=>row[k]))
       }
     }else{
       const keys=Object.keys(body);assert(keys.every(k=>allowed.has(k)))
       const values=keys.map(k=>body[k]);const filters=[]
       for(const [key,value] of url.searchParams){
         assert(allowed.has(key));const dot=value.indexOf('.');const op=value.slice(0,dot);assert(['eq','neq'].includes(op))
         values.push(value.slice(dot+1));filters.push(`"${key}" ${op==='eq'?'=':'<>'} $${values.length}`)
       }
       await tx.query(`UPDATE user_category_rules SET ${keys.map((k,i)=>'"'+k+'"=$'+(i+1)).join(',')} WHERE ${filters.join(' AND ')}`,values)
     }
   })
   send(req.method==='POST'?201:204,null)
 }catch(e){send(400,{message:e.message,code:e.code||'TEST_ERROR'})}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const url=`http://127.0.0.1:${server.address().port}`
const client=createClient(url,'synthetic-key',{auth:{persistSession:false,autoRefreshToken:false}})
const otherClient=createClient(url,'synthetic-key',{global:{headers:{Authorization:'Bearer other'}},auth:{persistSession:false,autoRefreshToken:false}})
const read=async(merchant)=> (await db.query('SELECT category,subcategory,source FROM user_category_rules WHERE user_id=$1 AND merchant=$2',[owner,merchant])).rows[0]
try{
 await persistAutomaticRules(client,owner,[{merchant:'legacy',category:'קניות'}])
 assert.equal((await read('legacy')).category,'אוכל')
 await persistManualRules(client,owner,[{merchant:'PAYPAL *STEAM',category:'קניות',subcategory:'בחירה אישית'}])
 await persistAutomaticRules(client,owner,[{merchant:'steam',category:'טכנולוגיה'}])
 assert.deepEqual(await read('steam'),{category:'קניות',subcategory:'בחירה אישית',source:'manual'})
 await persistAutomaticRules(client,owner,[{merchant:'fixture',category:'אוכל',subcategory:'קניות גדולות'}])
 await persistAutomaticRules(client,owner,[{merchant:'fixture',category:'אוכל'}])
 assert.equal((await read('fixture')).subcategory,'קניות גדולות')
 await persistAutomaticRules(client,owner,[{merchant:'fixture',category:'קניות'}])
 assert.equal((await read('fixture')).subcategory,null)
 beforePatch=()=>persistManualRules(client,owner,[{merchant:'race',category:'קניות'}])
 await persistAutomaticRules(client,owner,[{merchant:'race',category:'אוכל'}])
 assert.deepEqual(await read('race'),{category:'קניות',subcategory:null,source:'manual'})
 await persistManualRules(client,owner,[{merchant:'BOLT EUO2610011234',category:'טיסות ותיירות'}])
 assert.equal((await read('bolt euo')).source,'manual')
 await persistManualRules(otherClient,other,[{merchant:'steam',category:'אוכל'}])
 await assert.rejects(persistManualRules(otherClient,owner,[{merchant:'steam',category:'אוכל'}]))
 assert.equal((await read('steam')).category,'קניות')
 console.log(JSON.stringify({pass:true,requests,engine:'Postgres WASM',syntheticOnly:true,checks:['migration preserves rules and policies','legacy origin','source constraint','manual beats AI','category and subcategory persistence','manual edit during automatic save','canonical ride references','owner isolation','errors propagate']}))
}finally{await new Promise(resolve=>server.close(resolve));await db.close()}
