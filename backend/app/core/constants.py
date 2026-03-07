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
    'טיסות ותיירות': '✈️',
    'חינוך ולימודים': '📚',
    'מנויים ושירותים': '🔁',
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
# Order matters within a category; first match wins across categories.
# Keywords are matched case-insensitively via substring (str.contains).
#
# IMPORTANT: Short/ambiguous keywords are stored separately in
# _EXACT_WORD_KEYWORDS and matched with word-boundary regex to avoid
# false positives (e.g. "hot" matching "hotel").
KEYWORD_TO_CATEGORY: dict[str, str] = {}
# Keywords that need word-boundary matching (short or ambiguous)
EXACT_WORD_KEYWORDS: dict[str, str] = {}

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    # ── Travel & Tourism (checked BEFORE telecom to catch "booking hotel") ──
    'טיסות ותיירות': [
        'booking', 'airbnb', 'hotels.com', 'expedia', 'tripadvisor',
        'hostel', 'hotel', 'אירביאנבי', 'בוקינג',
        'טיסה', 'טיסות', 'flight', 'airline', 'airways',
        'אל על', 'el al', 'wizz air', 'ryanair', 'easyjet', 'turkish',
        'lufthansa', 'aegean', 'united airlines', 'british airways',
        'מלון', 'מלונות', 'resort', 'נופש', 'vacation',
        'duty free', 'דיוטי פרי',
        'תיירות', 'tourism', 'travel', 'אטרקציה', 'attraction',
        'דרכון', 'passport', 'visa fee',
        'אגודה', 'agoda', 'kayak', 'skyscanner',
        'הרץ', 'hertz', 'avis', 'budget rent', 'סיקסט', 'sixt',
    ],
    'מזון וצריכה': [
        'שופרסל', 'רמי לוי', 'מגה', 'יוחננוף', 'אושר עד', 'חצי חינם',
        'ויקטורי', 'טיב טעם', 'פרש מרקט', 'סופר מרקט', 'מכולת', 'קרפור',
        'פירות וירקות', 'מינימרקט', 'am:pm',
        'קואופ', 'נתיב החסד', 'סטופ מרקט', 'זול ובגדול',
        'cofix', 'קופיקס', 'סופר פארם', 'super-pharm', 'super pharm',
        'good pharm', 'גוד פארם', 'ניו פארם', 'new pharm',
        'yellow', 'ילו',
        'שפע שוק', 'מחסני השוק', 'חצי חינם', 'פרשמרקט',
        'משקאות', 'כלבו', 'מרקט',
    ],
    'מסעדות, קפה וברים': [
        'מסעדה', 'מסעדת', 'קפה ', 'בית קפה', 'פיצה', 'פיצריה',
        'סושי', 'בורגר', 'שווארמה', 'פלאפל', 'חומוס',
        'מקדונלד', "mcdonald's", 'מקדונלדס', 'דומינוס', "domino's",
        'פאפא ג\'ונס', 'ארומה', 'aroma',
        'קפה קפה', 'cafe cafe', 'לנדוור', 'landwer', 'רולדין', 'roladin',
        'גרג', 'greg', 'אספרסו בר', 'espresso bar',
        'wolt', 'וולט', 'תן ביס', '10bis', 'תנביס',
        'japanika', 'ג\'פניקה', 'ג\'פניקה',
        'שיפודי', 'shipudei', 'restaurant',
        'starbucks', 'סטארבקס', 'מושלי',
        'food', 'פוד', 'קייטרינג', 'catering',
        'טאקו', 'taco', 'kfc', 'burger king', 'בורגר קינג',
        'subway', 'סאבוויי', 'papa john',
        'שניצל', 'גלידה', 'ice cream', 'בייקרי', 'bakery', 'מאפייה',
    ],
    'תחבורה ורכבים': [
        'רב קו', 'רב-קו', 'ravkav', 'אגד', 'egged',
        'מטרופולין', 'metropoline', 'קווים', 'kavim',
        'רכבת ישראל', 'israel railways',
        'מונית', 'taxi', 'gett', 'yango', 'יאנגו', 'uber',
        'אוטובוס', 'חניה', 'חנייה', 'parking', 'פנגו', 'pango',
        'סלופארק', 'cellopark', 'cello park',
        'אי וויי', 'iway',
        'מוסך', 'garage', 'טסט', 'צמיגים', 'tires',
        'ביטוח רכב', 'רישוי', 'רישיון רכב', 'אגרה',
        'שלט רחוק', 'כביש 6', 'כביש אגרה',
        'דואר שליחויות', 'משלוח', 'delivery',
    ],
    'דלק, חשמל וגז': [
        'דלק', 'תדלוק', 'סונול', 'sonol', 'פז ', 'דור אלון', 'doralon',
        'delek', 'fuel', 'חברת החשמל', 'גז ',
        'ten דלק', 'yellow דלק',
    ],
    'רפואה ובתי מרקחת': [
        'מכבי', 'כללית', 'מאוחדת', 'לאומית',
        'בית מרקחת', 'pharmacy', 'רוקח', 'פארמסי',
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
        'באג', 'bug multistore', 'ksp',
        'איביי', 'ebay', 'אמזון', 'amazon',
        'אלי אקספרס', 'aliexpress', 'ali express',
        'apple', 'אפל', 'google play', 'גוגל פליי',
        'מיקרוסופט', 'microsoft',
        'נטפליקס', 'netflix', 'ספוטיפיי', 'spotify',
        'steam', 'playstation', 'xbox', 'nintendo',
        'אייבורי', 'ivory', 'מחשבים',
        'samsung', 'סמסונג', 'dell', 'lenovo',
        'חנות אפליקציות', 'app store',
        'שיאומי', 'xiaomi',
    ],
    'אופנה': [
        'זארה', 'zara', 'h&m', 'פול אנד בר', 'pull&bear',
        'מנגו', 'mango', 'קסטרו', 'castro', 'גולף ', 'golf ',
        'פוקס', 'fox ', 'אמריקן איגל', 'american eagle',
        'נעלי', 'shoes', 'בגדי',
        'רנואר', 'renuar', 'תמנון', 'שילב', 'shilav',
        'טרמינל', 'terminal x', 'אסוס', 'asos',
        'נייקי', 'nike', 'אדידס', 'adidas', 'puma', 'פומה',
        'הודיס', 'hoodies', 'סטרדיווריוס', 'stradivarius',
        'ברשקה', 'bershka', 'intimissimi', 'calzedonia',
        'delta', 'דלתא', 'נעליים',
    ],
    'עיצוב הבית': [
        'איקאה', 'ikea', 'הום סנטר', 'home center',
        'אייס', 'ace hardware', 'מרכז השיפוצים', 'ריהוט',
        'עצמל"ה', 'home depot', 'שיפוצים',
        'כלי בית', 'מצעים', 'שטיח', 'וילון',
        'פוקס הום', 'fox home', 'הום', 'home ',
        'ניקיון', 'cleaning', 'אלקטרה', 'electra',
    ],
    'פנאי, בידור וספורט': [
        'סינמה', 'cinema', 'סינמה סיטי', 'yes planet',
        'סרט', 'הופעה', 'כרטיס', 'כרטיסים',
        'eventim', 'לאן', 'leaan', 'הצגה', 'מופע', 'תיאטרון',
        'חדר כושר', 'gym ', 'הולמס פלייס', 'holmes place',
        'ספורט', 'sport', 'כושר',
        'חוג', 'חוגים', 'סדנה', 'workshop',
        'פארק', 'park', 'גן חיות', 'zoo',
        'בריכה', 'pool', 'שחייה', 'swimming',
        'יוגה', 'yoga', 'פילאטיס', 'pilates',
    ],
    'ביטוח': [
        'ביטוח', 'insurance', 'הראל', 'מגדל ביטוח',
        'כלל ביטוח', 'הפניקס', 'מנורה', 'איילון',
        'פוליסה', 'policy', 'ביטוח בריאות', 'ביטוח חיים',
        'ביטוח דירה', 'ביטוח נסיעות',
    ],
    'שירותי תקשורת': [
        'סלקום', 'cellcom', 'פרטנר', 'partner',
        'הוט מובייל', 'hot mobile', 'הוט נט', 'hot net',
        'בזק', 'bezeq', 'פלאפון', 'pelephone',
        'גולן טלקום', 'golan telecom',
        'we4g', '019 ', '012 ', '013 ',
        'אינטרנט', 'סלולר', 'cellular', 'mobile',
        'טלפון', 'phone',
        'yes ', 'יס ', 'רמי לוי תקשורת',
    ],
    'העברת כספים': [
        'העברה ל', 'העברת כספים', 'העברה בנקאית',
        'transfer', 'paypal', 'פייפאל',
        'ביט ', 'bit ', 'paybox', 'פייבוקס', 'pepper', 'פפר',
        'western union', 'ווסטרן יוניון',
    ],
    'חיות מחמד': [
        'וטרינר', 'veterinary', 'חיות מחמד',
        'פט שופ', 'pet shop', 'pet store',
        'מזון לחיות', 'כלב', 'חתול',
    ],
    'משיכת מזומן': [
        'משיכת מזומן', 'כספומט', 'atm', 'cash withdrawal', 'מזומן',
        'משיכה', 'בנקומט',
    ],
    'חינוך ולימודים': [
        'אוניברסיטה', 'university', 'מכללה', 'college',
        'בית ספר', 'school', 'גן ילדים', 'kindergarten',
        'שכר לימוד', 'tuition', 'קורס', 'course',
        'ספרים', 'books', 'סטימצקי', 'steimatzky',
        'צעצועים', 'toys', 'משחקים',
    ],
    'מנויים ושירותים': [
        'מנוי', 'subscription', 'חברות',
        'membership', 'annual fee', 'עמלה',
        'דמי ניהול', 'עמלת',
    ],
}

# Short/ambiguous keywords that need word-boundary matching.
# These are matched with \b (word boundary) regex to prevent
# false positives like "hot" matching "hotel".
_EXACT_WORD_KEYWORDS: dict[str, list[str]] = {
    'שירותי תקשורת': ['הוט', 'hot', 'יס'],
    'דלק, חשמל וגז': ['פז', 'ten'],
    'מסעדות, קפה וברים': ['בר'],
    'תחבורה ורכבים': ['דן'],
    'עיצוב הבית': ['ace'],
}

# Build flat lookup: keyword (lowercase) → category
for _cat, _keywords in _CATEGORY_KEYWORDS.items():
    for _kw in _keywords:
        KEYWORD_TO_CATEGORY[_kw.lower().strip()] = _cat

# Build exact-word lookup
for _cat, _keywords in _EXACT_WORD_KEYWORDS.items():
    for _kw in _keywords:
        EXACT_WORD_KEYWORDS[_kw.lower()] = _cat


def get_icon(category: str) -> str:
    return CATEGORY_ICONS.get(category, '📋')
