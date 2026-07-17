import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categorize, applyRules, subcategorize, categoryFromIssuer, normalizeMerchant, buildRuleMap, migrateCategory, VALID_CATEGORIES } from '../src/categorize.js'
import { normalizeTxn, txnKey, mergeSnapshots, refreshMiscCategories } from '../src/normalize.js'
import { applyIncomeMonthShift, isSalary } from '../src/income.js'
import { detectOwner, JOINT } from '../src/owner.js'

// ── Categorizer (Shelly's 2026-07 taxonomy) ─────────────────────────────
test('supermarket → אוכל', () => {
  assert.equal(categorize('שופרסל דיל רמת גן'), 'אוכל')
})

test('restaurant → בילויים', () => {
  assert.equal(categorize('מקדונלד'), 'בילויים')
})

test('fuel → הוצאות שוטפות', () => {
  assert.equal(categorize('סונול תחנת דלק'), 'הוצאות שוטפות')
})

test('atm → משיכת מזומן', () => {
  assert.equal(categorize('משיכת מזומן כספומט'), 'משיכת מזומן')
})

test('Psagot → העברה להשקעות (override)', () => {
  assert.equal(categorize('העברה פסגות גמל'), 'העברה להשקעות')
})

test('check withdrawal → rent under הוצאות שוטפות (override)', () => {
  assert.equal(categorize('משיכת שיקים'), 'הוצאות שוטפות')
  assert.equal(subcategorize('הוצאות שוטפות', 'משיכת שיקים'), 'שכר דירה')
})

test('standing order → הוראות קבע (override)', () => {
  assert.equal(categorize('הוראת קבע ועד בית'), 'הוראות קבע')
})

test('hotel matches טיסות via substring (before boundary "hot")', () => {
  assert.equal(categorize('Booking.com Hotel Berlin'), 'טיסות ותיירות')
})

test('boundary keyword "hot" matches as a whole word', () => {
  assert.equal(categorize('HOT mobile'), 'הוצאות שוטפות')
})

test('boundary keyword does NOT match inside a word ("hotdog")', () => {
  assert.equal(categorize('hotdog zzz'), 'שונות')
})

test('unknown merchant → שונות', () => {
  assert.equal(categorize('qwerty zzz 12345'), 'שונות')
})

// ── Catalog: false-positive fixes & expanded coverage ───────────────────────
test('Yes Planet at the Ayalon mall → בילויים, NOT insurance', () => {
  // "איילון" used to match Ayalon Insurance; the cinema must win.
  assert.equal(categorize('יס פלאנט איילון'), 'בילויים')
})

test('Ayalon Insurance still → הוצאות שוטפות (ביטוח)', () => {
  assert.equal(categorize('איילון חברה לביטוח'), 'הוצאות שוטפות')
  assert.equal(subcategorize('הוצאות שוטפות', 'איילון חברה לביטוח'), 'ביטוח')
})

test('a gift shop at קניון איילון → אירועים ומתנות (מתנות keyword)', () => {
  assert.equal(categorize('חנות מתנות קניון איילון'), 'אירועים ומתנות')
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
  assert.equal(categorize('מאמאנט ליגת אמהות לכ'), 'חוגים וספורט')
  assert.equal(categorize('דור-ארגמן'), 'הוצאות שוטפות')
  assert.equal(categorize('דור -האיצטדיון'), 'הוצאות שוטפות') // fuel, not אצטדיון
  assert.equal(categorize('ל ב קוסמטיקס'), 'טיפוח')
  assert.equal(categorize('PEDRO PPS'), 'קניות')
  assert.equal(categorize('ROSSO VINO'), 'בילויים')
  assert.equal(categorize('ביי-מי שוברי מתנה'), 'אירועים ומתנות')
  assert.equal(categorize('L.B.Y GROUP'), 'תרופות וטיפולים') // couples therapy
})

