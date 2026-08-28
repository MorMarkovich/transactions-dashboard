import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createScraper, CompanyTypes } from 'israeli-bank-scrapers'

test('bank scraper exposes the API used by the sync adapter', () => {
  assert.equal(typeof createScraper, 'function')
  assert.equal(typeof CompanyTypes, 'object')

  for (const provider of ['leumi', 'discount', 'max', 'isracard']) {
    assert.ok(CompanyTypes[provider], `missing CompanyTypes.${provider}`)
  }

  const scraper = createScraper({
    companyId: CompanyTypes.leumi,
    startDate: new Date('2026-01-01'),
    showBrowser: false,
    executablePath: '/nonexistent/test-browser',
  })

  assert.equal(typeof scraper.scrape, 'function')
})
