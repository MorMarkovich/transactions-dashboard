import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categorize, applyRules } from '../src/categorize.js'
import { normalizeTxn, txnKey, mergeSnapshots } from '../src/normalize.js'
import { applyIncomeMonthShift, isSalary } from '../src/income.js'
import { detectOwner, JOINT } from '../src/owner.js'

// ── Categorizer ──────────────────────────────────────────────────────────
test('supermarket → מזון וצריכה', () => {
  assert.equal(categorize('שופרסל דיל רמת גן'), 'מזון וצריכה')
})

test('restaurant → מסעדות, קפה וברים', () => {
  assert.equal(categorize('מקדונלד'), 'מסעדות, קפה וברים')
})

test('fuel → דלק, חשמל וגז', () => {
  assert.equal(categorize('סונול תחנת דלק'), 'דלק, חשמל וגז')
})

test('atm → משיכת מזומן', () => {
  assert.equal(categorize('משיכת מזומן כספומט'), 'משיכת מזומן')
})

test('Psagot → העברה להשקעות (override)', () => {
  assert.equal(categorize('העברה פסגות גמל'), 'העברה להשקעות')
})

test('check withdrawal → שכר דירה (override)', () => {
  assert.equal(categorize('משיכת שיקים'), 'שכר דירה')
})

test('standing order → הוראות קבע (override)', () => {
  assert.equal(categorize('הוראת קבע ועד בית'), 'הוראות קבע')
})

test('hotel matches טיסות via substring (before boundary "hot")', () => {
  assert.equal(categorize('Booking.com Hotel Berlin'), 'טיסות ותיירות')
})

test('boundary keyword "hot" matches as a whole word', () => {
  assert.equal(categorize('HOT mobile'), 'שירותי תקשורת')
})

test('boundary keyword does NOT match inside a word ("hotdog")', () => {
  assert.equal(categorize('hotdog kiosk zzz'), 'שונות')
})

test('unknown merchant → שונות', () => {
  assert.equal(categorize('qwerty zzz 12345'), 'שונות')
})

test('user rule overrides keyword category', () => {
  const ruleMap = new Map([['שופרסל דיל', 'מתנות']])
  const base = categorize('שופרסל דיל')
  assert.equal(base, 'מזון וצריכה')
  assert.equal(applyRules(base, 'שופרסל דיל', ruleMap), 'מתנות')
})

// ── Owner attribution ──────────────────────────────────────────────────────
test('detectOwner: a personal account keeps its owner regardless of description', () => {
  assert.equal(detectOwner('כל תיאור שהוא', 'שלי'), 'שלי')
  assert.equal(detectOwner('מתנה עבור מור', 'שלי'), 'שלי') // account owner wins on personal cards
})

test('detectOwner: a joint account attributes by keyword, else joint', () => {
  assert.equal(detectOwner('בנק פועלים משכורת', JOINT), 'מור')
  assert.equal(detectOwner('ישראכרט מש משכורת', JOINT), 'שלי')
  assert.equal(detectOwner('שופרסל דיל', JOINT), JOINT)
})

test('normalizeTxn tags _owner and account label from a personal account', () => {
  const acct = { provider: 'isracard', owner: 'שלי', label: 'ישראכרט (שלי)' }
  const t = normalizeTxn({ date: '2024-01-10T12:00:00', chargedAmount: -50, description: 'קפה' }, acct, new Map())
  assert.equal(t['_owner'], 'שלי')
  assert.equal(t['_source_file'], 'ישראכרט (שלי)')
  assert.equal(t['_provider'], 'isracard')
})

test('normalizeTxn name-detects owner on a joint bank account', () => {
  const acct = { provider: 'discount', owner: JOINT, label: 'בנק דיסקונט' }
  const t = normalizeTxn({ date: '2024-03-05T12:00:00', chargedAmount: 10652, description: 'בנק פועלים משכורת' }, acct, new Map())
  assert.equal(t['_owner'], 'מור')
})

// ── Normalizer ───────────────────────────────────────────────────────────
test('normalize: signs, abs, month, weekday, card billing date', () => {
  const raw = {
    date: '2024-01-01T12:00:00',
    processedDate: '2024-02-02T12:00:00',
    chargedAmount: -342.8,
    description: '  שופרסל דיל  ',
    memo: 'תשלום 1 מתוך 3',
  }
  const t = normalizeTxn(raw, 'max', new Map())
  assert.equal(t['תאריך'], '2024-01-01')
  assert.equal(t['סכום'], -342.8)
  assert.equal(t['סכום_מוחלט'], 342.8)
  assert.equal(t['חודש'], '01/2024')
  assert.equal(t['יום_בשבוע'], 0) // 2024-01-01 is Monday → pandas 0
  assert.equal(t['תיאור'], 'שופרסל דיל')
  assert.equal(t['קטגוריה'], 'מזון וצריכה')
  assert.equal(t['הערות'], 'תשלום 1 מתוך 3')
  assert.equal(t['_is_bank_row'], false) // max is a card
  assert.equal(t['תאריך_חיוב'], '2024-02-02')
  assert.equal(t['חודש_חיוב'], '02/2024')
})

