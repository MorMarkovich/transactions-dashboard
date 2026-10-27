import {test} from 'node:test'
import assert from 'node:assert/strict'
import {categorize, subcategorize, applyRules, buildRuleMap, normalizeMerchant} from '../src/categorize.js'
import {refreshMiscCategories} from '../src/normalize.js'

const cases = [
 ['כיתן גנים פ"ת-גמא', 'קניות', 'דברים לבית'],
 ['מיקה מקס בני ברק', 'קניות', 'דברים לבית'],
 ['MERKAZA ירכא', 'אוכל', 'קניות גדולות'],
 ['MAXIMA LT X 777', 'טיסות ותיירות', ''],
 ['NEW YORKER LIETUVA 0', 'טיסות ותיירות', ''],
 ['MAYA MOBILE LTD', 'טיסות ותיירות', ''],
 ['KSP הלגונה', 'קניות', 'אלקטרוניקה'],
 ['PAYPAL *STEAM', 'טכנולוגיה', ''],
 ['PAYPAL *TEMU', 'קניות', 'קניות אונליין'],
 ['טרקלין חשמל', 'קניות', 'אלקטרוניקה'],
 ['מרפאת חיות', 'סושי', ''],
 ['EXAMPLE SINGAPORE', 'שונות', ''],
 ['חנות הירקון', 'שונות', ''],
 ['GAP SINGAPORE SG', 'טיסות ותיירות', ''],
]
for (const [desc, cat, sub] of cases) test(`accurate catalog: ${desc}`, () => {
 assert.equal(categorize(desc), cat)
 if(sub) assert.equal(subcategorize(cat,desc),sub)
})
test('manual rules beat catalog and newer automatic rules', () => {
 const rules = buildRuleMap([
 {merchant:'PAYPAL *STEAM',category:'קניות',source:'manual'},
 {merchant:'steam',category:'טכנולוגיה',source:'ai',updated_at:'2027'},
 ])
 assert.equal(applyRules(categorize('steam'),'steam',rules),'קניות')
})
test('confirmed trip choices and changing ride references', () => {
 const rules = buildRuleMap(['bolt euo','levi s'].map(merchant => ({merchant,category:'טיסות ותיירות',source:'manual'})))
 for(const desc of ['BOLT EUO2610011234','BOLT EUO2610025678','LEVI S'])
   assert.equal(applyRules(categorize(desc),desc,rules),'טיסות ותיירות')
 assert.equal(normalizeMerchant('BOLT EUO2610025678'),'bolt euo')
})
test('refresh preserves pins and applies same-category manual subcategories', () => {
 const rows = [{תיאור:'שופרסל דיל',קטגוריה:'אוכל',קטגוריה_משנה:'קניות גדולות',סכום:-12},
 {תיאור:'שופרסל דיל',קטגוריה:'בילויים',סכום:-13,_locked:true}]
 const rules = buildRuleMap([{merchant:'שופרסל דיל',category:'אוכל',subcategory:'קניות שבת',source:'manual'}])
 refreshMiscCategories(rows,rules)
 assert.equal(rows[0].קטגוריה_משנה,'קניות שבת')
 assert.equal(rows[1].קטגוריה,'בילויים')
})
