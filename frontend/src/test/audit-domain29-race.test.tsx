/**
 * Domain29 race inspection — async legacy-session validation vs auth switch.
 * Real services/api (interceptors + cache) over a controllable XHR stub.
 *
 * Scenario: A's validation GET is in flight; auth switches A→B; the GET then
 * resolves. Proves: the request carried A's token captured at request start;
 * a 200 writes ONLY A's scoped keys; B's runtime sees no foreign state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

type FakeSession = { user: { id: string }; access_token: string } | null
let currentSession: FakeSession = null

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: currentSession } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({}),
    },
  },
}))

class FakeXHR {
  static pending: FakeXHR[] = []
  onloadend: ((e?: unknown) => void) | null = null
  onreadystatechange: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  onabort: (() => void) | null = null
  readyState = 0
  status = 0
  statusText = ''
  response = ''
  responseText = ''
  responseURL = ''
  timeout = 0
  withCredentials = false
  method = ''
  url = ''
  requestHeaders: Record<string, string> = {}
  upload = { addEventListener: () => {} }
  open(method: string, url: string) { this.method = method; this.url = url }
  setRequestHeader(k: string, v: string) { this.requestHeaders[k] = v }
  getAllResponseHeaders() { return 'content-type: application/json\r\n' }
  addEventListener() {}
  removeEventListener() {}
  abort() { this.onabort?.() }
  send() { FakeXHR.pending.push(this) }
  respond(status: number, json: unknown) {
    this.status = status
    this.responseText = JSON.stringify(json)
    this.response = this.responseText
    this.readyState = 4
    this.onloadend?.({})
  }
}

vi.stubGlobal('XMLHttpRequest', FakeXHR)

import { AuthProvider } from '../lib/AuthContext'
import { FilterProvider, useDashboardFilters } from '../context/FilterContext'
import { migrateUserState, scoped, LAST_SESSION_BASE, SNAPSHOT_SEEN_BASE } from '../lib/userStorage'
import { invalidateApiCache } from '../services/api'

function Probe() {
  const { category } = useDashboardFilters()
  return <span data-testid="value">{category || '(blank)'}</span>
}

const flush = () => act(async () => {})

beforeEach(() => {
  currentSession = null
  FakeXHR.pending = []
  invalidateApiCache()
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => cleanup())

describe('validation in flight across an A→B auth switch', () => {
  it('request carries A\'s token from request start; 200 writes only A\'s scoped keys; B sees nothing', async () => {
    // A is signed in; pre-isolation globals exist.
    currentSession = { user: { id: 'user-A' }, access_token: 'ta' }
    localStorage.setItem(LAST_SESSION_BASE, 'sess-race-1')
    localStorage.setItem(SNAPSHOT_SEEN_BASE, '2026-11-05T10:00:00Z')

    const migration = migrateUserState('user-A')
    await flush() // let the interceptor attach the token and the XHR go out

    expect(FakeXHR.pending).toHaveLength(1)
    const req = FakeXHR.pending[0]
    expect(req.url).toContain('/api/metrics')
    expect(req.url).toContain('sess-race-1')
    // Token was captured at request start, while A was the current session.
    expect(req.requestHeaders.Authorization).toBe('Bearer ta')

    // Auth switches to B while the validation GET is still pending.
    currentSession = { user: { id: 'user-B' }, access_token: 'tb' }
    render(<AuthProvider><FilterProvider><Probe /></FilterProvider></AuthProvider>)
    await flush()

    // A's GET finally resolves with 200 (true ownership: the backend checks
    // the token's user against the session owner; see core/security.py).
    req.respond(200, { ok: true })
    await migration
    await flush()

    // Only A's scoped keys were written — validated as A's own session.
    expect(localStorage.getItem(scoped(LAST_SESSION_BASE, 'user-A'))).toBe('sess-race-1')
    expect(localStorage.getItem(scoped(SNAPSHOT_SEEN_BASE, 'user-A'))).toBe('2026-11-05T10:00:00Z')
    // B's runtime and storage show no foreign state.
    expect(localStorage.getItem(scoped(LAST_SESSION_BASE, 'user-B'))).toBeNull()
    expect(localStorage.getItem(scoped(SNAPSHOT_SEEN_BASE, 'user-B'))).toBeNull()
    expect(screen.getByTestId('value')).toHaveTextContent('(blank)')
    // The validation issued exactly one request; nothing re-queried as B.
    expect(FakeXHR.pending).toHaveLength(1)
  }, 15000)

  it('a 404 after the switch (foreign or wiped session) writes nothing for anyone', async () => {
    currentSession = { user: { id: 'user-A' }, access_token: 'ta' }
    localStorage.setItem(LAST_SESSION_BASE, 'sess-race-2')

    const migration = migrateUserState('user-A')
    await flush()
    expect(FakeXHR.pending).toHaveLength(1)

    currentSession = { user: { id: 'user-B' }, access_token: 'tb' }
    FakeXHR.pending[0].respond(404, { detail: 'Session not found' })
    await migration

    expect(localStorage.getItem(scoped(LAST_SESSION_BASE, 'user-A'))).toBeNull()
    expect(localStorage.getItem(scoped(LAST_SESSION_BASE, 'user-B'))).toBeNull()
  }, 15000)
})
