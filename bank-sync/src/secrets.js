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

export const credKey = (provider) => `cred:${provider}`
export const SUPABASE_AUTH_KEY = 'supabase:auth'
export const SYNC_TOKEN_KEY = 'sync:token'

// Wipe everything this tool stored.
export async function clearAll() {
  const keys = [SUPABASE_AUTH_KEY, SYNC_TOKEN_KEY, ...SUPPORTED.map(credKey)]
  await Promise.all(keys.map((k) => keytar.deletePassword(SERVICE, k).catch(() => {})))
}
