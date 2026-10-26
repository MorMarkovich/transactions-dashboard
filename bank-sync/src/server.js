// Install safe handlers before importing Express, keychain, Supabase or scraper.
import { runSafeEntry } from './safe-errors.js'
await runSafeEntry(async () => { const {main} = await import('./server-runtime.js'); await main() })
