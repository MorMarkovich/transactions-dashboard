"""
Data validation and detection functions
"""
import pandas as pd
import re
from typing import Optional


def detect_header_row(df: pd.DataFrame) -> int:
    """זיהוי חכם של שורת הכותרת"""
    # מילות מפתח לזיהוי כותרות
    keywords = ['תאריך', 'שם בית העסק', 'סכום', 'קטגוריה', 'תיאור', 'חיוב', 'עסקה', 'Date', 'Amount']
    
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


def clean_amount(value) -> float:
    """ניקוי ופרסור סכומים בצורה רובסטית"""
    if pd.isna(value) or value == '':
        return 0.0
        
    if isinstance(value, (int, float)):
        return float(value)
        
    # המרה למחרוזת וניקוי תווים
    s_val = str(value).strip()
    
    # הסרת סימן שקל ורווחים
    s_val = s_val.replace('₪', '').replace('NIS', '').replace('nis', '').strip()
    
    # טיפול בסימן מינוס (יכול להיות בהתחלה או בסוף, או תווי מינוס מיוחדים)
    is_negative = '-' in s_val or '−' in s_val
    s_val = s_val.replace('-', '').replace('−', '').strip()
    
    # הסרת כל התווים שאינם מספרים או נקודה/פסיק
    s_val = re.sub(r'[^\d.,]', '', s_val)
    
    if not s_val:
        return 0.0
        
    # טיפול בפורמטים שונים (1,000.00 או 1.000,00)
    if ',' in s_val and '.' in s_val:
        if s_val.rfind(',') > s_val.rfind('.'):
            # פורמט אירופאי: 1.000,00 -> 1000.00
            s_val = s_val.replace('.', '').replace(',', '.')
        else:
            # פורמט אמריקאי: 1,000.00 -> 1000.00
            s_val = s_val.replace(',', '')
    elif ',' in s_val:
        # רק פסיקים - נניח שהם מפרידי אלפים אלא אם זה בסוף
        # אבל אם יש רק פסיק אחד ו-2 ספרות אחריו, אולי זה עשרוני?
        # ליתר ביטחון נחליף בנקודה רק אם זה נראה כמו עשרוני
        if len(s_val.split(',')[-1]) == 2:
             s_val = s_val.replace(',', '.')
        else:
             s_val = s_val.replace(',', '')
             
    try:
        amount = float(s_val)
        return -amount if is_negative else amount
    except ValueError:
        return 0.0


def has_valid_amounts(df: pd.DataFrame, col: str) -> bool:
    if col not in df.columns:
        return False
    try:
        values = df[col].apply(clean_amount)
        return (values.abs().sum() > 0)
    except:
        return False


def detect_amount_column(df: pd.DataFrame) -> Optional[str]:
    preferred = ['סכום חיוב', 'סכום עסקה מקורי', 'סכום']
    for name in preferred:
        matches = [c for c in df.columns if str(c).strip() == name]
        for col in matches:
            if has_valid_amounts(df, col):
                return col

    keywords = ['amount', 'sum', 'סכום', 'total', 'חיוב']
    for col in df.columns:
        col_lower = str(col).lower()
        if any(k in col_lower for k in keywords) and has_valid_amounts(df, col):
            return col

    for col in df.columns:
        if has_valid_amounts(df, col):
            return col

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
    
    formats = ['%d-%m-%Y', '%d/%m/%Y', '%Y-%m-%d', '%d.%m.%Y', '%Y/%m/%d', '%m/%d/%Y']
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
