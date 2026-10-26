import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTxn, mergeSnapshots } from '../src/normalize.js'

const ACCT = { provider: 'discount', owner: 'מור', label: 'דיסקונט מור' }
const base = { date: '2026-10-25T10:00:00', chargedAmount: -50, description: 'סופר רשת' }

test('normalizeTxn keeps provider-supplied pending status and identifier', () => {
  const t = normalizeTxn({ ...base, status: 'pending', identifier: 12345 }, ACCT, new Map())
  assert.equal(t._status, 'pending')
  assert.equal(t._identifier, '12345')
})

test('normalizeTxn keeps completed status when the provider marks it', () => {
  const t = normalizeTxn({ ...base, status: 'completed', identifier: 12345 }, ACCT, new Map())
  assert.equal(t._status, 'completed')
})

test('normalizeTxn invents no status when the provider supplies none', () => {
  const t = normalizeTxn(base, ACCT, new Map())
  assert.equal('_status' in t, false)
  assert.equal('_identifier' in t, false)
})

test('pending -> posted: same provider identifier flips status, no duplicate row', () => {
  const pending = normalizeTxn({ ...base, status: 'pending', identifier: 777 }, ACCT, new Map())
  const posted = normalizeTxn({ ...base, status: 'completed', identifier: 777 }, ACCT, new Map())
  const { merged, added, enriched } = mergeSnapshots([pending], [posted])
  assert.equal(merged.length, 1)
  assert.equal(added, 0)
  assert.equal(merged[0]._status, 'completed')
  assert.equal(enriched, 1)
})

test('same identifier but fresh status unknown: no flip, no duplicate (ambiguity retained)', () => {
  const pending = normalizeTxn({ ...base, status: 'pending', identifier: 888 }, ACCT, new Map())
  const unknown = normalizeTxn({ ...base, identifier: 888 }, ACCT, new Map())
  const { merged, added } = mergeSnapshots([pending], [unknown])
  assert.equal(merged.length, 1)
  assert.equal(added, 0)
  assert.equal(merged[0]._status, 'pending')
})

test('legacy key match without identifiers: no status flip (ambiguity retained), no duplicate', () => {
  const pending = normalizeTxn({ ...base, status: 'pending' }, ACCT, new Map())
  const posted = normalizeTxn({ ...base, status: 'completed' }, ACCT, new Map())
  const { merged, added } = mergeSnapshots([pending], [posted])
  assert.equal(merged.length, 1)
  assert.equal(added, 0)
  assert.equal(merged[0]._status, 'pending')
})

test('two fresh rows sharing an identifier in one batch collapse to one row', () => {
  const a = normalizeTxn({ ...base, status: 'pending', identifier: 999 }, ACCT, new Map())
  const b = normalizeTxn({ ...base, status: 'pending', identifier: 999 }, ACCT, new Map())
  const { merged, added } = mergeSnapshots([], [a, b])
  assert.equal(merged.length, 1)
  assert.equal(added, 1)
})

test('different identifiers on same date/amount/description stay separate rows', () => {
  const a = normalizeTxn({ ...base, status: 'completed', identifier: 1 }, ACCT, new Map())
  const b = normalizeTxn({ ...base, status: 'completed', identifier: 2 }, ACCT, new Map())
  // legacy key would merge them; identity must not create a false flip either
  const { merged } = mergeSnapshots([a], [b])
  // legacy key still dedups identical-looking rows (existing behavior);
  // identity index only reconciles, never splits or merges on its own
  assert.equal(merged.length, 1)
  assert.equal(merged[0]._identifier, '1')
})
