"""
Data processing and cleaning functions
"""
import re
import pandas as pd
import numpy as np
from typing import Optional
from ..utils.validators import detect_header_row, parse_dates, clean_amount
from ..core.constants import CHECK_WITHDRAWAL_KEYWORDS, STANDING_ORDER_KEYWORDS, KEYWORD_TO_CATEGORY, EXACT_WORD_KEYWORDS, SALARY_KEYWORDS, REFUND_KEYWORDS, normalize_category
from .ai_categorizer import categorize_transactions, classify_transactions


# Bidirectional control characters that sometimes leak through from PDF/CSV
# ingest. Stripping them prevents weird-looking descriptions in the UI.
_BIDI_CONTROLS = ''.join([
    '‎',  # LRM
    '‏',  # RLM
    '‪',  # LRE
    '‫',  # RLE
    '‬',  # PDF
    '‭',  # LRO
    '‮',  # RLO
    '⁦',  # LRI
    '⁧',  # RLI
    '⁨',  # FSI
    '⁩',  # PDI
])
_BIDI_RE = re.compile('[' + _BIDI_CONTROLS + ']')


def _sanitize_rtl_text(text) -> str:
    """Clean up RTL artefacts in user-visible strings before storing them.

    Real-world Excel/PDF/CSV exports sometimes embed bidi control marks or
    leave parentheses visually reversed (e.g. \")עילאי יצחק(\"). We:
      1. Strip bidi control marks (LRM/RLM/PDF/LRE/LRI/...)
      2. Swap mismatched leading/trailing parens that imply RTL reversal
      3. Collapse runs of whitespace
    """
    if text is None:
        return ''
    s = str(text)
    if not s:
        return s
    s = _BIDI_RE.sub('', s)
    # A common pattern from RTL-reversed exports: a closing paren *before*
    # an opening paren. Swap them as a heuristic.
    s = re.sub(r'\)([^()]*)\(', r'(\1)', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """ניקוי והכנת ה-DataFrame"""
    if df.empty:
        return df
    
    # זיהוי שורת כותרת
    header_row = detect_header_row(df)
    
    if header_row > 0:
        # הגדרת הכותרות
        df.columns = df.iloc[header_row].tolist()
        df = df.iloc[header_row + 1:].reset_index(drop=True)
    
    # ניקוי שמות העמודות
    df.columns = [str(c).strip() for c in df.columns]
    
    # הסרת שורות סיכום וזבל
    summary_keywords = ['סך הכל', 'סה"כ', 'total', 'סיכום', 'יתרה']
    
    def is_valid_row(row):
        # Create string representation safely handles mixed types/NaNs
        row_str = ' '.join([str(x).lower() for x in row if pd.notna(x)])
        # בדיקה אם זו שורת סיכום
        if any(k in row_str for k in summary_keywords):
            return False
        # בדיקה אם השורה ריקה כמעט לגמרי
        if row.isnull().sum() > len(row) * 0.8:
            return False
        return True

    mask = df.apply(is_valid_row, axis=1)
    df = df[mask].reset_index(drop=True)
    
    # הסרת עמודות ריקות לחלוטין
    df = df.dropna(axis=1, how='all')
    
    return df


def process_data(df: pd.DataFrame, date_col: str, amount_col: str, desc_col: str, cat_col: Optional[str], billing_date_col: Optional[str] = None) -> pd.DataFrame:
    """עיבוד הנתונים עם טיפול מקיף ב-edge cases"""
    if df.empty:
        return pd.DataFrame()

    result = df.copy()

    # פרסור תאריכים
    try:
        result['תאריך'] = parse_dates(result[date_col])
    except Exception:
        result['תאריך'] = pd.NaT

    # פרסור תאריך חיוב (אם קיים)
    if billing_date_col and billing_date_col in result.columns:
        try:
            result['תאריך_חיוב'] = parse_dates(result[billing_date_col])
        except Exception:
            result['תאריך_חיוב'] = pd.NaT
    
    # ניקוי סכומים
    try:
        # וידוא שהערכים הם מספריים
        result['סכום'] = pd.to_numeric(result[amount_col].apply(clean_amount), errors='coerce').fillna(0.0)
    except Exception:
        result['סכום'] = 0.0

    # Fallback לסכום עסקה מקורי אם סכום חיוב ריק
    amount_col_clean = str(amount_col).strip() if amount_col else ''
    if 'סכום חיוב' in amount_col_clean and 'סכום עסקה מקורי' in result.columns:
        try:
            fallback = pd.to_numeric(result['סכום עסקה מקורי'].apply(clean_amount), errors='coerce').fillna(0.0)
            # עדכון רק היכן שהסכום הוא 0 (עם סבילות לדיוק פלוטינג)
            mask_zero = result['סכום'].abs() < 1e-9
            if mask_zero.any():
                result.loc[mask_zero, 'סכום'] = fallback[mask_zero]
        except Exception:
            pass
    
    # המרת סכומים חיוביים לשליליים (הוצאות) - רק אם רוב הערכים חיוביים
    # לא מבצעים המרה בדוחות עו"ש (זכות/חובה) כי הסימן כבר נכון
    is_bank_statement = 'זכות/חובה' in str(amount_col)

    # Also detect bank statements by presence of known income keywords
    # (salary, etc.) that should stay positive.  If we see them it means
    # the file already has correct signs.
    _income_keywords = [
        'משכורת', 'salary', 'מענק', 'פנסיה', 'pension',
        'קצבה', 'פיצויים', 'דמי אבטלה', 'הכנסה',
        'העברת שכר', 'העב שכר', 'שכ"ע', 'שכר עבודה',
        'הפקדת שכר', 'תשלום שכר', 'שכר חודש',
        'קצבת ילדים', 'מענק עבודה', 'דמי לידה',
    ]
    if not is_bank_statement and desc_col in result.columns:
        _desc_check = result[desc_col].astype(str).str.lower()
        _has_income_rows = _desc_check.str.contains(
            '|'.join(_income_keywords), na=False,
        ).any()
        if _has_income_rows:
            # File contains salary/income rows → treat as bank statement
            is_bank_statement = True

    # Also detect bank statements by mixed sign distribution.
    # Credit-card files are almost entirely positive (>80%); bank
    # statements (עו"ש) typically have a mix of negative (debits) and
    # positive (credits like salary).  We only flip to "bank statement"
    # semantics if there's a *substantial* portion of each sign — a
    # credit-card file with a handful of refund rows shouldn't be
    # misclassified (verified bug: 48 expense rows were left positive
    # because two refunds tripped a 3 % mixed-signs threshold).
    if not is_bank_statement:
        _nz = result['סכום'][result['סכום'] != 0]
        if len(_nz) > 0:
            _pos_r = (_nz > 0).sum() / len(_nz)
            _neg_r = (_nz < 0).sum() / len(_nz)
            # Require ≥ 15 % of the minority sign before assuming it's a
            # mixed bank statement (was 3 %). And in either case, if the
            # majority is over 85 % we treat it as a credit-card file and
            # let the flip below run.
            if 0.15 <= _pos_r <= 0.85 and 0.15 <= _neg_r <= 0.85:
                is_bank_statement = True

    non_zero = result['סכום'][result['סכום'] != 0]
    if not is_bank_statement and len(non_zero) > 0:
        positive_ratio = (non_zero > 0).sum() / len(non_zero)
        if positive_ratio > 0.8:  # אם יותר מ-80% חיוביים - אלה הוצאות
            # Remember which rows were originally negative (credits/refunds/income)
            originally_negative = result['סכום'] < 0
            # Flip positive amounts to negative (expenses)
            result.loc[~originally_negative, 'סכום'] = -result.loc[~originally_negative, 'סכום'].abs()
            # Flip originally negative amounts to positive (income/refunds)
            result.loc[originally_negative, 'סכום'] = result.loc[originally_negative, 'סכום'].abs()

    # After sign-flipping, ensure known income descriptions stay positive.
    # This catches cases where a credit-card file's sign-flip incorrectly
    # turned salary/income rows negative.
    if desc_col in result.columns:
        _desc_for_income = result[desc_col].astype(str).str.lower()
        _all_income_kw = _income_keywords + ['החזר', 'refund', 'זיכוי']
        _income_desc_mask = _desc_for_income.str.contains(
            '|'.join(_all_income_kw), na=False,
        )
        # Only fix rows that are negative but should be income
        _wrong_sign = _income_desc_mask & (result['סכום'] < 0)
        if _wrong_sign.any():
            result.loc[_wrong_sign, 'סכום'] = result.loc[_wrong_sign, 'סכום'].abs()
    
    # ניקוי תיאור
    try:
        result['תיאור'] = result[desc_col].astype(str).str.strip()
        result['תיאור'] = result['תיאור'].apply(_sanitize_rtl_text)
        result['תיאור'] = result['תיאור'].replace(['nan', 'None', ''], 'לא ידוע')
    except Exception:
        result['תיאור'] = 'לא ידוע'
    
    # קטגוריה
    try:
        if cat_col and cat_col in result.columns:
            result['קטגוריה'] = result[cat_col].astype(str).str.strip()
        else:
            result['קטגוריה'] = 'שונות'
        # ניקוי ערכים ריקים
        result.loc[result['קטגוריה'].isin(['', 'nan', 'None', 'NaN']), 'קטגוריה'] = 'שונות'
        # Normalise variants (with/without commas, typos like
        # "שינותי תקשורת") so the same logical category isn't split into
        # two buckets across upload sources.
        result['קטגוריה'] = result['קטגוריה'].apply(normalize_category)
    except Exception:
        result['קטגוריה'] = 'שונות'
    
    # Reclassify check withdrawals as rent (שכר דירה)
    desc_lower = result['תיאור'].str.lower()

    # Reclassify Psagot investment transfers as a dedicated category
    psagot_mask = desc_lower.str.contains('פסגות', na=False) | desc_lower.str.contains('psagot', na=False)
    if psagot_mask.any():
        result.loc[psagot_mask, 'קטגוריה'] = 'העברה להשקעות'
    for keyword in CHECK_WITHDRAWAL_KEYWORDS:
        kw = keyword.lower()
        # Short keywords (≤3 chars) need word-boundary matching to avoid
        # false positives like "צק" matching inside "סטימצקי".
        if len(kw) <= 3:
            pattern = r'(?:^|[\s\-/])' + re.escape(kw) + r'(?:$|[\s\-/])'
            mask = desc_lower.str.contains(pattern, na=False, regex=True)
        else:
            mask = desc_lower.str.contains(kw, na=False, regex=False)
        if mask.any():
            result.loc[mask, 'קטגוריה'] = 'שכר דירה'

    # Reclassify standing orders (הוראות קבע)
    for keyword in STANDING_ORDER_KEYWORDS:
        mask = desc_lower.str.contains(keyword.lower(), na=False)
        if mask.any():
            result.loc[mask, 'קטגוריה'] = 'הוראות קבע'

    # Auto-categorize "שונות" transactions by matching description keywords
    misc_mask = result['קטגוריה'] == 'שונות'
    if misc_mask.any():
        # Substring-based keywords (longer, unambiguous)
        for kw, cat in KEYWORD_TO_CATEGORY.items():
            match = misc_mask & desc_lower.str.contains(kw, na=False, regex=False)
            if match.any():
                result.loc[match, 'קטגוריה'] = cat
                misc_mask = misc_mask & ~match
        # Word-boundary keywords (short/ambiguous like "הוט", "hot", "פז")
        for kw, cat in EXACT_WORD_KEYWORDS.items():
            if not misc_mask.any():
                break
            pattern = r'(?:^|[\s\-/])' + re.escape(kw) + r'(?:$|[\s\-/])'
            match = misc_mask & desc_lower.str.contains(pattern, na=False, regex=True)
            if match.any():
                result.loc[match, 'קטגוריה'] = cat
                misc_mask = misc_mask & ~match

    # ── AI classification: category + merchant canonical name ─────────
    # Runs on EVERY row (not just שונות) so we also get a normalised
    # merchant name for the dedup work the merchants/recurring/anomaly
    # endpoints rely on. For category, we only OVERRIDE rows that are
    # still in שונות — keyword matches win, since they're deterministic
    # and known-correct.
    if not result.empty and 'תיאור' in result.columns and 'סכום' in result.columns:
        all_descs = result['תיאור'].astype(str).tolist()
        all_amts = result['סכום'].astype(float).tolist()
        classified = classify_transactions(all_descs, all_amts)
        if classified:
            # Map local index → row data
            by_idx = {item['index']: item for item in classified if isinstance(item.get('index'), int)}
            # Allocate column once with object dtype so we can store None.
            if '_canonical_merchant' not in result.columns:
                result['_canonical_merchant'] = None
            for local_idx, row_idx in enumerate(result.index):
                item = by_idx.get(local_idx)
                if not item:
                    continue
                merchant = item.get('merchant_canonical')
                if merchant:
                    result.at[row_idx, '_canonical_merchant'] = merchant
                # Only override category when the row is still שונות.
                if result.at[row_idx, 'קטגוריה'] == 'שונות':
                    cat = item.get('category')
                    if cat and cat != 'שונות':
                        result.at[row_idx, 'קטגוריה'] = cat

    # Fallback canonical: when AI didn't return one (or wasn't available)
    # use the description verbatim so downstream group-bys still have a key.
    if '_canonical_merchant' in result.columns:
        result['_canonical_merchant'] = result['_canonical_merchant'].fillna(result['תיאור'])
    else:
        result['_canonical_merchant'] = result['תיאור']

    # Reclassify positive-amount rows by description: real income (salary,
    # pension, benefits) → "משכורת והכנסות"; refunds / credits / BIT receipts
    # → "החזרים וזיכויים". This prevents refunds and reimbursements from
    # being counted as "real income" on the dashboard.
    pos_mask = (result['סכום'] > 0) & result['תיאור'].notna()
    if pos_mask.any():
        pos_desc_lower = result.loc[pos_mask, 'תיאור'].astype(str).str.lower()

        salary_pattern = '|'.join(re.escape(k.lower()) for k in SALARY_KEYWORDS)
        refund_pattern = '|'.join(re.escape(k.lower()) for k in REFUND_KEYWORDS)
        salary_match = pos_desc_lower.str.contains(salary_pattern, na=False, regex=True)
        refund_match = pos_desc_lower.str.contains(refund_pattern, na=False, regex=True)

        to_salary = pos_mask.copy()
        to_salary.loc[pos_mask] = salary_match.values
        if to_salary.any():
            result.loc[to_salary, 'קטגוריה'] = 'משכורת והכנסות'

        # Refund pattern only wins where salary pattern didn't (salary > refund
        # for ambiguous wording).
        to_refund = pos_mask.copy()
        to_refund.loc[pos_mask] = (refund_match & ~salary_match).values
        if to_refund.any():
            result.loc[to_refund, 'קטגוריה'] = 'החזרים וזיכויים'

    # ── Net out canceled-transaction pairs ─────────────────────────────
    # Rows with a "ביטול" marker (in הערות, in סוג עסקה, or in the
    # description itself) cancel out their original charge. We drop both
    # sides of the pair so they don't inflate spending totals — e.g.
    # an "אל על ‎-₪4,221" charge paired with "אל על +₪4,221  ביטול עסקה"
    # nets to zero and shouldn't appear as the top expense for the month.
    if 'תאריך' in result.columns and 'תיאור' in result.columns and 'סכום' in result.columns:
        # Look for the cancellation marker in every string-ish column.
        cancel_mask = pd.Series(False, index=result.index)
        cancel_indicator_cols = [
            c for c in result.columns
            if isinstance(c, str)
            and c not in ('סכום', 'סכום_מוחלט', 'תאריך', 'תאריך_חיוב', 'יום_בשבוע')
        ]
        for col in cancel_indicator_cols:
            try:
                col_lower = result[col].astype(str).str.lower()
                cancel_mask = cancel_mask | col_lower.str.contains('ביטול', na=False)
            except Exception:
                continue

        if cancel_mask.any():
            to_drop = set()
            for cancel_idx in result.index[cancel_mask].tolist():
                if cancel_idx in to_drop:
                    continue
                row = result.loc[cancel_idx]
                merchant = row['תיאור']
                amount = row['סכום']
                if pd.isna(merchant) or pd.isna(amount):
                    continue
                date_val = row['תאריך']
                # Match by merchant + transaction date + opposite-sign equal
                # amount. Tolerate ±0.01 ILS for floating-point precision.
                candidates = result[
                    (result.index != cancel_idx)
                    & (result['תיאור'] == merchant)
                    & (result['תאריך'] == date_val)
                    & ((result['סכום'] + amount).abs() < 0.01)
                    & (~result.index.isin(to_drop))
                ]
                if not candidates.empty:
                    to_drop.add(cancel_idx)
                    to_drop.add(int(candidates.index[0]))
                else:
                    # No paired original on the same date — drop the lone
                    # cancellation anyway, since it's a credit that nets
                    # against an out-of-scope original. Keeping it inflates
                    # total_positive without any offsetting expense.
                    to_drop.add(cancel_idx)
            if to_drop:
                result = result.drop(index=list(to_drop)).reset_index(drop=True)

    # סינון שורות לא תקינות
    result = result[(result['סכום'] != 0) & result['תאריך'].notna()].reset_index(drop=True)
    
    # הוספת עמודות נוספות
    if not result.empty:
        result['סכום_מוחלט'] = result['סכום'].abs()
        result['חודש'] = result['תאריך'].dt.strftime('%m/%Y')
        result['יום_בשבוע'] = result['תאריך'].dt.dayofweek
        if 'תאריך_חיוב' in result.columns:
            result['חודש_חיוב'] = result['תאריך_חיוב'].dt.strftime('%m/%Y')
    else:
        # יצירת DataFrame ריק עם העמודות הנדרשות
        result = pd.DataFrame(columns=['תאריך', 'סכום', 'תיאור', 'קטגוריה', 'סכום_מוחלט', 'חודש', 'יום_בשבוע'])

    # Ensure notes column exists
    if 'הערות' not in result.columns:
        result['הערות'] = None

    # Stable row identifier for per-transaction updates from the UI
    if not result.empty:
        result['id'] = result.index.astype(int)
    else:
        # Keep an empty id column for schema consistency
        result['id'] = pd.Series(dtype='int64')
    
    # Replace NaN and Infinity with None to ensure valid JSON serialization
    result = result.replace([np.inf, -np.inf], None)
    result = result.where(pd.notnull(result), None)
    
    return result
