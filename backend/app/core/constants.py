"""
Application constants — the category taxonomy.

The tree below is Shelly's curated taxonomy (2026-07): 13 real-life categories
plus a handful of technical ones the pipeline itself needs. The OLD taxonomy
(24 categories) is still spoken by existing Supabase snapshots and rules —
CATEGORY_MIGRATION / CATEGORY_PAIR_MIGRATION translate old names on the fly
(restore + rule loading), so nothing stored ever breaks.
"""
from typing import Optional

CATEGORY_ICONS = {
    # ── Shelly's tree ──
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
    'סושי': '🐾',  # the pet — vet, food & treats
    # ── Technical categories the pipeline needs ──
    'העברת כספים': '💸',
    'העברה להשקעות': '📈',
    'משיכת מזומן': '🏧',
    'הוראות קבע': '🔄',
    'שונות': '📦',
}

# ── Old taxonomy → new taxonomy ─────────────────────────────────────
# Existing Supabase snapshots, user rules and transaction pins still carry the
# pre-2026-07 category names. These maps are applied BEFORE hygiene/catalog in
# restore (and by the frontend to the stored rules themselves), so old data
# flows seamlessly into the new tree and nothing is reset to שונות or deleted.
#
# Pair rules — (old_category, old_subcategory) — run FIRST (most specific):
# they route rows whose old subcategory moves to a different new parent.
CATEGORY_PAIR_MIGRATION: dict[tuple[str, str], tuple[str, str]] = {
    ('מזון וצריכה', 'פארם וטיפוח'): ('פארם', ''),
    ('מזון וצריכה', 'חנויות סטוק'): ('קניות', 'דברים לבית'),
    ('מזון וצריכה', 'סופרים'): ('אוכל', ''),  # re-seeded into גדולות/קטנים
    ('מסעדות, קפה וברים', 'משלוחי אוכל'): ('אוכל', 'משלוחים'),
    ('חשמל ומחשבים', 'סטרימינג'): ('הוצאות שוטפות', 'סטרימינג'),
    ('חשמל ומחשבים', 'חנויות חשמל'): ('קניות', 'אלקטרוניקה'),
    ('חשמל ומחשבים', 'קניות אונליין'): ('קניות', 'קניות אונליין'),
    ('חשמל ומחשבים', 'שירותי ענן'): ('טכנולוגיה', 'שירותי ענן'),
    ('אופנה', 'קוסמטיקה'): ('טיפוח', ''),
    ('אופנה', 'רשתות אופנה'): ('קניות', 'אופנה'),
    ('אופנה', 'נעליים'): ('קניות', 'אופנה'),
    ('אופנה', 'תכשיטים ואקססוריז'): ('קניות', 'תכשיטים ואקססוריז'),
    ('פנאי, בידור וספורט', 'ספורט וכושר'): ('חוגים וספורט', 'ספורט וכושר'),
    ('פנאי, בידור וספורט', 'קולנוע'): ('בילויים', 'סרטים'),
    ('תחבורה ורכבים', 'מוסכים וטיפולים'): ('הוצאות משתנות', 'טיפולים רכב'),
    ('רפואה ובתי מרקחת', 'טיפול זוגי'): ('תרופות וטיפולים', 'טיפולים'),
}
# Plain renames. Subcategory value: None = keep the row's existing subcategory
# (its name survives under the new parent, e.g. מאפיות); a string = set it.
CATEGORY_MIGRATION: dict[str, tuple[str, Optional[str]]] = {
    'מזון וצריכה': ('אוכל', None),
    'מסעדות, קפה וברים': ('בילויים', None),
    'תחבורה ורכבים': ('הוצאות משתנות', None),
    'דלק, חשמל וגז': ('הוצאות שוטפות', None),
    'רפואה ובתי מרקחת': ('תרופות וטיפולים', None),
    'עירייה וממשלה': ('הוצאות שוטפות', 'ארנונה ועירייה'),
    'חשמל ומחשבים': ('טכנולוגיה', None),
    'בינה מלאכותית': ('טכנולוגיה', 'AI'),
    'אופנה': ('קניות', 'אופנה'),
    'עיצוב הבית': ('קניות', 'דברים לבית'),
    'פנאי, בידור וספורט': ('בילויים', None),
    'ביטוח': ('הוצאות שוטפות', 'ביטוח'),
    'שירותי תקשורת': ('הוצאות שוטפות', None),
    'שכר דירה': ('הוצאות שוטפות', 'שכר דירה'),
    'חינוך ולימודים': ('חוגים וספורט', None),
    'מתנות': ('אירועים ומתנות', None),
    'מנויים ושירותים': ('הוצאות שוטפות', 'מנויים ושירותים'),
    'חיות מחמד': ('סושי', None),
}


