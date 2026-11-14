"""Classify existing ledger rows from a Bit activity export."""
import codecs
import csv
import io
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

import pandas as pd

from .category_rules import manual_rule_mask
from .data_processor import locked_mask, normalize_merchant, txn_fingerprint

MAX_BYTES = 2 * 1024 * 1024
MAX_ROWS = 10_000
DAY_WINDOW = 3

HEADERS = {
    'date': ('תאריך הפעולה', 'תאריך פעולה', 'תאריך ההעברה', 'תאריך העברה', 'תאריך העסקה',
             'תאריך ביצוע הפעולה', 'תאריך ביצוע', 'תאריך ושעה', 'מועד הפעולה',
             'מועד העברה', 'תאריך', 'transfer date', 'transaction date', 'timestamp', 'date'),
    'amount': ('סכום ההעברה', 'סכום העברה', 'סכום העסקה', 'סכום הפעולה', 'סכום בשח', 'סכום ₪',
               'סכום בשקלים', 'סכום הפעולה ₪', 'סכום', 'transfer amount', 'transaction amount', 'amount ils', 'amount'),
    'reason': ('סיבת ההעברה', 'סיבת העברה', 'מטרת ההעברה', 'מטרת העברה', 'סיבת הפעולה', 'סיבת התשלום',
               'סיבת תשלום', 'למה', 'סיבה', 'עבור', 'transfer reason', 'purpose', 'reason',
               'פירוט', 'הערה', 'הערות', 'תיאור', 'note', 'memo', 'description'),
    'direction': ('כיוון העברה', 'כיוון', 'סוג ההעברה', 'סוג העברה', 'סוג תנועה', 'סוג הפעולה',
                  'סוג פעולה', 'סוג העסקה', 'פעולה', 'סוג', 'direction', 'transfer type',
                  'transaction type', 'action', 'type'),
    'status': ('סטטוס העברה', 'סטטוס הפעולה', 'סטטוס', 'מצב הפעולה', 'מצב', 'transfer status',
               'transaction status', 'status'),
}

OUTGOING = {'שליחה', 'נשלח', 'העברה יוצאת', 'העברת כסף', 'תשלום', 'שולם', 'שלחת כסף', 'העברת כספים',
            'העברה לאיש קשר', 'העברת כסף לאיש קשר', 'כסף שנשלח', 'העברה ל', 'sent', 'outgoing', 'payment', 'debit'}
INCOMING = {'קבלה', 'קבלת כסף', 'קבלת כספים', 'התקבל', 'העברה נכנסת', 'קיבלת כסף', 'כסף שהתקבל', 'העברה מ',
            'received', 'incoming', 'credit'}
FINAL = {'בוצע', 'בוצעה', 'בוצע בהצלחה', 'הושלם', 'הושלמה', 'התקבל', 'אושר', 'אושרה', 'שולם',
         'הועבר', 'התקבלה', 'העברה בוצעה', 'ההעברה הושלמה', 'completed', 'successful', 'succeeded', 'accepted', 'paid', 'settled'}
BIT = re.compile(r'(?<!\w)(?:bit(?:pay)?|ביט|בביט)(?!\w)', re.IGNORECASE)
GENERIC_BIT = re.compile(
    r'(?:(?:bit|ביט)(?:[\s:–-]+(?:payment|transfer|העברה|העברת כספים|תשלום))?'
    r'|(?:תשלום|העברה|העברת כספים)\s+(?:ב[\s-]*)?(?:bit|ביט))',
    re.IGNORECASE,
)


def is_generic_bit(description: str) -> bool:
    return bool(GENERIC_BIT.fullmatch(normalize_merchant(description)))


