import {test} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {gzipSync} from 'node:zlib'
import express from 'express'
import {readFileSync} from 'node:fs'
import {syncJsonParser,safeRequestError} from '../src/request-body.js'

function request(port,body,encoding){return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path:'/sync',method:'POST',headers:{'content-type':'application/json',...(encoding?{'content-encoding':encoding}:{})}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,body:data}))});req.on('error',reject);req.end(body)})}
test('compressed frames and trailing bytes denied before route; normal JSON still works',async()=>{
 const app=express();let hits=0;app.use(syncJsonParser());app.post('/sync',(req,res)=>{hits++;res.json({ok:req.body.ok===true})});app.use(safeRequestError)
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const port=server.address().port
 try{
  for(const encoding of ['gzip','deflate','br'])assert.equal((await request(port,Buffer.concat([gzipSync('{"ok":true}'),Buffer.from('trailing')]),encoding)).status,415)
  assert.equal(hits,0)
  assert.deepEqual(await request(port,'{"ok":true}'),{status:200,body:'{"ok":true}'})
  assert.equal(hits,1)
  assert.equal((await request(port,'{bad')).status,400)
  assert.equal((await request(port,JSON.stringify({data:'x'.repeat(262144)}))).status,413)
 }finally{await new Promise(resolve=>server.close(resolve))}
})
test('runtime uses the reviewed non-inflating parser',()=>{
 const source=readFileSync(new URL('../src/server-runtime.js',import.meta.url),'utf8');assert.match(source,/app\.use\(syncJsonParser\(\)\)/);assert.doesNotMatch(source,/app\.use\(express\.json/);assert.match(source,/app\.use\(safeRequestError\)/);assert.ok(source.indexOf('app.use(safeRequestError)')>source.indexOf("app.post('/sync'"))
})
test('actual terminal middleware exposes and logs only fixed code in development or production',()=>{
 const saved=console.error,logs=[];console.error=(...args)=>logs.push(args)
 try{for(const error of [{type:'entity.parse.failed',message:'secret body',stack:'secret stack'},{type:'encoding.unsupported',message:'secret encoding'},{type:'entity.too.large',message:'secret large'},Object.defineProperty({},'type',{get(){throw Error('secret getter')}})]){
  const response={status(value){this.statusCode=value;return this},json(value){this.value=value;return this}}
  safeRequestError(error,{},response,()=>assert.fail('must not delegate raw error'))
  assert.deepEqual(response.value,{success:false,error:'BANK_REQUEST_REJECTED'})
  assert.ok([400,413,415].includes(response.statusCode))
 }
 assert.deepEqual(logs,Array(4).fill(['BANK_REQUEST_REJECTED']))
 }finally{console.error=saved}
})