// ── New-taxonomy splits ─────────────────────────────────────────────────────
test('pharm chains get their own פארם category', () => {
  assert.equal(categorize('סופר פארם דיזנגוף'), 'פארם')
  assert.equal(categorize('GOOD PHARM'.toLowerCase()), 'פארם')
  // Pharmacies (בתי מרקחת) stay medical.
  assert.equal(categorize('בית מרקחת המרכזי'), 'תרופות וטיפולים')
})

test('big chains vs neighborhood shops (קניות גדולות / סופרים קטנים)', () => {
  assert.equal(subcategorize('אוכל', 'שופרסל דיל רמת גן'), 'קניות גדולות')
  assert.equal(subcategorize('אוכל', 'רמי לוי שיווק השקמה'), 'קניות גדולות')
  // 'יינות ביתן' contains the אלכוהול keyword 'יין' — the chain must win.
  assert.equal(subcategorize('אוכל', 'יינות ביתן בע"מ'), 'קניות גדולות')
  assert.equal(subcategorize('אוכל', 'מכולת השכונה'), 'סופרים קטנים')
  assert.equal(subcategorize('אוכל', 'פרימדונה רמת גן'), 'סופרים קטנים')
})

test('grooming → טיפוח; pet things → סושי', () => {
  assert.equal(categorize('מספרת רון תל אביב'), 'טיפוח')
  assert.equal(categorize('וטרינר דר כהן'), 'סושי')
  assert.equal(subcategorize('סושי', 'וטרינר דר כהן'), 'וטרינרית וטיפולים')
  assert.equal(subcategorize('סושי', 'אניפט מזון לחיות'), 'אוכל וחטיפים')
  // מספרת כלבים is the pet's grooming, not the humans'.
  assert.equal(categorize('מספרת כלבים הפרווה'), 'סושי')
})

// ── Rule hygiene & foreign-billing exemptions (the 'אחר' junk-rules bug) ────
test('online services billed abroad are NOT bucketed as travel', () => {
  assert.equal(categorize('NETFLIX.COM AMSTERDAM NL'), 'הוצאות שוטפות')
  assert.equal(categorize('PAYPAL *SPOTIFY*P40762 35314369001 GB'), 'הוצאות שוטפות')
})

test('real overseas trip spend still goes to travel', () => {
  assert.equal(categorize('SHINSEGAE DEPARTMENT S SEOUL         KR'), 'טיסות ותיירות')
})

test('junk rules (category אחר) are ignored', () => {
  const junk = new Map([['l.b.y group', 'אחר']])
  assert.equal(applyRules(categorize('L.B.Y GROUP'), 'L.B.Y GROUP', junk), 'תרופות וטיפולים')
})

test('rules cannot pull AI-tool spend out of טכנולוגיה', () => {
  const stale = new Map([[normalizeMerchant('CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM US'), 'אחר']])
  const cat = categorize('CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM US')
  assert.equal(cat, 'טכנולוגיה')
  assert.equal(subcategorize(cat, 'CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM US'), 'AI')
  assert.equal(applyRules(cat, 'CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM US', stale), 'טכנולוגיה')
})

test('the catalog beats a conflicting rule; rules decide catalog-unknowns', () => {
  // A rule contradicting a keyword hit is stale (old AI guess) — ignored.
  const rules = buildRuleMap([
    { merchant: 'שופרסל דיל', category: 'אירועים ומתנות' },
    { merchant: 'מרצדס בנץ', category: 'הוצאות משתנות' },
  ])
  assert.equal(applyRules(categorize('שופרסל דיל'), 'שופרסל דיל', rules), 'אוכל')
  // The catalog has no opinion on this merchant — the rule decides.
  assert.equal(applyRules(categorize('מרצדס בנץ'), 'מרצדס בנץ', rules), 'הוצאות משתנות')
})

test('L.B.Y therapy gets the טיפולים subcategory', () => {
  assert.equal(subcategorize('תרופות וטיפולים', 'L.B.Y GROUP'.toLowerCase()), 'טיפולים')
})