def migrate_category(category, subcategory=None) -> tuple[str, Optional[str]]:
    """Translate an old-taxonomy (category, subcategory) to the new tree.

    Returns (new_category, new_subcategory) where new_subcategory None means
    "leave the row's subcategory as it is". Current-taxonomy names pass
    through unchanged.
    """
    cat = str(category or '').strip()
    sub = str(subcategory or '').strip()
    if (cat, sub) in CATEGORY_PAIR_MIGRATION:
        return CATEGORY_PAIR_MIGRATION[(cat, sub)]
    if cat in CATEGORY_MIGRATION:
        return CATEGORY_MIGRATION[cat]
    return cat, None

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
# Keywords are matched case-insensitively via substring (str.contains).
#
# IMPORTANT: Short/ambiguous keywords are stored separately in
# _EXACT_WORD_KEYWORDS and matched with word-boundary regex to avoid
# false positives (e.g. "hot" matching "hotel").
KEYWORD_TO_CATEGORY: dict[str, str] = {}
# Keywords that need word-boundary matching (short or ambiguous)
EXACT_WORD_KEYWORDS: dict[str, str] = {}

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    # ── Travel & Tourism ──
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
        # ── Israeli travel agencies & airlines ──
        'איסתא', 'issta', 'אופיר טורס', 'ophir tours', 'דיזנהויז', 'גוליבר',
        'ארקיע', 'arkia', 'ישראייר', 'israir', 'wizzair', 'pegasus',
        'דקה 90', 'eldan', 'אלדן', 'lastminute',
        'fattal', 'פתאל', 'isrotel', 'ישרוטל', 'דן פנורמה', 'לאונרדו',
        'leonardo', 'club hotel', 'קלאב הוטל', 'הרברט סמואל', 'רימונים',
        'צימר', 'zimmer', 'אכסניה', 'אכסניית', 'trip.com', 'getyourguide',
        'rentalcars', 'נסיעות לחו"ל', 'חבילת נופש', 'בתי מלון',
        'קווי חופשה', 'airbaltic', 'air baltic', 'ניו ויז\'ן טורס',
        'elal', 'אייר חיפה', 'air haifa', 'etihad', 'airalo',
        'double tree', 'doubletree', 'hilton', 'kohchang', 'koh chang',
        'railninja', 'rail ninja', 'rajadha', 'olive young', 'lottebaikhoajeom',
    ],
    # ── Groceries & food shopping (was מזון וצריכה; delivery moved in) ──
    'אוכל': [
        # פרימדונה = the Ramat Gan fresh supermarket (the Italian lingerie
        # brand bills as latin 'primadonna', kept under קניות).
        'פרימדונה',
        # ── Supermarkets & grocery ──
        'שופרסל', 'רמי לוי', 'מגה', 'יוחננוף', 'אושר עד', 'חצי חינם',
        'ויקטורי', 'טיב טעם', 'פרש מרקט', 'סופר', 'מכולת', 'קרפור',
        'מינימרקט', 'am:pm',
        'קואופ', 'נתיב החסד', 'סטופ מרקט', 'זול ובגדול',
        'שפע שוק', 'מחסני השוק', 'פרשמרקט',
        'כלבו', 'מרקט',
        # ── Fruit, vegetable, food shops ──
        'פרי', 'ירק', 'ירקות', 'פירות', 'בית הפרי',
        'ממתק', 'ממתקי', 'מתוק', 'שוקולד', 'חלבי', 'מאפה',
        'בשר', 'עוף', 'דגים', 'קצביה', 'אטליז',
        'grocery',
        'יין', 'wine', 'אלכוהול', 'משקאות',
        # ── Meal vouchers ──
        'סיבוס', 'cibus', 'תן ביס', 'pluxee', 'פלאקסי',
        # ── Food delivery (Shelly: משלוחים are groceries-side, not dining) ──
        'wolt', 'וולט', '10bis', 'תנביס',
        'משלוחה', 'משלוחים', 'משלוח', 'הזמנת אוכל', 'delivery',
        # ── More Israeli supermarket / grocery chains ──
        'shufersal', 'rami levy', 'osher ad', 'יינות ביתן',
        'סופרמרקט', 'מרכול', 'יש חסד', 'יש בשכונה', 'ברכל', 'קינג סטור',
        'מחסני מזון', 'סופר יהודה', 'סופר דוש', 'מעדניה', 'מאפיית', 'מאפיה',
        'קצביית', 'דברי מאפה', 'יקב', 'גבינות',
        # Bakeries & patisseries in ALL spelling variants — 'קונדטוריה' (no
        # yod, as card descriptors often misspell it) must land here too,
        # never in בילויים.
        'בייקרי', 'bakery', 'מאפייה', 'קונדיטוריה', 'קונדטוריה',
        'קונדיטורית', 'פטיסרי', 'קרואסון',
        'שוק העיר', 'שוק מהדרין', 'תנובה', 'שטראוס', 'יטבתה',
        'ביכורי השדה', 'סלסלת', '7-eleven', '7 eleven', '7-11',
        'פיצוצי', 'פיצוצייה', 'פיצוציה', 'קיוסק',
    ],
    # ── Dining, cafes, bars + entertainment (was מסעדות + most of פנאי) ──
    'בילויים': [
        'מסעדה', 'מסעדת', 'קפה ', 'בית קפה', 'פיצה', 'פיצריה',
        'סושי', 'בורגר', 'שווארמה', 'פלאפל', 'חומוס',
        'מקדונלד', "mcdonald", 'דומינו', "domino",
        'פאפא ג\'ונס', 'papa john',
        'ארומה', 'aroma', 'cofix', 'קופיקס',
        'קפה קפה', 'cafe cafe', 'לנדוור', 'landwer', 'רולדין', 'roladin',
        'גרג', 'greg', 'אספרסו', 'espresso',
        'japanika', 'ג\'פניקה',
        'שיפודי', 'shipudei', 'restaurant',
        'starbucks', 'סטארבקס', 'מושלי',
        'עילאי', 'רשי 33',
        'קייטרינג', 'catering',
        'טאקו', 'taco', 'kfc', 'burger king', 'בורגר קינג',
        'subway', 'סאבוויי',
        'שניצל', 'גלידה', 'ice cream',
        'cafe', 'rest.',
        # ── More restaurants, cafes, bars ──
        'מזנון', 'ביסטרו', 'bistro', 'בראסרי', 'גריל', 'grill', 'טאבון',
        'pub', 'פאב', 'בירה', 'beer',
        'פיצה האט', 'pizza hut', 'בנדיקט', 'benedict', 'מוזס', 'moses',
        'אגאדיר', 'agadir', 'הומבורגר', 'גולדה', 'goldas', 'אניטה', 'anita',
        'מקס ברנר', 'max brenner', 'גירף', 'giraffe', 'טוני וספה',
        'בורגרים', 'הבורגר', 'שייקסבורגר', 'black bar',
        'בייגל', 'bagel', 'דונאטס', 'donut',
        'cup o joe', 'ארקפה', 'arcaffe', 'נספרסו', 'nespresso',
        'קפה לואיז', 'ולנטינה', 'casa',
        'מקדונלדס', 'שקשוקה', 'קינוח', 'קינוחים',
        'kermeet', 'קרמיט', 'המאסטרו', 'rosso vino',
        # ── Cinema, shows, attractions, gambling (from old פנאי) ──
        'סינמה', 'cinema', 'סינמה סיטי', 'yes planet',
        'הופעה', 'כרטיסים',
        'eventim', 'לאן', 'leaan', 'הצגה', 'מופע', 'תיאטרון',
        'גן חיות', 'zoo',
        'יס פלאנט', 'רב חן', 'רב-חן', 'גלובוס מקס', 'לב סינמה', 'סינמטק',
        'מוזיאון', 'museum', 'ספארי', 'safari', 'לונה פארק', 'סופרלנד',
        'גימבורי', 'gymboree', 'משחקייה', 'אסקייפ', 'חדר בריחה', 'באולינג',
        'bowling', 'קרטינג', 'karting', 'פיינטבול', 'לייזר טאג', 'סקייט',
        'טוטו', 'winner', 'ווינר', 'מפעל הפיס', 'pais',
        'זאפה', 'zappa', 'ברבי', 'barby', 'בלוק', 'האנגר', 'hangar',
        'הבימה', 'הקאמרי', 'בית ליסין', 'תיאטרון גשר', 'צוותא', 'היכל התרבות',
        'בלאק בוקס', 'קולנוע', 'מובילנד',
    ],
    # ── Recurring transport spend (was תחבורה ורכבים) ──
    'הוצאות משתנות': [
        'רב קו', 'רב-קו', 'ravkav', 'אגד', 'egged',
        'מטרופולין', 'metropoline', 'קווים', 'kavim',
        'רכבת ישראל', 'israel railways',
        'מונית', 'taxi', 'gett', 'yango', 'יאנגו', 'uber',
        'אוטובוס', 'חניה', 'חנייה', 'parking', 'פנגו', 'pango',
        'סלופארק', 'cellopark', 'cello park',
        'אי וויי', 'iway',
        'מוסך', 'מוסכים', 'מוסכי', 'garage', 'צמיגים', 'tires',
        'רישוי', 'רישיון רכב', 'אגרה',
        'כביש 6', 'כביש אגרה', 'מנהרות', 'מנהרת', 'tunnel',
        # ── More transport, parking, car services ──
        'רכבת קלה', 'הרכבת הקלה', 'מטרונית', 'דן באב',
        'autotel', 'אוטוטל', 'car2go', 'sharenow', 'באבל דן',
        'אחוזת חוף', 'חניון', 'parking lot',
        'שטיפת רכב', 'רחיצת', 'car wash', 'מכונאי', 'פנצ\'ר', 'גרר',
        'מצבר', 'חלפים', 'מכון רישוי', 'בדיקת רכב', 'ליסינג',
        'leasing', 'אלבר', 'albar', 'קל אוטו', 'אוויס רנט',
        'אלדן רכב', 'ניו קופל', 'קרית הרכב', 'קריית הרכב', 'מרכז הרכב',
        'תחבורה', 'רב-פס', 'רב פס', 'ווואש', 'woosh',
    ],
    # ── Household running costs: utilities, rent, telecom, insurance,
    #    streaming, fuel, subscriptions (merges 6 old categories) ──
    'הוצאות שוטפות': [
        # fuel & utilities (was דלק, חשמל וגז)
        'דלק', 'תדלוק', 'סונול', 'sonol', 'דור אלון', 'doralon',
        'delek', 'fuel', 'חברת החשמל', 'חשמל',
        'ten דלק',
        'paz', 'yellow', 'מנטה', 'menta', 'אלונית', 'alonit',
        'תחנת דלק', 'דלקן', 'pazomat', 'פזומט',
        'סופרגז', 'supergas', 'אמישראגז', 'amisragas', 'פזגז', 'דורגז',
        'אמ.ש.ר.ג', 'בלוני גז', 'תאגיד החשמל',
        'דור-ארגמן', 'דור ארגמן', 'דור-האיצטדיון', 'דור -האיצטדיון',
        # municipal & government (was עירייה וממשלה)
        'עירייה', 'עיריית', 'עירית', 'ארנונה',
        'משרד הפנים', 'משרד הרישוי',
        'רשות האוכלוסין', 'רשות המיסים',
        'מס הכנסה', 'ביטוח לאומי', 'מע"מ',
        'אגרת', 'קנס', 'דוח חניה',
        'מועצה אזורית', 'מועצה מקומית', 'תאגיד מים', 'מי אביבים',
        'הגיחון', 'מי שבע', 'מי רעננה', 'מי נע', 'מים וביוב', 'מי כרמל',
        'מי רמת גן', 'מי לוד', 'מי ציונה', 'מי גליל', 'מי הרצליה',
        'מי מודיעין', 'מי בית שמש', 'מי נתניה', 'מי אונו', 'פלגי מוצקין',
        'דואר ישראל', 'דואר', 'רשות מקרקעי', 'טאבו', 'הוצאה לפועל',
        'בתי המשפט', 'משטרת ישראל', 'אגף הגביה', 'היטל', 'אגרות', 'מילגם',
        'מס במקור', 'ניכוי במקור', 'תשלום מס',
        # insurance & pension (was ביטוח)
        'ביטוח', 'insurance', 'מגדל ביטוח', 'ביטוח רכב',
        'כלל ביטוח', 'הפניקס', 'פוליסה', 'policy',
        'איילון חב', 'איילון ביטוח', 'ביטוח איילון', 'איילון פנסיה',
        'הראל ביטוח', 'הראל פנסיה', 'הראל השקעות', 'מנורה מבטחים',
        'הכשרה ביטוח', 'ביטוח ישיר', 'ביטוח חקלאי', 'שירביט', 'shirbit',
        'ליברה', 'libra', 'wobi', 'וובי', '9 מיליון', 'aig', 'איי איי ג\'י',
        'פספורטכרד', 'passportcard', 'דייויד שילד', 'davidshield',
        'קצין הביטוח', 'דמי ביטוח', 'גמל', 'פנסיה', 'השתלמות',
        # telecom & internet (was שירותי תקשורת)
        'סלקום', 'cellcom', 'פרטנר', 'partner',
        'הוט מובייל', 'hot mobile', 'הוט נט', 'hot net',
        'בזק', 'bezeq', 'פלאפון', 'pelephone',
        'גולן טלקום', 'golan telecom',
        'we4g',
        'סלולר', 'cellular',
        'רמי לוי תקשורת',
        '012', '013', '014', '019', 'נטוויז\'ן', 'netvision',
        'triple c', 'אינטרנט רימון', 'fiber', 'סיבים', 'פרי tv',
        'free telecom', 'הוט טלקום', 'partner tv', 'yes tv',
        # rent
        'שכר דירה', 'שכירות',
        # streaming (was under חשמל ומחשבים)
        'נטפליקס', 'netflix', 'ספוטיפיי', 'spotify',
        'youtube', 'יוטיוב', 'disney', 'דיסני',
        'hbo', 'prime video', 'paramount', 'פרמאונט', 'apple tv',
        'audible', 'kindle', 'televizo', 'iptv',
        # subscriptions & service fees (was מנויים ושירותים)
        'מנוי', 'subscription',
        'membership', 'annual fee',
        'דמי ניהול', 'עמלת',
        'דמי כרטיס', 'דמי חבר', 'דמי שירות', 'דמי טיפול', 'patreon',
        'פטראון', 'substack', 'linkedin', 'לינקדאין', 'zoom', 'amazon prime',
        'דמי מנוי', 'חידוש מנוי',
    ],
    # ── Medicine & treatments (was רפואה ובתי מרקחת; pharm chains → פארם) ──
    'תרופות וטיפולים': [
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
        'אסותא', 'assuta', 'הרצליה מדיקל', 'איכילוב', 'תל השומר', 'שיבא',
        'רמב"ם', 'סורוקה', 'הדסה', 'בלינסון', 'וולפסון',
        'טרם', 'terem', 'ביקור רופא', 'מוקד רופאים', 'נטלי', 'natali',
        'שח"ל', 'femi', 'פמי', 'מעבדה', 'מעבדות', 'בדיקות דם',
        'אופטיקנה', 'אופטיק', 'הלפרין', 'ירדן אופטיק', 'erroca',
        'ארוקה', 'אורטופד', 'אורתודונט', 'שתל שיניים', 'יישור שיניים',
        'דיאטנית', 'תזונאי', 'נטורופת', 'הומאופת', 'קוסמטיקה רפואית', 'מדיקל',
        'l.b.y', 'lby group',
    ],
    # ── Pharm chains (תרופות/טיפוח split is per-transaction) ──
    'פארם': [
        'סופר פארם', 'סופר-פארם', 'super pharm', 'super-pharm', 'superpharm',
        'גוד פארם', 'good pharm', 'ניו פארם', 'new pharm',
        'פארם', 'pharm', 'דראגסטור', 'drugstore',
    ],
    # ── Tech: software, cloud, dev, gaming, AI (part of old חשמל ומחשבים) ──
    'טכנולוגיה': [
        'apple', 'אפל', 'google', 'גוגל',
        'מיקרוסופט', 'microsoft',
        'steam', 'playstation', 'xbox', 'nintendo',
        'app store', 'חנות אפליקציות',
        'github',
        'adobe', 'canva', 'notion', 'dropbox', 'icloud', 'אייקלאוד',
        'office 365', 'microsoft 365', 'אופיס 365',
        'epic games', 'ubisoft', 'roblox', 'רובלוקס', 'twitch', 'discord',
        'גיימינג',
        # NOTE: AI-tool keywords (openai/chatgpt/anthropic/claude/midjourney…)
        # are applied as an unconditional override into טכנולוגיה + subcategory
        # AI (see AI_OVERRIDE_KEYWORDS below).
        # Dev/cloud subscriptions ("DIGITALOCEA"/"BROWSERBA" are how the card
        # descriptor truncates the full names).
        'render.com', 'digitalocean', 'digitalocea', 'alldebrid',
        'browserbase', 'browserba',
    ],
    # ── Shopping: fashion, electronics, furniture, home, online ──
    'קניות': [
        # electronics retailers (was חשמל ומחשבים)
        'באג מולטי', 'bug multi', 'ksp',
        'איביי', 'ebay', 'אמזון', 'amazon',
        'אלי אקספרס', 'aliexpress', 'ali express',
        'אייבורי', 'ivory', 'מחשבים',
        'samsung', 'סמסונג', 'dell', 'lenovo',
        'שיאומי', 'xiaomi',
        'באג', 'מחסני חשמל', 'machsanei', 'שקם אלקטריק', 'shekem',
        'idigital', 'איי דיגיטל', 'istore', 'מקסטור', 'last price',
        'לאסט פרייס', 'pc center', 'הום אלקטרוניק', 'ולנשטיין',
        'temu', 'טמו', 'banggood',
        'אלקטרוניק', 'electronics', 'אודיו', 'audio',
        # fashion & footwear (was אופנה; cosmetics moved to טיפוח)
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
        'primadonna',
        'לורן', 'lauren', 'טומי', 'tommy',
        'נקסט', 'next', 'gap', 'old navy', 'lacoste', 'לקוסט', 'ralph',
        'massimo', 'מסימו', 'oysho', 'אוישו', 'victoria', 'דלתא', 'delta',
        'reebok', 'ריבוק', 'under armour', 'new balance', 'crocs', 'קרוקס',
        'סקצ\'רס', 'skechers', 'timberland', 'aldo', 'אלדו', 'scoop', 'סקופ',
        'גולברי', 'golbary', 'אדיקה', 'adika', 'factory 54',
        'פקטורי 54', 'superdry', 'tfc', 'carter',
        'תכשיט', 'jewelry', 'pandora', 'פנדורה', 'magnolia', 'מגנוליה',
        'fossil', 'swarovski', 'סברובסקי',
        'children', 'הלבשה', 'הנעלה', 'אאוטלט', 'outlet', 'סטוק פקטורי',
        'pedro pps',
        # furniture & home (was עיצוב הבית)
        'איקאה', 'ikea', 'הום סנטר', 'home center',
        'ace hardware', 'מרכז השיפוצים', 'ריהוט',
        'עצמל"ה', 'home depot', 'שיפוצים',
        'כלי בית', 'מצעים', 'שטיח', 'וילון',
        'פוקס הום', 'fox home',
        'אלקטרה', 'electra',
        'ביתילי', 'bitili', 'נעמן', 'naaman', 'ורדינון', 'vardinon',
        'כספי', 'תמי 4', 'tami4', 'עמינח', 'aminach', 'הוליווד',
        'רהיטי', 'furniture', 'מזרן', 'mattress', 'דורגל',
        'טמבור', 'tambour', 'נירלט', 'nirlat', 'צבע', 'paint',
        'כלי עבודה', 'ברזל', 'גמיש', 'urban', 'הכל לבית', 'בית וגן',
        'מ. שטרן', 'דקור', 'decor', 'wishlist', 'מיאדרה',
        # discount variety / stock stores — household goods
        'סטוק סנטר', 'booom', 'זול סטוק', 'מקס סטוק', 'max stock',
    ],
    # ── Personal grooming & beauty ──
    'טיפוח': [
        'קוסמטיקה', 'cosmetic', 'קוסמטיקס',
        'איפור', 'makeup', 'מייקאפ', 'בשמים', 'perfume', 'פרפיום',
        'sephora', 'ספורה', 'body shop', 'laline', 'ללין',
        'lush', 'לאש', 'kiko', 'קיקו', 'yves rocher', 'איב רושה',
        'לוריאל', 'loreal', 'לייף סטייל',
        'מספרה', 'מספרת', 'עיצוב שיער', 'מעצב שיער', 'ברבר', 'barber',
        'מכון יופי', 'קוסמטיקאית', 'מניקור', 'פדיקור', 'ציפורניים',
        'לק ג\'ל', 'בניית ציפורניים', 'הסרת שיער', 'שעווה',
    ],
    # ── Classes, sport & studies (old פנאי sport + חינוך ולימודים) ──
    'חוגים וספורט': [
        'חדר כושר', 'הולמס פלייס', 'holmes place',
        'ספורט', 'sport', 'כושר',
        'חוג', 'חוגים', 'סדנה', 'workshop',
        'בריכה', 'שחייה', 'swimming',
        'יוגה', 'yoga', 'פילאטיס', 'pilates',
        'דקאתלון', 'decathlon', 'מגה ספורט', 'sport5', 'אצטדיון',
        'מכון כושר', 'energym', 'מאמאנט',
        # education & childcare (was חינוך ולימודים)
        'אוניברסיטה', 'university', 'מכללה', 'college',
        'בית ספר', 'school', 'גן ילדים', 'kindergarten',
        'שכר לימוד', 'tuition', 'קורס', 'course',
        'ספרים', 'books', 'סטימצקי', 'steimatzky',
        'צעצועים', 'toys',
        'צהרון', 'מעון', 'משפחתון', 'גנון', 'קייטנה', 'מתנ"ס',
        'קונסרבטוריון', 'שיעור', 'מורה פרטי', 'אולפן', 'ברליץ', 'berlitz',
        'wall street', 'udemy', 'coursera', 'duolingo', 'דואולינגו',
        'מורה לנהיגה', 'שיעורי נהיגה', 'בית ספר לנהיגה', 'אקדמיה',
        'הטכניון', 'ספרי לימוד', 'משחקי קופסה', 'lego', 'לגו',
        'אקדמיה ל', 'הסמכה',
    ],
    # ── Events & gifts (was מתנות) ──
    'אירועים ומתנות': [
        'buyme', 'buy me', 'ביי-מי', 'ביי מי', 'ביימי',
        'שוברי מתנה', 'שובר מתנה', 'gift card', 'giftcard',
        'מתנות', 'מתנה',
    ],
    'העברת כספים': [
        'העברה', 'העברה ל', 'העברה מ', 'העברת כספים', 'העברה בנקאית',
        'paypal', 'פייפאל',
        'paybox', 'פייבוקס', 'pepper', 'פפר',
        'western union', 'ווסטרן יוניון',
        'moneygram', 'מאני גרם', 'gmt', 'העברת זה"ב', 'wire transfer',
        'remitly', 'wise transfer',
    ],
    # ── Sushi the pet: vet, food & treats (was חיות מחמד) ──
    'סושי': [
        'וטרינר', 'veterinary', 'חיות מחמד', 'חיות',
        'פט שופ', 'pet shop', 'pet store',
        'מזון לחיות', 'כלב', 'חתול',
        'אניפט', 'anipet', 'פטלנד', 'petland',
        'תן לחיות',
        'פטס', 'all4pet', 'biopet', 'דוקטור בייקר', 'אקווריום',
        'aquarium', 'פנסיון כלבים', 'מספרת כלבים', 'אילוף כלבים', 'וט מרקט',
        'ספידוג', 'דוג סנטר',
    ],
    'משיכת מזומן': [
        'משיכת מזומן', 'משיכת מזומנים', 'מזומנים', 'כספומט', 'atm',
        'cash withdrawal', 'מזומן', 'בנקומט',
    ],
}