# The same reason can carry more than one signal. If several categories fit,
# leave the transaction for review.
REASONS = (
    ('אירועים ומתנות', '', r'מתנ(?:ה|ות)|יום הולדת|יומולדת|חתונה|בר מצווה|בת מצווה|birthday|gift|wedding'),
    ('בילויים', 'מסעדות וברים', r'מסעד(?:ה|ת|ות)|restaurant'),
    ('בילויים', 'בתי קפה', r'בית קפה|בתי קפה|coffee shop'),
    ('אוכל', '', r'סופרמרקט|סופרמרקטים|מצרכים|groceries'),
    ('אוכל', 'משלוחים', r'משלוח אוכל|משלוחי אוכל|food delivery'),
    ('הוצאות שוטפות', 'שכר דירה', r'שכר דירה|rent'),
    ('הוצאות משתנות', 'חניונים', r'חניון|חניונים|חניה|חנייה|parking'),
    ('הוצאות משתנות', 'מוניות ונסיעות', r'מונית|מוניות|taxi'),
    ('חוגים וספורט', 'חוגים', r'חוג|חוגים|צהרון|מעון'),
    ('סושי', 'וטרינרית וטיפולים', r'וטרינרית|וטרינר|וטרינריה|veterinary'),
    ('תרופות וטיפולים', '', r'תרופ(?:ה|ות)|פיזיותרפיה|physiotherapy'),
    ('טיסות ותיירות', '', r'טיס(?:ה|ות)|מלון|בית מלון|hotel|flights?'),
)
REASON_RULES = [(category, sub, re.compile(rf'(?<!\w)(?:{words})(?!\w)')) for category, sub, words in REASONS]
NON_PURCHASE = re.compile(r'(?<!\w)(?:החזר|החזרים|החזרתי|זיכוי|הלוואה|ביטול|משיכה|טעינה|העברה פנימית|לחשבון שלי|refund|reimbursement|loan|withdrawal|reversal)(?!\w)')


def clean(value: str) -> str:
    normalized = unicodedata.normalize('NFKC', value)
    return ' '.join(''.join(c for c in normalized if unicodedata.category(c) != 'Cf').lower().split())


def header_label(value: str) -> str:
    label = re.sub(r'[()\[\]"/:״]', '', clean(value)).replace('_', ' ').replace('-', ' ')
    return ' '.join(label.split())


def decode_export(raw: bytes) -> str:
    if raw.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return raw.decode('utf-16')
    try:
        return raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        return raw.decode('cp1255')


def read_rows(raw: bytes):
    content = decode_export(raw)
    if '\x00' in content:
        raise ValueError('יש לבחור קובץ CSV של תנועות Bit.')
    for delimiter in (',', ';', '\t', '|'):
        reader = csv.reader(io.StringIO(content), delimiter=delimiter)
        for index, row in enumerate(reader):
            if index >= 20:
                break
            labels = [header_label(cell) for cell in row]
            columns = {key: next((labels.index(name) for name in names if name in labels), None)
                       for key, names in HEADERS.items()}
            if all(columns[key] is not None for key in ('date', 'amount', 'reason')):
                return reader, columns
    raise ValueError('לא נמצאו עמודות תאריך, סכום וסיבת העברה. בחרו CSV מרשימת התנועות של Bit.')


def transfer_date(value: object) -> date | None:
    text = str(value).strip()
    # Israeli exports are day-first. ISO dates are recognized above that rule.
    if match := re.match(r'^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?=$|[T\s])', text):
        year, month, day = (int(part) for part in match.groups())
    elif match := re.match(r'^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?=$|[T\s])', text):
        day, month, year = (int(part) for part in match.groups())
        if year < 100:
            year += 2000
    else:
        return None
    try:
        return date(year, month, day) if 2000 <= year <= 2100 else None
    except ValueError:
        return None


def cents(value: object) -> int | None:
    text = clean(str(value)).replace('−', '-')
    text = re.sub(r'\s|₪|ש["״]?ח|ils|nis', '', text)
    if text.startswith('(') and text.endswith(')'):
        text = '-' + text[1:-1]
    if text.endswith('-'):
        text = '-' + text[:-1]
    if re.fullmatch(r'[+-]?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?', text):
        text = text.replace(',', '')
    elif re.fullmatch(r'[+-]?\d{1,12},\d{1,2}', text):
        text = text.replace(',', '.')
    if not re.fullmatch(r'[+-]?\d{1,12}(?:\.\d{1,2})?', text):
        return None
    try:
        amount = int(Decimal(text) * 100)
    except InvalidOperation:
        return None
    return amount or None


