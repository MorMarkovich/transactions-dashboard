"""Classify Bit statements by the purpose available in a bank or card feed."""
import re
import unicodedata

import pandas as pd

from ..core.constants import INTERNAL_TRANSFER_PATTERN
from .data_processor import normalize_merchant, txn_fingerprint

TRANSFER_CATEGORY = 'העברת כספים'
LEGACY_MEMO_PROVIDERS = {'leumi', 'discount', 'isracard', 'max'}
BIT_PREFIX = re.compile(r'^(?:bit(?:pay)?|ביט)(?=$|[\s*:/–-])')
BIT_TRANSFER = re.compile(r'(?<!\w)(?:העברה|העברת כספים|תשלום|שליחה|קבלת כספים) (?:ביט|בביט|ב[ -]?bit|bit)(?!\w)')
BIT_WITHDRAWAL = re.compile(INTERNAL_TRANSFER_PATTERN)

GENERIC_BIT = re.compile(
    r'(?:(?:bit(?:pay)?|ביט)(?:[\s:–-]+(?:payment|transfer|העברה|העברת כספים|תשלום))?'
    r'|(?:תשלום|העברה|העברת כספים)\s+(?:ב[\s-]*)?(?:bit(?:pay)?|ביט))',
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
REASON_RULES = [
    (category, sub, re.compile(rf'(?<!\w)[בוכלמשה]?(?:{words})(?!\w)'))
    for category, sub, words in REASONS
]
NON_PURCHASE = re.compile(
    r'(?<!\w)[בוכלמשה]?(?:החזר|החזרים|החזרתי|זיכוי|הלוואה|ביטול|משיכה|טעינה'
    r'|העברה פנימית|לחשבון שלי|refund|reimbursement|loan|withdrawal|reversal)(?!\w)'
)


def clean(value: str) -> str:
    normalized = unicodedata.normalize('NFKC', value)
    return ' '.join(''.join(c for c in normalized if unicodedata.category(c) != 'Cf').lower().split())


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



def bit_transfer_mask(descriptions: pd.Series) -> pd.Series:
    normalized = descriptions.fillna('').map(normalize_merchant)
    return normalized.str.contains(BIT_PREFIX, na=False) | normalized.str.contains(BIT_TRANSFER, na=False)


def classify_bit_transfers(df: pd.DataFrame, transaction_notes) -> None:
    """Use only the current row's metadata. A memo is never a merchant rule."""
    candidates = bit_transfer_mask(df['תיאור'])
    # Old versions of the local sync stored the original memo in הערות.
    # An account note may have replaced that value during a later restore.
    note_keys = {note.txn_key for note in transaction_notes}
    for index in df.index[candidates]:
        description = normalize_merchant(df.at[index, 'תיאור'])
        if BIT_WITHDRAWAL.search(description):
            continue
        row = df.loc[index]
        memo = row.get('_bank_memo')
        source = row.get('_provider')
        if not isinstance(memo, str):
            if isinstance(source, str) and source in LEGACY_MEMO_PROVIDERS:
                key = txn_fingerprint(row.get('תאריך'), row.get('סכום'), row.get('תיאור'))
                if key not in note_keys:
                    memo = row.get('הערות')
        signals = [description]
        if isinstance(memo, str) and memo.strip():
            signals.append(memo)
        classification = infer_category(' '.join(signals))
        category, subcategory = classification or (TRANSFER_CATEGORY, '')
        df.at[index, 'קטגוריה'] = category
        df.at[index, 'קטגוריה_משנה'] = subcategory
