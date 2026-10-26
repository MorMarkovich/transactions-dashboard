// Non-secret durable evidence for explicit emergency local wipe. Remote state is
// never claimed invalidated until an authenticated CAS write has succeeded.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises'
import {join} from 'node:path'
import {homedir} from 'node:os'
import {invalidatePendingBinding} from './pending-binding.js'
const dir=join(homedir(),'.transactions-bank-sync'),file=join(dir,'pending-invalidation-debt.json')
const marker=join(dir,'pending-debt-quarantine-warning')
const MAX=100
const valid=r=>r&&typeof r==='object'&&typeof r.scopeId==='string'&&/^pending-[0-9a-f-]{36}$/i.test(r.scopeId)&&typeof r.dashboardUserId==='string'&&/^[0-9a-f-]{36}$/i.test(r.dashboardUserId)&&['11','77'].includes(r.companyCode)&&typeof r.isPartner==='boolean'&&/^\d{4}$/.test(r.cardSuffix)&&typeof r.recordedAt==='string'&&Number.isFinite(Date.parse(r.recordedAt))
const key=r=>JSON.stringify([r.scopeId,r.dashboardUserId,r.companyCode,r.isPartner,r.cardSuffix])
export async function readDebt(storage={readFile,rename}){
 try{const rows=JSON.parse(await storage.readFile(file,'utf8'));if(!Array.isArray(rows)||rows.length>MAX||!rows.every(valid))throw Error();let corrupt=false;try{await readFile(marker);corrupt=true}catch{};return{rows,corrupt}}
 catch(error){if(error.code==='ENOENT'){let corrupt=false;try{await readFile(marker);corrupt=true}catch{};return{rows:[],corrupt}};await storage.rename(file,`${file}.quarantine-${Date.now()}`);if(storage.readFile===readFile)await writeFile(marker,'Unresolved quarantined debt requires authenticated manual review.',{mode:0o600});return{rows:[],corrupt:true}}
}
async function writeDebt(rows){await mkdir(dir,{recursive:true,mode:0o700});const temporary=`${file}.tmp-${process.pid}`;await writeFile(temporary,JSON.stringify(rows,null,2),{mode:0o600});await rename(temporary,file)}
export async function recordPendingInvalidationDebt(accounts){
 await mkdir(dir,{recursive:true,mode:0o700})
 const previous=await readDebt(),map=new Map(previous.rows.map(r=>[key(r),r]))
 for(const a of accounts.filter(a=>a.pending)){
  const r={scopeId:a.pending.scopeId,dashboardUserId:a.pending.dashboardUserId,companyCode:a.pending.companyCode,isPartner:a.pending.isPartner,cardSuffix:a.pending.cardSuffix,recordedAt:new Date().toISOString(),status:'remote_not_invalidated'}
  map.set(key(r),r)
 }
 const rows=[...map.values()]
 if(rows.length>MAX){await rename(file,`${file}.quarantine-cap-${Date.now()}`).catch(e=>{if(e.code!=='ENOENT')throw e});await writeFile(`${file}.quarantine-overflow-${Date.now()}`,JSON.stringify(rows),{mode:0o600});await writeFile(marker,'Unresolved archived debt requires authenticated manual review.',{mode:0o600});await writeDebt(rows.slice(-MAX));return{count:Math.min(rows.length,MAX),unresolvedArchive:true,warningPath:marker}}
 await writeDebt(rows);return{count:rows.length,unresolvedArchive:previous.corrupt,warningPath:previous.corrupt?marker:null}
}
// Called under local lock. Only original owner rows are attempted, no retries.
// Failed and other-owner debt remains durable; each success is durably removed.
export async function cleanupPendingDebt(client,userId,{read=readDebt,write=writeDebt,invalidate=invalidatePendingBinding}={}){
 const auth=await client.auth.getUser();if(auth.error||auth.data.user?.id!==userId)throw Error('pending_owner_invalid')
 const loaded=await read();let remaining=loaded.rows.slice(),cleared=0
 for(const row of loaded.rows){
  if(!valid(row)||row.dashboardUserId!==userId)continue
  try{
   await invalidate(client,{provider:'isracard',pending:{...row,enabled:true,verifiedAt:row.recordedAt}},userId)
   const next=remaining.filter(r=>key(r)!==key(row));await write(next);remaining=next;cleared++
  }catch{/* retain debt, do not turn cleanup failure into false remote success */}
 }
 return{cleared,remaining:remaining.length,unresolvedArchive:loaded.corrupt,warningPath:loaded.corrupt?marker:null}
}
