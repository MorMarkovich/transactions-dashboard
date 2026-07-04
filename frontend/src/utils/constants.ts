export const CATEGORY_ICONS: Record<string, string> = {
  'מזון וצריכה': '🛒',
  'מסעדות, קפה וברים': '☕',
  'תחבורה ורכבים': '🚗',
  'דלק, חשמל וגז': '⛽',
  'רפואה ובתי מרקחת': '💊',
  'עירייה וממשלה': '🏛️',
  'חשמל ומחשבים': '💻',
  'בינה מלאכותית': '🤖',
  'אופנה': '👔',
  'עיצוב הבית': '🏠',
  'פנאי, בידור וספורט': '🎬',
  'ביטוח': '🛡️',
  'שירותי תקשורת': '📱',
  'העברת כספים': '💸',
  'חיות מחמד': '🐕',
  'שונות': '📦',
  'משיכת מזומן': '🏧',
  'שכר דירה': '🔑',
  'הוראות קבע': '🔄',
  'טיסות ותיירות': '✈️',
  'חינוך ולימודים': '📚',
  'מתנות': '🎁',
  'מנויים ושירותים': '🔁',
  'אחר': '📊',
}

export function get_icon(category: string): string {
  return CATEGORY_ICONS[category] || '📊'
}

// Categories a transaction may actually be assigned to. 'אחר' exists in
// CATEGORY_ICONS only as a chart-legend bucket (small slices grouped in the
// pie) — it is NOT a real category, and rules/pickers must never use it.
export const ASSIGNABLE_CATEGORIES: string[] = Object.keys(CATEGORY_ICONS).filter(
  (c) => c !== 'אחר',
)

/** True when a merchant→category rule points at a real catalog category. */
export function isValidRuleCategory(category: string | null | undefined): boolean {
  return !!category && ASSIGNABLE_CATEGORIES.includes(category)
}

// Seeded subcategory icons (kept in sync with backend SUBCATEGORY_ICONS).
// The backend /categories/catalog also returns these; this is a UI fallback.
export const SUBCATEGORY_ICONS: Record<string, string> = {
  'מאפיות': '🥐',
  'קצביות ודגים': '🥩',
  'אלכוהול ומשקאות': '🍷',
  'שוברי מזון': '🎫',
  'קולנוע': '🎬',
  'מופעים והופעות': '🎭',
  'ספורט וכושר': '🏋️',
  'אטרקציות': '🎡',
}

export function get_subcategory_icon(subcategory: string): string {
  return SUBCATEGORY_ICONS[subcategory] || '🏷️'
}
