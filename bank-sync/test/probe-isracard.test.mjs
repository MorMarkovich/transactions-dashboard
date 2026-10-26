import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractScriptUrls, extractReqNames, classifyCandidates } from '../src/probe-isracard.js'

const BASE = 'https://digital.isracard.co.il/personalarea/login'

test('extractScriptUrls picks up same-origin .js bundles, resolves relative paths', () => {
  const html = `<html><head>
    <script src="/static/main.abc123.js"></script>
    <script src="chunk-2.js"></script>
    <script src="https://cdn.example.com/other.js"></script>
    <script src="/static/no-extension"></script>
    <script>inline()</script>
  </head></html>`
  const urls = extractScriptUrls(html, BASE)
  assert.deepEqual(urls, [
    'https://digital.isracard.co.il/static/main.abc123.js',
    'https://digital.isracard.co.il/personalarea/chunk-2.js',
  ])
})

test('extractScriptUrls dedupes and survives malformed entries', () => {
  const html = `<script src="/a.js"></script><script src="/a.js"></script><script src="://bad"></script>`
  assert.deepEqual(extractScriptUrls(html, BASE), ['https://digital.isracard.co.il/a.js'])
})

test('extractReqNames finds URL-param, object-literal and quoted forms', () => {
  const js = `
    fetch(u + "?reqName=CardsTransactionsList&m=10");
    x.set('reqName', 'DashboardMonth');
    const y = { reqName: "PirteyIska_204" };
    "reqName=GetPendingTransactions";
  `
  assert.deepEqual(extractReqNames(js), [
    'CardsTransactionsList',
    'DashboardMonth',
    'GetPendingTransactions',
    'PirteyIska_204',
  ])
})

test('extractReqNames ignores near-misses and dedupes', () => {
  const js = `reqName=ABC reqName=ABC reqName='ok_name-1' rename=NotThis reqNameNo=AlsoNot`
  assert.deepEqual(extractReqNames(js), ['ABC', 'ok_name-1'])
})

test('classifyCandidates separates pending-like names without asserting feasibility', () => {
  const { pendingCandidates, other } = classifyCandidates([
    'CardsTransactionsList', 'GetPendingTransactions', 'FutureDebits', 'DashboardMonth',
  ])
  assert.deepEqual(pendingCandidates.sort(), ['FutureDebits', 'GetPendingTransactions'])
  assert.deepEqual(other.sort(), ['CardsTransactionsList', 'DashboardMonth'])
})
