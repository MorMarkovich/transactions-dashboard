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

def get_icon(category: str) -> str:
    return CATEGORY_ICONS.get(category, '📋')
