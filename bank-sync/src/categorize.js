// GENERATED FILE — do not edit by hand.
// Faithful JS port of the backend keyword categorizer
// (backend/app/core/constants.py + the ordering in data_processor.py /
// routes.py restore_session). Regenerate after any constants.py change:
//     cd backend && python scripts/generate_bank_sync_categorize.py
// No AI here — the dashboard's /restore-session still runs the AI fallback +
// user category rules on top, so anything left as 'שונות' is resolved
// server-side exactly as for an uploaded file.

const CHECK_WITHDRAWAL_KEYWORDS = ["משיכת שיקים", "משיכת שיק", "שיק", "שיקים", "צ'ק", "צק", "המחאה", "cheque", "check withdrawal"]

const STANDING_ORDER_KEYWORDS = ["הוראת קבע", "הו\"ק", "הוק", "standing order", "הוראות קבע"]

// keyword → category, in priority order. Mirrors _CATEGORY_KEYWORDS.
const CATEGORY_KEYWORDS = {
  "טיסות ותיירות": ["booking", "airbnb", "hotels.com", "expedia", "tripadvisor", "hostel", "hotel", "אירביאנבי", "בוקינג", "טיסה", "טיסות", "flight", "airline", "airways", "אל על", "el al", "wizz air", "ryanair", "easyjet", "turkish air", "lufthansa", "aegean", "united airlines", "british airways", "מלון", "מלונות", "resort", "נופש", "vacation", "duty free", "דיוטי פרי", "תיירות", "tourism", "travel", "אטרקציה", "attraction", "דרכון", "passport", "visa fee", "אגודה", "agoda", "kayak", "skyscanner", "הרץ", "hertz", "avis rent", "budget rent", "סיקסט", "sixt", "איסתא", "issta", "אופיר טורס", "ophir tours", "דיזנהויז", "גוליבר", "ארקיע", "arkia", "ישראייר", "israir", "wizzair", "pegasus", "דקה 90", "eldan", "אלדן", "lastminute", "fattal", "פתאל", "isrotel", "ישרוטל", "דן פנורמה", "לאונרדו", "leonardo", "club hotel", "קלאב הוטל", "הרברט סמואל", "רימונים", "צימר", "zimmer", "אכסניה", "אכסניית", "trip.com", "getyourguide", "rentalcars", "נסיעות לחו\"ל", "חבילת נופש", "בתי מלון", "קווי חופשה", "airbaltic", "air baltic", "ניו ויז'ן טורס", "elal", "אייר חיפה", "air haifa", "etihad", "airalo", "double tree", "doubletree", "hilton", "kohchang", "koh chang", "railninja", "rail ninja", "rajadha", "olive young", "lottebaikhoajeom"],
  "אוכל": ["פרימדונה", "שופרסל", "רמי לוי", "מגה", "יוחננוף", "אושר עד", "חצי חינם", "ויקטורי", "טיב טעם", "פרש מרקט", "סופר", "מכולת", "קרפור", "מינימרקט", "am:pm", "קואופ", "נתיב החסד", "סטופ מרקט", "זול ובגדול", "שפע שוק", "מחסני השוק", "פרשמרקט", "כלבו", "מרקט", "פרי", "ירק", "ירקות", "פירות", "בית הפרי", "ממתק", "ממתקי", "מתוק", "שוקולד", "חלבי", "מאפה", "בשר", "עוף", "דגים", "קצביה", "אטליז", "grocery", "יין", "wine", "אלכוהול", "משקאות", "סיבוס", "cibus", "תן ביס", "pluxee", "פלאקסי", "wolt", "וולט", "10bis", "תנביס", "משלוחה", "משלוחים", "משלוח", "הזמנת אוכל", "delivery", "shufersal", "rami levy", "osher ad", "יינות ביתן", "סופרמרקט", "מרכול", "יש חסד", "יש בשכונה", "ברכל", "קינג סטור", "מחסני מזון", "סופר יהודה", "סופר דוש", "מעדניה", "מאפיית", "מאפיה", "קצביית", "דברי מאפה", "יקב", "גבינות", "בייקרי", "bakery", "מאפייה", "קונדיטוריה", "קונדטוריה", "קונדיטורית", "פטיסרי", "קרואסון", "שוק העיר", "שוק מהדרין", "תנובה", "שטראוס", "יטבתה", "ביכורי השדה", "סלסלת", "7-eleven", "7 eleven", "7-11", "פיצוצי", "פיצוצייה", "פיצוציה", "קיוסק"],
  "בילויים": ["מסעדה", "מסעדת", "קפה ", "בית קפה", "פיצה", "פיצריה", "סושי", "בורגר", "שווארמה", "פלאפל", "חומוס", "מקדונלד", "mcdonald", "דומינו", "domino", "פאפא ג'ונס", "papa john", "ארומה", "aroma", "cofix", "קופיקס", "קפה קפה", "cafe cafe", "לנדוור", "landwer", "רולדין", "roladin", "גרג", "greg", "אספרסו", "espresso", "japanika", "ג'פניקה", "שיפודי", "shipudei", "restaurant", "starbucks", "סטארבקס", "מושלי", "עילאי", "רשי 33", "קייטרינג", "catering", "טאקו", "taco", "kfc", "burger king", "בורגר קינג", "subway", "סאבוויי", "שניצל", "גלידה", "ice cream", "cafe", "rest.", "מזנון", "ביסטרו", "bistro", "בראסרי", "גריל", "grill", "טאבון", "pub", "פאב", "בירה", "beer", "פיצה האט", "pizza hut", "בנדיקט", "benedict", "מוזס", "moses", "אגאדיר", "agadir", "הומבורגר", "גולדה", "goldas", "אניטה", "anita", "מקס ברנר", "max brenner", "גירף", "giraffe", "טוני וספה", "בורגרים", "הבורגר", "שייקסבורגר", "black bar", "בייגל", "bagel", "דונאטס", "donut", "cup o joe", "ארקפה", "arcaffe", "נספרסו", "nespresso", "קפה לואיז", "ולנטינה", "casa", "מקדונלדס", "שקשוקה", "קינוח", "קינוחים", "kermeet", "קרמיט", "המאסטרו", "rosso vino", "סינמה", "cinema", "סינמה סיטי", "yes planet", "הופעה", "כרטיסים", "eventim", "לאן", "leaan", "הצגה", "מופע", "תיאטרון", "גן חיות", "zoo", "יס פלאנט", "רב חן", "רב-חן", "גלובוס מקס", "לב סינמה", "סינמטק", "מוזיאון", "museum", "ספארי", "safari", "לונה פארק", "סופרלנד", "גימבורי", "gymboree", "משחקייה", "אסקייפ", "חדר בריחה", "באולינג", "bowling", "קרטינג", "karting", "פיינטבול", "לייזר טאג", "סקייט", "טוטו", "winner", "ווינר", "מפעל הפיס", "pais", "זאפה", "zappa", "ברבי", "barby", "בלוק", "האנגר", "hangar", "הבימה", "הקאמרי", "בית ליסין", "תיאטרון גשר", "צוותא", "היכל התרבות", "בלאק בוקס", "קולנוע", "מובילנד"],
  "הוצאות משתנות": ["רב קו", "רב-קו", "ravkav", "אגד", "egged", "מטרופולין", "metropoline", "קווים", "kavim", "רכבת ישראל", "israel railways", "מונית", "taxi", "gett", "yango", "יאנגו", "uber", "אוטובוס", "חניה", "חנייה", "parking", "פנגו", "pango", "סלופארק", "cellopark", "cello park", "אי וויי", "iway", "מוסך", "מוסכים", "מוסכי", "garage", "צמיגים", "tires", "רישוי", "רישיון רכב", "אגרה", "כביש 6", "כביש אגרה", "מנהרות", "מנהרת", "tunnel", "רכבת קלה", "הרכבת הקלה", "מטרונית", "דן באב", "autotel", "אוטוטל", "car2go", "sharenow", "באבל דן", "אחוזת חוף", "חניון", "parking lot", "שטיפת רכב", "רחיצת", "car wash", "מכונאי", "פנצ'ר", "גרר", "מצבר", "חלפים", "מכון רישוי", "בדיקת רכב", "ליסינג", "leasing", "אלבר", "albar", "קל אוטו", "אוויס רנט", "אלדן רכב", "ניו קופל", "קרית הרכב", "קריית הרכב", "מרכז הרכב", "תחבורה", "רב-פס", "רב פס", "ווואש", "woosh"],
  "הוצאות שוטפות": ["דלק", "תדלוק", "סונול", "sonol", "דור אלון", "doralon", "delek", "fuel", "חברת החשמל", "חשמל", "ten דלק", "paz", "yellow", "מנטה", "menta", "אלונית", "alonit", "תחנת דלק", "דלקן", "pazomat", "פזומט", "סופרגז", "supergas", "אמישראגז", "amisragas", "פזגז", "דורגז", "אמ.ש.ר.ג", "בלוני גז", "תאגיד החשמל", "דור-ארגמן", "דור ארגמן", "דור-האיצטדיון", "דור -האיצטדיון", "עירייה", "עיריית", "עירית", "ארנונה", "משרד הפנים", "משרד הרישוי", "רשות האוכלוסין", "רשות המיסים", "מס הכנסה", "ביטוח לאומי", "מע\"מ", "אגרת", "קנס", "דוח חניה", "מועצה אזורית", "מועצה מקומית", "תאגיד מים", "מי אביבים", "הגיחון", "מי שבע", "מי רעננה", "מי נע", "מים וביוב", "מי כרמל", "מי רמת גן", "מי לוד", "מי ציונה", "מי גליל", "מי הרצליה", "מי מודיעין", "מי בית שמש", "מי נתניה", "מי אונו", "פלגי מוצקין", "דואר ישראל", "דואר", "רשות מקרקעי", "טאבו", "הוצאה לפועל", "בתי המשפט", "משטרת ישראל", "אגף הגביה", "היטל", "אגרות", "מילגם", "מס במקור", "ניכוי במקור", "תשלום מס", "ביטוח", "insurance", "מגדל ביטוח", "ביטוח רכב", "כלל ביטוח", "הפניקס", "פוליסה", "policy", "איילון חב", "איילון ביטוח", "ביטוח איילון", "איילון פנסיה", "הראל ביטוח", "הראל פנסיה", "הראל השקעות", "מנורה מבטחים", "הכשרה ביטוח", "ביטוח ישיר", "ביטוח חקלאי", "שירביט", "shirbit", "ליברה", "libra", "wobi", "וובי", "9 מיליון", "aig", "איי איי ג'י", "פספורטכרד", "passportcard", "דייויד שילד", "davidshield", "קצין הביטוח", "דמי ביטוח", "גמל", "פנסיה", "השתלמות", "סלקום", "cellcom", "פרטנר", "partner", "הוט מובייל", "hot mobile", "הוט נט", "hot net", "בזק", "bezeq", "פלאפון", "pelephone", "גולן טלקום", "golan telecom", "we4g", "סלולר", "cellular", "רמי לוי תקשורת", "012", "013", "014", "019", "נטוויז'ן", "netvision", "triple c", "אינטרנט רימון", "fiber", "סיבים", "פרי tv", "free telecom", "הוט טלקום", "partner tv", "yes tv", "שכר דירה", "שכירות", "נטפליקס", "netflix", "ספוטיפיי", "spotify", "youtube", "יוטיוב", "disney", "דיסני", "hbo", "prime video", "paramount", "פרמאונט", "apple tv", "audible", "kindle", "televizo", "iptv", "מנוי", "subscription", "membership", "annual fee", "דמי ניהול", "עמלת", "דמי כרטיס", "דמי חבר", "דמי שירות", "דמי טיפול", "patreon", "פטראון", "substack", "linkedin", "לינקדאין", "zoom", "amazon prime", "דמי מנוי", "חידוש מנוי"],
  "תרופות וטיפולים": ["מכבי", "כללית", "מאוחדת", "לאומית", "בית מרקחת", "pharmacy", "רוקח", "רופא", "דוקטור", "doctor", "dr.", "מרפאה", "מרפאת", "clinic", "דנטל", "dental", "שיניים", "רופא שיניים", "אופטיקה", "optic", "משקפיים", "עדשות", "פיזיותרפיה", "physiotherapy", "כירופרקט", "פסיכולוג", "פסיכיאטר", "therapist", "therapy", "בית חולים", "hospital", "תרופות", "medication", "אסותא", "assuta", "הרצליה מדיקל", "איכילוב", "תל השומר", "שיבא", "רמב\"ם", "סורוקה", "הדסה", "בלינסון", "וולפסון", "טרם", "terem", "ביקור רופא", "מוקד רופאים", "נטלי", "natali", "שח\"ל", "femi", "פמי", "מעבדה", "מעבדות", "בדיקות דם", "אופטיקנה", "אופטיק", "הלפרין", "ירדן אופטיק", "erroca", "ארוקה", "אורטופד", "אורתודונט", "שתל שיניים", "יישור שיניים", "דיאטנית", "תזונאי", "נטורופת", "הומאופת", "קוסמטיקה רפואית", "מדיקל", "l.b.y", "lby group"],
  "פארם": ["סופר פארם", "סופר-פארם", "super pharm", "super-pharm", "superpharm", "גוד פארם", "good pharm", "ניו פארם", "new pharm", "פארם", "pharm", "דראגסטור", "drugstore"],
  "טכנולוגיה": ["apple", "אפל", "google", "גוגל", "מיקרוסופט", "microsoft", "steam", "playstation", "xbox", "nintendo", "app store", "חנות אפליקציות", "github", "adobe", "canva", "notion", "dropbox", "icloud", "אייקלאוד", "office 365", "microsoft 365", "אופיס 365", "epic games", "ubisoft", "roblox", "רובלוקס", "twitch", "discord", "גיימינג", "render.com", "digitalocean", "digitalocea", "alldebrid", "browserbase", "browserba"],
  "קניות": ["באג מולטי", "bug multi", "ksp", "איביי", "ebay", "אמזון", "amazon", "אלי אקספרס", "aliexpress", "ali express", "אייבורי", "ivory", "מחשבים", "samsung", "סמסונג", "dell", "lenovo", "שיאומי", "xiaomi", "באג", "מחסני חשמל", "machsanei", "שקם אלקטריק", "shekem", "idigital", "איי דיגיטל", "istore", "מקסטור", "last price", "לאסט פרייס", "pc center", "הום אלקטרוניק", "ולנשטיין", "temu", "טמו", "banggood", "אלקטרוניק", "electronics", "אודיו", "audio", "זארה", "zara", "h&m", "פול אנד בר", "pull&bear", "מנגו", "mango", "קסטרו", "castro", "אמריקן איגל", "american eagle", "נעלי", "shoes", "בגדי", "רנואר", "renuar", "תמנון", "שילב", "shilav", "טרמינל", "terminal x", "אסוס", "asos", "נייקי", "nike", "אדידס", "adidas", "פומה", "סטרדיווריוס", "stradivarius", "ברשקה", "bershka", "intimissimi", "calzedonia", "נעליים", "primadonna", "לורן", "lauren", "טומי", "tommy", "נקסט", "next", "gap", "old navy", "lacoste", "לקוסט", "ralph", "massimo", "מסימו", "oysho", "אוישו", "victoria", "דלתא", "delta", "reebok", "ריבוק", "under armour", "new balance", "crocs", "קרוקס", "סקצ'רס", "skechers", "timberland", "aldo", "אלדו", "scoop", "סקופ", "גולברי", "golbary", "אדיקה", "adika", "factory 54", "פקטורי 54", "superdry", "tfc", "carter", "תכשיט", "jewelry", "pandora", "פנדורה", "magnolia", "מגנוליה", "fossil", "swarovski", "סברובסקי", "children", "הלבשה", "הנעלה", "אאוטלט", "outlet", "סטוק פקטורי", "pedro pps", "איקאה", "ikea", "הום סנטר", "home center", "ace hardware", "מרכז השיפוצים", "ריהוט", "עצמל\"ה", "home depot", "שיפוצים", "כלי בית", "מצעים", "שטיח", "וילון", "פוקס הום", "fox home", "אלקטרה", "electra", "ביתילי", "bitili", "נעמן", "naaman", "ורדינון", "vardinon", "כספי", "תמי 4", "tami4", "עמינח", "aminach", "הוליווד", "רהיטי", "furniture", "מזרן", "mattress", "דורגל", "טמבור", "tambour", "נירלט", "nirlat", "צבע", "paint", "כלי עבודה", "ברזל", "גמיש", "urban", "הכל לבית", "בית וגן", "מ. שטרן", "דקור", "decor", "wishlist", "מיאדרה", "סטוק סנטר", "booom", "זול סטוק", "מקס סטוק", "max stock"],
  "טיפוח": ["קוסמטיקה", "cosmetic", "קוסמטיקס", "איפור", "makeup", "מייקאפ", "בשמים", "perfume", "פרפיום", "sephora", "ספורה", "body shop", "laline", "ללין", "lush", "לאש", "kiko", "קיקו", "yves rocher", "איב רושה", "לוריאל", "loreal", "לייף סטייל", "מספרה", "מספרת", "עיצוב שיער", "מעצב שיער", "ברבר", "barber", "מכון יופי", "קוסמטיקאית", "מניקור", "פדיקור", "ציפורניים", "לק ג'ל", "בניית ציפורניים", "הסרת שיער", "שעווה"],
  "חוגים וספורט": ["חדר כושר", "הולמס פלייס", "holmes place", "ספורט", "sport", "כושר", "חוג", "חוגים", "סדנה", "workshop", "בריכה", "שחייה", "swimming", "יוגה", "yoga", "פילאטיס", "pilates", "דקאתלון", "decathlon", "מגה ספורט", "sport5", "אצטדיון", "מכון כושר", "energym", "מאמאנט", "אוניברסיטה", "university", "מכללה", "college", "בית ספר", "school", "גן ילדים", "kindergarten", "שכר לימוד", "tuition", "קורס", "course", "ספרים", "books", "סטימצקי", "steimatzky", "צעצועים", "toys", "צהרון", "מעון", "משפחתון", "גנון", "קייטנה", "מתנ\"ס", "קונסרבטוריון", "שיעור", "מורה פרטי", "אולפן", "ברליץ", "berlitz", "wall street", "udemy", "coursera", "duolingo", "דואולינגו", "מורה לנהיגה", "שיעורי נהיגה", "בית ספר לנהיגה", "אקדמיה", "הטכניון", "ספרי לימוד", "משחקי קופסה", "lego", "לגו", "אקדמיה ל", "הסמכה"],
  "אירועים ומתנות": ["buyme", "buy me", "ביי-מי", "ביי מי", "ביימי", "שוברי מתנה", "שובר מתנה", "gift card", "giftcard", "מתנות", "מתנה"],
  "העברת כספים": ["העברה", "העברה ל", "העברה מ", "העברת כספים", "העברה בנקאית", "paypal", "פייפאל", "paybox", "פייבוקס", "pepper", "פפר", "western union", "ווסטרן יוניון", "moneygram", "מאני גרם", "gmt", "העברת זה\"ב", "wire transfer", "remitly", "wise transfer"],
  "סושי": ["וטרינר", "veterinary", "חיות מחמד", "חיות", "פט שופ", "pet shop", "pet store", "מזון לחיות", "כלב", "חתול", "אניפט", "anipet", "פטלנד", "petland", "תן לחיות", "פטס", "all4pet", "biopet", "דוקטור בייקר", "אקווריום", "aquarium", "פנסיון כלבים", "מספרת כלבים", "אילוף כלבים", "וט מרקט", "ספידוג", "דוג סנטר"],
  "משיכת מזומן": ["משיכת מזומן", "משיכת מזומנים", "מזומנים", "כספומט", "atm", "cash withdrawal", "מזומן", "בנקומט"],
}

