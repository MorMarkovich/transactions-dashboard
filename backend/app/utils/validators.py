"""
Data validation and detection functions
"""
import pandas as pd
import re
from typing import Optional


def detect_header_row(df: pd.DataFrame) -> int:
    """זיהוי חכם של שורת הכותרת"""
    # מילות מפתח לזיהוי כותרות
    keywords = ['תאריך', 'שם בית העסק', 'סכום', 'קטגוריה', 'תיאור', 'חיוב', 'עסקה', 'Date', 'Amount', 'זכות', 'חובה', 'תנועה', 'ערך']
    
    # סריקה של 20 השורות הראשונות
    for idx in range(min(20, len(df))):
        # המרת השורה לטקסט וניקוי רווחים
        row_values = [str(val).strip() for val in df.iloc[idx].tolist() if pd.notna(val)]
        row_text = ' '.join(row_values)
        
        # ספירת התאמות
        matches = sum(1 for k in keywords if k in row_text or any(k in str(v) for v in row_values))
        
        # אם יש לפחות 3 התאמות - זו כנראה הכותרת
        if matches >= 3:
            return idx
            
    return 0


def _strict_grouped_thousands(s_val: str, sep: str) -> Optional[float]:
    """מפריד אלפים חוזר (1,234,567 / 1.234.567): כל קבוצה אחרי הראשונה בדיוק
    3 ספרות, הראשונה 1-3. אחרת — לא תקין (None), לא ניחוש."""
    parts = s_val.split(sep)
    if len(parts) < 2:
        return None
    if not (1 <= len(parts[0]) <= 3) or not parts[0].isdigit():
        return None
    if any(len(part) != 3 or not part.isdigit() for part in parts[1:]):
        return None
    return float(''.join(parts))


def _to_float(s_val: str) -> Optional[float]:
    try:
        return float(s_val)
    except ValueError:
        return None


def clean_amount(value) -> Optional[float]:
    """ניקוי ופרסור סכומים.

    מוסכמת בטיחות פיננסית: ערך ריק/חסר מחזיר 0.0, אבל תוכן לא-ריק שלא ניתן
    לפרסר בבירור לפי המוסכמות המאומתות (אלפים בקבוצות של 3, עשרוני ב-2 ספרות,
    נקודה עשרונית בודדת) מחזיר None — "לא תקין" — ולא ניחוש שעלול להיות
    פי 10/1000 מהערך האמיתי. השכבה מעל סופרת None כ-invalid_amount ומסמנת
    ל-UI, במקום להפיל שורה בשקט או להמציא סכום.
    """
    if pd.isna(value) or value == '':
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    # המרה למחרוזת וניקוי תווים
    s_val = str(value).strip()

    # פורמט חשבונאי: סכום שלילי בסוגריים, לדוגמה (1,234.56)
    paren_negative = s_val.startswith('(') and s_val.endswith(')')
    if paren_negative:
        s_val = s_val[1:-1].strip()

    # הסרת סימן שקל ורווחים
    s_val = s_val.replace('₪', '').replace('NIS', '').replace('nis', '').strip()

    # טיפול בסימן מינוס (יכול להיות בהתחלה או בסוף, או תווי מינוס מיוחדים)
    is_negative = paren_negative or '-' in s_val or '−' in s_val
    s_val = s_val.replace('-', '').replace('−', '').strip()

    # מה נשאר אחרי מטבע/מינוס — תוכן לא-מספרי כאן עם בלי ספרות בהמשך = לא תקין
    residual = s_val.strip()

    # הסרת כל התווים שאינם מספרים או נקודה/פסיק
    s_val = re.sub(r'[^\d.,]', '', s_val)

    if not s_val:
        return None if residual else 0.0

    # טיפול בפורמטים שונים (1,000.00 או 1.000,00)
    amount: Optional[float]
    if ',' in s_val and '.' in s_val:
        if s_val.rfind(',') > s_val.rfind('.'):
            # פורמט אירופאי: 1.000,00 -> 1000.00
            amount = _to_float(s_val.replace('.', '').replace(',', '.'))
        else:
            # פורמט אמריקאי: 1,000.00 -> 1000.00
            amount = _to_float(s_val.replace(',', ''))
    elif ',' in s_val:
        parts = s_val.split(',')
        tail = parts[-1]
        if len(parts) == 2 and len(tail) == 2:
            # עשרוני בפסיק, בדיוק 2 ספרות: 12,34 -> 12.34
            amount = _to_float(s_val.replace(',', '.'))
        elif len(parts) == 2 and len(tail) == 3 and 1 <= len(parts[0]) <= 3 and parts[0].isdigit():
            # אלפים בודד: 1,234 -> 1234
            amount = float(parts[0] + tail)
        elif len(parts) > 2:
            # אלפים חוזר: תקין רק בקבוצות של 3 (1,234,567); אחרת לא תקין
            amount = _strict_grouped_thousands(s_val, ',')
        else:
            # דו-משמעי: 0/1/4+ ספרות אחרי הפסיק (",5", "1,5", "1,2345") — לא מנחשים
            amount = None
    elif '.' in s_val:
        if s_val.count('.') == 1:
            amount = _to_float(s_val)
        else:
            # נקודות חוזרות: תקין רק כאלפים אירופיים בקבוצות של 3; "1.2.3" לא תקין
            amount = _strict_grouped_thousands(s_val, '.')
    else:
        amount = _to_float(s_val)

    if amount is None:
        return None
    return -amount if is_negative else amount


