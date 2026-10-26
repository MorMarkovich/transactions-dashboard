// Explicit recovery command, no issuer traffic or new binding.
import {runSafeEntry} from './safe-errors.js'
await runSafeEntry(async()=>{
 const {withLocalSyncLock}=await import('./local-sync-lock.js')
 await withLocalSyncLock(async()=>{
  const {getJSON,SUPABASE_AUTH_KEY}=await import('./secrets.js'),{config}=await import('./config.js'),{signIn}=await import('./supabaseClient.js'),{cleanupPendingDebt}=await import('./pending-invalidation-debt.js')
  const auth=await getJSON(SUPABASE_AUTH_KEY),{supabase,userId}=await signIn(config.supabaseUrl,config.supabaseAnonKey,auth.email,auth.password)
  try{const result=await cleanupPendingDebt(supabase,userId);if(result.unresolvedArchive)console.log(`Warning marker: ${result.warningPath}. Review sibling .quarantine-* files under the original authenticated owner before manually clearing the marker; quarantined debt was NOT cleared.`);console.log(`Debt cleared: ${result.cleared}; unresolved: ${result.remaining}; quarantined debt requires manual review: ${result.unresolvedArchive}`)}finally{await supabase.auth.signOut({scope:'local'})}
 })
})
