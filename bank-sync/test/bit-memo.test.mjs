import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTxn, mergeSnapshots } from '../src/normalize.js'

test('a bank refresh backfills Bit feed details without replacing a saved note', () => {
  const tx = { date: '2026-10-07T12:00:00+03:00', chargedAmount: -80, description: 'העברה בביט' }
  const original = normalizeTxn(tx, 'leumi', new Map())
  original.הערות = 'הערה שהוספתי'
  assert.equal(original._bank_memo, '')
  const incoming = normalizeTxn({ ...tx, memo: 'מתנה ליום הולדת' }, 'leumi', new Map())
  const { merged, added, enriched } = mergeSnapshots([original], [incoming])
  assert.equal(added, 0)
  assert.equal(enriched, 1)
  assert.equal(merged[0]._bank_memo, 'מתנה ליום הולדת')
  assert.equal(merged[0].הערות, 'הערה שהוספתי')
  assert.equal(normalizeTxn({ ...tx, description: 'ביטוח ישיר' }, 'leumi', new Map())._bank_memo, undefined)
})