test('normalize: bank row has no billing date; income stays positive', () => {
  const t = normalizeTxn(
    { date: '2024-03-10T12:00:00', chargedAmount: 18450, description: 'משכורת' },
    'leumi', new Map(),
  )
  assert.equal(t['_is_bank_row'], true)
  assert.equal(t['תאריך_חיוב'], undefined)
  assert.equal(t['סכום'], 18450)
})

test('normalize: split installments become distinct, self-describing rows', () => {
  const base = { date: '2024-01-10T12:00:00', chargedAmount: -100, description: 'חנות' }
  const t1 = normalizeTxn({ ...base, processedDate: '2024-02-02T12:00:00', installments: { number: 1, total: 3 } }, 'max', new Map())
  const t2 = normalizeTxn({ ...base, processedDate: '2024-03-02T12:00:00', installments: { number: 2, total: 3 } }, 'max', new Map())
  assert.equal(t1['תיאור'], 'חנות (תשלום 1/3)')
  assert.equal(t2['תיאור'], 'חנות (תשלום 2/3)')
  assert.notEqual(txnKey(t1), txnKey(t2)) // distinct → not collapsed by dedup
  assert.equal(t1['חודש_חיוב'], '02/2024') // each on its own billing month
  assert.equal(t2['חודש_חיוב'], '03/2024')
})

test('normalize: single-payment purchase keeps its plain description', () => {
  const t = normalizeTxn({ date: '2024-01-10T12:00:00', chargedAmount: -50, description: 'קפה', installments: { number: 1, total: 1 } }, 'max', new Map())
  assert.equal(t['תיאור'], 'קפה')
})

test('normalize: zero amount / bad date are dropped', () => {
  assert.equal(normalizeTxn({ date: '2024-01-01T12:00:00', chargedAmount: 0, description: 'x' }, 'leumi', new Map()), null)
  assert.equal(normalizeTxn({ date: 'not-a-date', chargedAmount: 5, description: 'x' }, 'leumi', new Map()), null)
})

// ── Income month attribution ──────────────────────────────────────────────
test('isSalary detects keyword and large deposits, ignores expenses', () => {
  assert.equal(isSalary({ 'סכום': 12000, 'תיאור': 'משכורת' }), true)
  assert.equal(isSalary({ 'סכום': 5000, 'תיאור': 'העברה כלשהי' }, 4000), true) // amount fallback opted in
  assert.equal(isSalary({ 'סכום': 9000, 'תיאור': 'העברה מאדם כלשהו' }), false) // large but no keyword, default keyword-only
  assert.equal(isSalary({ 'סכום': 200, 'תיאור': 'החזר קטן' }), false) // small, no keyword
  assert.equal(isSalary({ 'סכום': -12000, 'תיאור': 'משכורת' }), false) // negative
})

test('income shift "next": late-month salary moves to following month', () => {
  const txns = [
    { 'תאריך': '2024-01-27', 'סכום': 12000, 'תיאור': 'משכורת', 'חודש': '01/2024' },
    { 'תאריך': '2024-02-02', 'סכום': 12000, 'תיאור': 'משכורת', 'חודש': '02/2024' },
    { 'תאריך': '2024-02-05', 'סכום': 15000, 'תיאור': 'משכורת', 'חודש': '02/2024' },
    { 'תאריך': '2024-01-15', 'סכום': -200, 'תיאור': 'שופרסל', 'חודש': '01/2024' },
  ]
  const changed = applyIncomeMonthShift(txns, { direction: 'next', cutoffDay: 25, salaryMin: 4000 })
  assert.equal(changed, 1) // only the Jan-27 salary shifts
  assert.equal(txns[0]['חודש'], '02/2024')
  assert.equal(txns[0]['תאריך_חיוב'], '2024-02-01')
  assert.equal(txns[1]['חודש'], '02/2024') // unchanged
  assert.equal(txns[2]['חודש'], '02/2024') // mid-month, unchanged
  assert.equal(txns[3]['חודש'], '01/2024') // expense untouched
})

test('income shift crosses year boundary and is idempotent', () => {
  const txns = [{ 'תאריך': '2024-12-28', 'סכום': 12000, 'תיאור': 'משכורת', 'חודש': '12/2024' }]
  assert.equal(applyIncomeMonthShift(txns, { direction: 'next', cutoffDay: 25 }), 1)
  assert.equal(txns[0]['חודש'], '01/2025')
  assert.equal(applyIncomeMonthShift(txns, { direction: 'next', cutoffDay: 25 }), 0) // idempotent
})

test('txnKey + mergeSnapshots dedup, count, and reindex', () => {
  const a = { 'תאריך': '2024-01-01', 'סכום': -10, 'תיאור': 'a' }
  const b = { 'תאריך': '2024-01-02', 'סכום': -20, 'תיאור': 'b' }
  const bDup = { 'תאריך': '2024-01-02', 'סכום': -20, 'תיאור': 'b' }
  const c = { 'תאריך': '2024-01-03', 'סכום': -30, 'תיאור': 'c' }
  assert.equal(txnKey(b), '2024-01-02|-20|b')
  const { merged, added } = mergeSnapshots([a], [bDup, b, c])
  assert.equal(added, 2) // b once + c; bDup deduped
  assert.equal(merged.length, 3)
  assert.deepEqual(merged.map((t) => t.id), [0, 1, 2])
})
