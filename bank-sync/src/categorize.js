// Faithful JS port of the backend keyword categorizer
// (backend/app/core/constants.py + the ordering in data_processor.py /
// routes.py restore_session). No AI here — the dashboard's /restore-session
// still runs the AI fallback + user category rules on top, so anything left as
// 'שונות' is resolved server-side exactly as for an uploaded file.

const CHECK_WITHDRAWAL_KEYWORDS = [
  'משיכת שיקים', 'משיכת שיק', 'שיק', 'שיקים', "צ'ק", 'צק',
  'המחאה', 'cheque', 'check withdrawal',
]

const STANDING_ORDER_KEYWORDS = [
  'הוראת קבע', 'הו"ק', 'הוק', 'standing order', 'הוראות קבע',
]

// keyword → category, in priority order. Mirrors _CATEGORY_KEYWORDS.
const CATEGORY_KEYWORDS = {
  'טיסות ותיירות': [
    'booking', 'airbnb', 'hotels.com', 'expedia', 'tripadvisor',
    'hostel', 'hotel', 'אירביאנבי', 'בוקינג',
    'טיסה', 'טיסות', 'flight', 'airline', 'airways',
    'אל על', 'el al', 'wizz air', 'ryanair', 'easyjet', 'turkish air',
    'lufthansa', 'aegean', 'united airlines', 'british airways',
    'מלון', 'מלונות', 'resort', 'נופש', 'vacation',
    'duty free', 'דיוטי פרי',
    'תיירות', 'tourism', 'travel', 'אטרקציה', 'attraction',
    'דרכון', 'passport', 'visa fee',
    'אגודה', 'agoda', 'kayak', 'skyscanner',
    'הרץ', 'hertz', 'avis rent', 'budget rent', 'סיקסט', 'sixt',
  ],
  'מזון וצריכה': [
    'שופרסל', 'רמי לוי', 'מגה', 'יוחננוף', 'אושר עד', 'חצי חינם',
    'ויקטורי', 'טיב טעם', 'פרש מרקט', 'סופר', 'מכולת', 'קרפור',
    'מינימרקט', 'am:pm',
    'קואופ', 'נתיב החסד', 'סטופ מרקט', 'זול ובגדול',
    'cofix', 'קופיקס', 'סופר פארם', 'super-pharm', 'super pharm',
    'good pharm', 'גוד פארם', 'ניו פארם', 'new pharm',
    'שפע שוק', 'מחסני השוק', 'פרשמרקט',
    'כלבו', 'מרקט',
    'פרי', 'ירק', 'ירקות', 'פירות', 'בית הפרי',
    'ממתק', 'ממתקי', 'מתוק', 'שוקולד', 'חלבי', 'מאפה',
    'בשר', 'עוף', 'דגים', 'קצביה', 'אטליז',
    'grocery',
    'יין', 'wine', 'אלכוהול', 'משקאות',
    'סיבוס', 'cibus', 'תן ביס', 'pluxee', 'פלאקסי',
    'פארם', 'pharm',
  ],
  'מסעדות, קפה וברים': [
    'מסעדה', 'מסעדת', 'קפה ', 'בית קפה', 'פיצה', 'פיצריה',
    'סושי', 'בורגר', 'שווארמה', 'פלאפל', 'חומוס',
    'מקדונלד', 'mcdonald', 'דומינו', 'domino',
    "פאפא ג'ונס", 'papa john',
    'ארומה', 'aroma',
    'קפה קפה', 'cafe cafe', 'לנדוור', 'landwer', 'רולדין', 'roladin',
    'גרג', 'greg', 'אספרסו', 'espresso',
    'wolt', 'וולט',
    '10bis', 'תנביס',
    'japanika', "ג'פניקה",
    'שיפודי', 'shipudei', 'restaurant',
    'starbucks', 'סטארבקס', 'מושלי',
    'עילאי', 'רשי 33',
    'קייטרינג', 'catering',
    'טאקו', 'taco', 'kfc', 'burger king', 'בורגר קינג',
    'subway', 'סאבוויי',
    'שניצל', 'גלידה', 'ice cream', 'בייקרי', 'bakery', 'מאפייה',
    'cafe', 'rest.',
  ],
  'תחבורה ורכבים': [
    'רב קו', 'רב-קו', 'ravkav', 'אגד', 'egged',
    'מטרופולין', 'metropoline', 'קווים', 'kavim',
    'רכבת ישראל', 'israel railways',
    'מונית', 'taxi', 'gett', 'yango', 'יאנגו', 'uber',
    'אוטובוס', 'חניה', 'חנייה', 'parking', 'פנגו', 'pango',
    'סלופארק', 'cellopark', 'cello park',
    'אי וויי', 'iway',
    'מוסך', 'garage', 'צמיגים', 'tires',
    'ביטוח רכב', 'רישוי', 'רישיון רכב', 'אגרה',
    'כביש 6', 'כביש אגרה', 'מנהרות', 'מנהרת', 'tunnel',
    'משלוח', 'שליח', 'delivery',
  ],
  'דלק, חשמל וגז': [
    'דלק', 'תדלוק', 'סונול', 'sonol', 'דור אלון', 'doralon',
    'delek', 'fuel', 'חברת החשמל', 'חשמל',
    'ten דלק',
  ],
  'רפואה ובתי מרקחת': [
    'מכבי', 'כללית', 'מאוחדת', 'לאומית',
    'בית מרקחת', 'pharmacy', 'רוקח',
    'רופא', 'דוקטור', 'doctor', 'dr.',
    'מרפאה', 'מרפאת', 'clinic',
    'דנטל', 'dental', 'שיניים', 'רופא שיניים',
    'אופטיקה', 'optic', 'משקפיים', 'עדשות',
    'פיזיותרפיה', 'physiotherapy', 'כירופרקט',
    'פסיכולוג', 'פסיכיאטר', 'therapist', 'therapy',
    'בית חולים', 'hospital',
    'תרופות', 'medication',
  ],
  'עירייה וממשלה': [
    'עירייה', 'עיריית', 'ארנונה',
    'משרד הפנים', 'משרד הרישוי',
    'רשות האוכלוסין', 'רשות המיסים',
    'מס הכנסה', 'ביטוח לאומי', 'מע"מ',
    'אגרת', 'קנס', 'דוח חניה',
  ],
  'חשמל ומחשבים': [
    'באג מולטי', 'bug multi', 'ksp',
    'איביי', 'ebay', 'אמזון', 'amazon',
    'אלי אקספרס', 'aliexpress', 'ali express',
    'apple', 'אפל', 'google', 'גוגל',
    'מיקרוסופט', 'microsoft',
    'נטפליקס', 'netflix', 'ספוטיפיי', 'spotify',
    'steam', 'playstation', 'xbox', 'nintendo',
    'אייבורי', 'ivory', 'מחשבים',
    'samsung', 'סמסונג', 'dell', 'lenovo',
    'app store', 'חנות אפליקציות',
    'שיאומי', 'xiaomi',
    'youtube', 'יוטיוב', 'disney', 'דיסני',
    'hbo', 'prime video',
  ],
  'אופנה': [
    'זארה', 'zara', 'h&m', 'פול אנד בר', 'pull&bear',
    'מנגו', 'mango', 'קסטרו', 'castro',
    'אמריקן איגל', 'american eagle',
    'נעלי', 'shoes', 'בגדי',
    'רנואר', 'renuar', 'תמנון', 'שילב', 'shilav',
    'טרמינל', 'terminal x', 'אסוס', 'asos',
    'נייקי', 'nike', 'אדידס', 'adidas', 'פומה',
    'סטרדיווריוס', 'stradivarius',
    'ברשקה', 'bershka', 'intimissimi', 'calzedonia',
    'נעליים',
    'פרימדונה', 'primadonna', 'קוסמטיקה', 'cosmetic',
    'איפור', 'makeup', 'בשמים', 'perfume',
    'לורן', 'lauren', 'טומי', 'tommy',
  ],
  'עיצוב הבית': [
    'איקאה', 'ikea', 'הום סנטר', 'home center',
    'ace hardware', 'מרכז השיפוצים', 'ריהוט',
    'עצמל"ה', 'home depot', 'שיפוצים',
    'כלי בית', 'מצעים', 'שטיח', 'וילון',
    'פוקס הום', 'fox home',
    'אלקטרה', 'electra',
  ],
  'פנאי, בידור וספורט': [
    'סינמה', 'cinema', 'סינמה סיטי', 'yes planet',
    'הופעה', 'כרטיסים',
    'eventim', 'לאן', 'leaan', 'הצגה', 'מופע', 'תיאטרון',
    'חדר כושר', 'הולמס פלייס', 'holmes place',
    'ספורט', 'sport', 'כושר',
    'חוג', 'חוגים', 'סדנה', 'workshop',
    'גן חיות', 'zoo',
    'בריכה', 'שחייה', 'swimming',
    'יוגה', 'yoga', 'פילאטיס', 'pilates',
  ],
  'ביטוח': [
    'ביטוח', 'insurance', 'הראל', 'מגדל ביטוח',
    'כלל ביטוח', 'הפניקס', 'מנורה', 'איילון',
    'פוליסה', 'policy',
  ],
  'שירותי תקשורת': [
    'סלקום', 'cellcom', 'פרטנר', 'partner',
    'הוט מובייל', 'hot mobile', 'הוט נט', 'hot net',
    'בזק', 'bezeq', 'פלאפון', 'pelephone',
    'גולן טלקום', 'golan telecom',
    'we4g',
    'סלולר', 'cellular',
    'רמי לוי תקשורת',
  ],
  'העברת כספים': [
    'העברה ל', 'העברת כספים', 'העברה בנקאית',
    'paypal', 'פייפאל',
    'paybox', 'פייבוקס', 'pepper', 'פפר',
    'western union', 'ווסטרן יוניון',
  ],
  'חיות מחמד': [
    'וטרינר', 'veterinary', 'חיות מחמד', 'חיות',
    'פט שופ', 'pet shop', 'pet store',
    'מזון לחיות', 'כלב', 'חתול',
    'אניפט', 'anipet', 'פטלנד', 'petland',
    'תן לחיות',
  ],
  'משיכת מזומן': [
    'משיכת מזומן', 'כספומט', 'atm', 'cash withdrawal', 'מזומן',
    'בנקומט',
  ],
  'חינוך ולימודים': [
    'אוניברסיטה', 'university', 'מכללה', 'college',
    'בית ספר', 'school', 'גן ילדים', 'kindergarten',
    'שכר לימוד', 'tuition', 'קורס', 'course',
    'ספרים', 'books', 'סטימצקי', 'steimatzky',
    'צעצועים', 'toys',
  ],
  'מנויים ושירותים': [
    'מנוי', 'subscription',
    'membership', 'annual fee',
    'דמי ניהול', 'עמלת',
    'google one',
  ],
}

