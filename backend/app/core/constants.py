"""
Application constants
"""
from typing import Optional

CATEGORY_ICONS = {
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
    'העברה להשקעות': '📈',
    'חיות מחמד': '🐕',
    'שונות': '📦',
    'משיכת מזומן': '🏧',
    'שכר דירה': '🔑',
    'הוראות קבע': '🔄',
    'טיסות ותיירות': '✈️',
    'חינוך ולימודים': '📚',
    'מתנות': '🎁',
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
        # ── Israeli travel agencies & airlines ──
        'איסתא', 'issta', 'אופיר טורס', 'ophir tours', 'דיזנהויז', 'גוליבר',
        'ארקיע', 'arkia', 'ישראייר', 'israir', 'wizzair', 'pegasus',
        'ארקיע', 'דקה 90', 'eldan', 'אלדן', 'lastminute',
        'fattal', 'פתאל', 'isrotel', 'ישרוטל', 'דן פנורמה', 'לאונרדו',
        'leonardo', 'club hotel', 'קלאב הוטל', 'הרברט סמואל', 'רימונים',
        'צימר', 'zimmer', 'אכסניה', 'אכסניית', 'trip.com', 'getyourguide',
        'rentalcars', 'נסיעות לחו"ל', 'חבילת נופש', 'בתי מלון',
        'קווי חופשה', 'airbaltic', 'air baltic', 'ניו ויז\'ן טורס',
        'elal', 'אייר חיפה', 'air haifa', 'etihad', 'airalo',
        'double tree', 'doubletree', 'hilton', 'kohchang', 'koh chang',
        'railninja', 'rail ninja', 'rajadha', 'olive young', 'lottebaikhoajeom',
    ],
    'מזון וצריכה': [
        # Discount variety / stock stores — household consumption, not fashion.
        'סטוק סנטר', 'booom', 'זול סטוק', 'מקס סטוק', 'max stock',
        # פרימדונה = the Ramat Gan fresh supermarket (the Italian lingerie
        # brand bills as latin 'primadonna', kept under אופנה).
        'פרימדונה',
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
        # ── More Israeli supermarket / grocery chains ──
        'shufersal', 'rami levy', 'osher ad', 'יינות ביתן',
        'סופרמרקט', 'מרכול', 'יש חסד', 'יש בשכונה', 'ברכל', 'קינג סטור',
        'מחסני מזון', 'סופר יהודה', 'סופר דוש', 'מעדניה', 'מאפיית', 'מאפיה',
        'קצביית', 'דברי מאפה', 'יקב', 'גבינות',
        'שוק העיר', 'שוק מהדרין', 'תנובה', 'שטראוס', 'יטבתה',
        'ביכורי השדה', 'סלסלת', '7-eleven', '7 eleven', '7-11',
        'פיצוצי', 'פיצוצייה', 'פיצוציה', 'קיוסק',
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
        # Delivery descriptors on Israeli cards are food orders, not couriers
        # ("מפגש גרונר משלוחים", the משלוחה ordering app, "הזמנת אוכל").
        'משלוחה', 'משלוחים', 'משלוח', 'הזמנת אוכל', 'delivery',
        'japanika', 'ג\'פניקה',
        'שיפודי', 'shipudei', 'restaurant',
        'starbucks', 'סטארבקס', 'מושלי',
        'עילאי', 'רשי 33',
        'קייטרינג', 'catering',
        'טאקו', 'taco', 'kfc', 'burger king', 'בורגר קינג',
        'subway', 'סאבוויי',
        'שניצל', 'גלידה', 'ice cream', 'בייקרי', 'bakery', 'מאפייה',
        'cafe', 'rest.',
        # ── More restaurants, cafes, bars & delivery ──
        'מזנון', 'ביסטרו', 'bistro', 'בראסרי', 'גריל', 'grill', 'טאבון',
        'pub', 'פאב', 'בירה', 'beer',
        'פיצה האט', 'pizza hut', 'בנדיקט', 'benedict', 'מוזס', 'moses',
        'אגאדיר', 'agadir', 'הומבורגר', 'גולדה', 'goldas', 'אניטה', 'anita',
        'מקס ברנר', 'max brenner', 'גירף', 'giraffe', 'טוני וספה',
        'בורגרים', 'הבורגר', 'שייקסבורגר', 'black bar',
        'קונדיטוריה', 'בייגל', 'bagel', 'דונאטס', 'donut', 'קרואסון',
        'cup o joe', 'ארקפה', 'arcaffe', 'נספרסו', 'nespresso',
        'קפה לואיז', 'ולנטינה', 'casa',
        'מקדונלדס', 'שקשוקה', 'קינוח', 'קינוחים', 'קונדטוריה', 'פטיסרי',
        'kermeet', 'קרמיט', 'המאסטרו', 'rosso vino',
    ],
    'תחבורה ורכבים': [
        'רב קו', 'רב-קו', 'ravkav', 'אגד', 'egged',
        'מטרופולין', 'metropoline', 'קווים', 'kavim',
        'רכבת ישראל', 'israel railways',
        'מונית', 'taxi', 'gett', 'yango', 'יאנגו', 'uber',
        'אוטובוס', 'חניה', 'חנייה', 'parking', 'פנגו', 'pango',
        'סלופארק', 'cellopark', 'cello park',
        'אי וויי', 'iway',
        'מוסך', 'מוסכים', 'מוסכי', 'garage', 'צמיגים', 'tires',
        'ביטוח רכב', 'רישוי', 'רישיון רכב', 'אגרה',
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
    'דלק, חשמל וגז': [
        'דלק', 'תדלוק', 'סונול', 'sonol', 'דור אלון', 'doralon',
        'delek', 'fuel', 'חברת החשמל', 'חשמל',
        'ten דלק',
        # ── More fuel stations & utility (gas/electric) ──
        'paz', 'yellow', 'מנטה', 'menta', 'אלונית', 'alonit',
        'תחנת דלק', 'דלקן', 'pazomat', 'פזומט',
        'סופרגז', 'supergas', 'אמישראגז', 'amisragas', 'פזגז', 'דורגז',
        'אמ.ש.ר.ג', 'בלוני גז', 'תאגיד החשמל',
        'דור-ארגמן', 'דור ארגמן', 'דור-האיצטדיון', 'דור -האיצטדיון',
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
        # ── More clinics, hospitals, labs, optics ──
        'אסותא', 'assuta', 'הרצליה מדיקל', 'איכילוב', 'תל השומר', 'שיבא',
        'רמב"ם', 'סורוקה', 'הדסה', 'בלינסון', 'וולפסון',
        'טרם', 'terem', 'ביקור רופא', 'מוקד רופאים', 'נטלי', 'natali',
        'שח"ל', 'femi', 'פמי', 'מעבדה', 'מעבדות', 'בדיקות דם',
        'אופטיקנה', 'אופטיק', 'הלפרין', 'ירדן אופטיק', 'erroca',
        'ארוקה', 'אורטופד', 'אורתודונט', 'שתל שיניים', 'יישור שיניים',
        'דיאטנית', 'תזונאי', 'נטורופת', 'הומאופת', 'קוסמטיקה רפואית', 'מדיקל',
        'l.b.y', 'lby group',
    ],
    'עירייה וממשלה': [
        'עירייה', 'עיריית', 'עירית', 'ארנונה',
        'משרד הפנים', 'משרד הרישוי',
        'רשות האוכלוסין', 'רשות המיסים',
        'מס הכנסה', 'ביטוח לאומי', 'מע"מ',
        'אגרת', 'קנס', 'דוח חניה',
        # ── More municipal / government / water ──
        'מועצה אזורית', 'מועצה מקומית', 'מתנ"ס', 'תאגיד מים', 'מי אביבים',
        'הגיחון', 'מי שבע', 'מי רעננה', 'מי נע', 'מים וביוב', 'מי כרמל',
        'מי רמת גן', 'מי לוד', 'מי ציונה', 'מי גליל', 'מי הרצליה',
        'מי מודיעין', 'מי בית שמש', 'מי נתניה', 'מי אונו', 'פלגי מוצקין',
        'דואר ישראל', 'דואר', 'רשות מקרקעי', 'טאבו', 'הוצאה לפועל',
        'בתי המשפט', 'משטרת ישראל', 'אגף הגביה', 'היטל', 'אגרות', 'מילגם',
        'מס במקור', 'ניכוי במקור', 'תשלום מס',
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
        # ── More electronics retailers & digital services ──
        'באג', 'מחסני חשמל', 'machsanei', 'שקם אלקטריק', 'shekem',
        'idigital', 'איי דיגיטל', 'istore', 'מקסטור', 'last price',
        'לאסט פרייס', 'pc center', 'הום אלקטרוניק', 'ולנשטיין',
        'temu', 'טמו', 'banggood', 'aliexpress',
        # NOTE: AI-tool keywords (openai/chatgpt/anthropic/claude/midjourney…)
        # were moved to the dedicated 'בינה מלאכותית' category and are applied
        # as an unconditional override (see AI_OVERRIDE_KEYWORDS below).
        'github',
        'adobe', 'canva', 'notion', 'dropbox', 'icloud', 'אייקלאוד',
        'office 365', 'microsoft 365', 'אופיס 365',
        'paramount', 'פרמאונט', 'apple tv', 'audible', 'kindle',
        'epic games', 'ubisoft', 'roblox', 'רובלוקס', 'twitch', 'discord',
        'אלקטרוניק', 'electronics', 'גיימינג', 'אודיו', 'audio',
        # Dev/cloud + streaming-adjacent subscriptions ("DIGITALOCEA"/"BROWSERBA"
        # are how the card descriptor truncates the full names).
        'render.com', 'digitalocean', 'digitalocea', 'alldebrid',
        'browserbase', 'browserba', 'televizo', 'iptv',
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
        'primadonna', 'קוסמטיקה', 'cosmetic',
        'איפור', 'makeup', 'בשמים', 'perfume',
        'לורן', 'lauren', 'טומי', 'tommy',
        # ── More fashion, footwear, beauty & jewelry ──
        'נקסט', 'next', 'gap', 'old navy', 'lacoste', 'לקוסט', 'ralph',
        'massimo', 'מסימו', 'oysho', 'אוישו', 'victoria', 'דלתא', 'delta',
        'reebok', 'ריבוק', 'under armour', 'new balance', 'crocs', 'קרוקס',
        'סקצ\'רס', 'skechers', 'timberland', 'aldo', 'אלדו', 'scoop', 'סקופ',
        'גולברי', 'golbary', 'אדיקה', 'adika', 'factory 54',
        'פקטורי 54', 'superdry', 'tfc', 'carter',
        'תכשיט', 'jewelry', 'pandora', 'פנדורה', 'magnolia', 'מגנוליה',
        'fossil', 'swarovski', 'סברובסקי', 'sephora', 'ספורה',
        'body shop', 'laline', 'ללין',
        'children', 'הלבשה', 'הנעלה', 'אאוטלט', 'outlet', 'סטוק פקטורי',
        'קוסמטיקס', 'pedro pps',
    ],
    'עיצוב הבית': [
        'איקאה', 'ikea', 'הום סנטר', 'home center',
        'ace hardware', 'מרכז השיפוצים', 'ריהוט',
        'עצמל"ה', 'home depot', 'שיפוצים',
        'כלי בית', 'מצעים', 'שטיח', 'וילון',
        'פוקס הום', 'fox home',
        'אלקטרה', 'electra',
        # ── More furniture, homeware, renovation ──
        'ביתילי', 'bitili', 'נעמן', 'naaman', 'ורדינון', 'vardinon',
        'כספי', 'תמי 4', 'tami4', 'עמינח', 'aminach', 'הוליווד',
        'רהיטי', 'furniture', 'מזרן', 'mattress', 'דורגל',
        'טמבור', 'tambour', 'נירלט', 'nirlat', 'צבע', 'paint',
        'כלי עבודה', 'ברזל', 'גמיש', 'urban', 'הכל לבית', 'בית וגן',
        'מ. שטרן', 'דקור', 'decor', 'wishlist', 'מיאדרה',
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
        # ── More cinemas (incl. Hebrew names), shows, sport, attractions ──
        'יס פלאנט', 'רב חן', 'רב-חן', 'גלובוס מקס', 'לב סינמה', 'סינמטק',
        'מוזיאון', 'museum', 'ספארי', 'safari', 'לונה פארק', 'סופרלנד',
        'גימבורי', 'gymboree', 'משחקייה', 'אסקייפ', 'חדר בריחה', 'באולינג',
        'bowling', 'קרטינג', 'karting', 'פיינטבול', 'לייזר טאג', 'סקייט',
        'דקאתלון', 'decathlon', 'מגה ספורט', 'sport5', 'אצטדיון',
        'טוטו', 'winner', 'ווינר', 'מפעל הפיס', 'pais',
        'זאפה', 'zappa', 'ברבי', 'barby', 'בלוק', 'האנגר', 'hangar',
        'הבימה', 'הקאמרי', 'בית ליסין', 'תיאטרון גשר', 'צוותא', 'היכל התרבות',
        'ספא', 'מכון כושר', 'energym', 'בלאק בוקס', 'קולנוע', 'מובילנד',
        'מאמאנט',
    ],
    'ביטוח': [
        'ביטוח', 'insurance', 'מגדל ביטוח',
        'כלל ביטוח', 'הפניקס', 'פוליסה', 'policy',
        # ── Insurance companies (specific forms to avoid mall/brand clashes) ──
        # NOTE: bare 'איילון' was removed — it matched "יס פלאנט איילון"
        # (a cinema at the Ayalon mall) and any purchase at קניון איילון.
        'איילון חב', 'איילון ביטוח', 'ביטוח איילון', 'איילון פנסיה',
        'הראל ביטוח', 'הראל פנסיה', 'הראל השקעות', 'מנורה מבטחים',
        'הכשרה ביטוח', 'ביטוח ישיר', 'ביטוח חקלאי', 'שירביט', 'shirbit',
        'ליברה', 'libra', 'wobi', 'וובי', '9 מיליון', 'aig', 'איי איי ג\'י',
        'פספורטכרד', 'passportcard', 'דייויד שילד', 'davidshield',
        'קצין הביטוח', 'דמי ביטוח', 'גמל', 'פנסיה', 'השתלמות',
    ],
    'שירותי תקשורת': [
        'סלקום', 'cellcom', 'פרטנר', 'partner',
        'הוט מובייל', 'hot mobile', 'הוט נט', 'hot net',
        'בזק', 'bezeq', 'פלאפון', 'pelephone',
        'גולן טלקום', 'golan telecom',
        'we4g',
        'סלולר', 'cellular',
        'רמי לוי תקשורת',
        # ── More ISPs / telecom ──
        '012', '013', '014', '019', 'נטוויז\'ן', 'netvision',
        'triple c', 'אינטרנט רימון', 'fiber', 'סיבים', 'פרי tv',
        'free telecom', 'הוט טלקום', 'partner tv', 'yes tv',
    ],
    'העברת כספים': [
        'העברה', 'העברה ל', 'העברה מ', 'העברת כספים', 'העברה בנקאית',
        'paypal', 'פייפאל',
        'paybox', 'פייבוקס', 'pepper', 'פפר',
        'western union', 'ווסטרן יוניון',
        # ── More money-transfer services ──
        'moneygram', 'מאני גרם', 'gmt', 'העברת זה"ב', 'wire transfer',
        'remitly', 'wise transfer',
    ],
    'חיות מחמד': [
        'וטרינר', 'veterinary', 'חיות מחמד', 'חיות',
        'פט שופ', 'pet shop', 'pet store',
        'מזון לחיות', 'כלב', 'חתול',
        'אניפט', 'anipet', 'פטלנד', 'petland',
        'תן לחיות',
        # ── More pet shops / services ──
        'פטס', 'all4pet', 'biopet', 'דוקטור בייקר', 'אקווריום',
        'aquarium', 'פנסיון כלבים', 'מספרת כלבים', 'אילוף כלבים', 'וט מרקט',
        'ספידוג', 'דוג סנטר',
    ],
    'משיכת מזומן': [
        'משיכת מזומן', 'משיכת מזומנים', 'מזומנים', 'כספומט', 'atm',
        'cash withdrawal', 'מזומן', 'בנקומט',
    ],
    'חינוך ולימודים': [
        'אוניברסיטה', 'university', 'מכללה', 'college',
        'בית ספר', 'school', 'גן ילדים', 'kindergarten',
        'שכר לימוד', 'tuition', 'קורס', 'course',
        'ספרים', 'books', 'סטימצקי', 'steimatzky',
        'צעצועים', 'toys',
        # ── More education / childcare / courses ──
        'צהרון', 'מעון', 'משפחתון', 'גנון', 'קייטנה', 'מתנ"ס',
        'קונסרבטוריון', 'שיעור', 'מורה פרטי', 'אולפן', 'ברליץ', 'berlitz',
        'wall street', 'udemy', 'coursera', 'duolingo', 'דואולינגו',
        'מורה לנהיגה', 'שיעורי נהיגה', 'בית ספר לנהיגה', 'אקדמיה',
        'הטכניון', 'ספרי לימוד', 'משחקי קופסה', 'lego', 'לגו',
        'אקדמיה ל', 'הסמכה',
    ],
    'מתנות': [
        'buyme', 'buy me', 'ביי-מי', 'ביי מי', 'ביימי',
        'שוברי מתנה', 'שובר מתנה', 'gift card', 'giftcard',
    ],
    'מנויים ושירותים': [
        'מנוי', 'subscription',
        'membership', 'annual fee',
        'דמי ניהול', 'עמלת',
        'google one',
        # ── More subscriptions / service fees ──
        'דמי כרטיס', 'דמי חבר', 'דמי שירות', 'דמי טיפול', 'patreon',
        'פטראון', 'substack', 'linkedin', 'לינקדאין', 'zoom', 'amazon prime',
        'דמי מנוי', 'חידוש מנוי',
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
    'פנאי, בידור וספורט': ['gym', 'פארק', 'park', 'פיס'],
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


# ── AI tools → dedicated category ───────────────────────────────────
# These merchants used to live under 'חשמל ומחשבים'. They now get their
# own category, applied as an UNCONDITIONAL override (like Psagot / foreign
# card) so it re-tags rows that arrived already categorized — existing
# snapshots migrate on the next restore without a bank-sync re-pull.
# Matched case-insensitively via substring. Keep this list curated to
# well-known AI products to avoid false positives (e.g. avoid bare 'gemini'
# / 'suno' which collide with non-AI merchants).
AI_CATEGORY = 'בינה מלאכותית'
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
    ('מזון מהיר', 'מסעדות, קפה וברים'),
    ('מסעד', 'מסעדות, קפה וברים'),
    ('בתי קפה', 'מסעדות, קפה וברים'),
    ('בתי אוכל', 'מסעדות, קפה וברים'),
    ('סופרמרקט', 'מזון וצריכה'),
    ('רשתות שיווק', 'מזון וצריכה'),
    ('מרכול', 'מזון וצריכה'),
    ('מזון', 'מזון וצריכה'),
    ('אלקטרוניקה', 'חשמל ומחשבים'),
    ('מחשבים', 'חשמל ומחשבים'),
    ('סלולר', 'שירותי תקשורת'),
    ('תקשורת', 'שירותי תקשורת'),
    ('דלק', 'דלק, חשמל וגז'),
    ('תחנות תדלוק', 'דלק, חשמל וגז'),
    ('גז', 'דלק, חשמל וגז'),
    ('חשמל', 'דלק, חשמל וגז'),
    ('תחבורה', 'תחבורה ורכבים'),
    ('חניה', 'תחבורה ורכבים'),
    ('חניונים', 'תחבורה ורכבים'),
    ('מוניות', 'תחבורה ורכבים'),
    ('רכב', 'תחבורה ורכבים'),
    ('מוסך', 'תחבורה ורכבים'),
    ('תעופה', 'טיסות ותיירות'),
    ('טיסות', 'טיסות ותיירות'),
    ('תיירות', 'טיסות ותיירות'),
    ('מלונות', 'טיסות ותיירות'),
    ('בתי מלון', 'טיסות ותיירות'),
    ('נופש', 'טיסות ותיירות'),
    ('ביגוד', 'אופנה'),
    ('הלבשה', 'אופנה'),
    ('הנעלה', 'אופנה'),
    ('אופנה', 'אופנה'),
    ('קוסמטיקה', 'אופנה'),
    ('תכשיט', 'אופנה'),
    ('ריהוט', 'עיצוב הבית'),
    ('כלי בית', 'עיצוב הבית'),
    ('בית וגן', 'עיצוב הבית'),
    ('שיפוצים', 'עיצוב הבית'),
    ('בריאות', 'רפואה ובתי מרקחת'),
    ('רפואה', 'רפואה ובתי מרקחת'),
    ('מרקחת', 'רפואה ובתי מרקחת'),
    ('פארם', 'רפואה ובתי מרקחת'),
    ('אופטיקה', 'רפואה ובתי מרקחת'),
    ('פנאי', 'פנאי, בידור וספורט'),
    ('בידור', 'פנאי, בידור וספורט'),
    ('ספורט', 'פנאי, בידור וספורט'),
    ('תרבות', 'פנאי, בידור וספורט'),
    ('בילוי', 'פנאי, בידור וספורט'),
    ('ביטוח', 'ביטוח'),
    ('חינוך', 'חינוך ולימודים'),
    ('לימודים', 'חינוך ולימודים'),
    ('ספרים', 'חינוך ולימודים'),
    ('צעצועים', 'חינוך ולימודים'),
    ('חיות', 'חיות מחמד'),
    ('עירייה', 'עירייה וממשלה'),
    ('עיריות', 'עירייה וממשלה'),
    ('ממשל', 'עירייה וממשלה'),
    ('רשויות', 'עירייה וממשלה'),
    ('מיסים', 'עירייה וממשלה'),
    ('דואר', 'עירייה וממשלה'),
    ('כספומט', 'משיכת מזומן'),
    ('מזומן', 'משיכת מזומן'),
    ('העברות', 'העברת כספים'),
    ('העברת כספים', 'העברת כספים'),
    ('מתנות', 'מתנות'),
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
SUBCATEGORY_KEYWORDS: dict[str, dict[str, list[str]]] = {
    'רפואה ובתי מרקחת': {
        'טיפול זוגי': ['l.b.y', 'lby group', 'טיפול זוגי', 'מטפלת זוגית'],
        'קופות חולים': ['מכבי', 'maccabi', 'כללית', 'clalit', 'מאוחדת',
                          'לאומית שירותי בריאות'],
        'בתי מרקחת': ['בית מרקחת', 'מרקחת', 'pharm', 'פארם'],
    },
    'מזון וצריכה': {
        # פארם first ('סופר פארם' must not fall to a סופרים keyword), then
        # סופרים (chains like 'יינות ביתן' must not fall to the 'יין' keyword
        # of אלכוהול ומשקאות — first subcategory wins).
        'פארם וטיפוח': ['סופר פארם', 'סופר-פארם', 'super pharm', 'superpharm',
                          'super-pharm', 'גוד פארם', 'good pharm', 'ניו פארם'],
        'חנויות סטוק': ['סטוק סנטר', 'booom', 'זול סטוק', 'מקס סטוק',
                          'max stock', 'זול בשפע', 'כלבו חצי חינם'],
        'סופרים': ['שופרסל', 'shufersal', 'רמי לוי', 'rami levy', 'ויקטורי',
                    'victory', 'יינות ביתן', 'טיב טעם', 'tiv taam', 'אושר עד',
                    'osher ad', 'חצי חינם', 'יוחננוף', 'yochananof', 'קרפור',
                    'carrefour', 'מגה בעיר', 'זול ובגדול', 'נתיב החסד', 'ברכל',
                    'שוק העיר', 'סופרמרקט', 'supermarket', 'מינימרקט', 'פרימדונה',
                    'מיני מרקט', 'מכולת', 'am:pm', 'אי אם פי אם', 'פרשמרקט',
                    'freshmarket', 'fresh market'],
        'מאפיות': ['מאפיה', 'מאפיית', 'מאפה', 'דברי מאפה', 'קונדיטוריה',
                    'בייקרי', 'bakery', 'roladin', 'רולדין', 'לחם'],
        'קצביות ודגים': ['קצביה', 'קצביית', 'אטליז', 'בשר', 'עוף', 'דגים'],
        'אלכוהול ומשקאות': ['יין', 'wine', 'אלכוהול', 'משקאות', 'יקב',
                              'בירה', 'beer'],
        'שוברי מזון': ['סיבוס', 'cibus', 'תן ביס', 'pluxee', 'פלאקסי',
                        '10bis', 'תנביס'],
    },
    'חשמל ומחשבים': {
        'סטרימינג': ['netflix', 'נטפליקס', 'disney', 'דיסני', 'hbo',
                      'youtube', 'יוטיוב', 'spotify', 'ספוטיפיי', 'apple tv',
                      'prime video', 'אמזון פריים', 'apple.com/bill',
                      'crunchyroll', 'twitch'],
        'שירותי ענן': ['digitalocean', 'render.com', 'scrapingbee', 'aws',
                        'amazon web', 'google cloud', 'azure', 'github',
                        'gitlab', 'vercel', 'netlify', 'heroku', 'cloudflare',
                        'google one', 'icloud', 'dropbox', 'onedrive',
                        'microsoft', 'office 365', 'גוגל אחסון', 'wix',
                        'godaddy', 'namecheap', 'alldebrid'],
        'חנויות חשמל': ['שקם אלקטריק', 'מחסני חשמל', 'באג', 'bug', 'ksp',
                         'אייבורי', 'ivory', 'אלקטרה', 'זאפ', 'שיא החשמל',
                         'idigital', 'איי דיגיטל', 'istore', 'מקסטור',
                         'last price', 'לאסט פרייס'],
        'קניות אונליין': ['aliexpress', 'עלי אקספרס', 'amazon', 'אמזון',
                           'ebay', 'איביי', 'temu', 'טמו', 'banggood',
                           'gearbest', 'shein'],
    },
    'אופנה': {
        'רשתות אופנה': ['גולף', 'golf', 'קסטרו', 'castro', 'פוקס', 'fox',
                          'רנואר', 'renuar', 'זארה', 'zara', 'h&m', 'אייץ אנד אם',
                          'מנגו', 'mango', 'ברשקה', 'bershka', 'פול אנד בר',
                          'pull&bear', 'pull and bear', 'טרמינל', 'terminal x',
                          'אורבניקה', 'urbanica', 'אמריקן איגל', 'american eagle',
                          'ריזרבד', 'reserved', 'הודיס', 'hoodies',
                          'טוונטי פור סבן', 'twentyfourseven', 'delta', 'דלתא',
                          'intima', 'אינטימה'],
        'נעליים': ['נעלי', 'shoes', 'סקצ', 'skechers', 'nike', 'נייק',
                     'אדידס', 'adidas', 'new balance', 'ניו באלנס', 'קרוקס',
                     'crocs', 'טימברלנד', 'timberland', 'סטיב מאדן',
                     'steve madden', 'אלדו', 'aldo', 'to go', 'טו גו'],
        'קוסמטיקה': ['קוסמטיק', 'cosmetic', 'בשמים', 'perfume', 'פרפיום',
                       'סבון', 'lush', 'לאש', 'kiko', 'קיקו', 'sephora',
                       'ספורה', 'yves rocher', 'איב רושה', 'לוריאל', 'loreal',
                       'מייקאפ', 'makeup', 'לייף סטייל'],
        'תכשיטים ואקססוריז': ['פנדורה', 'pandora', 'תכשיט', 'jewel',
                                 'מגנוליה', 'magnolia', 'אימפרס', 'impress',
                                 'שעוני', 'משקפי', 'אופטיק', 'optic'],
    },
    'תחבורה ורכבים': {
        'כבישי אגרה': ['כביש 6', 'כביש אגרה', 'רב-פס', 'רב פס', 'מנהרות',
                         'מנהרת', 'אגרה', 'חוצה ישראל', 'חוצה צפון'],
        'חניונים': ['חניון', 'חניה', 'חנייה', 'parking', 'פנגו', 'pango',
                      'סלופארק', 'cellopark', 'אחוזת חוף'],
        'תחבורה ציבורית': ['רב קו', 'רב-קו', 'ravkav', 'אגד', 'egged',
                              'מטרופולין', 'קווים', 'kavim', 'רכבת', 'מטרונית',
                              'דן באב', 'באבל דן', 'אוטובוס', 'סופרבוס'],
        'מוניות ונסיעות': ['gett', 'מונית', 'taxi', 'yango', 'יאנגו', 'uber',
                             'autotel', 'אוטוטל', 'car2go', 'ווואש', 'woosh'],
        'מוסכים וטיפולים': ['מוסך', 'garage', 'צמיג', 'פנצ', 'גרר', 'מצבר',
                               'חלפים', 'מכון רישוי', 'בדיקת רכב', 'שטיפת רכב',
                               'רחיצת', 'car wash', 'מכונאי'],
    },
    'מסעדות, קפה וברים': {
        'משלוחי אוכל': ['wolt', 'וולט', '10bis', 'תנביס', 'משלוחה',
                          'משלוחים', 'משלוח', 'הזמנת אוכל', 'delivery'],
        'בתי קפה': ['קפה', 'cafe', 'coffee', 'ארומה', 'aroma', 'לנדוור',
                      'landwer', 'גרג', 'greg', 'אספרסו', 'espresso',
                      'starbucks', 'סטארבקס', 'קפולסקי', 'רולדין'],
        'מזון מהיר': ['מקדונלד', 'mcdonald', 'בורגר', 'burger', 'kfc',
                        'פיצה', 'פיצריה', 'pizza', 'דומינו', 'domino',
                        'שווארמה', 'פלאפל', 'falafel', 'טאקו', 'taco',
                        'ג\'פניקה', 'japanika', 'סושי', 'sushi'],
    },
    'פנאי, בידור וספורט': {
        'פיס והימורים': ['מפעל הפיס', 'פיס מרכז', 'לוטו', 'טוטו', 'ווינר',
                           'winner', 'הימורים', 'חיש גד'],
        'קולנוע': ['סינמה', 'cinema', 'יס פלאנט', 'yes planet', 'רב חן',
                    'רב-חן', 'גלובוס מקס', 'לב סינמה', 'קולנוע', 'מובילנד',
                    'סינמטק'],
        'מופעים והופעות': ['הופעה', 'מופע', 'הצגה', 'תיאטרון', 'eventim',
                             'כרטיסים', 'היכל התרבות', 'זאפה', 'zappa', 'ברבי',
                             'barby', 'הבימה', 'הקאמרי', 'בית ליסין',
                             'תיאטרון גשר', 'צוותא'],
        'ספורט וכושר': ['חדר כושר', 'מכון כושר', 'כושר', 'הולמס פלייס',
                          'holmes place', 'יוגה', 'yoga', 'פילאטיס', 'pilates',
                          'בריכה', 'שחייה', 'gym', 'energym', 'ספורט', 'sport',
                          'דקאתלון', 'decathlon'],
        'אטרקציות': ['מוזיאון', 'museum', 'ספארי', 'safari', 'גן חיות', 'zoo',
                       'לונה פארק', 'סופרלנד', 'משחקייה', 'גימבורי', 'gymboree',
                       'חדר בריחה', 'אסקייפ', 'באולינג', 'bowling', 'קרטינג',
                       'karting'],
    },
}

# Optional emoji per seeded subcategory (UI nicety; falls back in the UI).
SUBCATEGORY_ICONS: dict[str, str] = {
    'סופרים': '🛒', 'מאפיות': '🥐', 'פארם וטיפוח': '🧴', 'חנויות סטוק': '🧺',
    'קופות חולים': '🏥', 'בתי מרקחת': '💊',
    'רשתות אופנה': '👕', 'נעליים': '👟', 'קוסמטיקה': '💄', 'תכשיטים ואקססוריז': '💍',
    'כבישי אגרה': '🛣️', 'חניונים': '🅿️', 'תחבורה ציבורית': '🚌', 'מוניות ונסיעות': '🚕', 'מוסכים וטיפולים': '🔧',
    'משלוחי אוכל': '🛵', 'בתי קפה': '☕', 'מזון מהיר': '🍔', 'פיס והימורים': '🎰',
    'סטרימינג': '📺', 'שירותי ענן': '☁️', 'חנויות חשמל': '🔌', 'קניות אונליין': '📦', 'קצביות ודגים': '🥩', 'אלכוהול ומשקאות': '🍷',
    'שוברי מזון': '🎫',
    'קולנוע': '🎬', 'מופעים והופעות': '🎭', 'ספורט וכושר': '🏋️',
    'אטרקציות': '🎡',
    'טיפול זוגי': '💞',
}


def get_icon(category: str) -> str:
    return CATEGORY_ICONS.get(category, '📋')


def get_subcategory_catalog() -> dict[str, list[str]]:
    """Parent category → list of seeded subcategory names (for the UI)."""
    return {parent: list(subs.keys()) for parent, subs in SUBCATEGORY_KEYWORDS.items()}
