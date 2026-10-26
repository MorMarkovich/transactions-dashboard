// Opt-in, LOCAL-ONLY request/response SHAPE recorder for the Isracard
// personal area's pending-transactions view.
//
// Why: the public pre-login assets do not reference transaction-service
// endpoints (verified 2026-10-26: 14 public bundles, 0 pending-like names),
// so the endpoint contract can only be learned by OBSERVING the real site
// while the user navigates the real pending view. Nothing here invents or
// replays requests: this script records only what the bank's own pages
// already send.
//
// What is recorded (allowlist, nothing else):
// - endpoint names (reqName) on the verified service-handler path
// - request parameter KEY NAMES (URL query keys + body keys)
// - response JSON KEY NAMES with value-TYPE classification
//   (string/number/boolean/array/object/null/date-shaped-string)
// - whether posted-schema identifier keys (voucherNumberRatz family)
//   are present among the response item keys
// No counts. No URLs with parameters. No headers. No cookies. No request or
// response values are retained or output: bodies are parsed in memory and
// discarded; only key names and type labels survive.
//
// Hard bounds (deliberate, do not widen):
// - TWO PHASES. Phase 1 opens a plain Chrome window at the login page; the
//   USER logs in HIMSELF. Nothing is observed or recorded during login.
//   Only after the user returns here and confirms login does Phase 2 attach
//   listeners, and only to the verified service-handler path
//   (/services/ProxyRequestHandler.ashx on *.isracard.co.il).
// - This script never types, reads, or stores credentials, and never
//   performs a bank login. No listener exists during login (Phase 1).
//   In Phase 2, non-service-handler requests/responses are dropped by URL
//   before their bodies are touched. On the service path the URL reqName is
//   checked FIRST, so a mid-session auth-family call (e.g. token refresh)
//   is dropped without its body being consulted. Only when the URL carries
//   no usable token is the body scanned transiently for a reqName; if an
//   auth-family name is found there the observation is discarded.
// - The browser runs on a temporary local session profile, deleted on
//   normal/handled exit (Enter, window close, timeout, Ctrl+C). An abrupt
//   kill (kill -9, power loss) may leave it under the OS temp dir.
// - Nothing is uploaded. This file imports no bank-sync module and no
//   supabase client.
//
// Usage on Mor's Mac (from the bank-sync folder, so node_modules resolves):
//   node src/record-pending-shape.js
//   1) log in to Isracard in the window that opens, then press Enter here
//   2) open the pending/approved view, then press Enter here
//   3) copy everything between the markers; the window closes and cleanup runs

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const LOGIN_PAGE = 'https://digital.isracard.co.il/personalarea/login'
const ALLOWED_HOST_SUFFIX = '.isracard.co.il'
const SERVICE_PATH = '/services/proxyrequesthandler.ashx'
const MAX_OBSERVATIONS = 200
const MAX_REQUESTS = 5000
const MAX_POSTDATA_SCAN = 1_000_000
const MAX_RESPONSE_CHARS = 5_000_000
const MAX_KEYS_PER_OBJECT = 100
const MAX_ITEMS_SCAN = 2000
const MAX_MINUTES = 10
const LAUNCH_TIMEOUT_MS = 60_000
// Auth-family names are never reported, even on the service path.
const AUTHISH = /auth|login|otp|pass|secret|token|valid|signin|logon/i
// Posted-schema identifier keys (from israeli-bank-scrapers isracard mapping).
const VOUCHER_KEYS = ['voucherNumberRatz', 'voucherNumberRatzOutbound', 'voucherNumber']

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

// Schema-shaped key names only. Anything else (and auth-family keys) is
// omitted and flagged, never echoed.
export function acceptKey(k) {
  if (typeof k !== 'string' || k.length < 1 || k.length > 64) return false
  if (!/^[A-Za-z_][A-Za-z0-9_\-]*$/.test(k)) return false
  if (AUTHISH.test(k)) return false
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

// Value-TYPE labels only. Values themselves are never returned.
export function classifyValue(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  const t = typeof v
  if (t === 'number' || t === 'boolean') return t
  if (t === 'object') return 'object'
  if (t === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v)) return 'date-shaped-string'
    return 'string'
  }
  return 'unknown'
}

// URL token first. If the URL carries a reqName that fails the endpoint
// allowlist (auth-family, numeric, secret-shaped), the request is dropped
// WITHOUT consulting the body. Only a tokenless URL falls back to a
// transient body scan.
export function extractReqName(url, postData) {
  if (!isServiceEndpoint(url)) return null
  let raw = null
  try { raw = new URL(url).searchParams.get('reqName') } catch { return null }
  if (raw !== null) return acceptToken(raw) ? raw : null
  if (typeof postData !== 'string' || postData.length > MAX_POSTDATA_SCAN) return null
  const m = postData.match(/reqName=([A-Za-z0-9_\-]{1,80})/)
  if (!m) return null
  return acceptToken(m[1]) ? m[1] : null
}

