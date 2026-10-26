import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  acceptToken,
  isServiceEndpoint,
  extractReqNamesFromUrl,
  extractReqNamesFromPostData,
  classify,
  errorCode,
  ReqNameRecorder,
} from '../src/discover-pending.js'

const SVC = 'https://digital.isracard.co.il/services/ProxyRequestHandler.ashx'

test('acceptToken: endpoint-shaped names accepted, numeric/secret-shaped rejected', () => {
  assert.ok(acceptToken('CardsTransactionsList'))
  assert.ok(acceptToken('FutureTransactionsBlock'))
  assert.ok(acceptToken('PirteyIska_204'))
  assert.ok(!acceptToken('123456'))
  assert.ok(!acceptToken('a1b2c3d4e5f6789012345678'))      // hex-like
  assert.ok(!acceptToken('abcdefgh12345678abcd'))            // 60% letters, below 70%
  assert.ok(!acceptToken('x1'))                              // too short
  assert.ok(!acceptToken('has space'))                       // invalid charset
  assert.ok(!acceptToken('ValidateIdData'))                  // auth-family
  assert.ok(!acceptToken('LoginRequest'))
  assert.ok(!acceptToken('GetOtpToken'))
  assert.ok(!acceptToken(undefined))
})

test('isServiceEndpoint: only the verified isracard service-handler path', () => {
  assert.ok(isServiceEndpoint(SVC + '?reqName=CardsTransactionsList'))
  assert.ok(isServiceEndpoint('https://www.isracard.co.il/services/ProxyRequestHandler.ashx'))
  assert.ok(!isServiceEndpoint('https://digital.isracard.co.il/personalarea/login'))
  assert.ok(!isServiceEndpoint('https://digital.isracard.co.il/Api/other'))
  assert.ok(!isServiceEndpoint('https://evil.example/services/ProxyRequestHandler.ashx'))
  assert.ok(!isServiceEndpoint('https://isracard.co.il.evil.example/services/ProxyRequestHandler.ashx'))
  assert.ok(!isServiceEndpoint('not a url'))
})

test('login/auth requests are never inspected, even when they carry reqName-shaped data', () => {
  const rec = new ReqNameRecorder()
  rec.handleRequest({
    url: 'https://digital.isracard.co.il/personalarea/login',
    postData: 'reqName=ValidateIdData&username=mor&password=hunter2&otp=123456',
  })
  rec.handleRequest({
    url: 'https://digital.isracard.co.il/AuthService/Authenticate',
    postData: 'reqName=LoginRequest&secret=abc',
  })
  const r = rec.report()
  assert.equal(r.requestsSeen, 0)
  assert.equal(r.total, 0)
  const s = JSON.stringify(r)
  for (const bad of ['hunter2', '123456', 'ValidateIdData', 'LoginRequest', 'mor']) {
    assert.ok(!s.includes(bad), `${bad} must not appear`)
  }
})

test('auth-family reqNames excluded even on the service path', () => {
  const rec = new ReqNameRecorder()
  rec.handleRequest({ url: SVC, postData: 'reqName=ValidateIdData&reqName=CardsTransactionsList' })
  const r = rec.report()
  assert.deepEqual(r.other, ['CardsTransactionsList'])
  assert.equal(r.total, 1)
})

test('service-path capture from URL query and post body', () => {
  assert.deepEqual(extractReqNamesFromUrl(SVC + '?reqName=CardsTransactionsList&card=4580'), ['CardsTransactionsList'])
  assert.deepEqual(extractReqNamesFromPostData(SVC, 'reqName=FutureTransactionsBlock&reqName=x'), ['FutureTransactionsBlock'])
  assert.deepEqual(extractReqNamesFromPostData(SVC, undefined), [])
})

test('no params, bodies, or secret-like values leak into the report', () => {
  const rec = new ReqNameRecorder()
  rec.handleRequest({
    url: SVC + '?reqName=CardsTransactionsList&card=458012345678&secret=hunter2',
    postData: 'reqName=FutureTransactionsBlock&id=987654321&pin=4242&reqName=a1b2c3d4e5f67890',
  })
  const r = rec.report()
  const s = JSON.stringify(r)
  for (const bad of ['4580', 'hunter2', '987654321', '4242', 'a1b2c3d4']) {
    assert.ok(!s.includes(bad), `${bad} must not appear`)
  }
  assert.deepEqual(r.pendingCandidates, ['FutureTransactionsBlock'])
  assert.deepEqual(r.other, ['CardsTransactionsList'])
})

test('name cap enforced inside a single postData batch', () => {
  const rec = new ReqNameRecorder()
  for (let i = 0; i < 499; i++) rec.handleRequest({ url: `${SVC}?reqName=NameNumber${i}XYZ` })
  rec.handleRequest({ url: SVC, postData: 'reqName=ExtraOne&reqName=ExtraTwo&reqName=ExtraThree' })
  const r = rec.report()
  assert.ok(r.total <= 500)
  assert.equal(r.truncated, true)
})

test('request cap stops recording and reports truncation', () => {
  const rec = new ReqNameRecorder()
  for (let i = 0; i < 5001; i++) rec.handleRequest({ url: `${SVC}?reqName=SameName` })
  const r = rec.report()
  assert.equal(r.requestsSeen, 5000)
  assert.equal(r.truncated, true)
})

test('errorCode maps to controlled codes and never leaks message content', () => {
  assert.equal(errorCode(new Error("Cannot find module 'puppeteer-core'")), 'PPTR_UNAVAILABLE')
  assert.equal(errorCode(new Error('Failed to launch chrome at /Applications/Google Chrome.app?user=mor&secret=xyz')), 'LAUNCH_FAILED')
  const code = errorCode(new Error('weird https://internal.host/path?token=abc123'))
  assert.equal(code, 'UNKNOWN')
  assert.ok(!code.includes('token'))
})

test('classify splits pending-like names', () => {
  const { pendingCandidates, other } = classify(['FutureTransactionsBlock', 'CardsTransactionsList', 'GetPendingCharges'])
  assert.deepEqual(pendingCandidates.sort(), ['FutureTransactionsBlock', 'GetPendingCharges'].sort())
  assert.deepEqual(other, ['CardsTransactionsList'])
})
