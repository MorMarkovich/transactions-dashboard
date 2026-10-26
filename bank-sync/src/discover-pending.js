// Opt-in, LOCAL-ONLY endpoint-name discovery for the Isracard personal area.
//
// Why: the public pre-login assets do not reference transaction-service
// endpoints (verified 2026-10-26: 14 public bundles, 0 pending-like names),
// so discovering whether a pending/unsettled-transactions endpoint exists
// requires observing the REAL app after login.
//
// Hard bounds (deliberate, do not widen):
// - TWO PHASES. Phase 1 opens a plain Chrome window at the login page; the
//   USER logs in HIMSELF. Nothing is observed or recorded during login.
//   Only after the user returns here and confirms login does Phase 2 attach
//   a request listener, and only to the verified service-handler path
//   (/services/ProxyRequestHandler.ashx on *.isracard.co.il).
// - This script never types, reads, or stores credentials, and never
//   performs a bank login. No request listener exists during login (Phase 1),
//   so login traffic is never observed. In Phase 2, non-service-handler
//   requests are dropped by URL before their bodies are touched; for
//   service-handler requests the reqName token is extracted in memory and
//   nothing else is retained (bodies are scanned transiently, never kept).
//   Auth-family endpoint names (login/otp/validate/...) are excluded even so.
//   If an auth call re-uses the service path mid-session (e.g. token
//   refresh), its body would be scanned transiently like any other - only
//   the endpoint name can be retained, never the credentials in it.
// - Output is ONLY endpoint-shaped service names + counts. No URLs with
//   parameters, no headers, no cookies, no request/response bodies, no
//   amounts, no payees. Numeric-only and secret-shaped values are rejected.
// - The browser runs on a temporary local session profile, deleted on
//   normal/handled exit (Enter, window close, timeout, Ctrl+C). An abrupt
//   kill (kill -9, power loss) may leave it under the OS temp dir.
// - Nothing is uploaded. This file imports no bank-sync module and no
//   supabase client.
//
// Usage on Mor's Mac (from the bank-sync folder, so node_modules resolves):
//   node src/discover-pending.js
//   1) log in to Isracard in the window that opens, then press Enter here
//   2) open the transactions / pending view, then press Enter here
//   3) read the printed endpoint names; the window closes and cleanup runs

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const LOGIN_PAGE = 'https://digital.isracard.co.il/personalarea/login'
const ALLOWED_HOST_SUFFIX = '.isracard.co.il'
const SERVICE_PATH = '/services/proxyrequesthandler.ashx'
const MAX_NAMES = 500
const MAX_REQUESTS = 5000
const MAX_POSTDATA_SCAN = 1_000_000
const MAX_MINUTES = 10
const LAUNCH_TIMEOUT_MS = 60_000
// Auth-family names are never reported, even on the service path.
const AUTHISH = /auth|login|otp|pass|secret|token|valid|signin|logon/i

// Endpoint-shaped: starts with a letter, 3-60 chars of [A-Za-z0-9_-], and at
// least 70% letters - so numeric-only and hex/secret-shaped values are out.
export function acceptToken(v) {
  if (typeof v !== 'string' || v.length < 3 || v.length > 60) return false
  if (!/^[A-Za-z][A-Za-z0-9_\-]*$/.test(v)) return false
  const letters = (v.match(/[A-Za-z]/g) || []).length
  if (letters / v.length < 0.7) return false
  if (AUTHISH.test(v)) return false
  return true
}

// Only the verified isracard service-handler path is ever inspected.
export function isServiceEndpoint(url) {
  try {
    const u = new URL(url)
    const hostOk = u.hostname === 'isracard.co.il' || u.hostname.endsWith(ALLOWED_HOST_SUFFIX)
    return hostOk && u.pathname.toLowerCase() === SERVICE_PATH
  } catch { return false }
}

export function extractReqNamesFromUrl(url) {
  if (!isServiceEndpoint(url)) return []
  try {
    const v = new URL(url).searchParams.get('reqName')
    return acceptToken(v) ? [v] : []
  } catch { return [] }
}

export function extractReqNamesFromPostData(url, postData) {
  if (!isServiceEndpoint(url)) return []
  if (typeof postData !== 'string' || postData.length > MAX_POSTDATA_SCAN) return []
  const out = []
  for (const m of postData.matchAll(/reqName=([A-Za-z0-9_\-]{1,80})/g)) {
    if (acceptToken(m[1])) out.push(m[1])
  }
  return out
}

const PENDINGISH = /pend|process|klita|future|unposted|shaar|waiting|clea?rance/i

export function classify(names) {
  return {
    pendingCandidates: names.filter((n) => PENDINGISH.test(n)),
    other: names.filter((n) => !PENDINGISH.test(n)),
  }
}

// Controlled error codes only - raw error messages can carry URLs/paths/params.
export function errorCode(e) {
  const msg = String((e && e.message) || e || '')
  if (/puppeteer-core|Cannot find/i.test(msg)) return 'PPTR_UNAVAILABLE'
  if (/chrome|executable|launch|spawn|browser/i.test(msg)) return 'LAUNCH_FAILED'
  return 'UNKNOWN'
}