# Short/ambiguous keywords that need word-boundary matching.
# These are matched with \b (word boundary) regex to prevent
# false positives like "hot" matching "hotel".
_EXACT_WORD_KEYWORDS: dict[str, list[str]] = {
    'הוצאות שוטפות': ['הוט', 'hot', 'יס', 'פז', 'ten', 'גז'],
    'בילויים': ['בר', 'פארק', 'park', 'פיס'],
    'אוכל': ['food', 'פוד'],
    'הוצאות משתנות': ['דן'],
    'קניות': ['ace', 'גולף', 'golf', 'פוקס', 'fox'],
    'העברת כספים': ['ביט', 'bit'],
    'חוגים וספורט': ['gym'],
    'טיפוח': ['ספא', 'spa'],
}

# Build flat lookup: keyword (lowercase) → category
for _cat, _keywords in _CATEGORY_KEYWORDS.items():
    for _kw in _keywords:
        KEYWORD_TO_CATEGORY[_kw.lower().strip()] = _cat

# Longest keyword wins. Both pipelines scan this dict in order and stop at the
# first hit, so ordering IS the matching policy: a longer (more specific)
# keyword must beat a shorter generic one regardless of which category was
# declared first — e.g. 'רמי לוי תקשורת' (telecom) must win over 'רמי לוי'
# (groceries) for a "רמי לוי תקשורת בעמ" charge. The sort is stable, so
# same-length keywords keep catalog order. Mirrored in bank-sync categorize.js.
KEYWORD_TO_CATEGORY = dict(
    sorted(KEYWORD_TO_CATEGORY.items(), key=lambda kv: len(kv[0]), reverse=True)
)