def has_valid_amounts(df: pd.DataFrame, col: str) -> bool:
    if col not in df.columns:
        return False
    try:
        values = pd.to_numeric(df[col].apply(clean_amount), errors='coerce')
        return bool(values.abs().sum() > 0)
    except Exception:
        return False


DEBIT_CREDIT_PAIRS = [('זכות', 'חובה'), ('סכום זכות', 'סכום חובה'), ('זכות ₪', 'חובה ₪')]


_DATE_VALUE_RE = re.compile(r'^\s*\d{1,2}[/\.\-]\d{1,2}[/\.\-]\d{2,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?\s*$')


def _looks_like_date_column(df: pd.DataFrame, col) -> bool:
    """True when the column's values are mostly dates — never an amount source."""
    series = df[col]
    if not isinstance(series, pd.Series):
        return False
    if pd.api.types.is_datetime64_any_dtype(series):
        return True
    vals = series.dropna().astype(str).str.strip()
    vals = vals[vals != '']
    if vals.empty:
        return False
    return bool(vals.str.match(_DATE_VALUE_RE).mean() >= 0.5)


def _looks_like_identifier_column(df: pd.DataFrame, col) -> bool:
    """True when the column's values are mostly long digit runs (card numbers,
    אסמכתא/reference ids) — never an amount source."""
    series = df[col]
    if not isinstance(series, pd.Series):
        return False
    vals = series.dropna().astype(str).str.strip().str.replace(r'[\s\-]', '', regex=True)
    vals = vals[vals != '']
    if vals.empty:
        return False
    return bool((vals.str.fullmatch(r'\d+') & (vals.str.len() >= 10)).mean() >= 0.5)


