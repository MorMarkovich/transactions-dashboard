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
    'העברה להשקעות': '📈',
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
    'כאל', 'כ.א.ל', 'cal ',
    'לאומי קארד', 'leumi card',
    'מסטרקארד', 'mastercard',
    'דיינרס', 'diners',
    'אמריקן אקספרס', 'אמקס', 'amex', 'american express',
    'מקס ', 'max it',
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
        # ── Supermarkets & grocery ──
        'שופרסל', 'רמי לוי', 'מגה', 'יוחננוף', 'אושר עד', 'חצי חינם',
        'ויקטורי', 'טיב טעם', 'פרש מרקט', 'סופר', 'מכולת', 'קרפור',
        'מינימרקט', 'am:pm',
        'קואופ', 'נתיב החסד', 'סטופ מרקט', 'זול ובגדול',
        'cofix', 'קופיקס', 'סופר פארם', 'super-pharm', 'super pharm',
        'good pharm', 'גוד פארם', 'ניו פארם', 'new pharm',
        'שפע שוק', 'מחסני השוק', 'פרשמרקט',
        'כלבו', 'מרקט',
        # ── Fruit, vegetable, food shops ──
        'פרי', 'ירק', 'ירקות', 'פירות', 'בית הפרי',
        'ממתק', 'ממתקי', 'מתוק', 'שוקולד', 'חלבי', 'מאפה',
        'בשר', 'עוף', 'דגים', 'קצביה', 'אטליז',
        'מכולת', 'מינימרקט', 'grocery',
        'יין', 'wine', 'אלכוהול', 'משקאות',
        # ── Meal vouchers ──
        'סיבוס', 'cibus', 'תן ביס', 'pluxee', 'פלאקסי',
        # ── Pharmacy/health stores ──
        'פארם', 'pharm',
    ],
    'מסעדות, קפה וברים': [
        'מסעדה', 'מסעדת', 'קפה ', 'בית קפה', 'פיצה', 'פיצריה',
        'סושי', 'בורגר', 'שווארמה', 'פלאפל', 'חומוס',
        'מקדונלד', "mcdonald", 'דומינו', "domino",
        'פאפא ג\'ונס', 'papa john',
        'ארומה', 'aroma',
        'קפה קפה', 'cafe cafe', 'לנדוור', 'landwer', 'רולדין', 'roladin',
        'גרג', 'greg', 'אספרסו', 'espresso',
        'wolt', 'וולט',
        '10bis', 'תנביס',
        'japanika', 'ג\'פניקה',
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

# Short/ambiguous keywords that need word-boundary matching.
# These are matched with \b (word boundary) regex to prevent
# false positives like "hot" matching "hotel".
_EXACT_WORD_KEYWORDS: dict[str, list[str]] = {
    'שירותי תקשורת': ['הוט', 'hot', 'יס'],
    'דלק, חשמל וגז': ['פז', 'ten', 'גז'],
    'מסעדות, קפה וברים': ['בר', 'food', 'פוד'],
    'תחבורה ורכבים': ['דן'],
    'עיצוב הבית': ['ace'],
    'אופנה': ['גולף', 'golf', 'פוקס', 'fox'],
    'העברת כספים': ['ביט', 'bit'],
    'פנאי, בידור וספורט': ['gym', 'פארק', 'park'],
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
