import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withLocalSyncLock } from '../src/local-sync-lock.js'
import { superviseScrape } from '../src/scrape-supervisor.js'

test('normal failures release only the test lock; a real worker timeout retains it and blocks the next run', { timeout: 5000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'pinkas-lock-test-'))
  const lockPath = join(root, 'lock')
  try {
    await assert.rejects(withLocalSyncLock(async () => { throw Error('synthetic') }, { lockPath }), /synthetic/)
    await assert.rejects(stat(lockPath), { code: 'ENOENT' })
    await assert.rejects(withLocalSyncLock(() => superviseScrape('isracard', { mode: 'hang' }, {}, {
      workerUrl: new URL('../fixtures/scrape-worker.mjs', import.meta.url), deadlineMs: 300, killGraceMs: 50,
    }), { lockPath }), { code: 'BANK_CLEANUP_REQUIRED' })
    assert.ok((await stat(lockPath)).isDirectory())
    let retried = false
    await assert.rejects(withLocalSyncLock(() => { retried = true }, { lockPath }), { code: 'SYNC_LOCAL_LOCKED' })
    assert.equal(retried, false)
  } finally { await rm(root, { recursive: true, force: true }) }
})
