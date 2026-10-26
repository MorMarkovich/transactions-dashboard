import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  acceptToken,
  acceptKey,
  classifyValue,
  isServiceEndpoint,
  extractReqName,
  extractRequestKeys,
  shapeResponseJson,
  ShapeRecorder,
  makeRequestListener,
  makeResponseListener,
} from '../src/record-pending-shape.js'

const SVC = 'https://digital.isracard.co.il/services/ProxyRequestHandler.ashx'
const throwingThunk = () => { throw new Error('body must not be read') }

test('acceptToken: endpoint-shaped accepted, numeric/secret/auth rejected', () => {
  assert.ok(acceptToken('CardsTransactionsList'))
  assert.ok(acceptToken('PirteyIska_204'))
  assert.ok(!acceptToken('123456'))
  assert.ok(!acceptToken('a1b2c3d4e5f6789012345678'))
  assert.ok(!acceptToken('ValidateIdData'))
  assert.ok(!acceptToken('GetOtpToken'))
  assert.ok(!acceptToken(undefined))
})

test('acceptKey: schema-shaped keys accepted, auth-family/weird keys rejected', () => {
  assert.ok(acceptKey('cardIndex'))
  assert.ok(acceptKey('reqName'))
  assert.ok(acceptKey('month'))
  assert.ok(!acceptKey('password'))
  assert.ok(!acceptKey('token'))
  assert.ok(!acceptKey('has space'))
  assert.ok(!acceptKey('x'.repeat(65)))
})

test('classifyValue: type labels only', () => {
  assert.equal(classifyValue('hello'), 'string')
  assert.equal(classifyValue('25/10/2026'), 'date-shaped-string')
  assert.equal(classifyValue('2026-10-25T00:00:00'), 'date-shaped-string')
  assert.equal(classifyValue(549), 'number')
  assert.equal(classifyValue(true), 'boolean')
  assert.equal(classifyValue(null), 'null')
  assert.equal(classifyValue([]), 'array')
  assert.equal(classifyValue({}), 'object')
})

test('isServiceEndpoint: only the verified isracard service-handler path', () => {
  assert.ok(isServiceEndpoint(SVC + '?reqName=CardsTransactionsList'))
  assert.ok(!isServiceEndpoint('https://digital.isracard.co.il/personalarea/login'))
  assert.ok(!isServiceEndpoint('https://digital.isracard.co.il/Api/other'))
  assert.ok(!isServiceEndpoint('https://evil.example/services/ProxyRequestHandler.ashx'))
  assert.ok(!isServiceEndpoint('https://isracard.co.il.evil.example/services/ProxyRequestHandler.ashx'))
})

test('extractReqName: URL token wins; rejected URL token drops request WITHOUT body fallback', () => {
  assert.equal(extractReqName(SVC + '?reqName=CardsTransactionsList', 'reqName=OtherThing'), 'CardsTransactionsList')
  assert.equal(extractReqName(SVC + '?reqName=ValidateIdData', 'reqName=CardsTransactionsList'), null)
  assert.equal(extractReqName(SVC, 'reqName=FutureBlock&x=1'), 'FutureBlock')
  assert.equal(extractReqName(SVC, 'nothing here'), null)
})

test('request listener: non-service URLs never touch the body; auth-family service calls neither', () => {
  const rec = new ShapeRecorder()
  const onReq = makeRequestListener(rec)
  onReq({ url: () => 'https://digital.isracard.co.il/AuthService/Authenticate', postData: throwingThunk })
  onReq({ url: () => SVC + '?reqName=ValidateIdData', postData: throwingThunk })
  onReq({ url: () => SVC + '?reqName=123456', postData: throwingThunk })
  assert.deepEqual(rec.report().observations, [])
})

test('response listener: non-service URLs never read the response body', async () => {
  const rec = new ShapeRecorder()
  const onRes = makeResponseListener(rec)
  await onRes({ url: () => 'https://digital.isracard.co.il/static/app.js', text: throwingThunk })
  assert.deepEqual(rec.report().observations, [])
})

test('request keys: URL query keys + form body keys; values never appear', () => {
  const rec = new ShapeRecorder()
  rec.handleRequest({
    url: SVC + '?reqName=FutureBlock&cardIndex=2478',
    postData: () => 'month=102026&account=555123',
  })
  const r = rec.report()
  assert.equal(r.observations.length, 1)
  const o = r.observations[0]
  assert.equal(o.reqName, 'FutureBlock')
  assert.deepEqual(o.requestKeys, ['account', 'cardIndex', 'month', 'reqName'])
  const s = JSON.stringify(r)
  for (const bad of ['2478', '102026', '555123']) assert.ok(!s.includes(bad), `${bad} must not appear`)
})

test('request keys: JSON body keys extracted; auth-family keys omitted and flagged', () => {
  const rec = new ShapeRecorder()
  rec.handleRequest({
    url: SVC + '?reqName=FutureBlock',
    postData: () => JSON.stringify({ cardIndex: '2478', password: 'hunter2' }),
  })
  const o = rec.report().observations[0]
  assert.deepEqual(o.requestKeys, ['cardIndex', 'reqName'])
  assert.equal(o.nonSchemaKeysOmitted, true)
  assert.ok(!JSON.stringify(o).includes('hunter2'))
})