test('VALID_CATEGORIES excludes אחר and old-taxonomy names', () => {
  assert.equal(VALID_CATEGORIES.has('אחר'), false)
  assert.equal(VALID_CATEGORIES.has('מזון וצריכה'), false)
  assert.equal(VALID_CATEGORIES.has('אוכל'), true)
  assert.equal(VALID_CATEGORIES.has('אירועים ומתנות'), true)
  assert.equal(VALID_CATEGORIES.has('פארם'), true)
  assert.equal(VALID_CATEGORIES.has('סושי'), true)
})

// ── Old→new migration ───────────────────────────────────────────────────────
test('migrateCategory translates old names, passes new ones through', () => {
  assert.deepEqual(migrateCategory('מזון וצריכה'), ['אוכל', null])
  assert.deepEqual(migrateCategory('מזון וצריכה', 'סופרים'), ['אוכל', ''])
  assert.deepEqual(migrateCategory('מזון וצריכה', 'פארם וטיפוח'), ['פארם', ''])
  assert.deepEqual(migrateCategory('בינה מלאכותית'), ['טכנולוגיה', 'AI'])
  assert.deepEqual(migrateCategory('שכר דירה'), ['הוצאות שוטפות', 'שכר דירה'])
  assert.deepEqual(migrateCategory('חיות מחמד'), ['סושי', null])
  assert.deepEqual(migrateCategory('אוכל'), ['אוכל', null])
  assert.deepEqual(migrateCategory('אוכל', 'מאפיות'), ['אוכל', null])
})

test('buildRuleMap migrates rules saved under the old taxonomy', () => {
  const rules = buildRuleMap([{ merchant: 'מרצדס בנץ', category: 'תחבורה ורכבים' }])
  assert.equal(applyRules('שונות', 'מרצדס בנץ', rules), 'הוצאות משתנות')
})

test('refreshMiscCategories repairs rows stored with junk אחר', () => {
  const txns = [
    { 'תיאור': 'NETFLIX.COM AMSTERDAM NL', 'קטגוריה': 'אחר' },   // junk → catalog
    { 'תיאור': 'ZZQWX UNKNOWN', 'קטגוריה': 'אחר' },              // junk → שונות
    { 'תיאור': 'שופרסל דיל', 'קטגוריה': 'אוכל' },                 // valid → untouched
  ]
  const changed = refreshMiscCategories(txns, new Map())
  assert.equal(changed, 2)
  assert.equal(txns[0]['קטגוריה'], 'הוצאות שוטפות')
  assert.equal(txns[1]['קטגוריה'], 'שונות')
  assert.equal(txns[2]['קטגוריה'], 'אוכל')
})

test('refreshMiscCategories migrates old-taxonomy stored rows instead of nuking them', () => {
  const txns = [
    // Catalog-known: migrated AND kept aligned with the new catalog.
    { 'תיאור': 'שופרסל דיל', 'קטגוריה': 'מזון וצריכה', 'קטגוריה_משנה': 'סופרים', 'סכום': -50 },
    // Catalog-unknown: migration must preserve it (NOT reset to שונות).
    { 'תיאור': 'ZZQWX SERVICES', 'קטגוריה': 'מנויים ושירותים', 'סכום': -30 },
    { 'תיאור': 'CLAUDE.AI SUBSCRIPTION', 'קטגוריה': 'בינה מלאכותית', 'סכום': -75 },
  ]
  const changed = refreshMiscCategories(txns, new Map())
  assert.equal(changed, 3)
  assert.equal(txns[0]['קטגוריה'], 'אוכל')
  assert.equal(txns[0]['קטגוריה_משנה'], 'קניות גדולות')
  assert.equal(txns[1]['קטגוריה'], 'הוצאות שוטפות')
  assert.equal(txns[1]['קטגוריה_משנה'], 'מנויים ושירותים')
  assert.equal(txns[2]['קטגוריה'], 'טכנולוגיה')
  assert.equal(txns[2]['קטגוריה_משנה'], 'AI')
})