// Request parameter KEY NAMES from URL query + body (form-encoded or JSON).
// Key names only - parameter values are never returned.
export function extractRequestKeys(url, postData) {
  const keys = new Set()
  let omitted = false
  const add = (k) => { if (acceptKey(k)) keys.add(k); else omitted = true }
  try { for (const k of new URL(url).searchParams.keys()) add(k) } catch { /* skip */ }
  if (typeof postData === 'string' && postData.length > 0 && postData.length <= MAX_POSTDATA_SCAN) {
    const t = postData.trim()
    if (t.startsWith('{')) {
      try { for (const k of Object.keys(JSON.parse(t))) add(k) } catch { omitted = true }
    } else {
      try { for (const k of new URLSearchParams(t).keys()) add(k) } catch { omitted = true }
    }
  }
  return { keys: [...keys], omitted }
}

function addKeyType(map, key, typeLabel, state) {
  if (!acceptKey(key)) { state.omitted = true; return }
  let s = map.get(key)
  if (!s) {
    if (map.size >= MAX_KEYS_PER_OBJECT) { state.omitted = true; return }
    s = new Set()
    map.set(key, s)
  }
  s.add(typeLabel)
}

// Extract key/type shape from a PARSED JSON value. Values are never copied.
export function shapeResponseJson(parsed) {
  const state = { omitted: false }
  const responseKeys = new Map()
  const itemKeys = new Map()
  let itemsKey = null
  let items = null
  if (Array.isArray(parsed)) {
    items = parsed
  } else if (parsed && typeof parsed === 'object') {
    for (const [k, v] of Object.entries(parsed)) {
      addKeyType(responseKeys, k, classifyValue(v), state)
      if (itemsKey === null && Array.isArray(v) && v.some((e) => e && typeof e === 'object' && !Array.isArray(e))) {
        itemsKey = acceptKey(k) ? k : null
        items = v
      }
    }
  }
  if (items) {
    let scanned = 0
    for (const e of items) {
      if (scanned >= MAX_ITEMS_SCAN) { state.omitted = true; break }
      if (!e || typeof e !== 'object' || Array.isArray(e)) continue
      scanned++
      for (const [k, v] of Object.entries(e)) addKeyType(itemKeys, k, classifyValue(v), state)
    }
  }
  return { responseKeys, itemsKey, itemKeys, nonSchemaKeysOmitted: state.omitted }
}

// Controlled error codes only - raw error messages can carry URLs/paths/params.
export function errorCode(e) {
  const msg = String((e && e.message) || e || '')
  if (/puppeteer-core|Cannot find/i.test(msg)) return 'PPTR_UNAVAILABLE'
  if (/chrome|executable|launch|spawn|browser/i.test(msg)) return 'LAUNCH_FAILED'
  return 'UNKNOWN'
}

function typeMapToObject(map) {
  const out = {}
  for (const k of [...map.keys()].sort()) out[k] = [...map.get(k)].sort().join('|')
  return out
}

class Observation {
  constructor(reqName) {
    this.reqName = reqName
    this.requestKeys = new Set()
    this.responseFormat = 'not-observed' // json | non-json | too-large | unavailable | not-observed
    this.responseKeys = new Map()
    this.itemsKey = null
    this.itemKeys = new Map()
    this.nonSchemaKeysOmitted = false
  }

  addRequest(keys, omitted) {
    for (const k of keys) this.requestKeys.add(k)
    if (omitted) this.nonSchemaKeysOmitted = true
  }

  setResponse(bodyText) {
    if (this.responseFormat !== 'not-observed') return // first observed response wins
    if (bodyText === undefined) { this.responseFormat = 'unavailable'; return }
    if (bodyText.length > MAX_RESPONSE_CHARS) { this.responseFormat = 'too-large'; return }
    let parsed
    try { parsed = JSON.parse(bodyText) } catch { this.responseFormat = 'non-json'; return }
    this.responseFormat = 'json'
    const shape = shapeResponseJson(parsed)
    for (const [k, s] of shape.responseKeys) this.responseKeys.set(k, s)
    for (const [k, s] of shape.itemKeys) this.itemKeys.set(k, s)
    if (shape.itemsKey !== null) this.itemsKey = shape.itemsKey
    if (shape.nonSchemaKeysOmitted) this.nonSchemaKeysOmitted = true
  }

