// One-shot, READ-ONLY discovery probe: which service endpoint names
// (reqName tokens) does Isracard's public web app know about?
//
// Bounds (deliberate, do not widen):
// - NO login, NO credentials, NO bank session. It fetches the PUBLIC login
//   page and its public static JS bundles - the same files any browser
//   downloads before signing in.
// - It never calls a data/API endpoint, never guesses reqNames, and runs
//   exactly once (no loops, no retries, no polling).
// - It prints ONLY: counts, and the distinct endpoint NAMES found. No HTML/JS
//   content, no headers, no cookies, no URLs with parameters, nothing
//   personal (there is nothing personal - no session exists).
//
// Finding a name is a CANDIDATE, not proof the endpoint exists or what it
// returns; finding nothing means "unknown", not "unsupported".
//
// Usage on Mor's Mac (no npm/git needed):
//   node src/probe-isracard.js        (from the bank-sync folder)
// or fully standalone:
//   curl -sL <raw-url-of-this-file> -o /tmp/probe-isracard.js && node /tmp/probe-isracard.js

const LOGIN_PAGE = 'https://digital.isracard.co.il/personalarea/login'
const MAX_BUNDLES = 6
const MAX_BUNDLE_BYTES = 15 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20000
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

// --- pure, unit-tested extraction ---

export function extractScriptUrls(html, baseUrl) {
  const base = new URL(baseUrl)
  const urls = []
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[1], base)
      if (u.origin === base.origin && u.pathname.endsWith('.js')) urls.push(u.origin + u.pathname)
    } catch { /* ignore malformed */ }
  }
  return [...new Set(urls)]
}

export function extractReqNames(jsText) {
  const names = new Set()
  // reqName=Name (URL params), reqName:'Name', reqName:"Name", 'reqName': 'Name'
  for (const m of jsText.matchAll(/reqName['"]?\s*[=:,]\s*['"]([A-Za-z0-9_\-]{3,60})['"]|reqName=([A-Za-z0-9_\-]{3,60})/g)) {
    names.add(m[1] || m[2])
  }
  return [...names].sort()
}

export function classifyCandidates(names) {
  const pendingish = /pend|process|klita|future|unposted|shaar|waiting|clea?rance|auth/i
  return {
    pendingCandidates: names.filter((n) => pendingish.test(n)),
    other: names.filter((n) => !pendingish.test(n)),
  }
}

// --- thin network wrapper ---

async function getText(url, capBytes) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'he,en' }, signal: ctrl.signal, redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const reader = res.body.getReader()
    const chunks = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > capBytes) { await reader.cancel(); break }
      chunks.push(value)
    }
    return Buffer.concat(chunks).toString('utf8')
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  console.log('Isracard public-asset endpoint-name probe (no login, read-only, one shot)')
  let html
  try {
    html = await getText(LOGIN_PAGE, 1024 * 1024)
  } catch (e) {
    console.log(`RESULT: blocked - could not fetch the public login page (${e.message}).`)
    console.log('This usually means the site challenged the request (bot protection). Endpoint discovery is UNKNOWN, not impossible.')
    process.exit(2)
  }
  if (/Attention Required|cf-chl|cloudflare/i.test(html) && html.length < 20000) {
    console.log('RESULT: blocked - bot-protection challenge page received. Endpoint discovery is UNKNOWN, not impossible.')
    process.exit(2)
  }
  const bundles = extractScriptUrls(html, LOGIN_PAGE).slice(0, MAX_BUNDLES)
  console.log(`login page OK; ${bundles.length} public JS bundle(s) to scan (capped at ${MAX_BUNDLES})`)
  const all = new Set()
  let scanned = 0
  for (const u of bundles) {
    try {
      const js = await getText(u, MAX_BUNDLE_BYTES)
      scanned++
      for (const n of extractReqNames(js)) all.add(n)
    } catch (e) {
      console.log(`(one bundle failed to load: ${e.message} - continuing)`)
    }
  }
  const names = [...all].sort()
  const { pendingCandidates, other } = classifyCandidates(names)
  console.log(`bundles scanned: ${scanned}/${bundles.length}`)
  console.log(`endpoint names found: ${names.length}`)
  console.log('--- pending-like candidates (CANDIDATES ONLY - existence/shape unproven) ---')
  for (const n of pendingCandidates) console.log('  ' + n)
  console.log('--- other endpoint names ---')
  for (const n of other) console.log('  ' + n)
  if (names.length === 0) console.log('RESULT: no endpoint names in public bundles - discovery UNKNOWN (app may lazy-load them after login).')
  process.exit(0)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.log(`RESULT: error - ${e.message}`); process.exit(2) })
}