def infer_category(reason: str):
    phrase = clean(reason)
    if NON_PURCHASE.search(phrase):
        return None
    matches = [(category, sub) for category, sub, pattern in REASON_RULES if pattern.search(phrase)]
    parents = {category for category, _ in matches}
    if len(parents) != 1:
        return None
    subs = {sub for _, sub in matches if sub}
    return matches[0][0], next(iter(subs)) if len(subs) == 1 else ''


def preview_bit_import(raw: bytes, ledger: pd.DataFrame) -> dict:
    reader, columns = read_rows(raw)
    candidates = defaultdict(list)
    protected = locked_mask(ledger) | manual_rule_mask(ledger)
    if 'id' in ledger.columns:
        unique_ids = ~ledger['id'].duplicated(keep=False)
        bit_rows = ledger.loc[unique_ids & ledger['תיאור'].fillna('').str.contains(BIT, na=False)]
        for index, row in bit_rows.iterrows():
            day = transfer_date(row['תאריך'])
            amount = cents(row['סכום'])
            if day and amount and pd.notna(row['id']):
                candidates[amount, day].append((int(row['id']), index))

    counts = Counter()
    claims = Counter()
    possible = []
    for row_number, row in enumerate(reader, 1):
        if row_number > MAX_ROWS:
            raise ValueError('אפשר לייבא עד 10,000 שורות בכל קובץ.')
        if not any(cell.strip() for cell in row):
            continue

        def field(key):
            position = columns[key]
            return row[position].strip() if position is not None and position < len(row) else ''

        counts['total'] += 1
        day = transfer_date(field('date'))
        amount = cents(field('amount'))
        direction = clean(field('direction'))
        status = clean(field('status'))
        if columns['status'] is not None and status not in FINAL:
            counts['not_completed'] += 1
            continue
        if day is None or amount is None or (direction and direction not in OUTGOING | INCOMING):
            counts['invalid'] += 1
            continue
        if direction in OUTGOING:
            amount = -abs(amount)
        elif direction in INCOMING:
            amount = abs(amount)
        elif amount > 0 and not field('amount').lstrip().startswith('+'):
            # Unsigned positive values without a direction could mean either.
            counts['invalid'] += 1
            continue
        matches = [candidate for delta in range(-DAY_WINDOW, DAY_WINDOW + 1)
                   for candidate in candidates.get((amount, day + timedelta(days=delta)), ())]
        if not matches:
            counts['unmatched'] += 1
            continue
        for tx_id, _ in matches:
            claims[tx_id] += 1
        if len(matches) != 1:
            counts['ambiguous'] += 1
            continue
        tx_id, index = matches[0]
        possible.append((tx_id, index, day, field('reason'), amount))

    proposals = []
    for tx_id, index, day, reason, amount in possible:
        row = ledger.loc[index]
        classification = infer_category(reason)
        if claims[tx_id] != 1:
            counts['ambiguous'] += 1
        elif protected.at[index] or row['קטגוריה'] not in {'העברת כספים', 'שונות'}:
            counts['already_classified'] += 1
        elif classification is None:
            counts['unknown_reason'] += 1
        else:
            category, subcategory = classification
            proposals.append({
                'transaction_id': tx_id,
                'txn_key': txn_fingerprint(row['תאריך'], row['סכום'], row['תיאור']),
                'date': day.isoformat(),
                'transaction_date': transfer_date(row['תאריך']).isoformat(),
                'amount': amount / 100,
                'reason': reason[:240],
                'category': category,
                'subcategory': subcategory,
            })
    duplicate_keys = {key for key, count in Counter(row['txn_key'] for row in proposals).items() if count > 1}
    if duplicate_keys:
        unique = [row for row in proposals if row['txn_key'] not in duplicate_keys]
        counts['ambiguous'] += len(proposals) - len(unique)
        proposals = unique
    return {'proposals': proposals, 'counts': dict(counts)}
