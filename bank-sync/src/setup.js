// Interactive setup: manages the account registry (each account = provider +
// owner + credentials), your Supabase login, and the sync token — all in the OS
// keychain. Supports multiple accounts per provider (e.g. two Isracard cards).
// `npm run setup -- --clear` (or `npm run secrets:clear`) wipes everything.
import readline from 'node:readline'
import {withLocalSyncLock} from './local-sync-lock.js'
import crypto from 'node:crypto'
import {invalidatePendingBinding} from './pending-binding.js'
import {signIn} from './supabaseClient.js'
import {config} from './config.js'
import {safeError,safeErrorCode} from './safe-errors.js'
import { SUPPORTED, PROVIDER_LABELS, PROVIDER_FIELDS, makeAccountKey } from './providers.js'
import { JOINT } from './owner.js'
import {
  getJSON, setJSON, setSecret, getSecret, clearAll,
  getAccounts, setAccounts, credKey,
  SUPABASE_AUTH_KEY, SYNC_TOKEN_KEY,
} from './secrets.js'

function ask(rl, question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const orig = rl._writeToOutput
    rl.question(question, (answer) => {
      rl._writeToOutput = orig
      if (hidden) rl.output.write('\n')
      resolve(answer.trim())
    })
    if (hidden) rl._writeToOutput = () => {}
  })
}

async function askYesNo(rl, question) {
  const a = (await ask(rl, `${question} (y/n) `)).toLowerCase()
  return a === 'y' || a === 'yes'
}

async function askOwner(rl, current) {
  const def = current ? ` [${current}]` : ''
  const a = await ask(rl, `  Owner${def} — [1] מור  [2] שלי  [3] משותף (joint)  (or type a name): `)
  if (!a) return current || JOINT
  if (a === '1') return 'מור'
  if (a === '2') return 'שלי'
  if (a === '3') return JOINT
  return a
}

function labelFor(provider, owner) {
  const base = PROVIDER_LABELS[provider] || provider
  return owner && owner !== JOINT ? `${base} (${owner})` : base
}

async function collectCreds(rl, provider) {
  const creds = {}
  for (const field of PROVIDER_FIELDS[provider]) {
    const tag = field.secret ? ' (hidden)' : ''
    creds[field.key] = await ask(rl, `    ${field.label}${tag}: `, { hidden: field.secret })
  }
  return creds
}