  toJSON() {
    const itemKeyNames = new Set(this.itemKeys.keys())
    return {
      reqName: this.reqName,
      requestKeys: [...this.requestKeys].sort(),
      responseFormat: this.responseFormat,
      responseKeys: typeMapToObject(this.responseKeys),
      itemsKey: this.itemsKey,
      itemKeys: typeMapToObject(this.itemKeys),
      identifierKeys: VOUCHER_KEYS.filter((k) => itemKeyNames.has(k)),
      nonSchemaKeysOmitted: this.nonSchemaKeysOmitted,
    }
  }
}

// Records ONLY shape allowlist data from the verified service-handler path.
export class ShapeRecorder {
  #byUrl = new Map()
  #obs = new Map()
  #requestsSeen = 0
  #truncated = false

  // postData is a THUNK: it is invoked only after the URL checks pass, so
  // auth-family and non-service request bodies are never read.
  handleRequest({ url, postData } = {}) {
    if (!isServiceEndpoint(url)) return
    if (this.#requestsSeen >= MAX_REQUESTS) { this.#truncated = true; return }
    this.#requestsSeen++
    let urlRaw = null
    try { urlRaw = new URL(url).searchParams.get('reqName') } catch { return }
    if (urlRaw !== null && !acceptToken(urlRaw)) return // auth-family/numeric: body never consulted
    const pd = typeof postData === 'function' ? postData() : null
    const reqName = acceptToken(urlRaw) ? urlRaw : extractReqName(url, pd)
    if (!reqName) return
    let o = this.#obs.get(reqName)
    if (!o) {
      if (this.#obs.size >= MAX_OBSERVATIONS) { this.#truncated = true; return }
      o = new Observation(reqName)
      this.#obs.set(reqName, o)
    }
    const { keys, omitted } = extractRequestKeys(url, pd)
    o.addRequest(keys, omitted)
    if (!this.#byUrl.has(url) && this.#byUrl.size < MAX_REQUESTS) this.#byUrl.set(url, o)
  }

  handleResponse({ url, bodyText } = {}) {
    if (!isServiceEndpoint(url)) return
    const o = this.#byUrl.get(url)
    if (!o) return
    this.#byUrl.delete(url)
    o.setResponse(bodyText)
  }

  report() {
    return {
      truncated: this.#truncated,
      observations: [...this.#obs.values()].map((o) => o.toJSON()).sort((a, b) => a.reqName.localeCompare(b.reqName)),
    }
  }
}

// Listener factories: gate on the URL before ANY body access.
export function makeRequestListener(recorder) {
  return (req) => {
    try {
      const url = req.url()
      if (!isServiceEndpoint(url)) return
      recorder.handleRequest({ url, postData: () => req.postData() })
    } catch { /* ignore single-request errors */ }
  }
}

export function makeResponseListener(recorder) {
  return async (res) => {
    try {
      const url = res.url()
      if (!isServiceEndpoint(url)) return
      let bodyText
      try { bodyText = await res.text() } catch { bodyText = undefined }
      recorder.handleResponse({ url, bodyText })
    } catch { /* ignore single-response errors */ }
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
    fail('PPTR_UNAVAILABLE', 'run from the bank-sync folder: node src/record-pending-shape.js')
  }
  const chromePath = findChrome()
  if (!chromePath) {
    fail('CHROME_NOT_FOUND', 'install Chrome, or CHROME_PATH="/full/path/to/Google Chrome" node src/record-pending-shape.js')
  }
  console.log('Isracard pending-view SHAPE recorder (local only: endpoint names, key names, value types)')
  console.log(`Stops by itself after ${MAX_MINUTES} minutes. Nothing is uploaded. No values are retained or output.`)
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'record-pending-shape-'))
  let browser = null
  let windowClosed = false
  const recorder = new ShapeRecorder()
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

    page.on('request', makeRequestListener(recorder))
    page.on('response', makeResponseListener(recorder))
    console.log('PHASE 2: now open the pending/approved view ("עסקאות שאושרו וטרם נקלטו").')
    console.log('When it is on screen, come back here and press Enter.')
    await new Promise((resolve) => {
      process.stdin.once('data', resolve)
    })

    const r = recorder.report()
    console.log('-----BEGIN SHAPE REPORT-----')
    console.log(JSON.stringify(r, null, 2))
    console.log('-----END SHAPE REPORT-----')
    if (r.observations.length === 0) console.log('RESULT: NO_SERVICE_REQUESTS_OBSERVED - shape UNKNOWN.')
  } finally {
    clearTimeout(hardStop)
    await cleanup()
  }
  process.exit(0)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => { console.log('RESULT: UNKNOWN'); process.exit(2) })
}
