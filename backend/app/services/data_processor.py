"""
Data processing and cleaning functions
"""
import re
import pandas as pd
import numpy as np
from typing import Optional
from ..utils.validators import detect_header_row, parse_dates, clean_amount
from ..core.constants import (
    CHECK_WITHDRAWAL_KEYWORDS, STANDING_ORDER_KEYWORDS,
    KEYWORD_TO_CATEGORY, EXACT_WORD_KEYWORDS,
    AI_CATEGORY, AI_OVERRIDE_KEYWORDS, SUBCATEGORY_KEYWORDS,
)
from .ai_categorizer import categorize_transactions

# Pre-compiled AI-override pattern (substring, case-insensitive).
_AI_OVERRIDE_PATTERN = (
    '|'.join(re.escape(k) for k in AI_OVERRIDE_KEYWORDS) if AI_OVERRIDE_KEYWORDS else None
)


def apply_unconditional_overrides(df: pd.DataFrame) -> pd.DataFrame:
    """Apply category overrides that run on ALL rows, regardless of any
    pre-existing category. Shared by the upload pipeline (process_data) and the
    snapshot-restore pipeline (routes.restore_session) so the two never drift.

    Priority (later wins): Psagot → foreign-card → AI-tools. Operates in place.

    - 'פסגות'/'psagot'            → העברה להשקעות
    - foreign card descriptor      → טיסות ותיירות
      (trailing 2-letter country code, no Hebrew, not Israel's own IL)
    - AI-tool merchants            → בינה מלאכותית
      Applied as an override (not a keyword-pass entry) so charges that arrived
      already tagged 'חשמל ומחשבים' migrate without a bank-sync re-pull.
    """
    if df.empty or 'תיאור' not in df.columns or 'קטגוריה' not in df.columns:
        return df
    desc = df['תיאור'].astype(str)
    desc_lower = desc.str.lower()

    psagot_mask = desc_lower.str.contains('פסגות', na=False) | desc_lower.str.contains('psagot', na=False)
    if psagot_mask.any():
        df.loc[psagot_mask, 'קטגוריה'] = 'העברה להשקעות'

    foreign_mask = (
        ~desc.str.contains(r'[֐-׿]', regex=True, na=False)
        & desc.str.contains(r'[A-Za-z]', regex=True, na=False)
        & desc.str.contains(r'(?:^|\s)(?!IL(?:\s|$))[A-Z]{2}\s*$', regex=True, na=False)
    )
    if foreign_mask.any():
        df.loc[foreign_mask, 'קטגוריה'] = 'טיסות ותיירות'

    if _AI_OVERRIDE_PATTERN:
        ai_mask = desc_lower.str.contains(_AI_OVERRIDE_PATTERN, na=False, regex=True)
        if ai_mask.any():
            df.loc[ai_mask, 'קטגוריה'] = AI_CATEGORY

    return df


