"""
Application constants
"""
CATEGORY_ICONS = {
    'מזון וצריכה': '🛒',
    'מסעדות, קפה וברים': '☕',
    'תחבורה ורכבים': '🚗',
    'דלק, חשמל וגז': '⛽',
    'רפואה ובתי מרקחת': '💊',
    'עירייה וממשלה': '🏛️',
    'חשמל ומחשבים': '💻',
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
}

# Keywords in transaction descriptions that indicate check withdrawals (rent)
CHECK_WITHDRAWAL_KEYWORDS = [
    'משיכת שיקים', 'משיכת שיק', 'שיק', 'שיקים', 'צ\'ק', 'צק',
    'המחאה', 'cheque', 'check withdrawal',
]

# Keywords in transaction descriptions that indicate standing orders
STANDING_ORDER_KEYWORDS = [
    'הוראת קבע', 'הו"ק', 'הוק', 'standing order', 'הוראות קבע',
]

# Keywords that indicate a credit-card bill payment in a bank statement.
# When the user uploads BOTH a bank file and a credit-card file, these
# transactions represent the lump-sum payment to the card company and
# should be excluded to avoid double-counting the individual charges.
CREDIT_CARD_PAYMENT_KEYWORDS = [
    'ישראכרט', 'isracard',
    'ויזה', 'visa',
    'כאל', 'cal',
    'לאומי קארד', 'leumi card',
    'מסטרקארד', 'mastercard',
    'דיינרס', 'diners',
    'אמריקן אקספרס', 'אמקס', 'amex', 'american express',
    'מקס', 'max',
]

# ── Auto-categorization: keyword → category ─────────────────────────
# Applied to transactions in "שונות" whose description matches a keyword.
# Order matters: first match wins.  Keywords are matched case-insensitively
# against the transaction description (contains check).
KEYWORD_TO_CATEGORY: dict[str, str] = {}

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    'מזון וצריכה': [
        'שופרסל', 'רמי לוי', 'מגה', 'יוחננוף', 'אושר עד', 'חצי חינם',
        'ויקטורי', 'טיב טעם', 'פרש מרקט', 'סופר', 'מכולת', 'קרפור',
        'שוק', 'פירות', 'ירקות', 'מינימרקט', 'am:pm', 'yellow',
        'קואופ', 'נתיב החסד', 'סטופ מרקט', 'זול ובגדול', 'good pharm',
        'be', 'cofix', 'פארם', 'super-pharm', 'סופר פארם',
    ],
    'מסעדות, קפה וברים': [
        'מסעדה', 'קפה', 'פיצה', 'סושי', 'בורגר', 'שווארמה', 'פלאפל',
        'מקדונלד', "mcdonald", 'דומינו', 'פאפא ג\'ונס', 'ארומה',
        'קפה קפה', 'לנדוור', 'רולדין', 'גרג', 'אספרסו בר',
        'wolt', 'וולט', 'תן ביס', '10bis', 'japanika', 'ג\'פניקה',
        'מושלי', 'shipudei', 'שיפודי', 'cafe', 'restaurant', 'rest',
        'בר', 'פאב', 'beer', 'משקאות',
    ],
    'תחבורה ורכבים': [
        'רב קו', 'רב-קו', 'אגד', 'דן', 'מטרופולין', 'קווים',
        'רכבת', 'israel railways', 'מונית', 'gett', 'yango', 'יאנגו',
        'אוטובוס', 'חניה', 'חנייה', 'פנגו', 'pango', 'cello',
        'סלופארק', 'cellopark', 'אי וויי', 'iway',
        'מוסך', 'garage', 'טסט', 'שמן', 'oil', 'צמיגים',
    ],
    'דלק, חשמל וגז': [
        'דלק', 'סונול', 'פז', 'דור אלון', 'ten', 'אלון',
        'delek', 'sonol', 'fuel', 'חברת חשמל', 'גז',
    ],
    'רפואה ובתי מרקחת': [
        'מכבי', 'כללית', 'מאוחדת', 'לאומית',
        'בית מרקחת', 'pharmacy', 'רופא', 'דוקטור',
        'מרפאה', 'clinic', 'דנטל', 'dental', 'שיניים',
        'אופטיקה', 'optic', 'משקפיים',
    ],
    'עירייה וממשלה': [
        'עירייה', 'ארנונה', 'עיריית', 'משרד', 'רשות',
        'מס הכנסה', 'ביטוח לאומי',
    ],
    'חשמל ומחשבים': [
        'באג', 'bug', 'ksp', 'איביי', 'ebay', 'אמזון', 'amazon',
        'אלי אקספרס', 'aliexpress', 'apple', 'אפל', 'google', 'גוגל',
        'מיקרוסופט', 'microsoft', 'נטפליקס', 'netflix', 'ספוטיפיי',
        'spotify', 'steam', 'playstation', 'xbox',
    ],
    'אופנה': [
        'זארה', 'zara', 'h&m', 'פול אנד בר', 'pull&bear',
        'מנגו', 'mango', 'קסטרו', 'castro', 'גולף', 'golf',
        'פוקס', 'fox', 'אמריקן איגל', 'american eagle',
        'נעלי', 'shoes', 'בגדי',
        'רנואר', 'renuar', 'תמנון', 'shilav', 'שילב',
    ],
    'עיצוב הבית': [
        'איקאה', 'ikea', 'הום סנטר', 'home center', 'ace',
        'אייס', 'מרכז השיפוצים', 'ריהוט',
    ],
    'פנאי, בידור וספורט': [
        'סינמה', 'cinema', 'yes planet', 'סרט', 'הופעה', 'כרטיס',
        'eventim', 'leaan', 'לאן', 'הצגה', 'מופע',
        'חדר כושר', 'gym', 'הולמס פלייס', 'holmes place',
        'ספורט', 'sport',
    ],
    'ביטוח': [
        'ביטוח', 'insurance', 'הראל', 'מגדל', 'כלל', 'הפניקס',
        'מנורה', 'איילון',
    ],
    'שירותי תקשורת': [
        'סלקום', 'cellcom', 'פרטנר', 'partner', 'הוט', 'hot',
        'בזק', 'bezeq', 'פלאפון', 'pelephone', 'גולן', 'golan',
        'רמי', 'we4g', '019', '012', '013', 'אינטרנט', 'internet',
    ],
    'העברת כספים': [
        'העברה', 'transfer', 'העברת', 'paypal', 'פייפאל',
        'bit', 'ביט', 'paybox', 'פייבוקס', 'pepper', 'פפר',
    ],
    'חיות מחמד': [
        'וטרינר', 'vet', 'חיות', 'pet', 'פט',
    ],
    'משיכת מזומן': [
        'משיכת מזומן', 'כספומט', 'atm', 'cash withdrawal', 'מזומן',
    ],
}

# Build flat lookup: keyword (lowercase) → category
for _cat, _keywords in _CATEGORY_KEYWORDS.items():
    for _kw in _keywords:
        KEYWORD_TO_CATEGORY[_kw.lower()] = _cat

def get_icon(category: str) -> str:
    return CATEGORY_ICONS.get(category, '📋')
