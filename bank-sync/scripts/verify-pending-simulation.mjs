// Only loopback. No application configuration, secrets or bank connection.
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { createClient } from '@supabase/supabase-js'
import { boundedIssuerPost, attachPendingSessionHook, attachPendingDiscoveryHook } from '../src/isracard-pending-session.js'
import { enablePendingForAccount } from '../src/pending-enable-flow.js'
import { safeErrorCode } from '../src/safe-errors.js'
import { PENDING_ENDPOINTS } from '../src/isracard-pending-collector.js'
import { readPendingCard, savePendingObservation } from '../src/pending-store.js'
import { bindingCardKey } from '../src/pending-binding.js'
const base = new URL(process.argv[2])
assert.equal(base.protocol, 'http:'); assert.equal(base.hostname, '127.0.0.1'); assert.ok(base.port)
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const target = { accountKey: 'pending-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', companyCode: '11', isPartner: false, cardSuffix: '1234' }
const cardKey = bindingCardKey(target)
const client = createClient(`${base.origin}/snapshots`, 'synthetic-only', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, options) => {
  assert.equal(new URL(url).origin, base.origin)
  return fetch(url, { ...options, signal: AbortSignal.timeout(5000) })
} } })
await fetch(`${base.origin}/snapshots/__reset`, { method: 'POST', signal: AbortSignal.timeout(5000) })
let previous = await readPendingCard(client, userId, cardKey)
assert.equal(previous.version, 0)
let requests = 0
for (const mode of ['ok', 'rate', 'html', 'partial', 'empty', 'ok', 'rollover']) {
  const browserFetch = async (url, options) => {
    assert.ok(Object.values(PENDING_ENDPOINTS).includes(url)); requests++
    const response = await fetch(`${base.origin}/issuer${new URL(url).pathname}`, {
      ...options, headers: { ...options.headers, 'x-synthetic-mode': mode }, signal: AbortSignal.any([options.signal, AbortSignal.timeout(5000)]),
    })
    Object.defineProperty(response, 'url', { value: url })
    return response
  }
  const callback = vm.runInNewContext(`(${boundedIssuerPost.toString()})`, { fetch: browserFetch, AbortController, TextDecoder, setTimeout, clearTimeout })
  const posted = { success: true, accounts: [{ txns: [{ description: 'Synthetic posted', chargedAmount: 99 }] }] }
  const scraper = { page: { url: () => 'https://web.isracard.co.il/transactions', evaluate: (_, input) => callback(input) }, fetchData: async () => posted, terminate: async () => {} }
  const hook = attachPendingSessionHook(scraper, target)
  assert.equal(await scraper.fetchData(), posted); assert.equal(posted.accounts[0].txns.length, 1)
  const fresh = hook.getResult(); hook.detach()
  previous = await savePendingObservation(client, { userId, cardKey, previous, fresh, checkedAt: new Date().toISOString() })
  const stored = await readPendingCard(client, userId, cardKey)
  assert.deepEqual(stored, previous)
  if (mode === 'ok') assert.equal(stored.data.current.rows.length, 4)
  if (['rate', 'html', 'partial'].includes(mode)) { assert.equal(stored.data.state, 'stale'); assert.equal(stored.data.current.rows.length, 4) }
  if (mode === 'empty') assert.equal(stored.data.current.rows.length, 0)
  if (mode === 'rollover') { assert.equal(stored.data.current.rows.length, 0); assert.equal(stored.data.unresolved[0].rows.length, 4) }
}
await assert.rejects(savePendingObservation(client, { userId, cardKey, previous: { ...previous, version: previous.version - 1 }, fresh: previous.data.current, checkedAt: new Date().toISOString() }), /pending_store_conflict/)
assert.equal(requests, 14)
console.log('PASS: 7 HTTP scenarios, 14 issuer requests; four approvals, stale retention, explicit empty, rollover, CAS conflict; posted row unchanged.')
for (const [mode, expected] of [['discovery-auth', 'BANK_PENDING_AUTH_REQUIRED'], ['discovery-rate', 'BANK_PENDING_RATE_LIMITED'], ['discovery-partial', 'BANK_PENDING_CONTRACT_UNSUPPORTED']]) {
  let calls = 0, writes = 0
  const browserFetch = async (url, options) => {
    assert.equal(url, PENDING_ENDPOINTS.cards); calls++
    const response = await fetch(`${base.origin}/issuer${new URL(url).pathname}`, {
      ...options, headers: { ...options.headers, 'x-synthetic-mode': mode }, signal: AbortSignal.any([options.signal, AbortSignal.timeout(5000)]),
    })
    Object.defineProperty(response, 'url', { value: url }); return response
  }
  const callback = vm.runInNewContext(`(${boundedIssuerPost.toString()})`, { fetch: browserFetch, AbortController, TextDecoder, setTimeout, clearTimeout })
  const scraper = { page: { url: () => 'https://web.isracard.co.il/transactions', evaluate: (_, input) => callback(input) }, fetchData: async () => ({ success: true, accounts: [] }) }
  await assert.rejects(enablePendingForAccount({
    account: { key: 'synthetic', provider: 'isracard' }, userId, credentials: {}, options: {},
    client: { auth: { getUser: async () => ({ data: { user: { id: userId } } }) } },
    approveDiscovery: async () => true,
    discover: async () => { const hook = attachPendingDiscoveryHook(scraper); await scraper.fetchData(); const pending = hook.getResult(); hook.detach(); return { pending } },
    chooseCard: async () => { throw Error('must not select') }, approveBinding: async () => { throw Error('must not enable') },
    writeAccount: async () => { writes++ },
  }), error => safeErrorCode(error) === expected)
  assert.equal(calls, 1); assert.equal(writes, 0)
}
console.log('PASS: 3 discovery HTTP failures retain safe diagnostics; one request each, no retry, binding or snapshot writes.')
