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
  'טיסות ותיירות': ['booking', 'airbnb', 'hotels.com', 'expedia', 'tripadvisor', 'hostel', 'hotel', 'אירביאנבי', 'בוקינג', 'טיסה', 'טיסות', 'flight', 'airline', 'airways', 'אל על', 'el al', 'wizz air', 'ryanair', 'easyjet', 'turkish air', 'lufthansa', 'aegean', 'united airlines', 'british airways', 'מלון', 'מלונות', 'resort', 'נופש', 'vacation', 'duty free', 'דיוטי פרי', 'תיירות', 'tourism', 'travel', 'אטרקציה', 'attraction', 'דרכון', 'passport', 'visa fee', 'אגודה', 'agoda', 'kayak', 'skyscanner', 'הרץ', 'hertz', 'avis rent', 'budget rent', 'סיקסט', 'sixt', 'איסתא', 'issta', 'אופיר טורס', 'ophir tours', 'דיזנהויז', 'גוליבר', 'ארקיע', 'arkia', 'ישראייר', 'israir', 'wizzair', 'pegasus', 'ארקיע', 'דקה 90', 'eldan', 'אלדן', 'lastminute', 'fattal', 'פתאל', 'isrotel', 'ישרוטל', 'דן פנורמה', 'לאונרדו', 'leonardo', 'club hotel', 'קלאב הוטל', 'הרברט סמואל', 'רימונים', 'צימר', 'zimmer', 'אכסניה', 'אכסניית', 'trip.com', 'getyourguide', 'rentalcars', 'נסיעות לחו"ל', 'חבילת נופש', 'בתי מלון', 'קווי חופשה', 'airbaltic', 'air baltic', 'ניו ויז\'ן טורס', 'elal', 'אייר חיפה', 'air haifa', 'etihad', 'airalo', 'double tree', 'doubletree', 'hilton', 'kohchang', 'koh chang', 'railninja', 'rail ninja', 'rajadha', 'olive young', 'lottebaikhoajeom'],
  'מזון וצריכה': ['שופרסל', 'רמי לוי', 'מגה', 'יוחננוף', 'אושר עד', 'חצי חינם', 'ויקטורי', 'טיב טעם', 'פרש מרקט', 'סופר', 'מכולת', 'קרפור', 'מינימרקט', 'am:pm', 'קואופ', 'נתיב החסד', 'סטופ מרקט', 'זול ובגדול', 'cofix', 'קופיקס', 'סופר פארם', 'super-pharm', 'super pharm', 'good pharm', 'גוד פארם', 'ניו פארם', 'new pharm', 'שפע שוק', 'מחסני השוק', 'פרשמרקט', 'כלבו', 'מרקט', 'פרי', 'ירק', 'ירקות', 'פירות', 'בית הפרי', 'ממתק', 'ממתקי', 'מתוק', 'שוקולד', 'חלבי', 'מאפה', 'בשר', 'עוף', 'דגים', 'קצביה', 'אטליז', 'מכולת', 'מינימרקט', 'grocery', 'יין', 'wine', 'אלכוהול', 'משקאות', 'סיבוס', 'cibus', 'תן ביס', 'pluxee', 'פלאקסי', 'פארם', 'pharm', 'shufersal', 'rami levy', 'osher ad', 'יינות ביתן', 'סופרמרקט', 'מרכול', 'יש חסד', 'יש בשכונה', 'ברכל', 'קינג סטור', 'מחסני מזון', 'סופר יהודה', 'סופר דוש', 'מעדניה', 'מאפיית', 'מאפיה', 'קצביית', 'דברי מאפה', 'יקב', 'גבינות', 'שוק העיר', 'שוק מהדרין', 'תנובה', 'שטראוס', 'יטבתה', 'ביכורי השדה', 'סלסלת', '7-eleven', '7 eleven', '7-11', 'פיצוצי', 'פיצוצייה', 'פיצוציה', 'קיוסק'],
  'מסעדות, קפה וברים': ['מסעדה', 'מסעדת', 'קפה ', 'בית קפה', 'פיצה', 'פיצריה', 'סושי', 'בורגר', 'שווארמה', 'פלאפל', 'חומוס', 'מקדונלד', 'mcdonald', 'דומינו', 'domino', 'פאפא ג\'ונס', 'papa john', 'ארומה', 'aroma', 'קפה קפה', 'cafe cafe', 'לנדוור', 'landwer', 'רולדין', 'roladin', 'גרג', 'greg', 'אספרסו', 'espresso', 'wolt', 'וולט', '10bis', 'תנביס', 'japanika', 'ג\'פניקה', 'שיפודי', 'shipudei', 'restaurant', 'starbucks', 'סטארבקס', 'מושלי', 'עילאי', 'רשי 33', 'קייטרינג', 'catering', 'טאקו', 'taco', 'kfc', 'burger king', 'בורגר קינג', 'subway', 'סאבוויי', 'שניצל', 'גלידה', 'ice cream', 'בייקרי', 'bakery', 'מאפייה', 'cafe', 'rest.', 'מזנון', 'ביסטרו', 'bistro', 'בראסרי', 'גריל', 'grill', 'טאבון', 'pub', 'פאב', 'בירה', 'beer', 'פיצה האט', 'pizza hut', 'בנדיקט', 'benedict', 'מוזס', 'moses', 'אגאדיר', 'agadir', 'הומבורגר', 'גולדה', 'goldas', 'אניטה', 'anita', 'מקס ברנר', 'max brenner', 'גירף', 'giraffe', 'טוני וספה', 'בורגרים', 'הבורגר', 'שייקסבורגר', 'black bar', 'קונדיטוריה', 'בייגל', 'bagel', 'דונאטס', 'donut', 'קרואסון', 'cup o joe', 'ארקפה', 'arcaffe', 'נספרסו', 'nespresso', 'קפה לואיז', 'ולנטינה', 'casa', 'מקדונלדס', 'שקשוקה', 'קינוח', 'קינוחים', 'קונדטוריה', 'פטיסרי', 'kermeet', 'קרמיט', 'המאסטרו', 'rosso vino'],
  'תחבורה ורכבים': ['רב קו', 'רב-קו', 'ravkav', 'אגד', 'egged', 'מטרופולין', 'metropoline', 'קווים', 'kavim', 'רכבת ישראל', 'israel railways', 'מונית', 'taxi', 'gett', 'yango', 'יאנגו', 'uber', 'אוטובוס', 'חניה', 'חנייה', 'parking', 'פנגו', 'pango', 'סלופארק', 'cellopark', 'cello park', 'אי וויי', 'iway', 'מוסך', 'מוסכים', 'מוסכי', 'garage', 'צמיגים', 'tires', 'ביטוח רכב', 'רישוי', 'רישיון רכב', 'אגרה', 'כביש 6', 'כביש אגרה', 'מנהרות', 'מנהרת', 'tunnel', 'משלוח', 'שליח', 'delivery', 'רכבת קלה', 'הרכבת הקלה', 'מטרונית', 'דן באב', 'autotel', 'אוטוטל', 'car2go', 'sharenow', 'באבל דן', 'אחוזת חוף', 'חניון', 'parking lot', 'שטיפת רכב', 'רחיצת', 'car wash', 'מכונאי', 'פנצ\'ר', 'גרר', 'מצבר', 'חלפים', 'מכון רישוי', 'בדיקת רכב', 'ליסינג', 'leasing', 'אלבר', 'albar', 'קל אוטו', 'אוויס רנט', 'אלדן רכב', 'ניו קופל', 'קרית הרכב', 'קריית הרכב', 'מרכז הרכב', 'תחבורה', 'רב-פס', 'רב פס', 'ווואש', 'woosh'],
  'דלק, חשמל וגז': ['דלק', 'תדלוק', 'סונול', 'sonol', 'דור אלון', 'doralon', 'delek', 'fuel', 'חברת החשמל', 'חשמל', 'ten דלק', 'paz', 'yellow', 'מנטה', 'menta', 'אלונית', 'alonit', 'תחנת דלק', 'דלקן', 'pazomat', 'פזומט', 'סופרגז', 'supergas', 'אמישראגז', 'amisragas', 'פזגז', 'דורגז', 'אמ.ש.ר.ג', 'בלוני גז', 'תאגיד החשמל', 'דור-ארגמן', 'דור ארגמן', 'דור-האיצטדיון', 'דור -האיצטדיון'],
  'רפואה ובתי מרקחת': ['מכבי', 'כללית', 'מאוחדת', 'לאומית', 'בית מרקחת', 'pharmacy', 'רוקח', 'רופא', 'דוקטור', 'doctor', 'dr.', 'מרפאה', 'מרפאת', 'clinic', 'דנטל', 'dental', 'שיניים', 'רופא שיניים', 'אופטיקה', 'optic', 'משקפיים', 'עדשות', 'פיזיותרפיה', 'physiotherapy', 'כירופרקט', 'פסיכולוג', 'פסיכיאטר', 'therapist', 'therapy', 'בית חולים', 'hospital', 'תרופות', 'medication', 'אסותא', 'assuta', 'הרצליה מדיקל', 'איכילוב', 'תל השומר', 'שיבא', 'רמב"ם', 'סורוקה', 'הדסה', 'בלינסון', 'וולפסון', 'טרם', 'terem', 'ביקור רופא', 'מוקד רופאים', 'נטלי', 'natali', 'שח"ל', 'femi', 'פמי', 'מעבדה', 'מעבדות', 'בדיקות דם', 'אופטיקנה', 'אופטיק', 'הלפרין', 'ירדן אופטיק', 'erroca', 'ארוקה', 'אורטופד', 'אורתודונט', 'שתל שיניים', 'יישור שיניים', 'דיאטנית', 'תזונאי', 'נטורופת', 'הומאופת', 'קוסמטיקה רפואית', 'מדיקל', 'l.b.y', 'lby group'],
  'עירייה וממשלה': ['עירייה', 'עיריית', 'עירית', 'ארנונה', 'משרד הפנים', 'משרד הרישוי', 'רשות האוכלוסין', 'רשות המיסים', 'מס הכנסה', 'ביטוח לאומי', 'מע"מ', 'אגרת', 'קנס', 'דוח חניה', 'מועצה אזורית', 'מועצה מקומית', 'מתנ"ס', 'תאגיד מים', 'מי אביבים', 'הגיחון', 'מי שבע', 'מי רעננה', 'מי נע', 'מים וביוב', 'מי כרמל', 'מי רמת גן', 'מי לוד', 'מי ציונה', 'מי גליל', 'מי הרצליה', 'מי מודיעין', 'מי בית שמש', 'מי נתניה', 'מי אונו', 'פלגי מוצקין', 'דואר ישראל', 'דואר', 'רשות מקרקעי', 'טאבו', 'הוצאה לפועל', 'בתי המשפט', 'משטרת ישראל', 'אגף הגביה', 'היטל', 'אגרות', 'מילגם', 'מס במקור', 'ניכוי במקור', 'תשלום מס'],
  'חשמל ומחשבים': ['באג מולטי', 'bug multi', 'ksp', 'איביי', 'ebay', 'אמזון', 'amazon', 'אלי אקספרס', 'aliexpress', 'ali express', 'apple', 'אפל', 'google', 'גוגל', 'מיקרוסופט', 'microsoft', 'נטפליקס', 'netflix', 'ספוטיפיי', 'spotify', 'steam', 'playstation', 'xbox', 'nintendo', 'אייבורי', 'ivory', 'מחשבים', 'samsung', 'סמסונג', 'dell', 'lenovo', 'app store', 'חנות אפליקציות', 'שיאומי', 'xiaomi', 'youtube', 'יוטיוב', 'disney', 'דיסני', 'hbo', 'prime video', 'באג', 'מחסני חשמל', 'machsanei', 'שקם אלקטריק', 'shekem', 'idigital', 'איי דיגיטל', 'istore', 'מקסטור', 'last price', 'לאסט פרייס', 'pc center', 'הום אלקטרוניק', 'ולנשטיין', 'temu', 'טמו', 'banggood', 'aliexpress', 'github', 'adobe', 'canva', 'notion', 'dropbox', 'icloud', 'אייקלאוד', 'office 365', 'microsoft 365', 'אופיס 365', 'paramount', 'פרמאונט', 'apple tv', 'audible', 'kindle', 'epic games', 'ubisoft', 'roblox', 'רובלוקס', 'twitch', 'discord', 'אלקטרוניק', 'electronics', 'גיימינג', 'אודיו', 'audio'],
  'אופנה': ['זארה', 'zara', 'h&m', 'פול אנד בר', 'pull&bear', 'מנגו', 'mango', 'קסטרו', 'castro', 'אמריקן איגל', 'american eagle', 'נעלי', 'shoes', 'בגדי', 'רנואר', 'renuar', 'תמנון', 'שילב', 'shilav', 'טרמינל', 'terminal x', 'אסוס', 'asos', 'נייקי', 'nike', 'אדידס', 'adidas', 'פומה', 'סטרדיווריוס', 'stradivarius', 'ברשקה', 'bershka', 'intimissimi', 'calzedonia', 'נעליים', 'פרימדונה', 'primadonna', 'קוסמטיקה', 'cosmetic', 'איפור', 'makeup', 'בשמים', 'perfume', 'לורן', 'lauren', 'טומי', 'tommy', 'נקסט', 'next', 'gap', 'old navy', 'lacoste', 'לקוסט', 'ralph', 'massimo', 'מסימו', 'oysho', 'אוישו', 'victoria', 'דלתא', 'delta', 'reebok', 'ריבוק', 'under armour', 'new balance', 'crocs', 'קרוקס', 'סקצ\'רס', 'skechers', 'timberland', 'aldo', 'אלדו', 'scoop', 'סקופ', 'גולברי', 'golbary', 'אדיקה', 'adika', 'factory 54', 'פקטורי 54', 'superdry', 'tfc', 'carter', 'תכשיט', 'jewelry', 'pandora', 'פנדורה', 'magnolia', 'מגנוליה', 'fossil', 'swarovski', 'סברובסקי', 'sephora', 'ספורה', 'body shop', 'laline', 'ללין', 'children', 'הלבשה', 'הנעלה', 'אאוטלט', 'outlet', 'סטוק סנטר', 'סטוק פקטורי', 'booom', 'זול סטוק', 'קוסמטיקס', 'pedro pps'],
  'עיצוב הבית': ['איקאה', 'ikea', 'הום סנטר', 'home center', 'ace hardware', 'מרכז השיפוצים', 'ריהוט', 'עצמל"ה', 'home depot', 'שיפוצים', 'כלי בית', 'מצעים', 'שטיח', 'וילון', 'פוקס הום', 'fox home', 'אלקטרה', 'electra', 'ביתילי', 'bitili', 'נעמן', 'naaman', 'ורדינון', 'vardinon', 'כספי', 'תמי 4', 'tami4', 'עמינח', 'aminach', 'הוליווד', 'רהיטי', 'furniture', 'מזרן', 'mattress', 'דורגל', 'טמבור', 'tambour', 'נירלט', 'nirlat', 'צבע', 'paint', 'כלי עבודה', 'ברזל', 'גמיש', 'urban', 'הכל לבית', 'בית וגן', 'מ. שטרן', 'דקור', 'decor', 'wishlist', 'מיאדרה'],
  'פנאי, בידור וספורט': ['סינמה', 'cinema', 'סינמה סיטי', 'yes planet', 'הופעה', 'כרטיסים', 'eventim', 'לאן', 'leaan', 'הצגה', 'מופע', 'תיאטרון', 'חדר כושר', 'הולמס פלייס', 'holmes place', 'ספורט', 'sport', 'כושר', 'חוג', 'חוגים', 'סדנה', 'workshop', 'גן חיות', 'zoo', 'בריכה', 'שחייה', 'swimming', 'יוגה', 'yoga', 'פילאטיס', 'pilates', 'יס פלאנט', 'רב חן', 'רב-חן', 'גלובוס מקס', 'לב סינמה', 'סינמטק', 'מוזיאון', 'museum', 'ספארי', 'safari', 'לונה פארק', 'סופרלנד', 'גימבורי', 'gymboree', 'משחקייה', 'אסקייפ', 'חדר בריחה', 'באולינג', 'bowling', 'קרטינג', 'karting', 'פיינטבול', 'לייזר טאג', 'סקייט', 'דקאתלון', 'decathlon', 'מגה ספורט', 'sport5', 'אצטדיון', 'טוטו', 'winner', 'ווינר', 'מפעל הפיס', 'pais', 'זאפה', 'zappa', 'ברבי', 'barby', 'בלוק', 'האנגר', 'hangar', 'הבימה', 'הקאמרי', 'בית ליסין', 'תיאטרון גשר', 'צוותא', 'היכל התרבות', 'ספא', 'מכון כושר', 'energym', 'בלאק בוקס', 'קולנוע', 'מובילנד', 'מאמאנט'],
  'ביטוח': ['ביטוח', 'insurance', 'מגדל ביטוח', 'כלל ביטוח', 'הפניקס', 'פוליסה', 'policy', 'איילון חב', 'איילון ביטוח', 'ביטוח איילון', 'איילון פנסיה', 'הראל ביטוח', 'הראל פנסיה', 'הראל השקעות', 'מנורה מבטחים', 'הכשרה ביטוח', 'ביטוח ישיר', 'ביטוח חקלאי', 'שירביט', 'shirbit', 'ליברה', 'libra', 'wobi', 'וובי', '9 מיליון', 'aig', 'איי איי ג\'י', 'פספורטכרד', 'passportcard', 'דייויד שילד', 'davidshield', 'קצין הביטוח', 'דמי ביטוח', 'גמל', 'פנסיה', 'השתלמות'],
  'שירותי תקשורת': ['סלקום', 'cellcom', 'פרטנר', 'partner', 'הוט מובייל', 'hot mobile', 'הוט נט', 'hot net', 'בזק', 'bezeq', 'פלאפון', 'pelephone', 'גולן טלקום', 'golan telecom', 'we4g', 'סלולר', 'cellular', 'רמי לוי תקשורת', '012', '013', '014', '019', 'נטוויז\'ן', 'netvision', 'triple c', 'אינטרנט רימון', 'fiber', 'סיבים', 'פרי tv', 'free telecom', 'הוט טלקום', 'partner tv', 'yes tv'],
  'העברת כספים': ['העברה', 'העברה ל', 'העברה מ', 'העברת כספים', 'העברה בנקאית', 'paypal', 'פייפאל', 'paybox', 'פייבוקס', 'pepper', 'פפר', 'western union', 'ווסטרן יוניון', 'moneygram', 'מאני גרם', 'gmt', 'העברת זה"ב', 'wire transfer', 'remitly', 'wise transfer'],
  'חיות מחמד': ['וטרינר', 'veterinary', 'חיות מחמד', 'חיות', 'פט שופ', 'pet shop', 'pet store', 'מזון לחיות', 'כלב', 'חתול', 'אניפט', 'anipet', 'פטלנד', 'petland', 'תן לחיות', 'פטס', 'all4pet', 'biopet', 'דוקטור בייקר', 'אקווריום', 'aquarium', 'פנסיון כלבים', 'מספרת כלבים', 'אילוף כלבים', 'וט מרקט', 'ספידוג', 'דוג סנטר'],
  'משיכת מזומן': ['משיכת מזומן', 'משיכת מזומנים', 'מזומנים', 'כספומט', 'atm', 'cash withdrawal', 'מזומן', 'בנקומט'],
  'חינוך ולימודים': ['אוניברסיטה', 'university', 'מכללה', 'college', 'בית ספר', 'school', 'גן ילדים', 'kindergarten', 'שכר לימוד', 'tuition', 'קורס', 'course', 'ספרים', 'books', 'סטימצקי', 'steimatzky', 'צעצועים', 'toys', 'צהרון', 'מעון', 'משפחתון', 'גנון', 'קייטנה', 'מתנ"ס', 'קונסרבטוריון', 'שיעור', 'מורה פרטי', 'אולפן', 'ברליץ', 'berlitz', 'wall street', 'udemy', 'coursera', 'duolingo', 'דואולינגו', 'מורה לנהיגה', 'שיעורי נהיגה', 'בית ספר לנהיגה', 'אקדמיה', 'הטכניון', 'ספרי לימוד', 'משחקי קופסה', 'lego', 'לגו', 'אקדמיה ל', 'הסמכה'],
  'מתנות': ['buyme', 'buy me', 'ביי-מי', 'ביי מי', 'ביימי', 'שוברי מתנה', 'שובר מתנה', 'gift card', 'giftcard'],
  'מנויים ושירותים': ['מנוי', 'subscription', 'membership', 'annual fee', 'דמי ניהול', 'עמלת', 'google one', 'דמי כרטיס', 'דמי חבר', 'דמי שירות', 'דמי טיפול', 'patreon', 'פטראון', 'substack', 'linkedin', 'לינקדאין', 'zoom', 'amazon prime', 'דמי מנוי', 'חידוש מנוי'],
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
  'פנאי, בידור וספורט': ['gym', 'פארק', 'park', 'פיס'],
}

