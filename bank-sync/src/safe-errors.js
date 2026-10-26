// Never return/log arbitrary dependency exception messages, headers or payloads.
const CODES = new Set(['BANK_SCRAPE_FAILED','BANK_TIMEOUT','BANK_INVALID_PASSWORD','BANK_CLEANUP_REQUIRED',
  'BANK_PENDING_AUTH_REQUIRED','BANK_PENDING_RATE_LIMITED','BANK_PENDING_TIMEOUT',
  'BANK_PENDING_CONTRACT_UNSUPPORTED','BANK_PENDING_DISCOVERY_UNAVAILABLE','BANK_PENDING_NO_CARDS',
  'BANK_PENDING_NETWORK_FAILED','BANK_PENDING_HTTP_FAILED','BANK_PENDING_SESSION_FAILED',
  'BANK_PENDING_RESPONSE_LIMIT','BANK_PENDING_REQUEST_REJECTED','BANK_PENDING_NOT_OBSERVED',
  'BANK_CHANGE_PASSWORD','BANK_PENDING_OPTIONS_INVALID','BANK_BLOCKED','BANK_DEBUG_DISABLED_REQUIRED','BANK_SYNC_FAILED',
  'BANK_TWO_FACTOR_REQUIRED','BANK_GENERAL_ERROR','SYNC_SETUP_REQUIRED','SYNC_CONFIG_REQUIRED',
  'PENDING_INVALIDATION_REQUIRED','PENDING_INVALIDATION_FAILED','SYNC_LOCAL_LOCKED','SYNC_TOKEN_REQUIRED','SUPABASE_AUTH_FAILED','SUPABASE_READ_FAILED','SUPABASE_WRITE_FAILED','SUPABASE_CLEANUP_FAILED'])
const TYPES = Object.freeze({TIMEOUT:'BANK_TIMEOUT',INVALID_PASSWORD:'BANK_INVALID_PASSWORD',
  CHANGE_PASSWORD:'BANK_CHANGE_PASSWORD',ACCOUNT_BLOCKED:'BANK_BLOCKED',
  TWO_FACTOR_RETRIEVER_MISSING:'BANK_TWO_FACTOR_REQUIRED',GENERIC:'BANK_SCRAPE_FAILED',GENERAL_ERROR:'BANK_GENERAL_ERROR'})
export function safeErrorCode(error, fallback='BANK_SYNC_FAILED') {
  // Read only a fixed controlled code, not message/name/stack/cause/custom fields.
  try { if (error && CODES.has(error.code)) return error.code } catch { /* hostile getter */ }
  return CODES.has(fallback) ? fallback : 'BANK_SYNC_FAILED'
}
export function safeError(code) {
  const error = new Error(CODES.has(code) ? code : 'BANK_SYNC_FAILED')
  error.code = error.message
  return error
}
export function assertSafeDebugEnvironment(env=process.env) {
  // Reject instead of silently editing user debug settings. Check before dynamic
  // dependency import. Library DEBUG can expose entire bank login responses.
  if (env.DEBUG || env.NODE_DEBUG) throw safeError('BANK_DEBUG_DISABLED_REQUIRED')
}
export async function runScraperSafely(scraper, credentials) {
  let result
  try { result = await scraper.scrape(credentials) }
  catch { throw safeError('BANK_SCRAPE_FAILED') }
  if (!result || result.success !== true) {
    let code='BANK_SCRAPE_FAILED'
    try { if (Object.hasOwn(TYPES,result?.errorType)) code=TYPES[result.errorType] } catch { /* ignore */ }
    throw safeError(code)
  }
  return result
}

// Install in minimal entry modules before ANY dynamic application/dependency import.
// Uncaught errors invalidate state. Do not attempt to continue or retry banking.
export function installSafeProcessBoundary() {
  const fail = () => { process.stderr.write('BANK_SYNC_FAILED\n'); process.exit(1) }
  process.on('unhandledRejection', fail)
  process.on('uncaughtException', fail)
  return () => { process.off('unhandledRejection',fail); process.off('uncaughtException',fail) }
}
export async function runSafeEntry(load) {
  installSafeProcessBoundary()
  try { assertSafeDebugEnvironment(); await load() }
  catch (error) { process.stderr.write(`${safeErrorCode(error)}\n`); process.exit(1) }
}
