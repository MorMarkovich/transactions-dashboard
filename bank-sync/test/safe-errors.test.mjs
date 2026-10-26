import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {safeErrorCode,safeError,assertSafeDebugEnvironment,runScraperSafely} from '../src/safe-errors.js'
const attack='password=PRIVATE card6Digits=PRIVATE cookie=PRIVATE rawResponse=PRIVATE'
test('arbitrary error messages never reach public code',()=>assert.equal(safeErrorCode(Error(attack)),'BANK_SYNC_FAILED'))
test('unknown custom code never reaches output',()=>assert.equal(safeErrorCode({code:attack}),'BANK_SYNC_FAILED'))
test('fixed known code retained without message',()=>assert.equal(safeErrorCode({...Error(attack),code:'BANK_TIMEOUT'}),'BANK_TIMEOUT'))
test('hostile code getter fails closed',()=>assert.equal(safeErrorCode({get code(){throw Error(attack)}}),'BANK_SYNC_FAILED'))
test('message/stack/name getters are never accessed',()=>assert.equal(safeErrorCode({get message(){throw Error(attack)},get stack(){throw Error(attack)},get name(){throw Error(attack)}}),'BANK_SYNC_FAILED'))
test('unsafe fallback not reflected',()=>assert.equal(safeErrorCode(null,attack),'BANK_SYNC_FAILED'))
test('error factory allows controlled codes only',()=>assert.equal(safeError(attack).message,'BANK_SYNC_FAILED'))
test('DEBUG rejects before scraper start',()=>assert.throws(()=>assertSafeDebugEnvironment({DEBUG:'israeli-bank-scrapers:*'}),{code:'BANK_DEBUG_DISABLED_REQUIRED'}))
test('NODE_DEBUG rejects before scraper start',()=>assert.throws(()=>assertSafeDebugEnvironment({NODE_DEBUG:'http'}),{code:'BANK_DEBUG_DISABLED_REQUIRED'}))
test('no debug mode accepts environment',()=>assert.doesNotThrow(()=>assertSafeDebugEnvironment({})))
test('thrown scrape payload redacted',async()=>assert.rejects(runScraperSafely({scrape:async()=>{throw Error(attack)}},{}),{message:'BANK_SCRAPE_FAILED'}))
test('returned error payload redacted with safe category',async()=>assert.rejects(runScraperSafely({scrape:async()=>({success:false,errorType:'TIMEOUT',errorMessage:attack})},{}),{message:'BANK_TIMEOUT'}))
test('unknown error type redacted',async()=>assert.rejects(runScraperSafely({scrape:async()=>({success:false,errorType:attack,errorMessage:attack})},{}),{message:'BANK_SCRAPE_FAILED'}))
test('invalid successful-like result fails closed',async()=>assert.rejects(runScraperSafely({scrape:async()=>({success:'true',errorMessage:attack})},{}),{message:'BANK_SCRAPE_FAILED'}))
test('success result returned unchanged for caller normalization',async()=>{const r={success:true,accounts:[]};assert.equal(await runScraperSafely({scrape:async()=>r},{}),r)})
test('application logging/error response boundaries do not echo raw exception messages',()=>{
 for(const name of ['sync.js','server.js','sync-runtime.js','server-runtime.js']){
  const s=readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8')
  assert.equal(/(?:err|e)\.message/.test(s),false,name)
 }
 const s=readFileSync(new URL('../src/scrape.js',import.meta.url),'utf8')
 assert.equal(s.includes('result.errorMessage'),false)
 assert.equal(s.includes('storeFailureScreenShotPath:'),false)
 assert.ok(s.indexOf('assertSafeDebugEnvironment()') < s.indexOf("await import('israeli-bank-scrapers')"))
})

import {spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
const boundary=pathToFileURL(new URL('../src/safe-errors.js',import.meta.url).pathname).href
for (const [name,script] of [
 ['awaited',`throw Error('${attack}')`],
 ['unawaited',`Promise.reject(Error('${attack}'));await new Promise(r=>setTimeout(r,20))`],
 ['uncaught',`setTimeout(()=>{throw Error('${attack}')},0);await new Promise(r=>setTimeout(r,20))`],
 ['dynamic import',`await import('file:///private-secret-module-${attack.replaceAll(' ','-')}')`],
]) test(`child process ${name} failure emits only fixed code`,()=>{
 const child=spawnSync(process.execPath,['--input-type=module','-e',`import {runSafeEntry} from '${boundary}';await runSafeEntry(async()=>{${script}})`],{encoding:'utf8',env:{...process.env,DEBUG:'',NODE_DEBUG:''}})
 assert.equal(child.status,1);assert.equal(child.stdout,'');assert.equal(child.stderr,'BANK_SYNC_FAILED\n')
})
test('real scraper enum codes map to fixed diagnostics',async()=>{
 for(const [type,code] of Object.entries({ACCOUNT_BLOCKED:'BANK_BLOCKED',TWO_FACTOR_RETRIEVER_MISSING:'BANK_TWO_FACTOR_REQUIRED',GENERIC:'BANK_SCRAPE_FAILED',GENERAL_ERROR:'BANK_GENERAL_ERROR'})) {
  await assert.rejects(runScraperSafely({scrape:async()=>({success:false,errorType:type,errorMessage:attack})},{}),{code})
 }
})
test('actual CLI and server bootstrap import only safe boundary statically',()=>{
 for(const name of ['sync.js','server.js']) {
  const text=readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8')
  assert.equal((text.match(/^import /gm)||[]).length,1)
  assert.match(text,/runSafeEntry/)
 }
})
test('known setup and Supabase controlled codes remain useful',()=>{
 for(const code of ['SYNC_SETUP_REQUIRED','SYNC_CONFIG_REQUIRED','SYNC_TOKEN_REQUIRED','SUPABASE_AUTH_FAILED','SUPABASE_READ_FAILED','SUPABASE_WRITE_FAILED','SUPABASE_CLEANUP_FAILED']) assert.equal(safeErrorCode(safeError(code)),code)
})