// ── AI tools → dedicated category (mirrors constants.AI_OVERRIDE_KEYWORDS) ──
// Applied as an UNCONDITIONAL override so it wins over the foreign-card and
// keyword passes, matching the backend (where the AI override runs last).
const AI_CATEGORY = 'בינה מלאכותית'
const AI_OVERRIDE_KEYWORDS = [
  'openai', 'chatgpt', 'gpt-4', 'gpt4', 'anthropic', 'claude.ai', 'claude',
  'midjourney', 'perplexity', 'huggingface', 'hugging face',
  'elevenlabs', 'eleven labs', 'stability ai', 'runwayml', 'runway ai',
  'character.ai', 'synthesia', 'descript', 'x.ai', 'grok',
  'github copilot', 'copilot', 'cursor ai', 'cursor.com', 'cursor.so',
  'google gemini', 'gemini.google', 'jasper.ai', 'poe.com',
  'replicate.com', 'leonardo.ai', 'lovable.dev', 'suno.ai', 'suno.com',
]

// ── Issuer category (ענף_מקור) → catalog category ───────────────────
// Mirrors constants.ISSUER_CATEGORY_RULES — keep identical. The card company's
// own sector name for the merchant (MAX sends it with every transaction,
// Isracard exposes it via the extra-info fetch). Weak signal: used only when
// the keyword catalog leaves שונות; user rules still override it.
// Substring match, first rule wins — specific before generic.
const ISSUER_CATEGORY_RULES = [
  ['מזון מהיר', 'מסעדות, קפה וברים'],
  ['מסעד', 'מסעדות, קפה וברים'],
  ['בתי קפה', 'מסעדות, קפה וברים'],
  ['בתי אוכל', 'מסעדות, קפה וברים'],
  ['סופרמרקט', 'מזון וצריכה'],
  ['רשתות שיווק', 'מזון וצריכה'],
  ['מרכול', 'מזון וצריכה'],
  ['מזון', 'מזון וצריכה'],
  ['אלקטרוניקה', 'חשמל ומחשבים'],
  ['מחשבים', 'חשמל ומחשבים'],
  ['סלולר', 'שירותי תקשורת'],
  ['תקשורת', 'שירותי תקשורת'],
  ['דלק', 'דלק, חשמל וגז'],
  ['תחנות תדלוק', 'דלק, חשמל וגז'],
  ['גז', 'דלק, חשמל וגז'],
  ['חשמל', 'דלק, חשמל וגז'],
  ['תחבורה', 'תחבורה ורכבים'],
  ['חניה', 'תחבורה ורכבים'],
  ['חניונים', 'תחבורה ורכבים'],
  ['מוניות', 'תחבורה ורכבים'],
  ['רכב', 'תחבורה ורכבים'],
  ['מוסך', 'תחבורה ורכבים'],
  ['תעופה', 'טיסות ותיירות'],
  ['טיסות', 'טיסות ותיירות'],
  ['תיירות', 'טיסות ותיירות'],
  ['מלונות', 'טיסות ותיירות'],
  ['בתי מלון', 'טיסות ותיירות'],
  ['נופש', 'טיסות ותיירות'],
  ['ביגוד', 'אופנה'],
  ['הלבשה', 'אופנה'],
  ['הנעלה', 'אופנה'],
  ['אופנה', 'אופנה'],
  ['קוסמטיקה', 'אופנה'],
  ['תכשיט', 'אופנה'],
  ['ריהוט', 'עיצוב הבית'],
  ['כלי בית', 'עיצוב הבית'],
  ['בית וגן', 'עיצוב הבית'],
  ['שיפוצים', 'עיצוב הבית'],
  ['בריאות', 'רפואה ובתי מרקחת'],
  ['רפואה', 'רפואה ובתי מרקחת'],
  ['מרקחת', 'רפואה ובתי מרקחת'],
  ['פארם', 'רפואה ובתי מרקחת'],
  ['אופטיקה', 'רפואה ובתי מרקחת'],
  ['פנאי', 'פנאי, בידור וספורט'],
  ['בידור', 'פנאי, בידור וספורט'],
  ['ספורט', 'פנאי, בידור וספורט'],
  ['תרבות', 'פנאי, בידור וספורט'],
  ['בילוי', 'פנאי, בידור וספורט'],
  ['ביטוח', 'ביטוח'],
  ['חינוך', 'חינוך ולימודים'],
  ['לימודים', 'חינוך ולימודים'],
  ['ספרים', 'חינוך ולימודים'],
  ['צעצועים', 'חינוך ולימודים'],
  ['חיות', 'חיות מחמד'],
  ['עירייה', 'עירייה וממשלה'],
  ['עיריות', 'עירייה וממשלה'],
  ['ממשל', 'עירייה וממשלה'],
  ['רשויות', 'עירייה וממשלה'],
  ['מיסים', 'עירייה וממשלה'],
  ['דואר', 'עירייה וממשלה'],
  ['כספומט', 'משיכת מזומן'],
  ['מזומן', 'משיכת מזומן'],
  ['העברות', 'העברת כספים'],
  ['העברת כספים', 'העברת כספים'],
  ['מתנות', 'מתנות'],
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
// junk and must not override the categorizer.
export const VALID_CATEGORIES = new Set([
  'מזון וצריכה', 'מסעדות, קפה וברים', 'תחבורה ורכבים', 'דלק, חשמל וגז',
  'רפואה ובתי מרקחת', 'עירייה וממשלה', 'חשמל ומחשבים', 'בינה מלאכותית',
  'אופנה', 'עיצוב הבית', 'פנאי, בידור וספורט', 'ביטוח', 'שירותי תקשורת',
  'העברת כספים', 'העברה להשקעות', 'חיות מחמד', 'שונות', 'משיכת מזומן',
  'שכר דירה', 'הוראות קבע', 'טיסות ותיירות', 'חינוך ולימודים', 'מתנות',
  'מנויים ושירותים',
])

// ── Subcategories (parent category → {subcategory → [keywords]}) ─────
// Mirrors constants.SUBCATEGORY_KEYWORDS. Scoped to the parent category; first
// subcategory (in insertion order) wins on a keyword hit.
const SUBCATEGORY_KEYWORDS = {
  'רפואה ובתי מרקחת': {
    'טיפול זוגי': ['l.b.y', 'lby group', 'טיפול זוגי', 'מטפלת זוגית'],
  },
  'מזון וצריכה': {
    'מאפיות': ['מאפיה', 'מאפיית', 'מאפה', 'דברי מאפה', 'קונדיטוריה', 'בייקרי', 'bakery', 'roladin', 'רולדין', 'לחם'],
    'קצביות ודגים': ['קצביה', 'קצביית', 'אטליז', 'בשר', 'עוף', 'דגים'],
    'אלכוהול ומשקאות': ['יין', 'wine', 'אלכוהול', 'משקאות', 'יקב', 'בירה', 'beer'],
    'שוברי מזון': ['סיבוס', 'cibus', 'תן ביס', 'pluxee', 'פלאקסי', '10bis', 'תנביס'],
  },
  'פנאי, בידור וספורט': {
    'קולנוע': ['סינמה', 'cinema', 'יס פלאנט', 'yes planet', 'רב חן', 'רב-חן', 'גלובוס מקס', 'לב סינמה', 'קולנוע', 'מובילנד', 'סינמטק'],
    'מופעים והופעות': ['הופעה', 'מופע', 'הצגה', 'תיאטרון', 'eventim', 'כרטיסים', 'היכל התרבות', 'זאפה', 'zappa', 'ברבי', 'barby', 'הבימה', 'הקאמרי', 'בית ליסין', 'תיאטרון גשר', 'צוותא'],
    'ספורט וכושר': ['חדר כושר', 'מכון כושר', 'כושר', 'הולמס פלייס', 'holmes place', 'יוגה', 'yoga', 'פילאטיס', 'pilates', 'בריכה', 'שחייה', 'gym', 'energym', 'ספורט', 'sport', 'דקאתלון', 'decathlon'],
    'אטרקציות': ['מוזיאון', 'museum', 'ספארי', 'safari', 'גן חיות', 'zoo', 'לונה פארק', 'סופרלנד', 'משחקייה', 'גימבורי', 'gymboree', 'חדר בריחה', 'אסקייפ', 'באולינג', 'bowling', 'קרטינג', 'karting'],
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
const FOREIGN_EXEMPT_KEYWORDS = [
  'netflix', 'spotify', 'paypal', 'google', 'apple', 'amazon', 'microsoft',
  'disney', 'hbo', 'youtube', 'ebay', 'aliexpress', 'temu', 'banggood',
  'steam', 'playstation', 'xbox', 'nintendo', 'epic games',
  'adobe', 'canva', 'notion', 'dropbox', 'icloud', 'github', 'zoom',
  'linkedin', 'patreon', 'substack', 'audible', 'kindle', 'twitch',
  'discord', 'wolt', 'facebook', 'facebk', 'meta platforms',
]
export function isForeignDescriptor(description) {
  const s = String(description || '').trim()
  if (!s || /[\u0590-\u05FF]/.test(s)) return false // contains Hebrew → domestic
  const d = s.toLowerCase()
  if (FOREIGN_EXEMPT_KEYWORDS.some((kw) => d.includes(kw))) return false
  return /[A-Za-z]/.test(s) && FOREIGN_DESC.test(s)
}

/**
 * Categorize a single transaction description, mirroring the backend order:
 *  0. AI-tool keywords → בינה מלאכותית (override, wins over foreign-card too)
 *  1. foreign card descriptor → טיסות ותיירות (override)
 *  2. Psagot → investment transfer (override)
 *  3. check-withdrawal keywords → שכר דירה (override)
 *  4. standing-order keywords → הוראות קבע (override)
 *  5. substring keyword map (only if still שונות)
 *  6. word-boundary keyword map (only if still שונות)
 *  7. else שונות
 */
export function categorize(description) {
  const d = String(description || '').toLowerCase()
  // AI-tool override runs first so it wins over the foreign-card early-return,
  // matching the backend where the AI override is applied last (highest prio).
  if (AI_OVERRIDE_KEYWORDS.some((kw) => d.includes(kw))) return AI_CATEGORY
  if (isForeignDescriptor(description)) return 'טיסות ותיירות'
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
 * Derive the subcategory (קטגוריה_משנה) for a finalized category + description,
 * mirroring the backend `derive_subcategory`. Returns '' when no seeded
 * subcategory keyword matches (or the category has no subcategories).
 */
export function subcategorize(category, description) {
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
 * key collision (two stored variants of the same merchant).
 */
export function buildRuleMap(rules) {
  return new Map((rules || []).map((r) => [normalizeMerchant(r.merchant), r.category]))
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
  // from before בינה מלאכותית existed) must not pull it out. Mirrors the
  // backend, where apply_ai_tool_override re-runs AFTER rules.
  if (category === AI_CATEGORY) return category
  const ruled = ruleMap.get(key)
  // Rule hygiene: only catalog categories may be assigned (no 'אחר' junk).
  if (!VALID_CATEGORIES.has(ruled)) return category
  return ruled
}
