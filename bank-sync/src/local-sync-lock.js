// Prevent setup/invalidation racing a local sync. No automatic stale-lock deletion:
// an interrupted owner must be investigated before another banking run.
import {mkdir,rmdir} from 'node:fs/promises'
import {join} from 'node:path'
import {safeError} from './safe-errors.js'
import {homedir} from 'node:os'
import {needsScraperCleanup} from './scrape-supervisor.js'
const path=join(homedir(),'.transactions-bank-sync.lock')
export async function withLocalSyncLock(work,{lockPath=path}={}){
 try{await mkdir(lockPath,{mode:0o700})}catch{throw safeError('SYNC_LOCAL_LOCKED')}
 try{return await work()}finally{
  if(needsScraperCleanup())process.stderr.write('SYNC_LOCAL_LOCK_CLEANUP_REQUIRED\n')
  else try{await rmdir(lockPath)}catch{process.stderr.write('SYNC_LOCAL_LOCK_CLEANUP_REQUIRED\n')}
 }
}