// ── refreshMiscCategories: apply catalog updates to stored snapshots ─────────
test('refreshMiscCategories upgrades שונות rows and keeps catalog-unknown stored ones', () => {
  const txns = [
    { 'תיאור': 'ELAL', 'קטגוריה': 'שונות' },
    { 'תיאור': 'AIRALO (תשלום 2/3)', 'קטגוריה': 'שונות' }, // installment suffix stripped
    { 'תיאור': 'שופרסל דיל', 'קטגוריה': 'אוכל', 'סכום': -50 },  // catalog agrees — untouched
    { 'תיאור': 'מרצדס בנץ', 'קטגוריה': 'שונות' },           // user rule wins
    { 'תיאור': 'ZZQWX UNKNOWN', 'קטגוריה': 'שונות' },        // stays שונות
    // Catalog has NO opinion → the stored (current-taxonomy) category survives.
    { 'תיאור': 'ZZQWX SERVICES', 'קטגוריה': 'טכנולוגיה', 'סכום': -30 },
  ]
  const rules = buildRuleMap([{ merchant: 'מרצדס בנץ', category: 'הוצאות משתנות' }])
  const changed = refreshMiscCategories(txns, rules)
  assert.equal(changed, 3)
  assert.equal(txns[0]['קטגוריה'], 'טיסות ותיירות')
  assert.equal(txns[1]['קטגוריה'], 'טיסות ותיירות')
  assert.equal(txns[2]['קטגוריה'], 'אוכל')
  assert.equal(txns[3]['קטגוריה'], 'הוצאות משתנות')
  assert.equal(txns[4]['קטגוריה'], 'שונות')
  assert.equal(txns[5]['קטגוריה'], 'טכנולוגיה')
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
  const rules = buildRuleMap([{ merchant: 'רמי לוי שיווק', category: 'משיכת מזומן' }])
  const changed = refreshMiscCategories(txns, rules)
  assert.equal(changed, 2)
  assert.equal(txns[0]['קטגוריה'], 'אוכל')
  assert.notEqual(txns[0]['קטגוריה_משנה'], 'ישן')
  assert.equal(txns[1]['קטגוריה'], 'העברת כספים')
  assert.equal(txns[2]['קטגוריה'], 'אוכל')
})

test('foreign bucketing excludes Israel (IL), online services, and domestic rows', () => {
  assert.equal(categorize('ASOS IL'), 'קניות')            // IL = Israel, not foreign
  assert.equal(categorize('NETFLIX.COM'), 'הוצאות שוטפות') // no city/country trailer
  assert.equal(categorize('שופרסל דיל'), 'אוכל')           // Hebrew → domestic
  assert.equal(categorize('ZZQWX'), 'שונות')               // no country-code trailer, unknown
})

// ── AI tools → טכנולוגיה / AI (override) ────────────────────────────────────
test('AI tools get טכנולוגיה with the AI subcategory', () => {
  assert.equal(categorize('OPENAI *CHATGPT'), 'טכנולוגיה')
  assert.equal(categorize('Claude.ai subscription'), 'טכנולוגיה')
  assert.equal(categorize('MIDJOURNEY'), 'טכנולוגיה')
  assert.equal(categorize('GRAMMARLY CO ELTR6V9'), 'טכנולוגיה')
  assert.equal(subcategorize('טכנולוגיה', 'OPENAI *CHATGPT'), 'AI')
})

test('AI override beats the foreign-card descriptor', () => {
  // Trailing "US" looks foreign, but the AI override must win.
  assert.equal(categorize('CHATGPT US'), 'טכנולוגיה')
})

test('non-AI tech is טכנולוגיה without the AI subcategory', () => {
  assert.equal(categorize('GitHub'), 'טכנולוגיה')
  assert.equal(subcategorize('טכנולוגיה', 'github'), 'שירותי ענן')
})

// ── Subcategories (קטגוריה_משנה) ────────────────────────────────────────────
test('subcategorize: bakery → מאפיות / cinema → סרטים', () => {
  assert.equal(subcategorize('אוכל', 'מאפיית לחם ארז'), 'מאפיות')
  assert.equal(subcategorize('בילויים', 'יס פלאנט'), 'סרטים')
})

test('subcategorize: no match / unknown parent → empty string', () => {
  assert.equal(subcategorize('אוכל', 'חנות כלשהי'), '')
  assert.equal(subcategorize('קטגוריה לא ידועה', 'מאפיית לחם'), '')
})

