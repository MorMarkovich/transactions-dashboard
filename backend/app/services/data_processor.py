"""
Data processing and cleaning functions
"""
import pandas as pd
import numpy as np
from typing import Optional
from ..utils.validators import detect_header_row, parse_dates, clean_amount
from ..core.constants import CHECK_WITHDRAWAL_KEYWORDS, STANDING_ORDER_KEYWORDS, KEYWORD_TO_CATEGORY, EXACT_WORD_KEYWORDS
from .ai_categorizer import categorize_transactions


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

    # Also detect bank statements by presence of known income keywords
    # (salary, etc.) that should stay positive.  If we see them it means
    # the file already has correct signs.
    _income_keywords = [
        'משכורת', 'salary', 'מענק', 'פנסיה', 'pension',
        'קצבה', 'פיצויים', 'דמי אבטלה', 'הכנסה',
        'העברת שכר', 'העב שכר', 'שכ"ע', 'שכר עבודה',
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
    # positive (credits like salary, refunds).
    if not is_bank_statement:
        _nz = result['סכום'][result['סכום'] != 0]
        if len(_nz) > 0:
            _pos_r = (_nz > 0).sum() / len(_nz)
            _neg_r = (_nz < 0).sum() / len(_nz)
            if _pos_r >= 0.10 and _neg_r >= 0.10:
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
            pattern = r'(?:^|[\s\-/])' + kw + r'(?:$|[\s\-/])'
            match = misc_mask & desc_lower.str.contains(pattern, na=False, regex=True)
            if match.any():
                result.loc[match, 'קטגוריה'] = cat
                misc_mask = misc_mask & ~match

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
    
    # Replace NaN and Infinity with None to ensure valid JSON serialization
    result = result.replace([np.inf, -np.inf], None)
    result = result.where(pd.notnull(result), None)
    
    return result
