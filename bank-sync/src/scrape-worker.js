// Dedicated scraper process. Never load configuration, Keychain or Supabase.
import { createProviderAdapter } from './scrape.js'
import { safeErrorCode } from './safe-errors.js'

process.once('message', async ({ provider, credentials, options }) => {
  let message
  try {
    const value = await createProviderAdapter()(provider, credentials, {
      ...options,
      onStage: stage => process.send?.({ type: 'stage', stage }),
    })
    message = { type: 'result', value }
  } catch (error) {
    message = { type: 'result', error: safeErrorCode(error, 'BANK_SCRAPE_FAILED') }
  }
  // The adapter has completed cleanup before returning. Flush IPC, then exit;
  // third-party open handles cannot keep a completed scrape alive indefinitely.
  process.send?.(message, () => process.exit(0))
})
process.on('disconnect', () => process.exit(1))
