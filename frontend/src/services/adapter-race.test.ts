// @vitest-environment node
// D31 synthetic race harness - LOCAL ONLY, uncommitted. Exercises the REAL
// cachingAdapter + interceptors from services/api.ts against a controlled
// local HTTP server (no production, no real user data).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { vi } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

const tokenHolder = vi.hoisted(() => ({ current: 'tokenA' }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: tokenHolder.current } } }),
      refreshSession: async () => ({ data: { session: { access_token: tokenHolder.current } }, error: null }),
      signOut: async () => ({}),
    },
  },
}))

let server: http.Server
let baseURL = ''
// Controlled server state
let storedValue = 'A'
let dataDelayMs = 0
let writeDelayMs = 0
let statusDelayMs = 0
const seenAuth: string[] = []

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = req.url || ''
    seenAuth.push(String(req.headers.authorization || 'none'))
    notifyAuth(String(req.headers.authorization || 'none'))
    if (url.startsWith('/api/ai-status')) {
      // echoes the auth header it saw - lets us prove whose cached data is served
      const auth = req.headers.authorization
      const body = JSON.stringify({ free_only: false, configured: true, paid_fallback: false, monthly_spend_limit_usd: null, authSeen: auth })
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json' }).end(body)
      }, statusDelayMs)
      return
    }
    if (url.startsWith('/api/session-info')) {
      const auth = req.headers.authorization
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ session_id: 'sess-1', authSeen: auth }))
      }, statusDelayMs)
      return
    }
    if (url.startsWith('/api/data')) {
      const valueAtRequestStart = storedValue // read state at request time, respond later
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ value: valueAtRequestStart }))
      }, dataDelayMs)
      return
    }
    if (url.startsWith('/api/write') && req.method === 'POST') {
      setTimeout(() => {
        storedValue = 'B'
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true }))
      }, writeDelayMs)
      return
    }
    res.writeHead(404).end('{}')
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  vi.stubEnv('VITE_API_URL', baseURL)
})

afterAll(async () => { await new Promise((r) => server.close(r)) })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Resolves when the server receives a request carrying the given auth header.
const authWaiters: { auth: string; resolve: () => void }[] = []
function waitForAuth(auth: string): Promise<void> {
  if (seenAuth.includes(auth)) return Promise.resolve()
  return new Promise<void>((resolve) => authWaiters.push({ auth, resolve }))
}
function notifyAuth(auth: string) {
  for (let i = authWaiters.length - 1; i >= 0; i--) {
    if (authWaiters[i].auth === auth) { authWaiters.splice(i, 1)[0].resolve() }
  }
}

describe('D31 adapter races (real cachingAdapter, controlled local server)', () => {
  it('identity: second user on same browser is served first user\'s cached GET (no auth-lifecycle invalidation)', async () => {
    const { transactionsApi } = await import('../services/api')
    tokenHolder.current = 'tokenA'
    const a = await transactionsApi.aiStatus() as unknown as { authSeen: string }
    expect(a.authSeen).toBe('Bearer tokenA')

    // simulate logout -> login as a different user (AuthContext.signOut only
    // calls supabase.auth.signOut(); nothing invalidates the response cache)
    tokenHolder.current = 'tokenB'
    const b = await transactionsApi.aiStatus() as unknown as { authSeen: string }
    console.log('[D31-identity] userB received authSeen =', b.authSeen)
    expect(b.authSeen).toBe('Bearer tokenB') // FAILS if B was served A's cached response
  })


  it('identity: identical GET in flight across logout/login must not share the pending promise', async () => {
    const { transactionsApi } = await import('../services/api')
    tokenHolder.current = 'tokenA'
    statusDelayMs = 150
    const pendingA = transactionsApi.aiStatus() as unknown as Promise<{ authSeen: string }>
    await waitForAuth('Bearer tokenA') // A's request has left; its response is still pending
    // logout/login before A's response lands
    tokenHolder.current = 'tokenB'
    const b = await transactionsApi.aiStatus() as unknown as { authSeen: string }
    const a = await pendingA
    console.log('[D31-dedup] A got', a.authSeen, '| B got', b.authSeen)
    statusDelayMs = 0
    expect(a.authSeen).toBe('Bearer tokenA')
    expect(b.authSeen).toBe('Bearer tokenB') // FAILS if B joined A's in-flight promise
  })


  it('identity: D29-style session-validation GET - warmed A 200 must not reach B from cache', async () => {
    const { transactionsApi } = await import('../services/api')
    tokenHolder.current = 'tokenA'
    statusDelayMs = 0
    const a = await transactionsApi.getSessionInfo('sess-1') as unknown as { authSeen: string }
    expect(a.authSeen).toBe('Bearer tokenA')
    tokenHolder.current = 'tokenB'
    const b = await transactionsApi.getSessionInfo('sess-1') as unknown as { authSeen: string }
    console.log('[D31-d29-cache] B got', b.authSeen)
    expect(b.authSeen).toBe('Bearer tokenB')
  })

  it('identity: D29-style session-validation GET - B must not join A inflight validation', async () => {
    const { transactionsApi } = await import('../services/api')
    tokenHolder.current = 'tokenA'
    statusDelayMs = 150
    const pendingA = transactionsApi.getSessionInfo('sess-2') as unknown as Promise<{ authSeen: string }>
    await waitForAuth('Bearer tokenA')
    tokenHolder.current = 'tokenB'
    const b = await transactionsApi.getSessionInfo('sess-2') as unknown as { authSeen: string }
    const a = await pendingA
    console.log('[D31-d29-inflight] A got', a.authSeen, '| B got', b.authSeen)
    statusDelayMs = 0
    expect(a.authSeen).toBe('Bearer tokenA')
    expect(b.authSeen).toBe('Bearer tokenB')
  })

  it('write-read: GET issued during in-flight write must not serve pre-write data after the write completes', async () => {
    const apiMod = await import('../services/api')
    const api = apiMod.default
    apiMod.invalidateApiCache()
    storedValue = 'A'
    dataDelayMs = 150
    writeDelayMs = 20

    const get1 = api.get<{ value: string }>('/api/data') // in flight, will read 'A'
    await sleep(30) // enough for /api/data to arrive; write commits 'B' mid-flight
    await api.post('/api/write')
    const r1 = await get1                                // resolves with 'A' (expected; started pre-write)
    const get2 = await api.get<{ value: string }>('/api/data') // after write: cache must be clean
    console.log('[D31-write-read] during-write GET got', r1.data.value, '| after-write GET got', get2.data.value)
    expect(get2.data.value).toBe('B')
  })

  it('write-read: slow GET started before write must not poison the 60s cache', async () => {
    const apiMod = await import('../services/api')
    const api = apiMod.default
    apiMod.invalidateApiCache()
    storedValue = 'A'
    dataDelayMs = 200
    writeDelayMs = 10

    const get1 = api.get<{ value: string }>('/api/data')
    await sleep(30)
    await api.post('/api/write')
    await get1
    // cache state after slow pre-write GET resolves post-write:
    const get2 = await api.get<{ value: string }>('/api/data')
    console.log('[D31-poison] post-write read got', get2.data.value)
    expect(get2.data.value).toBe('B')
  })
})