def derive_subcategory(df: pd.DataFrame) -> pd.DataFrame:
    """Populate the קטגוריה_משנה (subcategory) column from SUBCATEGORY_KEYWORDS.

    Scoped to each parent category (so sub-keywords never leak across
    categories), shrinking-mask substring scan mirroring the category loop.
    Only fills rows whose subcategory is still empty, so a manual/rule-assigned
    subcategory is preserved. Pure — no AI. Must run AFTER the category is
    finalized (after user rules) in both pipelines.
    """
    if 'קטגוריה_משנה' not in df.columns:
        df['קטגוריה_משנה'] = ''
    if df.empty or 'קטגוריה' not in df.columns or 'תיאור' not in df.columns:
        return df

    df['קטגוריה_משנה'] = df['קטגוריה_משנה'].fillna('').astype(str)
    cat = df['קטגוריה'].astype(str)
    desc_lower = df['תיאור'].astype(str).str.lower()

    for parent, submap in SUBCATEGORY_KEYWORDS.items():
        parent_mask = (cat == parent) & (df['קטגוריה_משנה'] == '')
        if not parent_mask.any():
            continue
        remaining = desc_lower[parent_mask]
        for sub_name, keywords in submap.items():
            if remaining.empty:
                break
            for kw in keywords:
                if remaining.empty:
                    break
                hit = remaining.str.contains(kw.lower(), na=False, regex=False)
                if hit.any():
                    df.loc[remaining.index[hit], 'קטגוריה_משנה'] = sub_name
                    remaining = remaining[~hit]
    return df


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
    if amount_col_clean == 'סכום חיוב' and 'סכום עסקה מקורי' in result.columns:
        try:
            fallback = pd.to_numeric(result['סכום עסקה מקורי'].apply(clean_amount), errors='coerce').fillna(0.0)
            # עדכון רק היכן שהסכום הוא 0
            mask_zero = result['סכום'] == 0
            if mask_zero.any():
                result.loc[mask_zero, 'סכום'] = fallback[mask_zero]
        except Exception:
            pass
    
    # המרת סכומים חיוביים לשליליים (הוצאות) - רק אם רוב הערכים חיוביים
    # לא מבצעים המרה בדוחות עו"ש (זכות/חובה) כי הסימן כבר נכון
    is_bank_statement = 'זכות/חובה' in str(amount_col)

    # A billing-date column is the strongest possible signal that this is
    # a credit-card file — bank statements (עו"ש) do not have one. When
    # it's present, skip the weaker heuristics below (salary keywords,
    # mixed-sign distribution), which can misidentify a CC file that
    # happens to contain a couple of refund rows and would then leave
    # every expense row with the wrong sign.
    is_credit_card_file = bool(billing_date_col and billing_date_col in result.columns)

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
    if not is_bank_statement and not is_credit_card_file and desc_col in result.columns:
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
    # positive (credits like salary, refunds).  Use a low threshold
    # (3%) because a bank statement may have very few income rows
    # (e.g. 2 salaries out of 80 transactions = 2.5%).
    if not is_bank_statement and not is_credit_card_file:
        _nz = result['סכום'][result['סכום'] != 0]
        if len(_nz) > 0:
            _pos_r = (_nz > 0).sum() / len(_nz)
            _neg_r = (_nz < 0).sum() / len(_nz)
            if _pos_r >= 0.03 and _neg_r >= 0.03:
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
    except Exception:
        result['קטגוריה'] = 'שונות'
    
    # Unconditional category overrides (Psagot investment transfers, foreign-card
    # travel, AI tools) — these run on ALL rows regardless of any existing
    # category. Shared helper so this pipeline and restore_session never drift.
    apply_unconditional_overrides(result)

    # Reclassify check withdrawals as rent (שכר דירה)
    desc_lower = result['תיאור'].str.lower()
    for keyword in CHECK_WITHDRAWAL_KEYWORDS:
        kw = keyword.lower()
        # Short keywords (≤3 chars) need word-boundary matching to avoid
        # false positives like "צק" matching inside "סטימצקי".
        if len(kw) <= 3:
            pattern = r'(?:^|[\s\-/])' + kw + r'(?:$|[\s\-/])'
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

    # Auto-categorize "שונות" transactions by matching description keywords.
    # Scan only the shrinking "שונות" subset so each keyword check touches just
    # the still-uncategorized rows (cheap even with the ~1000-keyword catalog).
    misc_mask = result['קטגוריה'] == 'שונות'
    if misc_mask.any():
        remaining = desc_lower[misc_mask]
        # Substring-based keywords (longer, unambiguous)
        for kw, cat in KEYWORD_TO_CATEGORY.items():
            if remaining.empty:
                break
            hit = remaining.str.contains(kw, na=False, regex=False)
            if hit.any():
                result.loc[remaining.index[hit], 'קטגוריה'] = cat
                remaining = remaining[~hit]
        # Word-boundary keywords (short/ambiguous like "הוט", "hot", "פז")
        for kw, cat in EXACT_WORD_KEYWORDS.items():
            if remaining.empty:
                break
            pattern = r'(?:^|[\s\-/])' + kw + r'(?:$|[\s\-/])'
            hit = remaining.str.contains(pattern, na=False, regex=True)
            if hit.any():
                result.loc[remaining.index[hit], 'קטגוריה'] = cat
                remaining = remaining[~hit]

    # AI-powered categorization for remaining "שונות" transactions
    misc_mask = result['קטגוריה'] == 'שונות'
    if misc_mask.any():
        misc_descriptions = result.loc[misc_mask, 'תיאור'].tolist()
        ai_mapping = categorize_transactions(misc_descriptions)
        if ai_mapping:
            misc_indices = result.index[misc_mask].tolist()
            for local_idx, category in ai_mapping.items():
                if 0 <= local_idx < len(misc_indices):
                    result.at[misc_indices[local_idx], 'קטגוריה'] = category

    # Derive the subcategory (קטגוריה_משנה) from the now-finalized category.
    derive_subcategory(result)

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
        result = pd.DataFrame(columns=['תאריך', 'סכום', 'תיאור', 'קטגוריה', 'קטגוריה_משנה', 'סכום_מוחלט', 'חודש', 'יום_בשבוע'])

    # Ensure notes column exists
    if 'הערות' not in result.columns:
        result['הערות'] = None

    # Mark whether this batch was processed as a bank statement. We used to
    # identify bank rows downstream by checking תאריך_חיוב.isna(), but once
    # we started mapping יום ערך → תאריך_חיוב for bank files that signal
    # vanished. This explicit marker survives concat + Supabase round-trip
    # so restore-session can still pick lump-sum credit-card payments out
    # of bank rows for deduplication.
    if not result.empty:
        result['_is_bank_row'] = bool(is_bank_statement)

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
