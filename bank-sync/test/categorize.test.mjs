import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categorize, applyRules, subcategorize, categoryFromIssuer, normalizeMerchant, buildRuleMap, VALID_CATEGORIES } from '../src/categorize.js'
import { normalizeTxn, txnKey, mergeSnapshots, refreshMiscCategories } from '../src/normalize.js'
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

// ── Catalog: false-positive fixes & expanded coverage ───────────────────────
test('Yes Planet at the Ayalon mall → leisure, NOT insurance', () => {
  // "איילון" used to match Ayalon Insurance; the cinema must win.
  assert.equal(categorize('יס פלאנט איילון'), 'פנאי, בידור וספורט')
})

test('Ayalon Insurance still → ביטוח', () => {
  assert.equal(categorize('איילון חברה לביטוח'), 'ביטוח')
})

test('a generic store at קניון איילון is NOT forced into insurance', () => {
  // The bare "איילון" trap is gone — an unknown Ayalon-mall shop stays שונות.
  assert.equal(categorize('חנות מתנות קניון איילון'), 'שונות')
})

test('foreign card transactions are bucketed as travel (overseas spend)', () => {
  assert.equal(categorize('SHINSEGAE DEPARTMENT S SEOUL         KR'), 'טיסות ותיירות')
  assert.equal(categorize('BANGKOK BANK           TRAT          TH'), 'טיסות ותיירות')
  assert.equal(categorize('7-11 HAD SAI KHAO      TRAD          TH'), 'טיסות ותיירות') // overrides food keyword
})

test('merchants from the 2026-07 sync review are categorized', () => {
  assert.equal(categorize('ELAL'), 'טיסות ותיירות')
  assert.equal(categorize('אייר חיפה'), 'טיסות ותיירות')
  assert.equal(categorize('ETIHADAIR60724151216'), 'טיסות ותיירות')
  assert.equal(categorize('AIRALO'), 'טיסות ותיירות')
  assert.equal(categorize('DOUBLE TREE BY HILTO'), 'טיסות ותיירות')
  assert.equal(categorize('KC GRAND KOHCHANG'), 'טיסות ותיירות')
  assert.equal(categorize('RAILNINJA 7917'), 'טיסות ותיירות')
  assert.equal(categorize('LEVI S BIG C RAJADHA'), 'טיסות ותיירות')
  assert.equal(categorize('CJ OLIVE YOUNG HAEUN'), 'טיסות ותיירות')
  assert.equal(categorize('LOTTEBAIKHOAJEOM BON'), 'טיסות ותיירות')
  assert.equal(categorize('מאמאנט ליגת אמהות לכ'), 'פנאי, בידור וספורט')
  assert.equal(categorize('דור-ארגמן'), 'דלק, חשמל וגז')
  assert.equal(categorize('דור -האיצטדיון'), 'דלק, חשמל וגז') // not פנאי via 'אצטדיון'
  assert.equal(categorize('ל ב קוסמטיקס'), 'אופנה')
  assert.equal(categorize('PEDRO PPS'), 'אופנה')
  assert.equal(categorize('ROSSO VINO'), 'מסעדות, קפה וברים')
  assert.equal(categorize('ביי-מי שוברי מתנה'), 'מתנות')
  assert.equal(categorize('L.B.Y GROUP'), 'רפואה ובתי מרקחת') // couples therapy
})

// ── Rule hygiene & foreign-billing exemptions (the 'אחר' junk-rules bug) ────
test('online services billed abroad are NOT bucketed as travel', () => {
  assert.equal(categorize('NETFLIX.COM AMSTERDAM NL'), 'חשמל ומחשבים')
  assert.equal(categorize('PAYPAL *SPOTIFY*P40762 35314369001 GB'), 'חשמל ומחשבים')
})

test('real overseas trip spend still goes to travel', () => {
  assert.equal(categorize('SHINSEGAE DEPARTMENT S SEOUL         KR'), 'טיסות ותיירות')
})

test('junk rules (category אחר) are ignored', () => {
  const junk = new Map([['L.B.Y GROUP', 'אחר']])
  assert.equal(applyRules(categorize('L.B.Y GROUP'), 'L.B.Y GROUP', junk), 'רפואה ובתי מרקחת')
})

