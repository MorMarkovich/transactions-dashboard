// Explicit local operation. Not executed by installing, serving or syncing.
import {runSafeEntry,safeError} from './safe-errors.js'
await runSafeEntry(async()=>{
 const {withLocalSyncLock}=await import('./local-sync-lock.js')
 await withLocalSyncLock(async()=>{
  const {createInterface}=await import('node:readline/promises'),{stdin,stdout}=await import('node:process')
  const {getAccounts,getJSON,setAccounts,credKey,SUPABASE_AUTH_KEY}=await import('./secrets.js')
  const {config,assertConfig}=await import('./config.js'),{signIn}=await import('./supabaseClient.js')
  const {enablePendingForAccount}=await import('./pending-enable-flow.js'),{scrapeProviderDetailed}=await import('./scrape.js')
  assertConfig();const accounts=await getAccounts(),rl=createInterface({input:stdin,output:stdout})
  let client
  try{
   const eligible=accounts.filter(a=>a.provider==='isracard')
   if(!eligible.length)throw Error()
   eligible.forEach((a,i)=>stdout.write(`${i+1}: ${a.key}\n`))
   const index=Number(await rl.question('Choose the local login account number (not card suffix): '))-1,account=eligible[index]
   if(!account)throw Error()
   const auth=await getJSON(SUPABASE_AUTH_KEY),credentials=await getJSON(credKey(account.key))
   const signed=await signIn(config.supabaseUrl,config.supabaseAnonKey,auth.email,auth.password);client=signed.supabase
   const {cleanupPendingDebt}=await import('./pending-invalidation-debt.js')
   const debt=await cleanupPendingDebt(client,signed.userId)
   if(debt.unresolvedArchive)stdout.write(`Quarantined debt warning: ${debt.warningPath}. Review sibling .quarantine-* files under the original authenticated owner before manually clearing the marker. No remote cleanup is implied.\n`)
   if(debt.remaining||debt.unresolvedArchive)throw safeError('PENDING_INVALIDATION_REQUIRED')
   await enablePendingForAccount({account,userId:signed.userId,client,credentials,
    options:{monthsBack:config.monthsBack,showBrowser:config.showBrowser,executablePath:config.chromePath,timeout:config.scrapeTimeout,navigationRetryCount:0},discover:scrapeProviderDetailed,
    approveDiscovery:async()=>await rl.question('This logs into the selected issuer account once, reads existing posted data without saving it, and adds up to TWO card-list requests. Automation can be blocked. No approvals or sync are saved. Type DISCOVER to proceed: ')==='DISCOVER',
    chooseCard:async cards=>{cards.forEach((c,i)=>stdout.write(`${i+1}: ****${c.cardSuffix}, company ${c.companyCode}, partner ${c.isPartner}\n`));return Number(await rl.question('Choose the card returned by this exact login: '))-1},
    approveBinding:async b=>await rl.question(`Enable future explicit sync pending reads for ****${b.cardSuffix}, company ${b.companyCode}, partner ${b.isPartner}, source ${b.scopeId}? Adds up to two issuer requests to future syncs. Type ENABLE to save (does NOT sync now): `)==='ENABLE',
    writeAccount:async next=>{const i=accounts.findIndex(a=>a.key===account.key);accounts[i]=next;await setAccounts(accounts)},
   })
  }finally{rl.close();await client?.auth.signOut({scope:'local'})}
 })
})