// Short/ambiguous keywords needing word-boundary matching (mirrors _EXACT_WORD_KEYWORDS).
const EXACT_WORD_KEYWORDS = {
  "הוצאות שוטפות": ["הוט", "hot", "יס", "פז", "ten", "גז"],
  "בילויים": ["בר", "פארק", "park", "פיס"],
  "אוכל": ["food", "פוד"],
  "הוצאות משתנות": ["דן"],
  "קניות": ["ace", "גולף", "golf", "פוקס", "fox"],
  "העברת כספים": ["ביט", "bit"],
  "חוגים וספורט": ["gym"],
  "טיפוח": ["ספא", "spa"],
}

// ── AI tools → טכנולוגיה / AI (mirrors constants.AI_OVERRIDE_KEYWORDS) ──
// Applied as an UNCONDITIONAL override so it wins over the foreign-card and
// keyword passes, matching the backend (where the AI override runs last).
export const AI_CATEGORY = "טכנולוגיה"
export const AI_SUBCATEGORY = "AI"
const AI_OVERRIDE_KEYWORDS = ["openai", "chatgpt", "gpt-4", "gpt4", "anthropic", "claude.ai", "claude", "midjourney", "perplexity", "huggingface", "hugging face", "elevenlabs", "eleven labs", "stability ai", "runwayml", "runway ai", "character.ai", "synthesia", "descript", "x.ai", "grok", "github copilot", "copilot", "cursor ai", "cursor.com", "cursor.so", "google gemini", "gemini.google", "jasper.ai", "poe.com", "replicate.com", "leonardo.ai", "lovable.dev", "suno.ai", "suno.com", "grammarly"]