// Short/ambiguous keywords needing word-boundary matching (mirrors _EXACT_WORD_KEYWORDS).
const EXACT_WORD_KEYWORDS = {
  'שירותי תקשורת': ['הוט', 'hot', 'יס'],
  'דלק, חשמל וגז': ['פז', 'ten', 'גז'],
  'מסעדות, קפה וברים': ['בר', 'food', 'פוד'],
  'תחבורה ורכבים': ['דן'],
  'עיצוב הבית': ['ace'],
  'אופנה': ['גולף', 'golf', 'פוקס', 'fox'],
  'העברת כספים': ['ביט', 'bit'],
  'פנאי, בידור וספורט': ['gym', 'פארק', 'park'],
}

// Flatten in insertion order, mirroring the Python dict build (first position
// kept, value overwritten on duplicate key — Map.set behaves identically).
function buildFlat(map) {
  const flat = new Map()
  for (const [cat, kws] of Object.entries(map)) {
    for (const kw of kws) flat.set(kw.toLowerCase().trim(), cat)
  }
  return [...flat.entries()]
}

const KEYWORD_ENTRIES = buildFlat(CATEGORY_KEYWORDS)
const EXACT_ENTRIES = buildFlat(EXACT_WORD_KEYWORDS)

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Word-boundary match using the same delimiters as the backend:
// (?:^|[\s\-/])kw(?:$|[\s\-/])
function boundaryMatch(text, kw) {
  const re = new RegExp(`(?:^|[\\s\\-/])${escapeRegExp(kw)}(?:$|[\\s\\-/])`)
  return re.test(text)
}