# Build exact-word lookup (same longest-first policy for consistency)
for _cat, _keywords in _EXACT_WORD_KEYWORDS.items():
    for _kw in _keywords:
        EXACT_WORD_KEYWORDS[_kw.lower()] = _cat
EXACT_WORD_KEYWORDS = dict(
    sorted(EXACT_WORD_KEYWORDS.items(), key=lambda kv: len(kv[0]), reverse=True)
)


# ── AI tools → טכנולוגיה / AI ────────────────────────────────────────
# Applied as an UNCONDITIONAL override (like Psagot / foreign card): sets the
# category to טכנולוגיה AND the subcategory to AI, re-tagging rows that
# arrived already categorized — existing snapshots migrate on the next
# restore without a bank-sync re-pull. Matched case-insensitively via
# substring. Keep this list curated to well-known AI products to avoid false
# positives (e.g. avoid bare 'gemini' / 'suno' which collide with non-AI
# merchants).
AI_CATEGORY = 'טכנולוגיה'
AI_SUBCATEGORY = 'AI'
AI_OVERRIDE_KEYWORDS: list[str] = [
    'openai', 'chatgpt', 'gpt-4', 'gpt4', 'anthropic', 'claude.ai', 'claude',
    'midjourney', 'perplexity', 'huggingface', 'hugging face',
    'elevenlabs', 'eleven labs', 'stability ai', 'runwayml', 'runway ai',
    'character.ai', 'synthesia', 'descript', 'x.ai', 'grok',
    'github copilot', 'copilot', 'cursor ai', 'cursor.com', 'cursor.so',
    'google gemini', 'gemini.google', 'jasper.ai', 'poe.com',
    'replicate.com', 'leonardo.ai', 'lovable.dev', 'suno.ai', 'suno.com',
    'grammarly',
]

