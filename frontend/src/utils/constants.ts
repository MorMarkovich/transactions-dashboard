export const CATEGORY_ICONS: Record<string, string> = {
  // ── Shelly's tree (2026-07) ──
  'טיסות ותיירות': '✈️',
  'הוצאות שוטפות': '🏠',
  'תרופות וטיפולים': '💊',
  'פארם': '🧴',
  'בילויים': '🎉',
  'אוכל': '🛒',
  'קניות': '🛍️',
  'טיפוח': '💅',
  'חוגים וספורט': '🏋️',
  'אירועים ומתנות': '🎁',
  'טכנולוגיה': '💻',
  'הוצאות משתנות': '🚗',
  'סושי': '🐾',
  // ── Technical categories the pipeline needs ──
  'העברת כספים': '💸',
  'העברה להשקעות': '📈',
  'משיכת מזומן': '🏧',
  'הוראות קבע': '🔄',
  'שונות': '📦',
  'אחר': '📊',
}

export function get_icon(category: string): string {
  return CATEGORY_ICONS[category] || '📊'
}

// ── Old taxonomy → new taxonomy (mirror of backend constants.py) ──────
// Applied to the user's stored Supabase rules at login (migrateRule) so
// nothing saved under the old names gets deleted by the hygiene pass.
// Pair rules — old category + old subcategory — run first (most specific).
export const CATEGORY_PAIR_MIGRATION: Record<string, [string, string]> = {
  'מזון וצריכה|פארם וטיפוח': ['פארם', ''],
  'מזון וצריכה|חנויות סטוק': ['קניות', 'דברים לבית'],
  'מזון וצריכה|סופרים': ['אוכל', ''],
  'מסעדות, קפה וברים|משלוחי אוכל': ['אוכל', 'משלוחים'],
  'חשמל ומחשבים|סטרימינג': ['הוצאות שוטפות', 'סטרימינג'],
  'חשמל ומחשבים|חנויות חשמל': ['קניות', 'אלקטרוניקה'],
  'חשמל ומחשבים|קניות אונליין': ['קניות', 'קניות אונליין'],
  'חשמל ומחשבים|שירותי ענן': ['טכנולוגיה', 'שירותי ענן'],
  'אופנה|קוסמטיקה': ['טיפוח', ''],
  'אופנה|רשתות אופנה': ['קניות', 'אופנה'],
  'אופנה|נעליים': ['קניות', 'אופנה'],
  'אופנה|תכשיטים ואקססוריז': ['קניות', 'תכשיטים ואקססוריז'],
  'פנאי, בידור וספורט|ספורט וכושר': ['חוגים וספורט', 'ספורט וכושר'],
  'פנאי, בידור וספורט|קולנוע': ['בילויים', 'סרטים'],
  'תחבורה ורכבים|מוסכים וטיפולים': ['הוצאות משתנות', 'טיפולים רכב'],
  'רפואה ובתי מרקחת|טיפול זוגי': ['תרופות וטיפולים', 'טיפולים'],
}

// Plain renames. Subcategory: null = keep the rule's existing subcategory.
export const CATEGORY_MIGRATION: Record<string, [string, string | null]> = {
  'מזון וצריכה': ['אוכל', null],
  'מסעדות, קפה וברים': ['בילויים', null],
  'תחבורה ורכבים': ['הוצאות משתנות', null],
  'דלק, חשמל וגז': ['הוצאות שוטפות', null],
  'רפואה ובתי מרקחת': ['תרופות וטיפולים', null],
  'עירייה וממשלה': ['הוצאות שוטפות', 'ארנונה ועירייה'],
  'חשמל ומחשבים': ['טכנולוגיה', null],
  'בינה מלאכותית': ['טכנולוגיה', 'AI'],
  'אופנה': ['קניות', 'אופנה'],
  'עיצוב הבית': ['קניות', 'דברים לבית'],
  'פנאי, בידור וספורט': ['בילויים', null],
  'ביטוח': ['הוצאות שוטפות', 'ביטוח'],
  'שירותי תקשורת': ['הוצאות שוטפות', null],
  'שכר דירה': ['הוצאות שוטפות', 'שכר דירה'],
  'חינוך ולימודים': ['חוגים וספורט', null],
  'מתנות': ['אירועים ומתנות', null],
  'מנויים ושירותים': ['הוצאות שוטפות', 'מנויים ושירותים'],
  'חיות מחמד': ['סושי', null],
}