def detect_amount_column(df: pd.DataFrame, exclude: Optional[str] = None) -> Optional[str]:
    preferred = ['סכום חיוב', 'סכום עסקה מקורי', 'סכום', '₪ זכות/חובה', 'אם זכות/חובה']
    named_found = False
    for name in preferred:
        matches = [c for c in df.columns if str(c).strip() == name]
        for col in matches:
            named_found = True
            if has_valid_amounts(df, col):
                return col

    keywords = ['amount', 'sum', 'סכום', 'total', 'חיוב', 'זכות/חובה']
    for col in df.columns:
        col_lower = str(col).lower()
        if any(k in col_lower for k in keywords):
            named_found = True
            if has_valid_amounts(df, col):
                return col

    # עמודת סכום בשם מוכר קיימת אבל כל ערכיה אפס/ריק (למשל ייצוא עסקאות
    # ממתינות) — אין סכומים לקרוא. נכשל בבירור במקום לנחש עמודה לא קשורה
    # (תאריך, מספר כרטיס, אסמכתא) כעמודת סכומים.
    if named_found:
        return None

    # זוג עמודות זכות/חובה נפרדות הוא פורמט מוכר — אין לנחש עמודה אחרת;
    # ה-caller מאחד אותן לעמודה חתומה דרך combine_debit_credit_columns.
    col_names = {str(c).strip() for c in df.columns}
    for credit_name, debit_name in DEBIT_CREDIT_PAIRS:
        if credit_name in col_names and debit_name in col_names:
            return None

    # נפילה אחרונה: עמודה מספרית ללא שם מוכר — לעולם לא עמודת תאריך או מזהה.
    for col in df.columns:
        if exclude is not None and str(col).strip() == str(exclude).strip():
            continue
        if _looks_like_date_column(df, col) or _looks_like_identifier_column(df, col):
            continue
        if has_valid_amounts(df, col):
            return col

    return None


def combine_debit_credit_columns(df: pd.DataFrame) -> Optional[str]:
    """דוחות בנק ישראלים מפצלים לעיתים סכומים לעמודות זכות (קרדיט) וחובה
    (דביט) נפרדות. מאחד לעמודת '₪ זכות/חובה' חתומה (זכות חיובי, חובה שלילי)
    כדי שחוזה הסימנים הקיים של דוח עו"ש יחול כמות שהוא — בלי ניחוש סימנים."""
    cols = {str(c).strip(): c for c in df.columns}
    for credit_name, debit_name in DEBIT_CREDIT_PAIRS:
        if credit_name in cols and debit_name in cols:
            credit = df[cols[credit_name]].apply(clean_amount)
            debit = df[cols[debit_name]].apply(clean_amount)
            combined = credit - debit
            if combined.abs().sum() == 0:
                return None
            df['₪ זכות/חובה'] = combined
            return '₪ זכות/חובה'
    return None


def find_column(df: pd.DataFrame, keywords: list) -> Optional[str]:
    for col in df.columns:
        if str(col).strip() in keywords:
            return col
    for col in df.columns:
        col_lower = str(col).lower()
        for k in keywords:
            if k.lower() in col_lower:
                return col
    return None


def parse_dates(series: pd.Series) -> pd.Series:
    """פרסור תאריכים בפורמטים שונים עם טיפול בשגיאות"""
    if series.empty:
        return pd.Series(dtype='datetime64[ns]')

    # If already datetime dtype, return directly (no string conversion needed)
    if pd.api.types.is_datetime64_any_dtype(series):
        return pd.to_datetime(series, errors='coerce')

    # Check if values are native datetime/Timestamp objects (common from Excel)
    sample = series.dropna().head(5)
    if len(sample) > 0:
        from datetime import datetime as _dt
        if all(isinstance(v, (pd.Timestamp, _dt)) for v in sample):
            return pd.to_datetime(series, errors='coerce')

    # String-based parsing with explicit formats
    # %Y-%m-%d %H:%M:%S first — matches stringified Excel datetime objects
    formats = ['%Y-%m-%d %H:%M:%S', '%d-%m-%Y', '%d/%m/%Y', '%Y-%m-%d', '%d.%m.%Y', '%Y/%m/%d', '%m/%d/%Y']
    result = pd.Series([pd.NaT] * len(series), index=series.index)

    # ניקוי ערכים לפני פרסור
    cleaned_series = series.astype(str).str.strip()

    for fmt in formats:
        mask = result.isna()
        if not mask.any():
            break
        try:
            result[mask] = pd.to_datetime(cleaned_series[mask], format=fmt, errors='coerce')
        except Exception:
            continue

    # ניסיון אחרון עם dayfirst
    if result.isna().any():
        try:
            remaining_mask = result.isna()
            result[remaining_mask] = pd.to_datetime(cleaned_series[remaining_mask], dayfirst=True, errors='coerce')
        except Exception:
            pass

    return result