test('response shape: object with items array; key/type labels; identifier keys detected', () => {
  const rec = new ShapeRecorder()
  const url = SVC + '?reqName=FutureBlock'
  rec.handleRequest({ url, postData: () => 'a=1' })
  const body = JSON.stringify({
    status: 1,
    dealsInbound: [
      { voucherNumberRatz: '123456789', fullSupplierNameHeb: 'וטרינר תורן', dealSum: 549, fullPurchaseDate: '25/10/2026', isRefund: false, extra: null },
      { voucherNumberRatz: '987654321', fullSupplierNameHeb: 'גולדה', dealSum: 32, fullPurchaseDate: '24/10/2026', isRefund: true },
    ],
  })
  rec.handleResponse({ url, bodyText: body })
  const o = rec.report().observations[0]
  assert.equal(o.responseFormat, 'json')
  assert.equal(o.itemsKey, 'dealsInbound')
  assert.deepEqual(o.responseKeys, { dealsInbound: 'array', status: 'number' })
  assert.equal(o.itemKeys.voucherNumberRatz, 'string')
  assert.equal(o.itemKeys.dealSum, 'number')
  assert.equal(o.itemKeys.fullPurchaseDate, 'date-shaped-string')
  assert.equal(o.itemKeys.isRefund, 'boolean')
  assert.equal(o.itemKeys.extra, 'null')
  assert.deepEqual(o.identifierKeys, ['voucherNumberRatz'])
  const s = JSON.stringify(rec.report())
  for (const bad of ['וטרינר תורן', 'גולדה', '549', '123456789', '25/10/2026']) {
    assert.ok(!s.includes(bad), `${bad} must not appear`)
  }
})

test('response shape: top-level array treated as items; no identifier keys flagged', () => {
  const rec = new ShapeRecorder()
  const url = SVC + '?reqName=SomethingElse'
  rec.handleRequest({ url, postData: () => '' })
  rec.handleResponse({ url, bodyText: JSON.stringify([{ a: 1, b: 'x' }, { a: 2, c: true }]) })
  const o = rec.report().observations[0]
  assert.equal(o.responseFormat, 'json')
  assert.equal(o.itemsKey, null)
  assert.deepEqual(o.itemKeys, { a: 'number', b: 'string', c: 'boolean' })
  assert.deepEqual(o.identifierKeys, [])
})

test('response formats: non-JSON, unavailable, too-large, not-observed', () => {
  const rec = new ShapeRecorder()
  const u1 = SVC + '?reqName=Aaaa'; rec.handleRequest({ url: u1, postData: () => '' })
  rec.handleResponse({ url: u1, bodyText: '<html>not json</html>' })
  const u2 = SVC + '?reqName=Bbbb'; rec.handleRequest({ url: u2, postData: () => '' })
  rec.handleResponse({ url: u2, bodyText: undefined })
  const u3 = SVC + '?reqName=Cccc'; rec.handleRequest({ url: u3, postData: () => '' })
  rec.handleResponse({ url: u3, bodyText: ' '.repeat(5_000_001) })
  rec.handleRequest({ url: SVC + '?reqName=Dddd', postData: () => '' }) // no response seen
  const byName = Object.fromEntries(rec.report().observations.map((o) => [o.reqName, o.responseFormat]))
  assert.deepEqual(byName, { Aaaa: 'non-json', Bbbb: 'unavailable', Cccc: 'too-large', Dddd: 'not-observed' })
})

test('same reqName merges unions; no counts anywhere in the report', () => {
  const rec = new ShapeRecorder()
  rec.handleRequest({ url: SVC + '?reqName=FutureBlock&a=1', postData: () => 'x=1' })
  rec.handleRequest({ url: SVC + '?reqName=FutureBlock&b=2', postData: () => 'y=2' })
  rec.handleResponse({ url: SVC + '?reqName=FutureBlock&a=1', bodyText: JSON.stringify({ k: 'v' }) })
  const r = rec.report()
  assert.equal(r.observations.length, 1)
  assert.deepEqual(r.observations[0].requestKeys, ['a', 'b', 'reqName', 'x', 'y'])
  assert.ok(!/count|total|requestsSeen|occurrences/i.test(JSON.stringify(r)))
})

test('shapeResponseJson: non-schema JSON keys omitted and flagged', () => {
  const shape = shapeResponseJson({ 'weird key!': 1, ok_key: 2 })
  assert.equal(shape.nonSchemaKeysOmitted, true)
  assert.ok(!shape.responseKeys.has('weird key!'))
  assert.equal(shape.responseKeys.get('ok_key').has('number'), true)
})

test('mixed types across items union with | separator', () => {
  const shape = shapeResponseJson([{ v: 'x' }, { v: 5 }, { v: null }])
  assert.equal([...shape.itemKeys.get('v')].sort().join('|'), 'null|number|string')
})

test('login requests carrying reqName-shaped bodies are never inspected', () => {
  const rec = new ShapeRecorder()
  const onReq = makeRequestListener(rec)
  onReq({
    url: () => 'https://digital.isracard.co.il/personalarea/login',
    postData: () => 'reqName=ValidateIdData&username=mor&password=hunter2',
  })
  const s = JSON.stringify(rec.report())
  assert.deepEqual(rec.report().observations, [])
  for (const bad of ['hunter2', 'ValidateIdData', 'mor']) assert.ok(!s.includes(bad))
})

test('auth-family reqName in body: observation discarded', () => {
  const rec = new ShapeRecorder()
  rec.handleRequest({ url: SVC, postData: () => 'reqName=RefreshSessionToken&x=1' })
  assert.deepEqual(rec.report().observations, [])
})