export interface RuleLike {
  merchant: string
  category: string
  subcategory?: string | null
}

/**
 * Translate a rule saved under the old taxonomy to the new tree.
 * Returns null when the rule is already in current terms (no write needed).
 */
export function migrateRule(rule: RuleLike): RuleLike | null {
  const cat = (rule.category || '').trim()
  const sub = (rule.subcategory || '').trim()
  const pair = CATEGORY_PAIR_MIGRATION[`${cat}|${sub}`]
  if (pair) {
    return { merchant: rule.merchant, category: pair[0], subcategory: pair[1] || null }
  }
  const plain = CATEGORY_MIGRATION[cat]
  if (plain) {
    return {
      merchant: rule.merchant,
      category: plain[0],
      subcategory: plain[1] !== null ? plain[1] || null : rule.subcategory ?? null,
    }
  }
  return null
}

// Categories a transaction may actually be assigned to. 'אחר' exists in
// CATEGORY_ICONS only as a chart-legend bucket (small slices grouped in the
// pie) — it is NOT a real category, and rules/pickers must never use it.
export const ASSIGNABLE_CATEGORIES: string[] = Object.keys(CATEGORY_ICONS).filter(
  (c) => c !== 'אחר',
)

/**
 * True when a merchant→category rule points at a real catalog category or one
 * of the user's own custom categories (the dynamic taxonomy).
 */
export function isValidRuleCategory(
  category: string | null | undefined,
  customCategories: string[] = [],
): boolean {
  if (!category || category === 'אחר') return false
  return ASSIGNABLE_CATEGORIES.includes(category) || customCategories.includes(category)
}

// Seeded subcategory icons (kept in sync with backend SUBCATEGORY_ICONS).
// The backend /categories/catalog also returns these; this is a UI fallback.
export const SUBCATEGORY_ICONS: Record<string, string> = {
  'טיסות': '✈️', 'בתי מלון': '🏨', 'שופינג': '🛍️',
  'שכר דירה': '🔑', 'ארנונה ועירייה': '🏛️', 'מים': '🚿', 'גז': '🔥',
  'חשמל': '⚡', 'דלק': '⛽', 'סטרימינג': '📺', 'אינטרנט': '🌐',
  'סלולר': '📱', 'ביטוח': '🛡️', 'מנויים ושירותים': '🔁',
  'קופות חולים': '🏥', 'בתי מרקחת': '💊', 'טיפולים': '💞',
  'תרופות': '💊', 'טיפוח': '🧴',
  'בתי קפה': '☕', 'מזון מהיר': '🍔', 'מסעדות וברים': '🍽️',
  'סרטים': '🎬', 'מופעים והופעות': '🎭', 'פיס והימורים': '🎰',
  'אטרקציות': '🎡', 'בילויים עם חברים': '🥂',
  'קניות גדולות': '🛒', 'סופרים קטנים': '🏪', 'משלוחים': '🛵',
  'מאפיות': '🥐', 'קצביות ודגים': '🥩', 'אלכוהול ומשקאות': '🍷',
  'שוברי מזון': '🎫',
  'אלקטרוניקה': '🔌', 'קניות אונליין': '📦', 'אופנה': '👕',
  'תכשיטים ואקססוריז': '💍', 'ריהוט': '🛋️', 'דברים לבית': '🏠',
  'ספורט וכושר': '🏋️', 'לימודים': '📚', 'חוגים': '🎨',
  'AI': '🤖', 'שירותי ענן': '☁️', 'גיימינג': '🎮', 'תוכנה ואפליקציות': '💿',
  'טיפולים רכב': '🔧', 'כבישי אגרה': '🛣️', 'חניונים': '🅿️',
  'תחבורה ציבורית': '🚌', 'מוניות ונסיעות': '🚕',
  'וטרינרית וטיפולים': '🩺', 'אוכל וחטיפים': '🦴',
}

export function get_subcategory_icon(subcategory: string): string {
  return SUBCATEGORY_ICONS[subcategory] || '🏷️'
}