test('rules cannot pull AI-tool spend out of בינה מלאכותית', () => {
  const stale = new Map([['CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM US', 'אחר']])
  const cat = categorize('CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM US')
  assert.equal(cat, 'בינה מלאכותית')
  assert.equal(applyRules(cat, 'CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM US', stale), 'בינה מלאכותית')
})

test('the catalog beats a conflicting rule; rules decide catalog-unknowns', () => {
  // A rule contradicting a keyword hit is stale (old AI guess) — ignored.
  const rules = new Map([['שופרסל דיל', 'מתנות'], ['מרצדס בנץ', 'תחבורה ורכבים']])
  assert.equal(applyRules(categorize('שופרסל דיל'), 'שופרסל דיל', rules), 'מזון וצריכה')
  // The catalog has no opinion on this merchant — the rule decides.
  assert.equal(applyRules(categorize('מרצדס בנץ'), 'מרצדס בנץ', rules), 'תחבורה ורכבים')
})

test('L.B.Y therapy gets the טיפול זוגי subcategory', () => {
  assert.equal(subcategorize('רפואה ובתי מרקחת', 'L.B.Y GROUP'.toLowerCase()), 'טיפול זוגי')
})

test('VALID_CATEGORIES excludes אחר', () => {
  assert.equal(VALID_CATEGORIES.has('אחר'), false)
  assert.equal(VALID_CATEGORIES.has('מתנות'), true)
})

test('refreshMiscCategories repairs rows stored with junk אחר', () => {
  const txns = [
    { 'תיאור': 'NETFLIX.COM AMSTERDAM NL', 'קטגוריה': 'אחר' },   // junk → catalog
    { 'תיאור': 'ZZQWX UNKNOWN', 'קטגוריה': 'אחר' },              // junk → שונות
    { 'תיאור': 'שופרסל דיל', 'קטגוריה': 'מזון וצריכה' },          // valid → untouched
  ]
  const changed = refreshMiscCategories(txns, new Map())
  assert.equal(changed, 2)
  assert.equal(txns[0]['קטגוריה'], 'חשמל ומחשבים')
  assert.equal(txns[1]['קטגוריה'], 'שונות')
  assert.equal(txns[2]['קטגוריה'], 'מזון וצריכה')
})

// ── refreshMiscCategories: apply catalog updates to stored snapshots ─────────
test('refreshMiscCategories upgrades שונות rows and keeps catalog-unknown stored ones', () => {
  const txns = [
    { 'תיאור': 'ELAL', 'קטגוריה': 'שונות' },
    { 'תיאור': 'AIRALO (תשלום 2/3)', 'קטגוריה': 'שונות' }, // installment suffix stripped
    { 'תיאור': 'שופרסל דיל', 'קטגוריה': 'מזון וצריכה', 'סכום': -50 },  // catalog agrees — untouched
    { 'תיאור': 'מרצדס בנץ', 'קטגוריה': 'שונות' },           // user rule wins
    { 'תיאור': 'ZZQWX UNKNOWN', 'קטגוריה': 'שונות' },        // stays שונות
    // Catalog has NO opinion → the stored category survives.
    { 'תיאור': 'ZZQWX SERVICES', 'קטגוריה': 'מנויים ושירותים', 'סכום': -30 },
  ]
  const rules = new Map([['מרצדס בנץ', 'תחבורה ורכבים']])
  const changed = refreshMiscCategories(txns, rules)
  assert.equal(changed, 3)
  assert.equal(txns[0]['קטגוריה'], 'טיסות ותיירות')
  assert.equal(txns[1]['קטגוריה'], 'טיסות ותיירות')
  assert.equal(txns[2]['קטגוריה'], 'מזון וצריכה')
  assert.equal(txns[3]['קטגוריה'], 'תחבורה ורכבים')
  assert.equal(txns[4]['קטגוריה'], 'שונות')
  assert.equal(txns[5]['קטגוריה'], 'מנויים ושירותים')
})