test('normalizeTxn writes the subcategory column', () => {
  const t = normalizeTxn({ date: '2024-01-10T12:00:00', chargedAmount: -30, description: 'מאפיית לחם' }, 'max', new Map())
  assert.equal(t['קטגוריה'], 'אוכל')
  assert.equal(t['קטגוריה_משנה'], 'מאפיות')
})

test('expanded catalog: common Israeli merchants resolve out of שונות', () => {
  assert.equal(categorize('רב חן דיזנגוף'), 'בילויים')
  assert.equal(categorize('דקאתלון'), 'חוגים וספורט')
  assert.equal(categorize('מקס ברנר'), 'בילויים')
  assert.equal(categorize('איסתא ליינס'), 'טיסות ותיירות')
  assert.equal(categorize('אסותא מרכזים רפואיים'), 'תרופות וטיפולים')
  assert.equal(categorize('תאגיד מים מי אביבים'), 'הוצאות שוטפות')
})

test('a rule agreeing with the catalog is a no-op; a conflicting one loses', () => {
  const base = categorize('שופרסל דיל')
  assert.equal(base, 'אוכל')
  assert.equal(applyRules(base, 'שופרסל דיל', buildRuleMap([{ merchant: 'שופרסל דיל', category: 'אוכל' }])), 'אוכל')
  assert.equal(applyRules(base, 'שופרסל דיל', buildRuleMap([{ merchant: 'שופרסל דיל', category: 'אירועים ומתנות' }])), 'אוכל')
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
  assert.equal(t['קטגוריה'], 'אוכל')
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
  assert.equal(categoryFromIssuer('מסעדות ובתי קפה'), 'בילויים')
  assert.equal(categoryFromIssuer('מזון מהיר'), 'בילויים') // not אוכל
  assert.equal(categoryFromIssuer('רשתות שיווק מזון'), 'אוכל')
  assert.equal(categoryFromIssuer('חשמל ואלקטרוניקה'), 'קניות') // not דלק/חשמל
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
  assert.equal(miss['קטגוריה'], 'בילויים')

  // Known merchant → keyword catalog wins over the issuer sector.
  const hit = normalizeTxn(
    { date: '2024-01-10T12:00:00', chargedAmount: -80, description: 'שופרסל דיל', category: 'מסעדות' },
    'max', new Map(),
  )
  assert.equal(hit['קטגוריה'], 'אוכל')

  // No issuer data → field is null, category stays שונות.
  const none = normalizeTxn(
    { date: '2024-01-10T12:00:00', chargedAmount: -80, description: 'העסק של יוסי' },
    'max', new Map(),
  )
  assert.equal(none['ענף_מקור'], null)
  assert.equal(none['קטגוריה'], 'שונות')
})

test('user rule beats the issuer category (old rule names migrate)', () => {
  const rules = buildRuleMap([{ merchant: 'העסק של יוסי', category: 'חינוך ולימודים' }])
  const t = normalizeTxn(
    { date: '2024-01-10T12:00:00', chargedAmount: -80, description: 'העסק של יוסי', category: 'מסעדות' },
    'max', rules,
  )
  assert.equal(t['קטגוריה'], 'חוגים וספורט')
})

test('refreshMiscCategories uses stored ענף_מקור for שונות rows', () => {
  const txns = [
    { 'תיאור': 'העסק של יוסי', 'קטגוריה': 'שונות', 'ענף_מקור': 'מוסכים ורכב' },
    { 'תיאור': 'עסק אחר', 'קטגוריה': 'שונות', 'ענף_מקור': 'ענף עלום' },
    { 'תיאור': 'עסק שלישי', 'קטגוריה': 'טיפוח', 'ענף_מקור': 'מסעדות' }, // real category untouched
  ]
  const changed = refreshMiscCategories(txns, new Map())
  assert.equal(changed, 1)
  assert.equal(txns[0]['קטגוריה'], 'הוצאות משתנות')
  assert.equal(txns[1]['קטגוריה'], 'שונות')
  assert.equal(txns[2]['קטגוריה'], 'טיפוח')
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
  assert.equal(applyRules('שונות', 'רהיטי עצמל (תשלום 7/12)', ruleMap), 'קניות') // old name migrated
  assert.equal(applyRules('שונות', 'רהיטי עצמל', ruleMap), 'קניות')
})