// ── Old taxonomy → new taxonomy (mirrors constants.CATEGORY_MIGRATION) ──
// Stored snapshots / rules may still carry pre-2026-07 names.
const CATEGORY_PAIR_MIGRATION = {
  "מזון וצריכה|פארם וטיפוח": [
    "פארם",
    ""
  ],
  "מזון וצריכה|חנויות סטוק": [
    "קניות",
    "דברים לבית"
  ],
  "מזון וצריכה|סופרים": [
    "אוכל",
    ""
  ],
  "מסעדות, קפה וברים|משלוחי אוכל": [
    "אוכל",
    "משלוחים"
  ],
  "חשמל ומחשבים|סטרימינג": [
    "הוצאות שוטפות",
    "סטרימינג"
  ],
  "חשמל ומחשבים|חנויות חשמל": [
    "קניות",
    "אלקטרוניקה"
  ],
  "חשמל ומחשבים|קניות אונליין": [
    "קניות",
    "קניות אונליין"
  ],
  "חשמל ומחשבים|שירותי ענן": [
    "טכנולוגיה",
    "שירותי ענן"
  ],
  "אופנה|קוסמטיקה": [
    "טיפוח",
    ""
  ],
  "אופנה|רשתות אופנה": [
    "קניות",
    "אופנה"
  ],
  "אופנה|נעליים": [
    "קניות",
    "אופנה"
  ],
  "אופנה|תכשיטים ואקססוריז": [
    "קניות",
    "תכשיטים ואקססוריז"
  ],
  "פנאי, בידור וספורט|ספורט וכושר": [
    "חוגים וספורט",
    "ספורט וכושר"
  ],
  "פנאי, בידור וספורט|קולנוע": [
    "בילויים",
    "סרטים"
  ],
  "תחבורה ורכבים|מוסכים וטיפולים": [
    "הוצאות משתנות",
    "טיפולים רכב"
  ],
  "רפואה ובתי מרקחת|טיפול זוגי": [
    "תרופות וטיפולים",
    "טיפולים"
  ]
}
const CATEGORY_MIGRATION = {
  "מזון וצריכה": [
    "אוכל",
    null
  ],
  "מסעדות, קפה וברים": [
    "בילויים",
    null
  ],
  "תחבורה ורכבים": [
    "הוצאות משתנות",
    null
  ],
  "דלק, חשמל וגז": [
    "הוצאות שוטפות",
    null
  ],
  "רפואה ובתי מרקחת": [
    "תרופות וטיפולים",
    null
  ],
  "עירייה וממשלה": [
    "הוצאות שוטפות",
    "ארנונה ועירייה"
  ],
  "חשמל ומחשבים": [
    "טכנולוגיה",
    null
  ],
  "בינה מלאכותית": [
    "טכנולוגיה",
    "AI"
  ],
  "אופנה": [
    "קניות",
    "אופנה"
  ],
  "עיצוב הבית": [
    "קניות",
    "דברים לבית"
  ],
  "פנאי, בידור וספורט": [
    "בילויים",
    null
  ],
  "ביטוח": [
    "הוצאות שוטפות",
    "ביטוח"
  ],
  "שירותי תקשורת": [
    "הוצאות שוטפות",
    null
  ],
  "שכר דירה": [
    "הוצאות שוטפות",
    "שכר דירה"
  ],
  "חינוך ולימודים": [
    "חוגים וספורט",
    null
  ],
  "מתנות": [
    "אירועים ומתנות",
    null
  ],
  "מנויים ושירותים": [
    "הוצאות שוטפות",
    "מנויים ושירותים"
  ],
  "חיות מחמד": [
    "סושי",
    null
  ]
}