# ── Foreign-card exemptions ──────────────────────────────────────────
# The foreign-card heuristic (trailing 2-letter country code, no Hebrew) buckets
# overseas spend as travel — but online services bill from abroad year-round
# ("NETFLIX.COM AMSTERDAM NL", "PAYPAL *SPOTIFY ... GB") and are NOT trip spend.
# Descriptions matching any of these skip the foreign→travel override and fall
# through to the keyword catalog instead.
FOREIGN_EXEMPT_KEYWORDS: list[str] = [
    'netflix', 'spotify', 'paypal', 'google', 'apple', 'amazon', 'microsoft',
    'disney', 'hbo', 'youtube', 'ebay', 'aliexpress', 'temu', 'banggood',
    'steam', 'playstation', 'xbox', 'nintendo', 'epic games',
    'adobe', 'canva', 'notion', 'dropbox', 'icloud', 'github', 'zoom',
    'linkedin', 'patreon', 'substack', 'audible', 'kindle', 'twitch',
    'discord', 'wolt', 'facebook', 'facebk', 'meta platforms',
    # Dev/cloud subscriptions billed from abroad (Render/DigitalOcean bill
    # from the US, AllDebrid from FR, …) — recurring services, not trip spend.
    'render.com', 'digitalocean', 'digitalocea', 'alldebrid', 'browserbase',
    'browserba', 'televizo', 'iptv',
]

# ── Issuer category (ענף_מקור) → catalog category ───────────────────
# The card companies classify every transaction themselves (MAX sends a
# category name with each transaction; Isracard exposes the merchant's ענף).
# bank-sync stores it as ענף_מקור. It's a WEAK signal: applied only to rows
# the keyword catalog left in שונות, and user rules still override it.
# Matched by substring (first hit wins) because each issuer words its sector
# names differently — order specific before generic (e.g. אלקטרוניקה before
# חשמל, מזון מהיר before מזון). Mirrored in bank-sync categorize.js.
ISSUER_CATEGORY_RULES: list[tuple[str, str]] = [
    ('מזון מהיר', 'בילויים'),
    ('מסעד', 'בילויים'),
    ('בתי קפה', 'בילויים'),
    ('בתי אוכל', 'בילויים'),
    ('סופרמרקט', 'אוכל'),
    ('רשתות שיווק', 'אוכל'),
    ('מרכול', 'אוכל'),
    ('מזון', 'אוכל'),
    ('אלקטרוניקה', 'קניות'),
    ('מחשבים', 'קניות'),
    ('סלולר', 'הוצאות שוטפות'),
    ('תקשורת', 'הוצאות שוטפות'),
    ('דלק', 'הוצאות שוטפות'),
    ('תחנות תדלוק', 'הוצאות שוטפות'),
    ('גז', 'הוצאות שוטפות'),
    ('חשמל', 'הוצאות שוטפות'),
    ('תחבורה', 'הוצאות משתנות'),
    ('חניה', 'הוצאות משתנות'),
    ('חניונים', 'הוצאות משתנות'),
    ('מוניות', 'הוצאות משתנות'),
    ('רכב', 'הוצאות משתנות'),
    ('מוסך', 'הוצאות משתנות'),
    ('תעופה', 'טיסות ותיירות'),
    ('טיסות', 'טיסות ותיירות'),
    ('תיירות', 'טיסות ותיירות'),
    ('מלונות', 'טיסות ותיירות'),
    ('בתי מלון', 'טיסות ותיירות'),
    ('נופש', 'טיסות ותיירות'),
    ('ביגוד', 'קניות'),
    ('הלבשה', 'קניות'),
    ('הנעלה', 'קניות'),
    ('אופנה', 'קניות'),
    ('קוסמטיקה', 'טיפוח'),
    ('תכשיט', 'קניות'),
    ('ריהוט', 'קניות'),
    ('כלי בית', 'קניות'),
    ('בית וגן', 'קניות'),
    ('שיפוצים', 'קניות'),
    ('פארם', 'פארם'),
    ('בריאות', 'תרופות וטיפולים'),
    ('רפואה', 'תרופות וטיפולים'),
    ('מרקחת', 'תרופות וטיפולים'),
    ('אופטיקה', 'תרופות וטיפולים'),
    ('ספורט', 'חוגים וספורט'),
    ('פנאי', 'בילויים'),
    ('בידור', 'בילויים'),
    ('תרבות', 'בילויים'),
    ('בילוי', 'בילויים'),
    ('ביטוח', 'הוצאות שוטפות'),
    ('חינוך', 'חוגים וספורט'),
    ('לימודים', 'חוגים וספורט'),
    ('ספרים', 'חוגים וספורט'),
    ('צעצועים', 'חוגים וספורט'),
    ('חיות', 'סושי'),
    ('עירייה', 'הוצאות שוטפות'),
    ('עיריות', 'הוצאות שוטפות'),
    ('ממשל', 'הוצאות שוטפות'),
    ('רשויות', 'הוצאות שוטפות'),
    ('מיסים', 'הוצאות שוטפות'),
    ('דואר', 'הוצאות שוטפות'),
    ('כספומט', 'משיכת מזומן'),
    ('מזומן', 'משיכת מזומן'),
    ('העברות', 'העברת כספים'),
    ('העברת כספים', 'העברת כספים'),
    ('מתנות', 'אירועים ומתנות'),
]