/**
 * Categorize a single transaction description, mirroring the backend order:
 *  1. Psagot → investment transfer (override)
 *  2. check-withdrawal keywords → שכר דירה (override)
 *  3. standing-order keywords → הוראות קבע (override)
 *  4. substring keyword map (only if still שונות)
 *  5. word-boundary keyword map (only if still שונות)
 *  6. else שונות
 */
export function categorize(description) {
  const d = String(description || '').toLowerCase()
  let cat = 'שונות'

  if (d.includes('פסגות') || d.includes('psagot')) cat = 'העברה להשקעות'

  for (const kw of CHECK_WITHDRAWAL_KEYWORDS) {
    const k = kw.toLowerCase()
    const hit = k.length <= 3 ? boundaryMatch(d, k) : d.includes(k)
    if (hit) cat = 'שכר דירה'
  }

  for (const kw of STANDING_ORDER_KEYWORDS) {
    if (d.includes(kw.toLowerCase())) cat = 'הוראות קבע'
  }

  if (cat === 'שונות') {
    for (const [kw, c] of KEYWORD_ENTRIES) {
      if (d.includes(kw)) { cat = c; break }
    }
  }
  if (cat === 'שונות') {
    for (const [kw, c] of EXACT_ENTRIES) {
      if (boundaryMatch(d, kw)) { cat = c; break }
    }
  }
  return cat
}

/**
 * Apply user-defined merchant→category overrides (exact description match),
 * mirroring restore_session. `rules` is [{ merchant, category }].
 */
export function applyRules(category, description, ruleMap) {
  if (ruleMap && ruleMap.has(description)) return ruleMap.get(description)
  return category
}