/**
 * Translate an old-taxonomy (category, subcategory) to the new tree.
 * Returns [newCategory, newSubcategory] where newSubcategory === null means
 * "keep the row's existing subcategory". Current names pass through.
 */
export function migrateCategory(category, subcategory = '') {
  const cat = String(category || '').trim()
  const sub = String(subcategory || '').trim()
  const pair = CATEGORY_PAIR_MIGRATION[`${cat}|${sub}`]
  if (pair) return pair
  const plain = CATEGORY_MIGRATION[cat]
  if (plain) return plain
  return [cat, null]
}

// ── Issuer category (ענף_מקור) → catalog category ───────────────────
// Mirrors constants.ISSUER_CATEGORY_RULES — keep identical. The card company's
// own sector name for the merchant (MAX sends it with every transaction,
// Isracard exposes it via the extra-info fetch). Weak signal: used only when
// the keyword catalog leaves שונות; user rules still override it.
// Substring match, first rule wins — specific before generic.
const ISSUER_CATEGORY_RULES = [
  [
    "מזון מהיר",
    "בילויים"
  ],
  [
    "מסעד",
    "בילויים"
  ],
  [
    "בתי קפה",
    "בילויים"
  ],
  [
    "בתי אוכל",
    "בילויים"
  ],
  [
    "סופרמרקט",
    "אוכל"
  ],
  [
    "רשתות שיווק",
    "אוכל"
  ],
  [
    "מרכול",
    "אוכל"
  ],
  [
    "מזון",
    "אוכל"
  ],
  [
    "אלקטרוניקה",
    "קניות"
  ],
  [
    "מחשבים",
    "קניות"
  ],
  [
    "סלולר",
    "הוצאות שוטפות"
  ],
  [
    "תקשורת",
    "הוצאות שוטפות"
  ],
  [
    "דלק",
    "הוצאות שוטפות"
  ],
  [
    "תחנות תדלוק",
    "הוצאות שוטפות"
  ],
  [
    "גז",
    "הוצאות שוטפות"
  ],
  [
    "חשמל",
    "הוצאות שוטפות"
  ],
  [
    "תחבורה",
    "הוצאות משתנות"
  ],
  [
    "חניה",
    "הוצאות משתנות"
  ],
  [
    "חניונים",
    "הוצאות משתנות"
  ],
  [
    "מוניות",
    "הוצאות משתנות"
  ],
  [
    "רכב",
    "הוצאות משתנות"
  ],
  [
    "מוסך",
    "הוצאות משתנות"
  ],
  [
    "תעופה",
    "טיסות ותיירות"
  ],
  [
    "טיסות",
    "טיסות ותיירות"
  ],
  [
    "תיירות",
    "טיסות ותיירות"
  ],
  [
    "מלונות",
    "טיסות ותיירות"
  ],
  [
    "בתי מלון",
    "טיסות ותיירות"
  ],
  [
    "נופש",
    "טיסות ותיירות"
  ],
  [
    "ביגוד",
    "קניות"
  ],
  [
    "הלבשה",
    "קניות"
  ],
  [
    "הנעלה",
    "קניות"
  ],
  [
    "אופנה",
    "קניות"
  ],
  [
    "קוסמטיקה",
    "טיפוח"
  ],
  [
    "תכשיט",
    "קניות"
  ],
  [
    "ריהוט",
    "קניות"
  ],
  [
    "כלי בית",
    "קניות"
  ],
  [
    "בית וגן",
    "קניות"
  ],
  [
    "שיפוצים",
    "קניות"
  ],
  [
    "פארם",
    "פארם"
  ],
  [
    "בריאות",
    "תרופות וטיפולים"
  ],
  [
    "רפואה",
    "תרופות וטיפולים"
  ],
  [
    "מרקחת",
    "תרופות וטיפולים"
  ],
  [
    "אופטיקה",
    "תרופות וטיפולים"
  ],
  [
    "ספורט",
    "חוגים וספורט"
  ],
  [
    "פנאי",
    "בילויים"
  ],
  [
    "בידור",
    "בילויים"
  ],
  [
    "תרבות",
    "בילויים"
  ],
  [
    "בילוי",
    "בילויים"
  ],
  [
    "ביטוח",
    "הוצאות שוטפות"
  ],
  [
    "חינוך",
    "חוגים וספורט"
  ],
  [
    "לימודים",
    "חוגים וספורט"
  ],
  [
    "ספרים",
    "חוגים וספורט"
  ],
  [
    "צעצועים",
    "חוגים וספורט"
  ],
  [
    "חיות",
    "סושי"
  ],
  [
    "עירייה",
    "הוצאות שוטפות"
  ],
  [
    "עיריות",
    "הוצאות שוטפות"
  ],
  [
    "ממשל",
    "הוצאות שוטפות"
  ],
  [
    "רשויות",
    "הוצאות שוטפות"
  ],
  [
    "מיסים",
    "הוצאות שוטפות"
  ],
  [
    "דואר",
    "הוצאות שוטפות"
  ],
  [
    "כספומט",
    "משיכת מזומן"
  ],
  [
    "מזומן",
    "משיכת מזומן"
  ],
  [
    "העברות",
    "העברת כספים"
  ],
  [
    "העברת כספים",
    "העברת כספים"
  ],
  [
    "מתנות",
    "אירועים ומתנות"
  ]
]

