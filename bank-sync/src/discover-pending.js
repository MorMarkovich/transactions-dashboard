// Opt-in, LOCAL-ONLY endpoint-name discovery for the Isracard personal area.
//
// Why: the public pre-login assets do not reference transaction-service
// endpoints (verified 2026-10-26: 14 public bundles, 0 pending-like names),
// so discovering whether a pending/unsettled-transactions endpoint exists
// requires observing the REAL app after login.
//
// Hard bounds (deliberate, do not widen):
// - The USER logs in HIMSELF in the opened browser window. This script never
//   sees, stores, or types credentials, and never performs a bank login.
// - Output is ONLY endpoint names (reqName tokens) + counts from requests to
//   *.isracard.co.il. No URLs with parameters, no headers, no cookies, no
//   request/response bodies, no amounts, no payees.
// - The browser runs on a throwaway temporary profile that is deleted when
//   the script exits. No cookies or site data are kept. Nothing is uploaded.
// - This file imports no bank-sync module and no supabase client.
//
// Usage on Mor's Mac (from the bank-sync folder, so node_modules resolves):
//   node src/discover-pending.js
// Then: log in to Isracard in the window that opens, click into the
// transactions view, return here and press Enter (or just close the window).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const LOGIN_PAGE = 'https://digital.isracard.co.il/personalarea/login'
const ALLOWED_HOST_SUFFIX = '.isracard.co.il'
const TOKEN = /^[A-Za-z0-9_\-]{3,60}$/
const MAX_NAMES = 500
const MAX_REQUESTS = 5000
const MAX_POSTDATA_SCAN = 1_000_000
const MAX_MINUTES = 10

function isAllowedHost(url) {
  try {
    const h = new URL(url).hostname
    return h === 'isracard.co.il' || h.endsWith(ALLOWED_HOST_SUFFIX)
  } catch { return false }
}

export function extractReqNamesFromUrl(url) {
  if (!isAllowedHost(url)) return []
  try {
    const v = new URL(url).searchParams.get('reqName')
    return v && TOKEN.test(v) ? [v] : []
  } catch { return [] }
}

export function extractReqNamesFromPostData(url, postData) {
  if (!isAllowedHost(url)) return []
  if (typeof postData !== 'string' || postData.length > MAX_POSTDATA_SCAN) return []
  const out = []
  for (const m of postData.matchAll(/reqName=([A-Za-z0-9_\-]{3,60})/g)) {
    if (TOKEN.test(m[1])) out.push(m[1])
  }
  return out
}

const PENDINGISH = /pend|process|klita|future|unposted|shaar|waiting|clea?rance|auth/i

export function classify(names) {
  return {
    pendingCandidates: names.filter((n) => PENDINGISH.test(n)),
    other: names.filter((n) => !PENDINGISH.test(n)),
  }
}

// Records ONLY reqName tokens from *.isracard.co.il requests. Request URLs,
// parameters, headers, cookies and bodies are inspected in-memory for the
// token and discarded immediately. Bounded: stops recording after
// MAX_REQUESTS requests or MAX_NAMES distinct names.
export class ReqNameRecorder {
  #names = new Set()
  #requestsSeen = 0
  #truncated = false

  handleRequest({ url, postData } = {}) {
    if (this.#requestsSeen >= MAX_REQUESTS || this.#names.size >= MAX_NAMES) {
      this.#truncated = true
      return
    }
    this.#requestsSeen++
    for (const n of extractReqNamesFromUrl(url)) this.#names.add(n)
    for (const n of extractReqNamesFromPostData(url, postData)) this.#names.add(n)
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

async function main() {
  let puppeteer
  try {
    ;({ default: puppeteer } = await import('puppeteer-core'))
  } catch {
    console.log('RESULT: error - could not load puppeteer-core.')
    console.log('Run this from the bank-sync folder (node src/discover-pending.js) so the existing node_modules is found.')
    process.exit(2)
  }
  const chromePath = findChrome()
  if (!chromePath) {
    console.log('RESULT: error - Chrome not found in /Applications or ~/Applications.')
    console.log('If Chrome lives elsewhere, run: CHROME_PATH="/full/path/to/Google Chrome" node src/discover-pending.js')
    process.exit(2)
  }
  console.log('Isracard endpoint-name discovery (local only, names only, no credentials)')
  console.log('A Chrome window will open. Log in YOURSELF, open the transactions view,')
  console.log(`then come back here and press Enter. Auto-stops after ${MAX_MINUTES} minutes.`)
  console.log('Nothing is saved or uploaded; the browser profile is deleted on exit.')
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discover-pending-'))
  let browser = null
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: false,
      defaultViewport: null,
      userDataDir: profileDir,
    })
    const page = (await browser.pages())[0] || (await browser.newPage())
    const recorder = new ReqNameRecorder()
    page.on('request', (req) => {
      try { recorder.handleRequest({ url: req.url(), postData: req.postData() }) } catch { /* ignore single-request errors */ }
    })
    await page.goto(LOGIN_PAGE, { waitUntil: 'domcontentloaded' }).catch(() => {})
    console.log(`Opened ${LOGIN_PAGE}`)
    const timeout = setTimeout(() => process.kill(process.pid, 'SIGTERM'), MAX_MINUTES * 60 * 1000)
    timeout.unref()
    await new Promise((resolve) => {
      process.stdin.resume()
      process.stdin.once('data', resolve)
      browser.on('disconnected', resolve)
      process.once('SIGTERM', resolve)
    })
    const r = recorder.report()
    console.log(`requests observed: ${r.requestsSeen}${r.truncated ? ' (cap reached - partial)' : ''}`)
    console.log(`endpoint names found: ${r.total}`)
    console.log('--- pending-like candidates (CANDIDATES ONLY - existence/shape unproven) ---')
    for (const n of r.pendingCandidates) console.log('  ' + n)
    console.log('--- other endpoint names ---')
    for (const n of r.other) console.log('  ' + n)
    if (r.total === 0) console.log('RESULT: no endpoint names observed - discovery UNKNOWN.')
  } finally {
    if (browser) await browser.close().catch(() => {})
    fs.rmSync(profileDir, { recursive: true, force: true })
  }
  process.exit(0)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.log(`RESULT: error - ${e.message}`); process.exit(2) })
}