test('refreshMiscCategories: the catalog repairs a stale stored category on expenses', () => {
  const txns = [
    // Old AI guess baked into the snapshot: a minimarket pinned to משיכת מזומן.
    // The catalog KNOWS it ('מרקט') → repaired, stale subcategory re-derived.
    { 'תיאור': 'סיטי מרקט רמת גן', 'קטגוריה': 'משיכת מזומן', 'קטגוריה_משנה': 'ישן', 'סכום': -13.9 },
    // Income row (refund) with the same descriptor — never second-guessed.
    { 'תיאור': 'סיטי מרקט רמת גן', 'קטגוריה': 'העברת כספים', 'סכום': 100 },
    // A stale rule pinning a catalog-known merchant loses to the catalog too.
    { 'תיאור': 'רמי לוי שיווק', 'קטגוריה': 'משיכת מזומן', 'סכום': -80 },
  ]
  const rules = new Map([['רמי לוי שיווק', 'משיכת מזומן']])
  const changed = refreshMiscCategories(txns, rules)
  assert.equal(changed, 2)
  assert.equal(txns[0]['קטגוריה'], 'מזון וצריכה')
  assert.notEqual(txns[0]['קטגוריה_משנה'], 'ישן')
  assert.equal(txns[1]['קטגוריה'], 'העברת כספים')
  assert.equal(txns[2]['קטגוריה'], 'מזון וצריכה')
})

test('foreign bucketing excludes Israel (IL), online services, and domestic rows', () => {
  assert.equal(categorize('ASOS IL'), 'אופנה')          // IL = Israel, not foreign
  assert.equal(categorize('NETFLIX.COM'), 'חשמל ומחשבים') // no city/country trailer
  assert.equal(categorize('שופרסל דיל'), 'מזון וצריכה')  // Hebrew → domestic
  assert.equal(categorize('ZZQWX'), 'שונות')             // no country-code trailer, unknown
})

// ── AI tools → בינה מלאכותית (override) ─────────────────────────────────────
test('AI tools get the dedicated בינה מלאכותית category', () => {
  assert.equal(categorize('OPENAI *CHATGPT'), 'בינה מלאכותית')
  assert.equal(categorize('Claude.ai subscription'), 'בינה מלאכותית')
  assert.equal(categorize('MIDJOURNEY'), 'בינה מלאכותית')
  // Real descriptor from the 2026-07 sync review.
  assert.equal(categorize('GRAMMARLY CO ELTR6V9'), 'בינה מלאכותית')
})

test('AI override beats the foreign-card descriptor', () => {
  // Trailing "US" looks foreign, but the AI override must win.
  assert.equal(categorize('CHATGPT US'), 'בינה מלאכותית')
})

test('non-AI electronics stay in חשמל ומחשבים', () => {
  assert.equal(categorize('NETFLIX.COM'), 'חשמל ומחשבים')
  assert.equal(categorize('GitHub'), 'חשמל ומחשבים')
})

// ── Subcategories (קטגוריה_משנה) ────────────────────────────────────────────
test('subcategorize: Food → מאפיות / Entertainment → קולנוע', () => {
  assert.equal(subcategorize('מזון וצריכה', 'מאפיית לחם ארז'), 'מאפיות')
  assert.equal(subcategorize('פנאי, בידור וספורט', 'יס פלאנט'), 'קולנוע')
})

test('subcategorize: no match / unknown parent → empty string', () => {
  assert.equal(subcategorize('מזון וצריכה', 'חנות כלשהי'), '')
  assert.equal(subcategorize('קטגוריה לא ידועה', 'מאפיית לחם'), '')
})

test('normalizeTxn writes the subcategory column', () => {
  const t = normalizeTxn({ date: '2024-01-10T12:00:00', chargedAmount: -30, description: 'מאפיית לחם' }, 'max', new Map())
  assert.equal(t['קטגוריה'], 'מזון וצריכה')
  assert.equal(t['קטגוריה_משנה'], 'מאפיות')
})

test('expanded catalog: common Israeli merchants resolve out of שונות', () => {
  assert.equal(categorize('רב חן דיזנגוף'), 'פנאי, בידור וספורט')
  assert.equal(categorize('דקאתלון'), 'פנאי, בידור וספורט')
  assert.equal(categorize('מקס ברנר'), 'מסעדות, קפה וברים')
  assert.equal(categorize('איסתא ליינס'), 'טיסות ותיירות')
  assert.equal(categorize('אסותא מרכזים רפואיים'), 'רפואה ובתי מרקחת')
  assert.equal(categorize('תאגיד מים מי אביבים'), 'עירייה וממשלה')
})

