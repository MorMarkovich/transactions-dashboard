import assert from 'node:assert/strict'
import { test } from 'node:test'
import { once } from 'node:events'
import { createSyncApp } from '../src/server-runtime.js'
import { safeError } from '../src/safe-errors.js'

test('streams live milestones for authenticated requests and preserves legacy JSON', async (t) => {
  let finish
  let starts = 0
  const server = createSyncApp('test-token', async (_log, { onProgress }) => {
    starts++
    onProgress?.({ stage: 'collecting', percent: 38, account: 2, accounts: 3 })
    if (starts === 1) await new Promise(resolve => { finish = resolve })
    if (starts === 3) throw safeError('BANK_CLEANUP_REQUIRED')
    return { success: true, added: 4 }
  }).listen(0, '127.0.0.1')
  t.after(() => { finish?.(); server.closeAllConnections(); server.close() })
  await once(server, 'listening')

  const send = (progress, token = 'test-token', origin) => fetch(`http://127.0.0.1:${server.address().port}/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-sync-token': token, ...(origin && { origin }) },
    body: JSON.stringify({ progress }),
  })
  assert.equal((await send(true, 'invalid')).status, 401)
  assert.equal((await send(true, 'test-token', 'https://untrusted.invalid')).status, 403)
  assert.equal(starts, 0)

  const streamed = await send(true)
  assert.match(streamed.headers.get('content-type'), /^application\/x-ndjson/)
  const reader = streamed.body.getReader()
  const decoder = new TextDecoder()
  let received = ''
  while (!received.includes('"percent":38')) {
    const { value, done } = await reader.read()
    assert.equal(done, false)
    received += decoder.decode(value, { stream: true })
  }
  assert.match(received, /"stage":"connecting"/)
  assert.match(received, /"account":2,"accounts":3/)
  assert.equal((await send(true)).status, 429)
  finish()
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    received += decoder.decode(value, { stream: true })
  }
  assert.deepEqual(JSON.parse(received.trim().split('\n').at(-1)), {
    type: 'result', result: { success: true, added: 4 },
  })
  const legacy = await send(false)
  assert.match(legacy.headers.get('content-type'), /^application\/json/)
  assert.deepEqual(await legacy.json(), { success: true, added: 4 })

  const failed = await send(true)
  assert.deepEqual(JSON.parse((await failed.text()).trim().split('\n').at(-1)), {
    type: 'error', error: 'BANK_CLEANUP_REQUIRED',
  })
})
