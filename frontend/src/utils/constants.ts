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
  'מנויים ושירותים': '🔁',
  'אחר': '📊',
}

export function get_icon(category: string): string {
  return CATEGORY_ICONS[category] || '📊'
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