test('a rule agreeing with the catalog is a no-op; a conflicting one loses', () => {
  const base = categorize('שופרסל דיל')
  assert.equal(base, 'מזון וצריכה')
  assert.equal(applyRules(base, 'שופרסל דיל', new Map([['שופרסל דיל', 'מזון וצריכה']])), 'מזון וצריכה')
  assert.equal(applyRules(base, 'שופרסל דיל', new Map([['שופרסל דיל', 'מתנות']])), 'מזון וצריכה')
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

// ── Issuer category (ענף_מקור) fallback ──────────────────────────────────────
test('categoryFromIssuer maps issuer sector names, specific before generic', () => {
  assert.equal(categoryFromIssuer('מסעדות ובתי קפה'), 'מסעדות, קפה וברים')
  assert.equal(categoryFromIssuer('מזון מהיר'), 'מסעדות, קפה וברים') // not מזון וצריכה
  assert.equal(categoryFromIssuer('רשתות שיווק מזון'), 'מזון וצריכה')
  assert.equal(categoryFromIssuer('חשמל ואלקטרוניקה'), 'חשמל ומחשבים') // not דלק/חשמל
  assert.equal(categoryFromIssuer('תיירות ותעופה'), 'טיסות ותיירות')
  assert.equal(categoryFromIssuer(''), null)
  assert.equal(categoryFromIssuer(undefined), null)
  assert.equal(categoryFromIssuer('ענף לא מוכר'), null)
})

test('normalizeTxn stores ענף_מקור and uses it only when keywords miss', () => {
  // Unknown merchant + issuer sector → issuer category fills the gap.
  const miss = normalizeTxn(
    { date: '2024-01-10T12:00:00', chargedAmount: -80, description: 'העסק של יוסי', category: 'מסעדות' },
    'max', new Map(),
  )
  assert.equal(miss['ענף_מקור'], 'מסעדות')
  assert.equal(miss['קטגוריה'], 'מסעדות, קפה וברים')

  // Known merchant → keyword catalog wins over the issuer sector.
  const hit = normalizeTxn(
    { date: '2024-01-10T12:00:00', chargedAmount: -80, description: 'שופרסל דיל', category: 'מסעדות' },
    'max', new Map(),
  )
  assert.equal(hit['קטגוריה'], 'מזון וצריכה')

  // No issuer data → field is null, category stays שונות.
  const none = normalizeTxn(
    { date: '2024-01-10T12:00:00', chargedAmount: -80, description: 'העסק של יוסי' },
    'max', new Map(),
  )
  assert.equal(none['ענף_מקור'], null)
  assert.equal(none['קטגוריה'], 'שונות')
})

test('user rule beats the issuer category', () => {
  const rules = new Map([['העסק של יוסי', 'חינוך ולימודים']])
  const t = normalizeTxn(
    { date: '2024-01-10T12:00:00', chargedAmount: -80, description: 'העסק של יוסי', category: 'מסעדות' },
    'max', rules,
  )
  assert.equal(t['קטגוריה'], 'חינוך ולימודים')
})

test('refreshMiscCategories uses stored ענף_מקור for שונות rows', () => {
  const txns = [
    { 'תיאור': 'העסק של יוסי', 'קטגוריה': 'שונות', 'ענף_מקור': 'מוסכים ורכב' },
    { 'תיאור': 'עסק אחר', 'קטגוריה': 'שונות', 'ענף_מקור': 'ענף עלום' },
    { 'תיאור': 'עסק שלישי', 'קטגוריה': 'ביטוח', 'ענף_מקור': 'מסעדות' }, // real category untouched
  ]
  const changed = refreshMiscCategories(txns, new Map())
  assert.equal(changed, 1)
  assert.equal(txns[0]['קטגוריה'], 'תחבורה ורכבים')
  assert.equal(txns[1]['קטגוריה'], 'שונות')
  assert.equal(txns[2]['קטגוריה'], 'ביטוח')
})

// ── Merchant normalization + canonical-key rules ─────────────────────────────
test('normalizeMerchant canonicalizes descriptor variants', () => {
  assert.equal(normalizeMerchant('רהיטי עצמל (תשלום 4/12)'), 'רהיטי עצמל')
  assert.equal(normalizeMerchant('PAYPAL *SPOTIFY'), 'spotify')
  assert.equal(normalizeMerchant('  ZARA   TLV  '), 'zara tlv')
  assert.equal(normalizeMerchant('GOOGLE *YouTubePremium'), 'youtubepremium')
  assert.equal(normalizeMerchant(''), '')
})

test('a rule saved from one installment hits every installment', () => {
  const ruleMap = buildRuleMap([{ merchant: 'רהיטי עצמל (תשלום 1/12)', category: 'עיצוב הבית' }])
  assert.equal(applyRules('שונות', 'רהיטי עצמל (תשלום 7/12)', ruleMap), 'עיצוב הבית')
  assert.equal(applyRules('שונות', 'רהיטי עצמל', ruleMap), 'עיצוב הבית')
})

test('a rule matches across payment-processor prefixes and case', () => {
  const ruleMap = buildRuleMap([{ merchant: 'PAYPAL *NINTENDO', category: 'חשמל ומחשבים' }])
  assert.equal(applyRules('שונות', 'nintendo', ruleMap), 'חשמל ומחשבים')
})

test('longest keyword wins across categories', () => {
  // 'רמי לוי תקשורת' (telecom) must beat the shorter 'רמי לוי' (groceries),
  // whatever order the catalog declares the two categories in.
  assert.equal(categorize('רמי לוי תקשורת בעמ'), 'שירותי תקשורת')
  assert.equal(categorize('רמי לוי שיווק השקמה'), 'מזון וצריכה')
})

// ── Stale foreign-exempt travel repair (retag path) ──────────────────────────
test('refreshMiscCategories repairs pre-exemption travel rows', () => {
  const txns = [
    { 'תיאור': 'NETFLIX.COM 408-724-9160 NL', 'קטגוריה': 'טיסות ותיירות' },
    { 'תיאור': 'RENDER.COM RENDER.COM US', 'קטגוריה': 'טיסות ותיירות' },
    { 'תיאור': 'SHINSEGAE DEPARTMENT S SEOUL         KR', 'קטגוריה': 'טיסות ותיירות' }, // real trip spend
    { 'תיאור': 'איסתא נסיעות', 'קטגוריה': 'טיסות ותיירות' }, // Hebrew — untouched
  ]
  const changed = refreshMiscCategories(txns, new Map())
  assert.equal(changed, 2)
  assert.equal(txns[0]['קטגוריה'], 'חשמל ומחשבים')
  assert.equal(txns[1]['קטגוריה'], 'חשמל ומחשבים')
  assert.equal(txns[2]['קטגוריה'], 'טיסות ותיירות')
  assert.equal(txns[3]['קטגוריה'], 'טיסות ותיירות')
})

test('new dev/cloud merchants categorize as חשמל ומחשבים, not travel', () => {
  assert.equal(categorize('RENDER.COM RENDER.COM US'), 'חשמל ומחשבים')
  assert.equal(categorize('PAYPAL *DIGITALOCEA 4029357733 US'), 'חשמל ומחשבים')
  assert.equal(categorize('ALLDEBRID MONTROUGE FR'), 'חשמל ומחשבים')
  assert.equal(categorize('WSERBASE INC WWW.BROWSERBA US'), 'חשמל ומחשבים')
})

test('subcategorize: Food → סופרים; chain with יין substring stays a supermarket', () => {
  assert.equal(subcategorize('מזון וצריכה', 'שופרסל דיל רמת גן'), 'סופרים')
  assert.equal(subcategorize('מזון וצריכה', 'רמי לוי שיווק השקמה'), 'סופרים')
  // 'יינות ביתן' contains the אלכוהול keyword 'יין' — סופרים is first in the
  // parent's submap, so the chain must win.
  assert.equal(subcategorize('מזון וצריכה', 'יינות ביתן בע"מ'), 'סופרים')
})

test('delivery descriptors are food orders, not transport', () => {
  assert.equal(categorize('מפגש גרונר משלוחים'), 'מסעדות, קפה וברים')
  assert.equal(categorize('משלוחה הזמנת אוכל או'), 'מסעדות, קפה וברים')
  // Real toll/road rows stay transport.
  assert.equal(categorize('כביש 6 חוצה צפון בע"מ'), 'תחבורה ורכבים')
  assert.equal(categorize('מ.תחבורה ? רב-פס'), 'תחבורה ורכבים')
})

test('stock/variety stores are consumption with the חנויות סטוק subcategory', () => {
  assert.equal(categorize('BOOOM'.toLowerCase()), 'מזון וצריכה')
  assert.equal(categorize('סטוק סנטר איריס בע"מ'), 'מזון וצריכה')
  assert.equal(subcategorize('מזון וצריכה', 'סטוק סנטר איריס בע"מ'), 'חנויות סטוק')
  // Real fashion chains stay fashion.
  assert.equal(categorize('גולף קניון רמת גן-גמ'), 'אופנה')
})