def map_issuer_category(issuer_name) -> Optional[str]:
    """Catalog category for an issuer sector name (ענף_מקור), or None.

    Substring match, first rule wins. Only returns catalog categories, so the
    result is always safe to assign.
    """
    s = str(issuer_name or '').strip()
    if not s or s.lower() in ('nan', 'none', 'null'):
        return None
    for needle, category in ISSUER_CATEGORY_RULES:
        if needle in s:
            return category
    return None


# ── Subcategories (parent category → {subcategory → [keywords]}) ─────
# Keyword-seeded subcategories, scoped to their parent category so they only
# refine rows already in that category (no cross-category false positives).
# Users can create/assign more in the UI; those are stored as merchant rules.
# First subcategory (in dict order) wins on a keyword hit.
# NOTE: פארם deliberately has NO seeds and is excluded from the AI subcategory
# sweep — the תרופות/טיפוח split depends on what was bought, so it's assigned
# per-transaction (the "אל תשנה עסקאות דומות" pin).
SUBCATEGORY_KEYWORDS: dict[str, dict[str, list[str]]] = {
    'טיסות ותיירות': {
        'טיסות': ['אל על', 'el al', 'elal', 'wizz', 'ryanair', 'easyjet',
                    'turkish air', 'lufthansa', 'aegean', 'united airlines',
                    'british airways', 'ארקיע', 'arkia', 'ישראייר', 'israir',
                    'pegasus', 'airbaltic', 'air baltic', 'אייר חיפה',
                    'air haifa', 'etihad', 'טיסה', 'flight', 'airline',
                    'airways'],
        'בתי מלון': ['מלון', 'מלונות', 'hotel', 'hostel', 'booking',
                       'airbnb', 'אירביאנבי', 'בוקינג', 'resort', 'צימר',
                       'zimmer', 'אכסני', 'fattal', 'פתאל', 'isrotel',
                       'ישרוטל', 'לאונרדו', 'leonardo', 'club hotel',
                       'קלאב הוטל', 'רימונים', 'hilton', 'doubletree',
                       'double tree', 'דן פנורמה', 'הרברט סמואל', 'אגודה',
                       'agoda'],
        # שופינג + שונות: manual / AI only.
    },
    'הוצאות שוטפות': {
        'שכר דירה': ['שכר דירה', 'שכירות', 'rent', 'משיכת שיקים',
                       'משיכת שיק', 'המחאה', 'cheque'],
        'ארנונה ועירייה': ['ארנונה', 'עירייה', 'עיריית', 'עירית',
                             'מועצה אזורית', 'מועצה מקומית', 'אגף הגביה',
                             'מילגם', 'היטל', 'דוח חניה', 'קנס'],
        'מים': ['תאגיד מים', 'מי אביבים', 'הגיחון', 'מים וביוב', 'מי רמת גן',
                 'מי שבע', 'מי רעננה', 'מי כרמל', 'מי הרצליה', 'מי מודיעין',
                 'מי בית שמש', 'מי נתניה', 'מי אונו', 'פלגי מוצקין', 'מי לוד',
                 'מי ציונה', 'מי גליל', 'מי נע'],
        'גז': ['סופרגז', 'supergas', 'אמישראגז', 'amisragas', 'פזגז',
                'דורגז', 'בלוני גז'],
        'חשמל': ['חברת החשמל', 'תאגיד החשמל', 'חשמל'],
        'דלק': ['דלק', 'תדלוק', 'סונול', 'sonol', 'דור אלון', 'paz',
                 'yellow', 'מנטה', 'menta', 'אלונית', 'תחנת דלק', 'דלקן',
                 'pazomat', 'פזומט', 'דור-ארגמן', 'דור ארגמן'],
        'סטרימינג': ['netflix', 'נטפליקס', 'disney', 'דיסני', 'hbo',
                      'youtube', 'יוטיוב', 'spotify', 'ספוטיפיי', 'apple tv',
                      'prime video', 'אמזון פריים', 'apple.com/bill',
                      'crunchyroll', 'paramount', 'פרמאונט', 'televizo',
                      'iptv'],
        'אינטרנט': ['בזק', 'bezeq', 'הוט נט', 'hot net', 'נטוויז',
                     'netvision', 'אינטרנט רימון', 'fiber', 'סיבים',
                     'yes tv', 'partner tv', 'הוט טלקום', 'triple c',
                     'free telecom'],
        'סלולר': ['סלקום', 'cellcom', 'פלאפון', 'pelephone', 'פרטנר',
                   'partner', 'הוט מובייל', 'hot mobile', 'גולן טלקום',
                   'golan telecom', 'we4g', '019', 'סלולר', 'cellular',
                   'רמי לוי תקשורת'],
        'ביטוח': ['ביטוח', 'insurance', 'פוליסה', 'policy', 'הראל',
                   'מגדל', 'הפניקס', 'מנורה מבטחים', 'שירביט', 'ליברה',
                   'libra', 'wobi', 'פספורטכרד', 'passportcard', 'פנסיה',
                   'גמל', 'השתלמות'],
        'מנויים ושירותים': ['מנוי', 'subscription', 'membership',
                              'דמי ניהול', 'דמי כרטיס', 'דמי חבר', 'עמלת',
                              'patreon', 'פטראון', 'substack', 'linkedin',
                              'zoom'],
    },
    'תרופות וטיפולים': {
        'טיפולים': ['l.b.y', 'lby group', 'טיפול זוגי', 'מטפלת', 'פסיכולוג',
                      'פסיכיאטר', 'therapist', 'therapy', 'פיזיותרפיה',
                      'physiotherapy', 'כירופרקט', 'דיאטנית', 'תזונאי',
                      'נטורופת', 'הומאופת'],
        'קופות חולים': ['מכבי', 'maccabi', 'כללית', 'clalit', 'מאוחדת',
                          'לאומית שירותי בריאות'],
        'בתי מרקחת': ['בית מרקחת', 'מרקחת', 'pharmacy', 'רוקח'],
    },
    'בילויים': {
        'בתי קפה': ['קפה', 'cafe', 'coffee', 'ארומה', 'aroma', 'לנדוור',
                      'landwer', 'גרג', 'greg', 'אספרסו', 'espresso',
                      'starbucks', 'סטארבקס', 'קפולסקי', 'רולדין', 'cofix',
                      'קופיקס', 'ארקפה', 'arcaffe'],
        'מזון מהיר': ['מקדונלד', 'mcdonald', 'בורגר', 'burger', 'kfc',
                        'פיצה', 'פיצריה', 'pizza', 'דומינו', 'domino',
                        'שווארמה', 'פלאפל', 'falafel', 'טאקו', 'taco',
                        'ג\'פניקה', 'japanika', 'סושי', 'sushi', 'subway',
                        'סאבוויי', 'שניצל'],
        'מסעדות וברים': ['מסעדה', 'מסעדת', 'restaurant', 'ביסטרו', 'bistro',
                           'בראסרי', 'גריל', 'grill', 'טאבון', 'פאב', 'pub',
                           'בירה', 'beer', 'שיפודי', 'קייטרינג', 'catering',
                           'מזנון'],
        'סרטים': ['סינמה', 'cinema', 'יס פלאנט', 'yes planet', 'רב חן',
                    'רב-חן', 'גלובוס מקס', 'לב סינמה', 'קולנוע', 'מובילנד',
                    'סינמטק'],
        'מופעים והופעות': ['הופעה', 'מופע', 'הצגה', 'תיאטרון', 'eventim',
                             'כרטיסים', 'היכל התרבות', 'זאפה', 'zappa', 'ברבי',
                             'barby', 'הבימה', 'הקאמרי', 'בית ליסין',
                             'תיאטרון גשר', 'צוותא'],
        'פיס והימורים': ['מפעל הפיס', 'פיס מרכז', 'לוטו', 'טוטו', 'ווינר',
                           'winner', 'הימורים', 'חיש גד'],
        'אטרקציות': ['מוזיאון', 'museum', 'ספארי', 'safari', 'גן חיות', 'zoo',
                       'לונה פארק', 'סופרלנד', 'משחקייה', 'גימבורי', 'gymboree',
                       'חדר בריחה', 'אסקייפ', 'באולינג', 'bowling', 'קרטינג',
                       'karting', 'פיינטבול', 'לייזר טאג'],
        # בילויים עם חברים + אחר: manual / AI only.
    },
    'אוכל': {
        # קניות גדולות first (brand chains), then סופרים קטנים (the
        # neighborhood shops), so a branded branch never falls to the generic
        # מינימרקט/סופרמרקט keywords.
        'קניות גדולות': ['שופרסל', 'shufersal', 'רמי לוי', 'rami levy',
                           'ויקטורי', 'victory', 'יינות ביתן', 'טיב טעם',
                           'tiv taam', 'אושר עד', 'osher ad', 'חצי חינם',
                           'יוחננוף', 'yochananof', 'קרפור', 'carrefour',
                           'מגה בעיר', 'זול ובגדול', 'נתיב החסד', 'ברכל',
                           'פרשמרקט', 'freshmarket', 'fresh market',
                           'קינג סטור', 'מחסני השוק', 'שפע שוק', 'יש חסד',
                           'יש בשכונה', 'מחסני מזון', 'קואופ', 'סטופ מרקט'],
        'סופרים קטנים': ['מינימרקט', 'מיני מרקט', 'מכולת', 'am:pm',
                           'אי אם פי אם', 'סופרמרקט', 'supermarket', 'מרכול',
                           'פרימדונה', 'סיטי מרקט', 'שוק העיר', 'שוק מהדרין',
                           'פיצוצי', 'פיצוצייה', 'פיצוציה', 'קיוסק',
                           '7-eleven', '7 eleven', '7-11'],
        'שוברי מזון': ['סיבוס', 'cibus', 'תן ביס', 'pluxee', 'פלאקסי',
                        'תנביס'],
        'משלוחים': ['wolt', 'וולט', '10bis', 'משלוחה', 'משלוחים', 'משלוח',
                     'הזמנת אוכל', 'delivery'],
        'מאפיות': ['מאפיה', 'מאפיית', 'מאפייה', 'מאפה', 'דברי מאפה',
                    'קונדיטוריה', 'קונדטוריה', 'קונדיטורית', 'פטיסרי',
                    'קרואסון', 'בייקרי', 'bakery', 'לחם'],
        'קצביות ודגים': ['קצביה', 'קצביית', 'אטליז', 'בשר', 'עוף', 'דגים'],
        'אלכוהול ומשקאות': ['יין', 'wine', 'אלכוהול', 'משקאות', 'יקב',
                              'בירה', 'beer'],
        # שונות: whatever nothing above catches.
    },
    'קניות': {
        'אלקטרוניקה': ['שקם אלקטריק', 'מחסני חשמל', 'באג', 'bug', 'ksp',
                         'אייבורי', 'ivory', 'אלקטרה', 'זאפ', 'שיא החשמל',
                         'idigital', 'איי דיגיטל', 'istore', 'מקסטור',
                         'last price', 'לאסט פרייס', 'samsung', 'סמסונג',
                         'שיאומי', 'xiaomi', 'אלקטרוניק', 'electronics'],
        'קניות אונליין': ['aliexpress', 'עלי אקספרס', 'אלי אקספרס', 'amazon',
                           'אמזון', 'ebay', 'איביי', 'temu', 'טמו', 'banggood',
                           'gearbest', 'shein', 'asos', 'אסוס'],
        'אופנה': ['גולף', 'golf', 'קסטרו', 'castro', 'פוקס', 'fox',
                    'רנואר', 'renuar', 'זארה', 'zara', 'h&m', 'אייץ אנד אם',
                    'מנגו', 'mango', 'ברשקה', 'bershka', 'פול אנד בר',
                    'pull&bear', 'pull and bear', 'טרמינל', 'terminal x',
                    'אורבניקה', 'urbanica', 'אמריקן איגל', 'american eagle',
                    'ריזרבד', 'reserved', 'הודיס', 'hoodies',
                    'טוונטי פור סבן', 'twentyfourseven', 'delta', 'דלתא',
                    'intima', 'אינטימה', 'נעלי', 'shoes', 'סקצ', 'skechers',
                    'nike', 'נייק', 'אדידס', 'adidas', 'new balance',
                    'ניו באלנס', 'קרוקס', 'crocs', 'טימברלנד', 'timberland',
                    'סטיב מאדן', 'steve madden', 'אלדו', 'aldo', 'to go',
                    'טו גו', 'הלבשה', 'הנעלה'],
        'תכשיטים ואקססוריז': ['פנדורה', 'pandora', 'תכשיט', 'jewel',
                                 'מגנוליה', 'magnolia', 'אימפרס', 'impress',
                                 'שעוני', 'משקפי', 'אופטיק', 'optic'],
        'ריהוט': ['איקאה', 'ikea', 'ריהוט', 'רהיטי', 'furniture', 'מזרן',
                    'mattress', 'עמינח', 'aminach', 'ביתילי', 'bitili',
                    'הוליווד'],
        'דברים לבית': ['הום סנטר', 'home center', 'ace', 'עצמל"ה',
                         'home depot', 'שיפוצים', 'כלי בית', 'מצעים', 'שטיח',
                         'וילון', 'פוקס הום', 'fox home', 'נעמן', 'naaman',
                         'ורדינון', 'vardinon', 'טמבור', 'tambour', 'נירלט',
                         'צבע', 'כלי עבודה', 'תמי 4', 'tami4', 'דקור',
                         'decor', 'סטוק סנטר', 'booom', 'זול סטוק',
                         'מקס סטוק', 'max stock', 'זול בשפע',
                         'כלבו חצי חינם'],
    },
    'חוגים וספורט': {
        'ספורט וכושר': ['חדר כושר', 'מכון כושר', 'כושר', 'הולמס פלייס',
                          'holmes place', 'יוגה', 'yoga', 'פילאטיס', 'pilates',
                          'בריכה', 'שחייה', 'gym', 'energym', 'ספורט', 'sport',
                          'דקאתלון', 'decathlon', 'מאמאנט'],
        'לימודים': ['אוניברסיטה', 'university', 'מכללה', 'college',
                      'בית ספר', 'school', 'שכר לימוד', 'tuition', 'קורס',
                      'course', 'אולפן', 'udemy', 'coursera', 'duolingo',
                      'דואולינגו', 'אקדמיה', 'הטכניון', 'ספרי לימוד',
                      'סטימצקי', 'steimatzky', 'ברליץ', 'berlitz', 'הסמכה'],
        'חוגים': ['חוג', 'חוגים', 'סדנה', 'workshop', 'צהרון', 'מעון',
                    'משפחתון', 'גנון', 'קייטנה', 'מתנ"ס', 'קונסרבטוריון',
                    'גן ילדים', 'kindergarten', 'שיעור'],
    },
    'טכנולוגיה': {
        'AI': [],  # assigned by the unconditional AI-tool override, not keywords
        'שירותי ענן': ['digitalocean', 'render.com', 'scrapingbee', 'aws',
                        'amazon web', 'google cloud', 'azure', 'github',
                        'gitlab', 'vercel', 'netlify', 'heroku', 'cloudflare',
                        'google one', 'icloud', 'dropbox', 'onedrive',
                        'גוגל אחסון', 'wix', 'godaddy', 'namecheap',
                        'alldebrid', 'browserbase', 'browserba'],
        'גיימינג': ['steam', 'playstation', 'xbox', 'nintendo', 'epic games',
                      'ubisoft', 'roblox', 'רובלוקס', 'twitch', 'גיימינג'],
        'תוכנה ואפליקציות': ['adobe', 'canva', 'notion', 'app store',
                               'חנות אפליקציות', 'microsoft', 'office 365',
                               'microsoft 365', 'אופיס 365'],
    },
    'הוצאות משתנות': {
        'טיפולים רכב': ['מוסך', 'garage', 'צמיג', 'פנצ', 'גרר', 'מצבר',
                          'חלפים', 'מכון רישוי', 'בדיקת רכב', 'שטיפת רכב',
                          'רחיצת', 'car wash', 'מכונאי', 'ליסינג', 'leasing'],
        'כבישי אגרה': ['כביש 6', 'כביש אגרה', 'רב-פס', 'רב פס', 'מנהרות',
                         'מנהרת', 'אגרה', 'חוצה ישראל', 'חוצה צפון'],
        'חניונים': ['חניון', 'חניה', 'חנייה', 'parking', 'פנגו', 'pango',
                      'סלופארק', 'cellopark', 'אחוזת חוף'],
        'תחבורה ציבורית': ['רב קו', 'רב-קו', 'ravkav', 'אגד', 'egged',
                              'מטרופולין', 'קווים', 'kavim', 'רכבת', 'מטרונית',
                              'דן באב', 'באבל דן', 'אוטובוס', 'סופרבוס'],
        'מוניות ונסיעות': ['gett', 'מונית', 'taxi', 'yango', 'יאנגו', 'uber',
                             'autotel', 'אוטוטל', 'car2go', 'ווואש', 'woosh'],
    },
    'סושי': {
        'וטרינרית וטיפולים': ['וטרינר', 'veterinary', 'פנסיון כלבים',
                                 'מספרת כלבים', 'אילוף'],
        'אוכל וחטיפים': ['פט שופ', 'pet shop', 'pet store', 'מזון לחיות',
                           'אניפט', 'anipet', 'פטלנד', 'petland', 'וט מרקט',
                           'all4pet', 'biopet', 'ספידוג', 'דוג סנטר',
                           'תן לחיות'],
    },
}

