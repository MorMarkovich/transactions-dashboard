import test from 'node:test'
import assert from 'node:assert/strict'
import { withScraperCleanup } from '../src/scraper-lifecycle.js'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { EventEmitter } from 'node:events'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const lib = dirname(require.resolve('israeli-bank-scrapers'))
function load(name, dependencies) {
  const module = { exports: {} }
  new vm.Script('(function(require,module,exports){' + readFileSync(join(lib, name), 'utf8') + '\n})')
    .runInNewContext({ URL, performance }, { timeout: 1000 })(id => {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
      return dependencies[id]
    }, module, module.exports)
  return module.exports
}
const definitions = require(join(lib, 'definitions.js'))
const errors = require(join(lib, 'scrapers/errors.js'))
const base = load('scrapers/base-scraper.js', {
  events: { EventEmitter }, 'moment-timezone': require('moment-timezone'), '../definitions': definitions,
  '../helpers/waiting': { TimeoutError: class extends Error {} }, './errors': errors,
})
const { BaseScraperWithBrowser } = load('scrapers/base-scraper-with-browser.js', {
  puppeteer: { launch() { assert.fail('Real browser launch forbidden') } }, '../definitions': definitions,
  '../helpers/debug': { getDebug: () => () => {} }, '../helpers/elements-interactions': {},
  '../helpers/navigation': {}, './base-scraper': base, './errors': errors,
})
for (const failAt of ['new_page', 'cache', 'prepare', 'viewport']) {
  test(`actual installed scraper cleans up initialization failure at ${failAt}`, async () => {
    let closed = 0, logins = 0
    const step = name => async () => { if (name === failAt) throw Error('synthetic failure') }
    const page = { setCacheEnabled: step('cache'), setDefaultTimeout() {}, setViewport: step('viewport'), on() {}, close: async () => {} }
    const browser = { newPage: async () => { await step('new_page')(); return page }, close: async () => { closed++ } }
    const scraper = new BaseScraperWithBrowser({ companyId: 'isracard', browser, preparePage: step('prepare') })
    scraper.login = async () => { logins++; return { success: false } }
    await assert.rejects(withScraperCleanup(scraper, () => scraper.scrape({})), /synthetic failure/)
    assert.equal(closed, 1); assert.equal(logins, 0)
  })
}
test('normal cleanup runs once and restores the original lifecycle', async () => {
  let calls = 0
  const terminate = async () => { calls++ }
  const scraper = { terminate }
  const posted = { success: true }
  assert.equal(await withScraperCleanup(scraper, async () => { await scraper.terminate(true); return posted }), posted)
  assert.equal(calls, 1); assert.equal(scraper.terminate, terminate)
})
const workerUrl = new URL('../fixtures/scrape-worker.mjs', import.meta.url)
for (const mode of ['ok', 'error', 'crash', 'hang']) {
  test(`real isolated worker: ${mode}`, { timeout: 5000 }, async () => {
    const { superviseScrape, needsScraperCleanup } = await import(`../src/scrape-supervisor.js?test=${mode}`)
    const stages = []
    const started = Date.now()
    const task = superviseScrape('isracard', { mode }, { onStage: stage => stages.push(stage) }, { workerUrl, deadlineMs: 300, killGraceMs: 50 })
    if (mode === 'ok') assert.equal((await task).transactions.length, 1)
    else await assert.rejects(task, { code: mode === 'error' ? 'BANK_INVALID_PASSWORD' : 'BANK_CLEANUP_REQUIRED' })
    assert.equal(needsScraperCleanup(), ['crash', 'hang'].includes(mode))
    assert.ok(Date.now() - started < 2500)
    assert.ok(stages.includes('starting'))
    if (needsScraperCleanup()) await assert.rejects(superviseScrape('isracard', {}, {}, { workerUrl }), { code: 'BANK_CLEANUP_REQUIRED' })
  })
}