async function invalidateBeforeChange(account) {
  if(!account?.pending)return
  const auth=await getJSON(SUPABASE_AUTH_KEY)
  if(!auth?.email||!auth?.password)throw safeError('PENDING_INVALIDATION_REQUIRED')
  const {supabase,userId}=await signIn(config.supabaseUrl,config.supabaseAnonKey,auth.email,auth.password)
  try{await invalidatePendingBinding(supabase,account,userId)}catch{throw safeError('PENDING_INVALIDATION_FAILED')}finally{await supabase.auth.signOut({scope:'local'})}
}
async function main() {
  if(process.argv.includes('--emergency-local-wipe')){
    const rl=readline.createInterface({input:process.stdin,output:process.stdout})
    let answer
    try{answer=await ask(rl,'WARNING: clears local credentials only. Cloud pending data is NOT invalidated and may still appear current until the 24-hour age limit. A durable remote-invalidation debt is retained locally. Type LOCAL WIPE to continue: ')}finally{rl.close()}
    if(answer!=='LOCAL WIPE')return
    const {recordPendingInvalidationDebt}=await import('./pending-invalidation-debt.js')
    const debt=await recordPendingInvalidationDebt(await getAccounts())
    if(debt.unresolvedArchive)console.log(`WARNING: older debt was NOT cleared. Marker: ${debt.warningPath}. Review sibling .quarantine-* files under the original authenticated owner before manually clearing the marker.`)
    await clearAll()
    console.log('Local credentials cleared. Remote pending data was NOT invalidated; retained debt requires later authenticated cleanup. Rebinding creates a fresh source scope.')
    return
  }
  if (process.argv.includes('--clear')) {
    for(const account of await getAccounts())await invalidateBeforeChange(account)
    await clearAll()
    console.log('✓ All stored secrets cleared from the keychain.')
    return
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  console.log('\n=== bank-sync setup ===')
  console.log('Secrets are stored in your OS keychain — not on disk or in the repo.')
  console.log('(For secret fields, what you type is hidden — just type and press Enter.)\n')

  // Working account list: existing registry, or migrate legacy single-provider creds.
  const accounts = await getAccounts()
  if (!accounts.length) {
    for (const provider of SUPPORTED) {
      if (await getJSON(credKey(provider))) {
        accounts.push({ key: provider, provider, owner: null, label: PROVIDER_LABELS[provider] || provider })
      }
    }
  }

  // Assign/confirm the owner of each existing account, and optionally update
  // its stored login (e.g. after a bank forces a password change).
  if (accounts.length) {
    console.log('Existing accounts — set who each one belongs to:')
    for (const acct of accounts) {
      // Show the current label (incl. owner) so two cards of one provider
      // (e.g. ישראכרט (מור) vs ישראכרט (שלי)) can't be confused.
      console.log(`\n• ${acct.label || PROVIDER_LABELS[acct.provider] || acct.provider}  [${acct.key}]  — currently: ${acct.owner || JOINT}`)
      acct.owner = await askOwner(rl, acct.owner)
      acct.label = labelFor(acct.provider, acct.owner)
      if (await askYesNo(rl, '  Update the login (e.g. new password) for this account?')) {
        const creds = await collectCreds(rl, acct.provider)
        await invalidateBeforeChange(acct)
        delete acct.pending
        await setAccounts(accounts) // remove binding before replacing any credential
        await setJSON(credKey(acct.key), creds)
        console.log('  ✓ login updated.')
      }
    }
    console.log('')
  }

  // Add new accounts (e.g. a spouse's second Isracard).
  while (await askYesNo(rl, 'Add an account?')) {
    const provider = (await ask(rl, `  Provider [${SUPPORTED.join(' / ')}]: `)).toLowerCase()
    if (!SUPPORTED.includes(provider)) { console.log(`  ✗ unknown provider "${provider}"\n`); continue }
    const owner = await askOwner(rl)
    const creds = await collectCreds(rl, provider)
    const key = makeAccountKey(provider, new Set(accounts.map((a) => a.key)))
    await setJSON(credKey(key), creds)
    const label = labelFor(provider, owner)
    accounts.push({ key, provider, owner, label })
    console.log(`  ✓ ${label} saved.\n`)
  }

  await setAccounts(accounts)

  // Supabase login (your dashboard email + password).
  console.log('Supabase login — the SAME email/password you use for the dashboard.')
  const email = await ask(rl, '  Email: ')
  const password = await ask(rl, '  Password (hidden): ', { hidden: true })
  // A changed dashboard login must not leave old-account observations current.
  const oldAuth=await getJSON(SUPABASE_AUTH_KEY)
  if(oldAuth?.email!==email||oldAuth?.password!==password){
    for(const account of accounts){await invalidateBeforeChange(account);delete account.pending}
    await setAccounts(accounts)
  }
  await setJSON(SUPABASE_AUTH_KEY, { email, password })
  console.log('  ✓ Supabase login saved.\n')

  // Sync token.
  let token = await getSecret(SYNC_TOKEN_KEY)
  if (!token) {
    token = crypto.randomBytes(32).toString('hex')
    await setSecret(SYNC_TOKEN_KEY, token)
  }

  rl.close()

  console.log('=== Setup complete ===')
  console.log('\nAccounts:')
  for (const a of accounts) console.log(`  • ${a.label}  → owner: ${a.owner || JOINT}`)
  console.log('\nYour sync token (paste it into the dashboard when prompted):\n')
  console.log('  ' + token + '\n')
  console.log('Next steps:')
  console.log('  • Changed an account OWNER only? → `npm run retag` (re-tags existing data, no bank login).')
  console.log('  • Added/updated a LOGIN, or want new transactions? → `npm run sync` (merges; never wipes).')
  console.log('  • `npm run resync` does a full re-pull. It now keeps data for any account that fails,')
  console.log('    but a working sync is still safer — avoid it while a provider (e.g. Isracard) is blocked.')
  console.log('(Re-running setup keeps the same token. To rotate it, run `npm run secrets:clear` first.)')
}

withLocalSyncLock(main).catch((e) => { console.error('setup failed:',safeErrorCode(e,'SYNC_SETUP_REQUIRED')); process.exit(1) })
