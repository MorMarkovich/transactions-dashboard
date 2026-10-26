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
// - Output is ONLY endpoint names (reqName tokens) + counts. No URLs with
//   parameters, no headers, no cookies, no request/response bodies, no
//   amounts, no payees. Nothing is saved to disk and nothing is uploaded.
// - This file imports no bank-sync module and no supabase client.
//
// Usage on Mor's Mac (from the bank-sync folder, after npm install):
//   node src/discover-pending.js
// Then: log in to Isracard in the window that opens, click into the
// transactions view, return here and press Enter.

const LOGIN_PAGE = 'https://digital.isracard.co.il/personalarea/login'
const TOKEN = /^[A-Za-z0-9_\-]{3,60}$/

export function extractReqNamesFromUrl(url) {
  const out = []
  let u
  try { u = new URL(url) } catch { return out }
  const v = u.searchParams.get('reqName')
  if (v && TOKEN.test(v)) out.push(v)
  return out
}

export function extractReqNamesFromPostData(postData) {
  if (typeof postData !== 'string' || postData.length > 1_000_000) return []
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

// Records ONLY reqName tokens. Request URLs, parameters, headers, cookies and
// bodies are inspected in-memory for the token and discarded immediately.
export class ReqNameRecorder {
  #names = new Set()
  #requestsSeen = 0

  handleRequest({ url, postData } = {}) {
    this.#requestsSeen++
    for (const n of extractReqNamesFromUrl(url)) this.#names.add(n)
    for (const n of extractReqNamesFromPostData(postData)) this.#names.add(n)
  }

  get requestsSeen() { return this.#requestsSeen }

  report() {
    const names = [...this.#names].sort()
    const { pendingCandidates, other } = classify(names)
    return { requestsSeen: this.#requestsSeen, total: names.length, pendingCandidates, other }
  }
}

async function main() {
  const { default: puppeteer } = await import('puppeteer-core')
  console.log('Isracard endpoint-name discovery (local only, names only, no credentials)')
  console.log('A Chrome window will open. Log in YOURSELF, open the transactions view,')
  console.log('then come back here and press Enter. Nothing is saved or uploaded.')
  let browser
  try {
    browser = await puppeteer.launch({
      channel: process.env.CHROME_CHANNEL || 'chrome',
      executablePath: process.env.CHROME_PATH || undefined,
      headless: false,
      defaultViewport: null,
    })
  } catch (e) {
    console.log(`RESULT: error - could not open Chrome (${e.message}).`)
    console.log('If Chrome is installed in a non-standard place, set CHROME_PATH and retry.')
    process.exit(2)
  }
  const page = (await browser.pages())[0] || (await browser.newPage())
  const recorder = new ReqNameRecorder()
  page.on('request', (req) => {
    try { recorder.handleRequest({ url: req.url(), postData: req.postData() }) } catch { /* ignore single-request errors */ }
  })
  await page.goto(LOGIN_PAGE, { waitUntil: 'domcontentloaded' }).catch(() => {})
  console.log(`Opened ${LOGIN_PAGE}`)
  await new Promise((resolve) => {
    process.stdin.resume()
    process.stdin.once('data', resolve)
    browser.on('disconnected', resolve)
  })
  const r = recorder.report()
  console.log(`requests observed: ${r.requestsSeen}`)
  console.log(`endpoint names found: ${r.total}`)
  console.log('--- pending-like candidates (CANDIDATES ONLY - existence/shape unproven) ---')
  for (const n of r.pendingCandidates) console.log('  ' + n)
  console.log('--- other endpoint names ---')
  for (const n of r.other) console.log('  ' + n)
  if (r.total === 0) console.log('RESULT: no endpoint names observed - discovery UNKNOWN.')
  await browser.close().catch(() => {})
  process.exit(0)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.log(`RESULT: error - ${e.message}`); process.exit(2) })
}