test('a rule matches across payment-processor prefixes and case', () => {
  const ruleMap = buildRuleMap([{ merchant: 'PAYPAL *NINTENDO', category: 'טכנולוגיה' }])
  assert.equal(applyRules('שונות', 'nintendo', ruleMap), 'טכנולוגיה')
})

test('longest keyword wins across categories', () => {
  // 'רמי לוי תקשורת' (telecom) must beat the shorter 'רמי לוי' (groceries),
  // whatever order the catalog declares the two categories in.
  assert.equal(categorize('רמי לוי תקשורת בעמ'), 'הוצאות שוטפות')
  assert.equal(categorize('רמי לוי שיווק השקמה'), 'אוכל')
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
  assert.equal(txns[0]['קטגוריה'], 'הוצאות שוטפות')
  assert.equal(txns[1]['קטגוריה'], 'טכנולוגיה')
  assert.equal(txns[2]['קטגוריה'], 'טיסות ותיירות')
  assert.equal(txns[3]['קטגוריה'], 'טיסות ותיירות')
})

test('new dev/cloud merchants categorize as טכנולוגיה, not travel', () => {
  assert.equal(categorize('RENDER.COM RENDER.COM US'), 'טכנולוגיה')
  assert.equal(categorize('PAYPAL *DIGITALOCEA 4029357733 US'), 'טכנולוגיה')
  assert.equal(categorize('ALLDEBRID MONTROUGE FR'), 'טכנולוגיה')
  assert.equal(categorize('WSERBASE INC WWW.BROWSERBA US'), 'טכנולוגיה')
})

test('delivery descriptors are food orders, not transport', () => {
  assert.equal(categorize('מפגש גרונר משלוחים'), 'אוכל')
  assert.equal(categorize('משלוחה הזמנת אוכל או'), 'אוכל')
  // Real toll/road rows stay transport (הוצאות משתנות).
  assert.equal(categorize('כביש 6 חוצה צפון בע"מ'), 'הוצאות משתנות')
  assert.equal(categorize('מ.תחבורה ? רב-פס'), 'הוצאות משתנות')
})

test('stock/variety stores are קניות with the דברים לבית subcategory', () => {
  assert.equal(categorize('BOOOM'.toLowerCase()), 'קניות')
  assert.equal(categorize('סטוק סנטר איריס בע"מ'), 'קניות')
  assert.equal(subcategorize('קניות', 'סטוק סנטר איריס בע"מ'), 'דברים לבית')
  // Real fashion chains stay in קניות with the אופנה subcategory.
  assert.equal(categorize('גולף קניון רמת גן-גמ'), 'קניות')
  assert.equal(subcategorize('קניות', 'גולף קניון רמת גן-גמ'), 'אופנה')
})

test('retag trip-window: latin misc rows near confirmed overseas spend → travel', () => {
  const txns = [
    { 'תאריך': '2026-06-20', 'תיאור': 'SHINSEGAE DEPARTMENT S SEOUL         KR', 'קטגוריה': 'טיסות ותיירות' },
    { 'תאריך': '2026-06-22', 'תיאור': 'CHARM BKK', 'קטגוריה': 'שונות' },
    { 'תאריך': '2026-06-22', 'תיאור': 'שוקי מגי', 'קטגוריה': 'שונות' },   // Hebrew → stays
    { 'תאריך': '2026-07-25', 'תיאור': 'NATIVE', 'קטגוריה': 'שונות' },     // far away → stays
  ]
  const changed = refreshMiscCategories(txns, new Map())
  assert.equal(changed, 1)
  assert.equal(txns[1]['קטגוריה'], 'טיסות ותיירות')
  assert.equal(txns[2]['קטגוריה'], 'שונות')
  assert.equal(txns[3]['קטגוריה'], 'שונות')
})