# Optional emoji per seeded subcategory (UI nicety; falls back in the UI).
SUBCATEGORY_ICONS: dict[str, str] = {
    # טיסות ותיירות
    'טיסות': '✈️', 'בתי מלון': '🏨', 'שופינג': '🛍️',
    # הוצאות שוטפות
    'שכר דירה': '🔑', 'ארנונה ועירייה': '🏛️', 'מים': '🚿', 'גז': '🔥',
    'חשמל': '⚡', 'דלק': '⛽', 'סטרימינג': '📺', 'אינטרנט': '🌐',
    'סלולר': '📱', 'ביטוח': '🛡️', 'מנויים ושירותים': '🔁',
    # תרופות וטיפולים
    'קופות חולים': '🏥', 'בתי מרקחת': '💊', 'טיפולים': '💞',
    # פארם
    'תרופות': '💊', 'טיפוח': '🧴',
    # בילויים
    'בתי קפה': '☕', 'מזון מהיר': '🍔', 'מסעדות וברים': '🍽️',
    'סרטים': '🎬', 'מופעים והופעות': '🎭', 'פיס והימורים': '🎰',
    'אטרקציות': '🎡', 'בילויים עם חברים': '🥂',
    # אוכל
    'קניות גדולות': '🛒', 'סופרים קטנים': '🏪', 'משלוחים': '🛵',
    'מאפיות': '🥐', 'קצביות ודגים': '🥩', 'אלכוהול ומשקאות': '🍷',
    'שוברי מזון': '🎫',
    # קניות
    'אלקטרוניקה': '🔌', 'קניות אונליין': '📦', 'אופנה': '👕',
    'תכשיטים ואקססוריז': '💍', 'ריהוט': '🛋️', 'דברים לבית': '🏠',
    # חוגים וספורט
    'ספורט וכושר': '🏋️', 'לימודים': '📚', 'חוגים': '🎨',
    # טכנולוגיה
    'AI': '🤖', 'שירותי ענן': '☁️', 'גיימינג': '🎮', 'תוכנה ואפליקציות': '💿',
    # הוצאות משתנות
    'טיפולים רכב': '🔧', 'כבישי אגרה': '🛣️', 'חניונים': '🅿️',
    'תחבורה ציבורית': '🚌', 'מוניות ונסיעות': '🚕',
    # סושי
    'וטרינרית וטיפולים': '🩺', 'אוכל וחטיפים': '🦴',
}

# Categories the automatic AI subcategory sweep must skip: שונות has no parent
# to refine, and פארם is split per-transaction (תרופות/טיפוח depends on the
# basket, not the merchant).
AI_SUBCATEGORIZE_SKIP: set[str] = {'שונות', 'פארם'}


def get_icon(category: str) -> str:
    return CATEGORY_ICONS.get(category, '📋')


def get_subcategory_catalog() -> dict[str, list[str]]:
    """Parent category → list of seeded subcategory names (for the UI)."""
    catalog = {parent: list(subs.keys()) for parent, subs in SUBCATEGORY_KEYWORDS.items()}
    # Pickable subcategories that have no keyword seeds.
    catalog.setdefault('טיסות ותיירות', []).append('שופינג')
    catalog.setdefault('בילויים', []).append('בילויים עם חברים')
    catalog['פארם'] = ['תרופות', 'טיפוח']
    return catalog