/**
 * Catalog category for an issuer sector name (ענף_מקור), or null.
 * Mirrors backend map_issuer_category. Substring match, first rule wins.
 */
export function categoryFromIssuer(issuerName) {
  const s = String(issuerName || '').trim()
  if (!s || ['nan', 'none', 'null'].includes(s.toLowerCase())) return null
  for (const [needle, category] of ISSUER_CATEGORY_RULES) {
    if (s.includes(needle)) return category
  }
  return null
}

// ── Valid categories (mirrors backend CATEGORY_ICONS keys) ──────────
// Rules pointing anywhere else (e.g. 'אחר' persisted by early AI runs) are
// junk and must not override the categorizer. NOTE: user-created custom
// categories (Supabase user_categories) are additionally valid — callers that
// have them should pass them via buildRuleMap's second argument.
export const VALID_CATEGORIES = new Set(["טיסות ותיירות", "הוצאות שוטפות", "תרופות וטיפולים", "פארם", "בילויים", "אוכל", "קניות", "טיפוח", "חוגים וספורט", "אירועים ומתנות", "טכנולוגיה", "הוצאות משתנות", "סושי", "העברת כספים", "העברה להשקעות", "משיכת מזומן", "הוראות קבע", "שונות"])

// ── Subcategories (parent category → {subcategory → [keywords]}) ─────
// Mirrors constants.SUBCATEGORY_KEYWORDS. Scoped to the parent category; first
// subcategory (in insertion order) wins on a keyword hit.
const SUBCATEGORY_KEYWORDS = {
  "טיסות ותיירות": {
    "טיסות": ["אל על", "el al", "elal", "wizz", "ryanair", "easyjet", "turkish air", "lufthansa", "aegean", "united airlines", "british airways", "ארקיע", "arkia", "ישראייר", "israir", "pegasus", "airbaltic", "air baltic", "אייר חיפה", "air haifa", "etihad", "טיסה", "flight", "airline", "airways"],
    "בתי מלון": ["מלון", "מלונות", "hotel", "hostel", "booking", "airbnb", "אירביאנבי", "בוקינג", "resort", "צימר", "zimmer", "אכסני", "fattal", "פתאל", "isrotel", "ישרוטל", "לאונרדו", "leonardo", "club hotel", "קלאב הוטל", "רימונים", "hilton", "doubletree", "double tree", "דן פנורמה", "הרברט סמואל", "אגודה", "agoda"],
  },
  "הוצאות שוטפות": {
    "שכר דירה": ["שכר דירה", "שכירות", "rent", "משיכת שיקים", "משיכת שיק", "המחאה", "cheque"],
    "ארנונה ועירייה": ["ארנונה", "עירייה", "עיריית", "עירית", "מועצה אזורית", "מועצה מקומית", "אגף הגביה", "מילגם", "היטל", "דוח חניה", "קנס"],
    "מים": ["תאגיד מים", "מי אביבים", "הגיחון", "מים וביוב", "מי רמת גן", "מי שבע", "מי רעננה", "מי כרמל", "מי הרצליה", "מי מודיעין", "מי בית שמש", "מי נתניה", "מי אונו", "פלגי מוצקין", "מי לוד", "מי ציונה", "מי גליל", "מי נע"],
    "גז": ["סופרגז", "supergas", "אמישראגז", "amisragas", "פזגז", "דורגז", "בלוני גז"],
    "חשמל": ["חברת החשמל", "תאגיד החשמל", "חשמל"],
    "דלק": ["דלק", "תדלוק", "סונול", "sonol", "דור אלון", "paz", "yellow", "מנטה", "menta", "אלונית", "תחנת דלק", "דלקן", "pazomat", "פזומט", "דור-ארגמן", "דור ארגמן"],
    "סטרימינג": ["netflix", "נטפליקס", "disney", "דיסני", "hbo", "youtube", "יוטיוב", "spotify", "ספוטיפיי", "apple tv", "prime video", "אמזון פריים", "apple.com/bill", "crunchyroll", "paramount", "פרמאונט", "televizo", "iptv"],
    "אינטרנט": ["בזק", "bezeq", "הוט נט", "hot net", "נטוויז", "netvision", "אינטרנט רימון", "fiber", "סיבים", "yes tv", "partner tv", "הוט טלקום", "triple c", "free telecom"],
    "סלולר": ["סלקום", "cellcom", "פלאפון", "pelephone", "פרטנר", "partner", "הוט מובייל", "hot mobile", "גולן טלקום", "golan telecom", "we4g", "019", "סלולר", "cellular", "רמי לוי תקשורת"],
    "ביטוח": ["ביטוח", "insurance", "פוליסה", "policy", "הראל", "מגדל", "הפניקס", "מנורה מבטחים", "שירביט", "ליברה", "libra", "wobi", "פספורטכרד", "passportcard", "פנסיה", "גמל", "השתלמות"],
    "מנויים ושירותים": ["מנוי", "subscription", "membership", "דמי ניהול", "דמי כרטיס", "דמי חבר", "עמלת", "patreon", "פטראון", "substack", "linkedin", "zoom"],
  },
  "תרופות וטיפולים": {
    "טיפולים": ["l.b.y", "lby group", "טיפול זוגי", "מטפלת", "פסיכולוג", "פסיכיאטר", "therapist", "therapy", "פיזיותרפיה", "physiotherapy", "כירופרקט", "דיאטנית", "תזונאי", "נטורופת", "הומאופת"],
    "קופות חולים": ["מכבי", "maccabi", "כללית", "clalit", "מאוחדת", "לאומית שירותי בריאות"],
    "בתי מרקחת": ["בית מרקחת", "מרקחת", "pharmacy", "רוקח"],
  },
  "בילויים": {
    "בתי קפה": ["קפה", "cafe", "coffee", "ארומה", "aroma", "לנדוור", "landwer", "גרג", "greg", "אספרסו", "espresso", "starbucks", "סטארבקס", "קפולסקי", "רולדין", "cofix", "קופיקס", "ארקפה", "arcaffe"],
    "מזון מהיר": ["מקדונלד", "mcdonald", "בורגר", "burger", "kfc", "פיצה", "פיצריה", "pizza", "דומינו", "domino", "שווארמה", "פלאפל", "falafel", "טאקו", "taco", "ג'פניקה", "japanika", "סושי", "sushi", "subway", "סאבוויי", "שניצל"],
    "מסעדות וברים": ["מסעדה", "מסעדת", "restaurant", "ביסטרו", "bistro", "בראסרי", "גריל", "grill", "טאבון", "פאב", "pub", "בירה", "beer", "שיפודי", "קייטרינג", "catering", "מזנון"],
    "סרטים": ["סינמה", "cinema", "יס פלאנט", "yes planet", "רב חן", "רב-חן", "גלובוס מקס", "לב סינמה", "קולנוע", "מובילנד", "סינמטק"],
    "מופעים והופעות": ["הופעה", "מופע", "הצגה", "תיאטרון", "eventim", "כרטיסים", "היכל התרבות", "זאפה", "zappa", "ברבי", "barby", "הבימה", "הקאמרי", "בית ליסין", "תיאטרון גשר", "צוותא"],
    "פיס והימורים": ["מפעל הפיס", "פיס מרכז", "לוטו", "טוטו", "ווינר", "winner", "הימורים", "חיש גד"],
    "אטרקציות": ["מוזיאון", "museum", "ספארי", "safari", "גן חיות", "zoo", "לונה פארק", "סופרלנד", "משחקייה", "גימבורי", "gymboree", "חדר בריחה", "אסקייפ", "באולינג", "bowling", "קרטינג", "karting", "פיינטבול", "לייזר טאג"],
  },
  "אוכל": {
    "קניות גדולות": ["שופרסל", "shufersal", "רמי לוי", "rami levy", "ויקטורי", "victory", "יינות ביתן", "טיב טעם", "tiv taam", "אושר עד", "osher ad", "חצי חינם", "יוחננוף", "yochananof", "קרפור", "carrefour", "מגה בעיר", "זול ובגדול", "נתיב החסד", "ברכל", "פרשמרקט", "freshmarket", "fresh market", "קינג סטור", "מחסני השוק", "שפע שוק", "יש חסד", "יש בשכונה", "מחסני מזון", "קואופ", "סטופ מרקט"],
    "סופרים קטנים": ["מינימרקט", "מיני מרקט", "מכולת", "am:pm", "אי אם פי אם", "סופרמרקט", "supermarket", "מרכול", "פרימדונה", "סיטי מרקט", "שוק העיר", "שוק מהדרין", "פיצוצי", "פיצוצייה", "פיצוציה", "קיוסק", "7-eleven", "7 eleven", "7-11"],
    "שוברי מזון": ["סיבוס", "cibus", "תן ביס", "pluxee", "פלאקסי", "תנביס"],
    "משלוחים": ["wolt", "וולט", "10bis", "משלוחה", "משלוחים", "משלוח", "הזמנת אוכל", "delivery"],
    "מאפיות": ["מאפיה", "מאפיית", "מאפייה", "מאפה", "דברי מאפה", "קונדיטוריה", "קונדטוריה", "קונדיטורית", "פטיסרי", "קרואסון", "בייקרי", "bakery", "לחם"],
    "קצביות ודגים": ["קצביה", "קצביית", "אטליז", "בשר", "עוף", "דגים"],
    "אלכוהול ומשקאות": ["יין", "wine", "אלכוהול", "משקאות", "יקב", "בירה", "beer"],
  },
  "קניות": {
    "אלקטרוניקה": ["שקם אלקטריק", "מחסני חשמל", "באג", "bug", "ksp", "אייבורי", "ivory", "אלקטרה", "זאפ", "שיא החשמל", "idigital", "איי דיגיטל", "istore", "מקסטור", "last price", "לאסט פרייס", "samsung", "סמסונג", "שיאומי", "xiaomi", "אלקטרוניק", "electronics"],
    "קניות אונליין": ["aliexpress", "עלי אקספרס", "אלי אקספרס", "amazon", "אמזון", "ebay", "איביי", "temu", "טמו", "banggood", "gearbest", "shein", "asos", "אסוס"],
    "אופנה": ["גולף", "golf", "קסטרו", "castro", "פוקס", "fox", "רנואר", "renuar", "זארה", "zara", "h&m", "אייץ אנד אם", "מנגו", "mango", "ברשקה", "bershka", "פול אנד בר", "pull&bear", "pull and bear", "טרמינל", "terminal x", "אורבניקה", "urbanica", "אמריקן איגל", "american eagle", "ריזרבד", "reserved", "הודיס", "hoodies", "טוונטי פור סבן", "twentyfourseven", "delta", "דלתא", "intima", "אינטימה", "נעלי", "shoes", "סקצ", "skechers", "nike", "נייק", "אדידס", "adidas", "new balance", "ניו באלנס", "קרוקס", "crocs", "טימברלנד", "timberland", "סטיב מאדן", "steve madden", "אלדו", "aldo", "to go", "טו גו", "הלבשה", "הנעלה"],
    "תכשיטים ואקססוריז": ["פנדורה", "pandora", "תכשיט", "jewel", "מגנוליה", "magnolia", "אימפרס", "impress", "שעוני", "משקפי", "אופטיק", "optic"],
    "ריהוט": ["איקאה", "ikea", "ריהוט", "רהיטי", "furniture", "מזרן", "mattress", "עמינח", "aminach", "ביתילי", "bitili", "הוליווד"],
    "דברים לבית": ["הום סנטר", "home center", "ace", "עצמל\"ה", "home depot", "שיפוצים", "כלי בית", "מצעים", "שטיח", "וילון", "פוקס הום", "fox home", "נעמן", "naaman", "ורדינון", "vardinon", "טמבור", "tambour", "נירלט", "צבע", "כלי עבודה", "תמי 4", "tami4", "דקור", "decor", "סטוק סנטר", "booom", "זול סטוק", "מקס סטוק", "max stock", "זול בשפע", "כלבו חצי חינם"],
  },
  "חוגים וספורט": {
    "ספורט וכושר": ["חדר כושר", "מכון כושר", "כושר", "הולמס פלייס", "holmes place", "יוגה", "yoga", "פילאטיס", "pilates", "בריכה", "שחייה", "gym", "energym", "ספורט", "sport", "דקאתלון", "decathlon", "מאמאנט"],
    "לימודים": ["אוניברסיטה", "university", "מכללה", "college", "בית ספר", "school", "שכר לימוד", "tuition", "קורס", "course", "אולפן", "udemy", "coursera", "duolingo", "דואולינגו", "אקדמיה", "הטכניון", "ספרי לימוד", "סטימצקי", "steimatzky", "ברליץ", "berlitz", "הסמכה"],
    "חוגים": ["חוג", "חוגים", "סדנה", "workshop", "צהרון", "מעון", "משפחתון", "גנון", "קייטנה", "מתנ\"ס", "קונסרבטוריון", "גן ילדים", "kindergarten", "שיעור"],
  },
  "טכנולוגיה": {
    "AI": [],
    "שירותי ענן": ["digitalocean", "render.com", "scrapingbee", "aws", "amazon web", "google cloud", "azure", "github", "gitlab", "vercel", "netlify", "heroku", "cloudflare", "google one", "icloud", "dropbox", "onedrive", "גוגל אחסון", "wix", "godaddy", "namecheap", "alldebrid", "browserbase", "browserba"],
    "גיימינג": ["steam", "playstation", "xbox", "nintendo", "epic games", "ubisoft", "roblox", "רובלוקס", "twitch", "גיימינג"],
    "תוכנה ואפליקציות": ["adobe", "canva", "notion", "app store", "חנות אפליקציות", "microsoft", "office 365", "microsoft 365", "אופיס 365"],
  },
  "הוצאות משתנות": {
    "טיפולים רכב": ["מוסך", "garage", "צמיג", "פנצ", "גרר", "מצבר", "חלפים", "מכון רישוי", "בדיקת רכב", "שטיפת רכב", "רחיצת", "car wash", "מכונאי", "ליסינג", "leasing"],
    "כבישי אגרה": ["כביש 6", "כביש אגרה", "רב-פס", "רב פס", "מנהרות", "מנהרת", "אגרה", "חוצה ישראל", "חוצה צפון"],
    "חניונים": ["חניון", "חניה", "חנייה", "parking", "פנגו", "pango", "סלופארק", "cellopark", "אחוזת חוף"],
    "תחבורה ציבורית": ["רב קו", "רב-קו", "ravkav", "אגד", "egged", "מטרופולין", "קווים", "kavim", "רכבת", "מטרונית", "דן באב", "באבל דן", "אוטובוס", "סופרבוס"],
    "מוניות ונסיעות": ["gett", "מונית", "taxi", "yango", "יאנגו", "uber", "autotel", "אוטוטל", "car2go", "ווואש", "woosh"],
  },
  "סושי": {
    "וטרינרית וטיפולים": ["וטרינר", "veterinary", "פנסיון כלבים", "מספרת כלבים", "אילוף"],
    "אוכל וחטיפים": ["פט שופ", "pet shop", "pet store", "מזון לחיות", "אניפט", "anipet", "פטלנד", "petland", "וט מרקט", "all4pet", "biopet", "ספידוג", "דוג סנטר", "תן לחיות"],
  },
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

// Longest keyword wins (stable sort keeps catalog order for equal lengths) —
// a more specific keyword must beat a shorter generic one regardless of which
// category was declared first, e.g. 'רמי לוי תקשורת' (telecom) over 'רמי לוי'
// (groceries). Mirrors the backend's sorted KEYWORD_TO_CATEGORY.
const KEYWORD_ENTRIES = buildFlat(CATEGORY_KEYWORDS).sort((a, b) => b[0].length - a[0].length)
const EXACT_ENTRIES = buildFlat(EXACT_WORD_KEYWORDS).sort((a, b) => b[0].length - a[0].length)

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Word-boundary match using the same delimiters as the backend:
// (?:^|[\s\-/])kw(?:$|[\s\-/])
function boundaryMatch(text, kw) {
  const re = new RegExp(`(?:^|[\\s\\-/])${escapeRegExp(kw)}(?:$|[\\s\\-/])`)
  return re.test(text)
}

// Foreign card transactions carry a trailing 2-letter country code after the
// city, e.g. "SHINSEGAE DEPARTMENT S SEOUL   KR". Per the user's preference,
// all overseas spend is bucketed as travel — even a merchant we'd otherwise
// recognise (a 7-Eleven abroad is trip spend). Israel's own code (IL) is
// excluded, and anything containing Hebrew is treated as domestic. Online
// services (NETFLIX.COM, AMAZON …) have no city/country trailer, so they keep
// their keyword category.
const FOREIGN_DESC = /(?:^|\s)(?!IL(?:\s|$))[A-Z]{2}\s*$/
// Online services bill from abroad year-round ("NETFLIX.COM AMSTERDAM NL",
// "PAYPAL *SPOTIFY ... GB") — not trip spend. Mirrors FOREIGN_EXEMPT_KEYWORDS.
const FOREIGN_EXEMPT_KEYWORDS = ["netflix", "spotify", "paypal", "google", "apple", "amazon", "microsoft", "disney", "hbo", "youtube", "ebay", "aliexpress", "temu", "banggood", "steam", "playstation", "xbox", "nintendo", "epic games", "adobe", "canva", "notion", "dropbox", "icloud", "github", "zoom", "linkedin", "patreon", "substack", "audible", "kindle", "twitch", "discord", "wolt", "facebook", "facebk", "meta platforms", "render.com", "digitalocean", "digitalocea", "alldebrid", "browserbase", "browserba", "televizo", "iptv"]

// True when the descriptor matches an exempt online service (used by retag to
// repair rows the PRE-exemption foreign rule wrongly tagged as travel).
export function isForeignExempt(description) {
  const d = String(description || '').toLowerCase()
  return FOREIGN_EXEMPT_KEYWORDS.some((kw) => d.includes(kw))
}
export function isForeignDescriptor(description) {
  const s = String(description || '').trim()
  if (!s || /[\u0590-\u05FF]/.test(s)) return false // contains Hebrew → domestic
  const d = s.toLowerCase()
  if (FOREIGN_EXEMPT_KEYWORDS.some((kw) => d.includes(kw))) return false
  return /[A-Za-z]/.test(s) && FOREIGN_DESC.test(s)
}

function isAiTool(description) {
  const d = String(description || '').toLowerCase()
  return AI_OVERRIDE_KEYWORDS.some((kw) => d.includes(kw))
}

/**
 * Categorize a single transaction description, mirroring the backend order:
 *  0. AI-tool keywords → טכנולוגיה (override, wins over foreign-card too)
 *  1. foreign card descriptor → טיסות ותיירות (override)
 *  2. Psagot → investment transfer (override)
 *  3. check-withdrawal keywords → הוצאות שוטפות (rent; subcategory שכר דירה)
 *  4. standing-order keywords → הוראות קבע (override)
 *  5. substring keyword map (only if still שונות)
 *  6. word-boundary keyword map (only if still שונות)
 *  7. else שונות
 */
export function categorize(description) {
  const d = String(description || '').toLowerCase()
  // AI-tool override runs first so it wins over the foreign-card early-return,
  // matching the backend where the AI override is applied last (highest prio).
  if (isAiTool(d)) return AI_CATEGORY
  if (isForeignDescriptor(description)) return 'טיסות ותיירות'
  let cat = 'שונות'

  if (d.includes('פסגות') || d.includes('psagot')) cat = 'העברה להשקעות'

  for (const kw of CHECK_WITHDRAWAL_KEYWORDS) {
    const k = kw.toLowerCase()
    const hit = k.length <= 3 ? boundaryMatch(d, k) : d.includes(k)
    if (hit) cat = 'הוצאות שוטפות'
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
 * Derive the subcategory (קטגוריה_משנה) for a finalized category + description,
 * mirroring the backend `derive_subcategory` (+ the AI-tool override, which in
 * the backend also pins the subcategory). Returns '' when no seeded
 * subcategory keyword matches (or the category has no subcategories).
 */
export function subcategorize(category, description) {
  if (category === AI_CATEGORY && isAiTool(description)) return AI_SUBCATEGORY
  const submap = SUBCATEGORY_KEYWORDS[category]
  if (!submap) return ''
  const d = String(description || '').toLowerCase()
  for (const [subName, keywords] of Object.entries(submap)) {
    for (const kw of keywords) {
      if (d.includes(kw.toLowerCase())) return subName
    }
  }
  return ''
}

const INSTALLMENT_SUFFIX = /\s*\(תשלום \d+\/\d+\)\s*$/
const PROCESSOR_PREFIX = /^(?:PAYPAL|PP|GOOGLE|FACEBK|FB)\s*\*\s*/i

/**
 * Canonical merchant key for rule matching — mirrors the backend's
 * normalize_merchant, keep identical. The same purchase shows up under several
 * descriptor variants (installment suffixes, "PAYPAL *" prefixes, ragged
 * whitespace, case); a rule saved from one variant must hit all of them.
 */
export function normalizeMerchant(desc) {
  let s = String(desc || '').trim()
  s = s.replace(INSTALLMENT_SUFFIX, '')
  s = s.replace(PROCESSOR_PREFIX, '')
  s = s.replace(/\s+/g, ' ')
  return s.toLowerCase().trim()
}

/**
 * Build the rule lookup keyed by canonical merchant. Later rules win on a
 * key collision (two stored variants of the same merchant). Rule categories
 * saved under the OLD taxonomy are migrated on the way in. `customCategories`
 * (names from Supabase user_categories) extend the valid set.
 */
export function buildRuleMap(rules, customCategories = []) {
  const custom = new Set(customCategories || [])
  const map = new Map()
  for (const r of rules || []) {
    const [cat] = migrateCategory(r.category, r.subcategory)
    map.set(normalizeMerchant(r.merchant), { category: cat, custom })
  }
  return map
}

/**
 * Apply user-defined merchant→category overrides (canonical-merchant match),
 * mirroring restore_session. `ruleMap` must be built with buildRuleMap.
 */
export function applyRules(category, description, ruleMap) {
  if (!ruleMap) return category
  const key = normalizeMerchant(description)
  if (!ruleMap.has(key)) return category
  // AI-tool spend is unconditional — a stale rule (junk 'אחר' or a category
  // from before the AI override existed) must not pull it out. Mirrors the
  // backend, where apply_ai_tool_override re-runs AFTER rules. Matched by
  // DESCRIPTION (not category — טכנולוגיה also holds non-AI merchants).
  if (isAiTool(description)) return category
  const entry = ruleMap.get(key)
  const ruled = typeof entry === 'string' ? entry : entry.category
  const custom = typeof entry === 'string' ? new Set() : entry.custom
  // Rule hygiene: only catalog/custom categories may be assigned (no 'אחר').
  if (!VALID_CATEGORIES.has(ruled) && !custom.has(ruled)) return category
  // The keyword catalog is the source of truth: when it has an opinion
  // (category !== שונות), a conflicting rule is stale (an old AI guess
  // persisted as a rule) and is ignored. Rules decide only merchants the
  // catalog doesn't know. Mirrors the backend restore.
  if (category !== 'שונות' && category !== ruled) return category
  return ruled
}
