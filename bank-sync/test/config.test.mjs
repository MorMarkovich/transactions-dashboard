import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

// config.js computes chromePath at import time, so each case re-imports with
// a unique query string and (for darwin cases) a patched process.platform.

const userChrome = path.join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')

async function importFresh() {
  return import(`../src/config.js?case=${Math.random()}`)
}

test('CHROME_PATH env var always wins', async () => {
  process.env.CHROME_PATH = '/custom/chrome'
  try {
    const { config } = await importFresh()
    assert.equal(config.chromePath, '/custom/chrome')
  } finally {
    delete process.env.CHROME_PATH
  }
})

test('non-darwin defaults to empty chromePath', async () => {
  // (sandbox/CI are linux; also documents intended non-Mac behavior)
  const { config } = await importFresh()
  assert.equal(config.chromePath, '')
})

test('darwin discovers a per-user ~/Applications Chrome install', async () => {
  mkdirSync(path.dirname(userChrome), { recursive: true })
  writeFileSync(userChrome, '')
  try {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const { config } = await importFresh()
    assert.equal(config.chromePath, userChrome)
  } finally {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    rmSync(path.join(homedir(), 'Applications'), { recursive: true, force: true })
  }
})

test('darwin falls back to the system path when Chrome is nowhere installed', async () => {
  Object.defineProperty(process, 'platform', { value: 'darwin' })
  try {
    const { config } = await importFresh()
    assert.equal(config.chromePath, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  } finally {
    Object.defineProperty(process, 'platform', { value: 'linux' })
  }
})

// --- sync outcome / exit semantics (src/sync.js pure helpers) ---

import { computeSyncOutcome, exitCodeForResult } from '../src/outcome.js'

test('all accounts failed -> success:false, failed counted, exit code 1', () => {
  const { success, scraped, failed } = computeSyncOutcome({}, { discount: 'Chrome not found', isracard: 'Chrome not found' })
  assert.equal(success, false)
  assert.equal(scraped, 0)
  assert.equal(failed, 2)
  assert.equal(exitCodeForResult({ success }), 1)
})

test('partial failure -> success:true, failed counted, exit code 0', () => {
  const { success, scraped, failed } = computeSyncOutcome({ discount: 55 }, { isracard: 'blocked' })
  assert.equal(success, true)
  assert.equal(scraped, 1)
  assert.equal(failed, 1)
  assert.equal(exitCodeForResult({ success }), 0)
})

test('all accounts succeeded -> success:true, failed 0, exit code 0', () => {
  const { success, scraped, failed } = computeSyncOutcome({ discount: 55, isracard: 362 }, {})
  assert.equal(success, true)
  assert.equal(scraped, 2)
  assert.equal(failed, 0)
  assert.equal(exitCodeForResult({ success }), 0)
})

test('no accounts configured -> vacuously successful, exit code 0', () => {
  const { success, scraped, failed } = computeSyncOutcome({}, {})
  assert.equal(success, true)
  assert.equal(scraped, 0)
  assert.equal(failed, 0)
  assert.equal(exitCodeForResult({ success }), 0)
})
