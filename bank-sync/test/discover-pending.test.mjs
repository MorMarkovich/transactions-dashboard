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

test('allowlist: ignores reqName values on non-isracard hosts (no reflected junk)', () => {
  assert.deepEqual(extractReqNamesFromUrl('https://evil.example/x?reqName=StealThis'), [])
  assert.deepEqual(extractReqNamesFromUrl('https://isracard.co.il.evil.example/x?reqName=StealThis'), [])
  assert.deepEqual(extractReqNamesFromPostData('https://ads.example/pixel', 'reqName=ReflectedName'), [])
  assert.deepEqual(extractReqNamesFromUrl('https://www.isracard.co.il/x?reqName=GetCardsList'), ['GetCardsList'])
})

test('captures reqName tokens from post body, rejects too-short tokens', () => {
  // 'reqName=x' is below the 3-char minimum and must be dropped.
  const url = 'https://digital.isracard.co.il/Api'
  const body = 'reqName=FutureTransactionsBlock&card=4580&amount=999.99&reqName=x&reqName=CardsTransactionsList'
  assert.deepEqual(extractReqNamesFromPostData(url, body), ['FutureTransactionsBlock', 'CardsTransactionsList'])
  assert.deepEqual(extractReqNamesFromPostData(url, undefined), [])
  assert.deepEqual(extractReqNamesFromPostData(url, 'no tokens here'), [])
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
  rec.handleRequest({ url: 'https://evil.example/x?reqName=ShouldNotAppear', postData: 'reqName=Nope' })
  rec.handleRequest({ url: 'https://digital.isracard.co.il/svc?reqName=CardsTransactionsList&card=9999' })
  const r = rec.report()
  const serialized = JSON.stringify(r)
  assert.equal(r.requestsSeen, 3)
  assert.equal(r.total, 2)
  assert.ok(!serialized.includes('4580'), 'card digits must not appear')
  assert.ok(!serialized.includes('hunter2'), 'query secret must not appear')
  assert.ok(!serialized.includes('987654321'), 'body field must not appear')
  assert.ok(!serialized.includes('4242'), 'pin must not appear')
  assert.deepEqual(r.pendingCandidates, ['FutureTransactionsBlock'])
  assert.deepEqual(r.other, ['CardsTransactionsList'])
  assert.ok(!serialized.includes('ShouldNotAppear'), 'third-party host token must not appear')
  assert.ok(!serialized.includes('Nope'), 'third-party body token must not appear')
})

test('recorder bounds: stops recording past the request cap and reports truncation', () => {
  const rec = new ReqNameRecorder()
  for (let i = 0; i < 5001; i++) rec.handleRequest({ url: 'https://digital.isracard.co.il/svc?reqName=SameName' })
  const r = rec.report()
  assert.equal(r.requestsSeen, 5000)
  assert.equal(r.truncated, true)
  const rec2 = new ReqNameRecorder()
  for (let i = 0; i < 600; i++) rec2.handleRequest({ url: `https://digital.isracard.co.il/svc?reqName=Name${i}X` })
  assert.equal(rec2.report().truncated, true)
  assert.ok(rec2.report().total <= 500)
})

test('recorder dedupes and tolerates malformed requests', () => {
  const rec = new ReqNameRecorder()
  rec.handleRequest({})
  rec.handleRequest({ url: 'garbage' })
  rec.handleRequest({ url: 'https://digital.isracard.co.il/?reqName=SameName', postData: 'reqName=SameName' })
  assert.equal(rec.report().total, 1)
})
