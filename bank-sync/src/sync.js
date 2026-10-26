// Minimal CLI entry. No credentials/dependency import before safe handlers.
import { runSafeEntry } from './safe-errors.js'
export async function runSync(...args) {
  const {runSync:run} = await import('./sync-runtime.js')
  return run(...args)
}
export function tokensMatch(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff=0
  for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i)
  return diff===0
}
if (import.meta.url === `file://${process.argv[1]}`) {
  await runSafeEntry(async () => {
    const result = await runSync(m => console.log('•',m), {fresh:process.argv.includes('--fresh')})
    console.log('Sync complete:',JSON.stringify(result,null,2))
    // CLI uses a short-lived authenticated browser. Never leave it open.
    process.exit(0)
  })
}
