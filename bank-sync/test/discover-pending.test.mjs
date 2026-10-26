import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractReqNamesFromUrl,
  extractReqNamesFromPostData,
  classify,
  ReqNameRecorder,
} from '../src/discover-pending.js'

test('captures reqName from URL query only', () => {
  assert.deepEqual(
    extractReqNamesFromUrl('https://digital.isracard.co.il/svc?reqName=CardsTransactionsList&account=1234&from=01%2F01'),
    ['CardsTransactionsList'],
  )
  assert.deepEqual(extractReqNamesFromUrl('https://digital.isracard.co.il/svc?account=1'), [])
  assert.deepEqual(extractReqNamesFromUrl('not a url'), [])
})

test('captures reqName tokens from post body, rejects too-short tokens', () => {
  // 'reqName=x' is below the 3-char minimum and must be dropped; a token stops at the first
  // character outside [A-Za-z0-9_-], so an unencoded space truncates ('has space' -> 'has').
  const body = 'reqName=FutureTransactionsBlock&card=4580&amount=999.99&reqName=x&reqName=CardsTransactionsList'
  assert.deepEqual(extractReqNamesFromPostData(body), ['FutureTransactionsBlock', 'CardsTransactionsList'])
  assert.deepEqual(extractReqNamesFromPostData(undefined), [])
  assert.deepEqual(extractReqNamesFromPostData('no tokens here'), [])
})

test('classify splits pending-like names', () => {
  const { pendingCandidates, other } = classify(['FutureTransactionsBlock', 'CardsTransactionsList', 'GetPendingCharges'])
  assert.deepEqual(pendingCandidates.sort(), ['FutureTransactionsBlock', 'GetPendingCharges'].sort())
  assert.deepEqual(other, ['CardsTransactionsList'])
})

test('recorder records ONLY names: no params, bodies, or secrets leak into the report', () => {
  const rec = new ReqNameRecorder()
  rec.handleRequest({
    url: 'https://digital.isracard.co.il/svc?reqName=CardsTransactionsList&card=458012345678&secret=hunter2',
    postData: 'reqName=FutureTransactionsBlock&id=987654321&pin=4242',
  })
  rec.handleRequest({ url: 'https://digital.isracard.co.il/svc?reqName=CardsTransactionsList&card=9999' })
  const r = rec.report()
  const serialized = JSON.stringify(r)
  assert.equal(r.requestsSeen, 2)
  assert.equal(r.total, 2)
  assert.ok(!serialized.includes('4580'), 'card digits must not appear')
  assert.ok(!serialized.includes('hunter2'), 'query secret must not appear')
  assert.ok(!serialized.includes('987654321'), 'body field must not appear')
  assert.ok(!serialized.includes('4242'), 'pin must not appear')
  assert.deepEqual(r.pendingCandidates, ['FutureTransactionsBlock'])
  assert.deepEqual(r.other, ['CardsTransactionsList'])
})

test('recorder dedupes and tolerates malformed requests', () => {
  const rec = new ReqNameRecorder()
  rec.handleRequest({})
  rec.handleRequest({ url: 'garbage' })
  rec.handleRequest({ url: 'https://x.co.il/?reqName=SameName', postData: 'reqName=SameName' })
  assert.equal(rec.report().total, 1)
})