// Records ONLY endpoint-shaped names from the verified service-handler path.
// Bounded: stops recording after MAX_REQUESTS requests or MAX_NAMES names,
// enforced inside every batch loop.
export class ReqNameRecorder {
  #names = new Set()
  #requestsSeen = 0
  #truncated = false

  #add(name) {
    if (this.#names.size >= MAX_NAMES) { this.#truncated = true; return false }
    this.#names.add(name)
    return true
  }

  handleRequest({ url, postData } = {}) {
    if (!isServiceEndpoint(url)) return
    if (this.#requestsSeen >= MAX_REQUESTS) { this.#truncated = true; return }
    this.#requestsSeen++
    // Prefer the URL's reqName. Only when the URL carries none do we look at
    // the body - and the body is scanned for the token in memory and discarded.
    const fromUrl = extractReqNamesFromUrl(url)
    for (const n of fromUrl) { if (!this.#add(n)) break }
    if (fromUrl.length > 0) return
    for (const n of extractReqNamesFromPostData(url, postData)) { if (!this.#add(n)) break }
  }

  get requestsSeen() { return this.#requestsSeen }

  report() {
    const names = [...this.#names].sort()
    const { pendingCandidates, other } = classify(names)
    return { requestsSeen: this.#requestsSeen, truncated: this.#truncated, total: names.length, pendingCandidates, other }
  }
}

function chromeCandidates() {
  const home = os.homedir()
  return [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    path.join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean)
}

function findChrome() {
  for (const p of chromeCandidates()) {
    try { if (fs.existsSync(p)) return p } catch { /* keep looking */ }
  }
  return null
}

function fail(code, hint) {
  console.log(`RESULT: ${code}${hint ? ' - ' + hint : ''}`)
  process.exit(2)
}

async function main() {
  let puppeteer
  try {
    ;({ default: puppeteer } = await import('puppeteer-core'))
  } catch {
    fail('PPTR_UNAVAILABLE', 'run from the bank-sync folder: node src/discover-pending.js')
  }
  const chromePath = findChrome()
  if (!chromePath) {
    fail('CHROME_NOT_FOUND', 'install Chrome, or CHROME_PATH="/full/path/to/Google Chrome" node src/discover-pending.js')
  }
  console.log('Isracard endpoint-name discovery (local only, names only)')
  console.log(`Stops by itself after ${MAX_MINUTES} minutes. Nothing is uploaded.`)
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discover-pending-'))
  let browser = null
  let windowClosed = false
  const recorder = new ReqNameRecorder()
  const cleanup = async () => {
    if (browser) await browser.close().catch(() => {})
    fs.rmSync(profileDir, { recursive: true, force: true })
  }
  const hardStop = setTimeout(async () => { await cleanup(); console.log('RESULT: TIMEOUT'); process.exit(2) }, MAX_MINUTES * 60 * 1000)
  process.once('SIGINT', async () => { await cleanup(); process.exit(130) })
  try {
    browser = await Promise.race([
      puppeteer.launch({ executablePath: chromePath, headless: false, defaultViewport: null, userDataDir: profileDir }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('launch timeout')), LAUNCH_TIMEOUT_MS)),
    ]).catch(async (e) => { await cleanup(); fail(errorCode(e)) })
    const page = (await browser.pages())[0] || (await browser.newPage())
    await page.goto(LOGIN_PAGE, { waitUntil: 'domcontentloaded' }).catch(() => {})
    console.log(`Opened ${LOGIN_PAGE}`)
    console.log('PHASE 1: log in YOURSELF in that window. Nothing is recorded yet.')
    console.log('When you are logged in, come back here and press Enter.')
    await new Promise((resolve) => {
      process.stdin.resume()
      process.stdin.once('data', resolve)
      browser.on('disconnected', () => { windowClosed = true; resolve() })
    })
    if (windowClosed) { await cleanup(); console.log('RESULT: WINDOW_CLOSED_BEFORE_LOGIN_CONFIRMED'); process.exit(2) }

    page.on('request', (req) => {
      try {
        // Gate on the URL first: req.postData() is never invoked for
        // non-service-handler requests, so their bodies are never read.
        if (!isServiceEndpoint(req.url())) return
        recorder.handleRequest({ url: req.url(), postData: req.postData() })
      } catch { /* ignore single-request errors */ }
    })
    console.log('PHASE 2: now open the transactions view (including the pending/approved section).')
    console.log('When it is on screen, come back here and press Enter.')
    await new Promise((resolve) => {
      process.stdin.once('data', resolve)
    })

    const r = recorder.report()
    console.log(`requests observed (service-handler only): ${r.requestsSeen}${r.truncated ? ' (cap reached - partial)' : ''}`)
    console.log(`endpoint names found: ${r.total}`)
    console.log('--- pending-like candidates (CANDIDATES ONLY - existence/shape unproven) ---')
    for (const n of r.pendingCandidates) console.log('  ' + n)
    console.log('--- other endpoint names ---')
    for (const n of r.other) console.log('  ' + n)
    if (r.total === 0) console.log('RESULT: no endpoint names observed - discovery UNKNOWN.')
  } finally {
    clearTimeout(hardStop)
    await cleanup()
  }
  process.exit(0)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => { console.log('RESULT: UNKNOWN'); process.exit(2) })
}
