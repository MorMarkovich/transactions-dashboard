// OS keychain wrapper (keytar). Everything sensitive lives here, encrypted at
// rest by the OS and scoped to your user account — never written to disk or the
// repo. Keys used:
//   cred:<provider>   JSON blob of that provider's login fields
//   supabase:auth     JSON { email, password } — your dashboard login
//   sync:token        the random token the dashboard sends with each /sync
import keytar from 'keytar'
import { SUPPORTED } from './providers.js'

const SERVICE = 'transactions-bank-sync'

export async function getJSON(key) {
  const v = await keytar.getPassword(SERVICE, key)
  return v ? JSON.parse(v) : null
}

export async function setJSON(key, obj) {
  await keytar.setPassword(SERVICE, key, JSON.stringify(obj))
}

export async function getSecret(key) {
  return keytar.getPassword(SERVICE, key)
}

export async function setSecret(key, value) {
  await keytar.setPassword(SERVICE, key, value)
}

export async function deleteKey(key) {
  return keytar.deletePassword(SERVICE, key)
}

// cred key is per ACCOUNT key now (e.g. 'isracard', 'isracard-2'), but a plain
// provider id is still a valid account key for single-account providers.
export const credKey = (accountKey) => `cred:${accountKey}`
export const SUPABASE_AUTH_KEY = 'supabase:auth'
export const SYNC_TOKEN_KEY = 'sync:token'
export const ACCOUNTS_KEY = 'accounts' // registry: [{ key, provider, owner, label }]

export async function getAccounts() {
  return (await getJSON(ACCOUNTS_KEY)) || []
}
export async function setAccounts(accounts) {
  await setJSON(ACCOUNTS_KEY, accounts)
}

// Wipe everything this tool stored (all account creds + registry + supabase + token).
export async function clearAll() {
  const accounts = await getAccounts()
  const credKeys = [...new Set([...SUPPORTED, ...accounts.map((a) => a.key)])].map(credKey)
  const keys = [...new Set([SUPABASE_AUTH_KEY, SYNC_TOKEN_KEY, ACCOUNTS_KEY, ...credKeys])]
  await Promise.all(keys.map((k) => keytar.deletePassword(SERVICE, k).catch(() => {})))
}
