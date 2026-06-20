// Interactive setup: stores bank logins + your Supabase login in the OS keychain
// and generates the one-time sync token. Run with `npm run setup`.
// `npm run setup -- --clear` (or `npm run secrets:clear`) wipes everything.
import readline from 'node:readline'
import crypto from 'node:crypto'
import { config } from './config.js'
import { PROVIDER_LABELS, PROVIDER_FIELDS } from './providers.js'
import {
  setJSON, setSecret, getSecret, clearAll,
  credKey, SUPABASE_AUTH_KEY, SYNC_TOKEN_KEY,
} from './secrets.js'

function ask(rl, question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    // rl.question() writes the prompt synchronously using the CURRENT
    // _writeToOutput, so we let it print the prompt normally first, then (for
    // secret fields) suppress only the echo of the characters the user types.
    // Overriding before rl.question would hide the prompt itself.
    const orig = rl._writeToOutput
    rl.question(question, (answer) => {
      rl._writeToOutput = orig
      if (hidden) rl.output.write('\n')
      resolve(answer.trim())
    })
    if (hidden) {
      rl._writeToOutput = () => {}
    }
  })
}

async function askYesNo(rl, question) {
  const a = (await ask(rl, `${question} (y/n) `)).toLowerCase()
  return a === 'y' || a === 'yes'
}

async function main() {
  if (process.argv.includes('--clear')) {
    await clearAll()
    console.log('✓ All stored secrets cleared from the keychain.')
    return
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  console.log('\n=== bank-sync setup ===')
  console.log('Secrets are stored in your OS keychain — not on disk or in the repo.')
  console.log('(For secret fields, what you type is hidden — just type and press Enter.)\n')

  // ── Bank / card credentials ──
  for (const provider of config.providers) {
    const label = PROVIDER_LABELS[provider] || provider
    if (!(await askYesNo(rl, `Configure ${label} [${provider}]?`))) continue
    const creds = {}
    for (const field of PROVIDER_FIELDS[provider]) {
      const tag = field.secret ? ' (hidden)' : ''
      creds[field.key] = await ask(rl, `  ${field.label}${tag}: `, { hidden: field.secret })
    }
    await setJSON(credKey(provider), creds)
    console.log(`  ✓ ${label} saved.\n`)
  }

  // ── Supabase login (your dashboard email + password) ──
  console.log('Supabase login — the SAME email/password you use for the dashboard.')
  const email = await ask(rl, '  Email: ')
  const password = await ask(rl, '  Password (hidden): ', { hidden: true })
  await setJSON(SUPABASE_AUTH_KEY, { email, password })
  console.log('  ✓ Supabase login saved.\n')

  // ── Sync token ──
  let token = await getSecret(SYNC_TOKEN_KEY)
  if (!token) {
    token = crypto.randomBytes(32).toString('hex')
    await setSecret(SYNC_TOKEN_KEY, token)
  }

  rl.close()

  console.log('=== Setup complete ===')
  console.log('\nYour sync token (paste it into the dashboard when prompted):\n')
  console.log('  ' + token + '\n')
  console.log('Next: `npm run serve`, then click "רענן מהבנקים" in the dashboard.')
  console.log('(Re-running setup keeps the same token. To rotate it, run `npm run secrets:clear` first.)')
}

main().catch((e) => { console.error('setup failed:', e.message); process.exit(1) })
