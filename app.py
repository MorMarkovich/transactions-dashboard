"""
מנתח עסקאות כרטיס אשראי - גרסה מקצועית
========================================
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np
from datetime import datetime, timedelta
from io import BytesIO
import re
from typing import Optional, Dict
import warnings

warnings.filterwarnings('ignore')

# =============================================================================
# הגדרות
# =============================================================================

st.set_page_config(
    page_title="מנתח עסקאות",
    page_icon="💳",
    layout="wide",
    initial_sidebar_state="expanded"
)

# =============================================================================
# עיצוב CSS מקצועי
# =============================================================================

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap');
    
    :root {
        --bg-dark: #0d1117;
        --bg-card: #161b22;
        --bg-card-alt: #1c2128;
        --border: #30363d;
        --text-white: #f0f6fc;
        --text-gray: #8b949e;
        --text-muted: #6e7681;
        --accent-blue: #58a6ff;
        --accent-green: #3fb950;
        --accent-red: #f85149;
        --accent-purple: #a371f7;
        --accent-orange: #d29922;
    }
    
    * {
        font-family: 'Heebo', sans-serif !important;
    }
    
    .stApp {
        background: var(--bg-dark);
        direction: rtl;
        text-align: right;
    }
    
    /* ========== הסתרת אלמנטים בעייתיים של Streamlit ========== */
    #MainMenu, footer, header, .stDeployButton,
    [data-testid="collapsedControl"],
    [data-testid="stSidebarCollapseButton"],
    button[kind="headerNoPadding"],
    div[data-testid="stSidebarNav"],
    .stSidebarCollapsedControl,
    button[aria-label="Collapse sidebar"],
    button[aria-label="Expand sidebar"] {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
    }
    
    /* הסתרת כל טקסט שמכיל keyboard (אייקונים שבורים) */
    span:not(:empty) {
        font-size: inherit;
    }
    
    /* כותרת */
    .app-header {
        text-align: center;
        padding: 2rem 0 1rem 0;
    }
    
    .app-title {
        font-size: 2.5rem;
        font-weight: 800;
        background: linear-gradient(135deg, #58a6ff 0%, #a371f7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin: 0;
    }
    
    .app-subtitle {
        color: var(--text-gray);
        font-size: 1rem;
        margin-top: 0.5rem;
    }
    
    /* כרטיסי מדדים */
    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1rem;
        margin: 1.5rem 0;
    }
    
    @media (max-width: 768px) {
        .metrics-grid { grid-template-columns: repeat(2, 1fr); }
    }
    
    .metric-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1.25rem;
        text-align: center;
    }
    
    .metric-card:hover {
        border-color: var(--accent-blue);
    }
    
    .metric-icon {
        font-size: 1.75rem;
        margin-bottom: 0.5rem;
    }
    
    .metric-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-white);
        direction: ltr;
        display: inline-block;
    }
    
    .metric-label {
        font-size: 0.85rem;
        color: var(--text-gray);
        margin-top: 0.25rem;
    }
    
    /* כרטיס גרף */
    .chart-container {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1.25rem;
        margin-bottom: 1rem;
    }
    
    .chart-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border);
    }
    
    .chart-header-icon {
        font-size: 1.25rem;
    }
    
    .chart-header-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-white);
        margin: 0;
    }

    /* כותרת מקטע */
    .section-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--text-white);
        font-weight: 600;
        font-size: 1rem;
        margin: 0.25rem 0 0.75rem 0;
    }

    .section-title span {
        font-size: 1.1rem;
    }

    /* עיצוב לגרפים של Plotly */
    div[data-testid="stPlotlyChart"] {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 0.75rem;
        margin-bottom: 1rem;
    }

    div[data-testid="stPlotlyChart"] > div {
        border-radius: 10px;
        overflow: hidden;
    }
    
    /* סרגל צד */
    section[data-testid="stSidebar"] {
        background: var(--bg-card) !important;
        direction: rtl;
        min-width: 260px;
        max-width: 340px;
        width: 300px;
    }
    
    section[data-testid="stSidebar"] > div {
        direction: rtl;
        text-align: right;
        padding: 1.5rem 1rem 2rem 1rem;
    }
    
    .sidebar-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text-white);
        text-align: center;
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border);
    }
    
    /* ========== העלאת קובץ ========== */
    [data-testid="stFileUploader"] {
        direction: rtl !important;
        text-align: right !important;
    }
    
    [data-testid="stFileUploader"] > div {
        direction: rtl !important;
    }
    
    [data-testid="stFileUploader"] section {
        direction: rtl !important;
        text-align: right !important;
        background: var(--bg-card-alt) !important;
        border: 2px dashed var(--border) !important;
        border-radius: 8px !important;
        padding: 1rem !important;
    }
    
    [data-testid="stFileUploader"] section:hover {
        border-color: var(--accent-blue) !important;
    }

    /* הסתרת טקסט אנגלי בלבד */
    [data-testid="stFileUploader"] section > div:first-child > div:first-child {
        display: none !important;
    }
    
    [data-testid="stFileUploader"] small {
        display: none !important;
    }

    /* כפתור העלאה */
    [data-testid="stFileUploader"] button {
        background: var(--accent-blue) !important;
        color: white !important;
        border-radius: 6px !important;
        padding: 0.6rem 1.5rem !important;
        font-size: 0.9rem !important;
        border: none !important;
        margin-top: 0.5rem !important;
    }
    
    /* קובץ שהועלה */
    [data-testid="stFileUploaderFile"] {
        direction: rtl !important;
        text-align: right !important;
        background: var(--bg-card-alt) !important;
        border-radius: 6px !important;
        padding: 0.5rem !important;
        margin-top: 0.5rem !important;
    }

    /* ========== יישור מלא RTL לכל האלמנטים ========== */
    
    /* Labels */
    [data-testid="stWidgetLabel"],
    .stSelectbox label,
    .stMultiSelect label,
    .stDateInput label,
    .stTextInput label {
        direction: rtl !important;
        text-align: right !important;
        width: 100% !important;
        display: block !important;
    }
    
    /* Selectbox / Dropdown - יישור מלא */
    [data-testid="stSelectbox"],
    [data-testid="stMultiSelect"] {
        direction: rtl !important;
    }
    
    [data-testid="stSelectbox"] > div,
    [data-testid="stMultiSelect"] > div {
        direction: rtl !important;
    }
    
    [data-baseweb="select"] {
        direction: rtl !important;
    }
    
    [data-baseweb="select"] > div {
        direction: rtl !important;
        text-align: right !important;
    }
    
    [data-baseweb="select"] [data-baseweb="icon"] {
        order: -1 !important;
        margin-left: 8px !important;
        margin-right: 0 !important;
    }
    
    /* Dropdown menu */
    [data-baseweb="popover"],
    [data-baseweb="menu"],
    ul[role="listbox"] {
        direction: rtl !important;
        text-align: right !important;
    }
    
    ul[role="listbox"] li {
        direction: rtl !important;
        text-align: right !important;
    }
    
    /* Date Input - תיקון כיוון */
    [data-testid="stDateInput"] {
        direction: rtl !important;
    }
    
    [data-testid="stDateInput"] > div {
        direction: ltr !important; /* תאריכים נשארים LTR */
    }
    
    [data-testid="stDateInput"] input {
        direction: ltr !important;
        text-align: center !important;
    }
    
    /* Text Input */
    [data-testid="stTextInput"] {
        direction: rtl !important;
    }
    
    [data-testid="stTextInput"] input {
        direction: rtl !important;
        text-align: right !important;
    }
    
    /* MultiSelect tags */
    [data-testid="stMultiSelect"] [data-baseweb="tag"] {
        direction: rtl !important;
    }
    
    /* ========== הסתרת Tooltip ========== */
    div[data-baseweb="tooltip"] {
        display: none !important;
    }
    
    /* ========== תיקון columns ========== */
    [data-testid="column"] {
        direction: rtl !important;
    }
    
    /* ========== טבלה - יישור מלא לימין ========== */
    [data-testid="stDataFrame"],
    [data-testid="stDataFrame"] > div {
        direction: rtl !important;
    }
    
    /* כותרות עמודות */
    [data-testid="stDataFrame"] th,
    [data-testid="stDataFrame"] [role="columnheader"] {
        text-align: right !important;
        direction: rtl !important;
    }
    
    /* תאים */
    [data-testid="stDataFrame"] td,
    [data-testid="stDataFrame"] [role="gridcell"] {
        text-align: right !important;
        direction: rtl !important;
    }
    
    /* Glide Data Grid - RTL */
    .dvn-scroller {
        direction: rtl !important;
    }
    
    canvas + div {
        direction: rtl !important;
    }
    
    /* הסתרת סרגל כלים בריחוף על הטבלה */
    [data-testid="stDataFrame"] [data-testid="stElementToolbar"],
    [data-testid="stElementToolbar"],
    [data-testid="StyledFullScreenButton"],
    button[kind="minimal"],
    [data-testid="stDataFrame"] button,
    [data-testid="stDataFrame"] [role="toolbar"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }
    
    /* הסתרת כפתורי hover על כל האלמנטים */
    [data-testid="stElementToolbarButton"],
    [data-testid="stBaseButton-minimal"],
    .stElementToolbar {
        display: none !important;
    }
    
    /* ========== סרגל גלילה בסייד ========== */
    section[data-testid="stSidebar"]::-webkit-scrollbar {
        width: 4px;
    }
    section[data-testid="stSidebar"]::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 2px;
    }
    section[data-testid="stSidebar"]::-webkit-scrollbar-track {
        background: transparent;
    }
    
    /* טאבים */
    .stTabs [data-baseweb="tab-list"] {
        gap: 0;
        background: var(--bg-card);
        border-radius: 8px;
        padding: 4px;
        direction: rtl;
    }
    
    .stTabs [data-baseweb="tab"] {
        background: transparent;
        border-radius: 6px;
        color: var(--text-gray);
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
    }
    
    .stTabs [aria-selected="true"] {
        background: var(--accent-blue);
        color: white;
    }
    
    /* טבלאות */
    [data-testid="stDataFrame"] {
        direction: rtl;
    }
    
    /* כפתורים */
    .stButton > button {
        background: var(--accent-blue);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0.5rem 1.5rem;
        font-weight: 600;
    }
    
    .stDownloadButton > button {
        background: var(--accent-green);
    }
    
    /* Expander */
    .streamlit-expanderHeader {
        background: var(--bg-card-alt);
        border-radius: 8px;
        direction: rtl;
    }
    
    [data-testid="stExpander"] {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 8px;
    }
    
    /* רשימת קטגוריות */
    .category-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    
    .category-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        background: var(--bg-card-alt);
        border-radius: 8px;
    }
    
    .category-icon {
        font-size: 1.5rem;
        width: 40px;
        text-align: center;
    }
    
    .category-info {
        flex: 1;
    }
    
    .category-name {
        color: var(--text-white);
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 0.25rem;
    }
    
    .category-bar-bg {
        height: 6px;
        background: var(--border);
        border-radius: 3px;
        overflow: hidden;
    }
    
    .category-bar {
        height: 100%;
        border-radius: 3px;
    }
    
    .category-stats {
        text-align: left;
        direction: ltr;
    }
    
    .category-amount {
        color: var(--text-white);
        font-weight: 700;
        font-size: 0.95rem;
    }
    
    .category-percent {
        color: var(--text-muted);
        font-size: 0.8rem;
    }
    
    /* מצב ריק */
    .empty-state {
        text-align: center;
        padding: 3rem;
    }
    
    .empty-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
    }
    
    .empty-title {
        color: var(--text-white);
        font-size: 1.25rem;
        font-weight: 600;
    }
    
    .empty-text {
        color: var(--text-gray);
        font-size: 0.9rem;
    }
    
    /* גלילה */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg-dark); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
</style>
""", unsafe_allow_html=True)

# =============================================================================
# קבועים
# =============================================================================

CATEGORY_ICONS = {
    'מזון וצריכה': '🛒', 'מסעדות, קפה וברים': '☕', 'תחבורה ורכבים': '🚗',
    'דלק, חשמל וגז': '⛽', 'רפואה ובתי מרקחת': '💊', 'עירייה וממשלה': '🏛️',
    'חשמל ומחשבים': '💻', 'אופנה': '👔', 'עיצוב הבית': '🏠',
    'פנאי, בידור וספורט': '🎬', 'ביטוח': '🛡️', 'שירותי תקשורת': '📱',
    'העברת כספים': '💸', 'חיות מחמד': '🐕', 'שונות': '📦', 'משיכת מזומן': '🏧',
}

CATEGORY_COLORS = [
    '#58a6ff', '#3fb950', '#f85149', '#a371f7', '#d29922',
    '#8b949e', '#f0883e', '#db61a2', '#79c0ff', '#56d364',
    '#ff7b72', '#d2a8ff', '#e3b341', '#a5d6ff', '#ffa657'
]

# =============================================================================
# פונקציות עזר
# =============================================================================

def format_currency(value: float) -> str:
    if pd.isna(value) or value == 0:
        return "₪0"
    return f"₪{abs(value):,.0f}"


def get_icon(category: str) -> str:
    return CATEGORY_ICONS.get(category, '📋')


def detect_header_row(df: pd.DataFrame) -> int:
    keywords = ['תאריך עסקה', 'שם בית העסק', 'סכום', 'קטגוריה']
    for idx in range(min(10, len(df))):
        row_text = ' '.join(df.iloc[idx].astype(str).tolist())
        if sum(1 for k in keywords if k in row_text) >= 2:
            return idx
    return 0


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    
    header_row = detect_header_row(df)
    if header_row > 0:
        df.columns = df.iloc[header_row].tolist()
        df = df.iloc[header_row + 1:].reset_index(drop=True)
    
    # הסרת שורות סיכום
    summary_keywords = ['סך הכל', 'סה"כ', 'total']
    mask = ~df.apply(lambda row: any(k in ' '.join(row.astype(str)).lower() for k in summary_keywords), axis=1)
    df = df[mask].dropna(how='all').reset_index(drop=True)
    
    if len(df.columns) > 0:
        first_col = df.columns[0]
        df = df[df[first_col].notna() & (df[first_col].astype(str).str.strip() != '')]
    
    return df


def clean_amount(value) -> float:
    if pd.isna(value):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r'[^\d\.\-\,]', '', str(value).strip())
    if not cleaned:
        return 0.0
    if ',' in cleaned and '.' in cleaned:
        cleaned = cleaned.replace('.', '').replace(',', '.') if cleaned.rfind(',') > cleaned.rfind('.') else cleaned.replace(',', '')
    elif ',' in cleaned:
        cleaned = cleaned.replace(',', '.')
    try:
        return float(cleaned)
    except:
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
    formats = ['%d-%m-%Y', '%d/%m/%Y', '%Y-%m-%d', '%d.%m.%Y']
    result = pd.Series([pd.NaT] * len(series), index=series.index)
    for fmt in formats:
        mask = result.isna()
        if not mask.any():
            break
        try:
            result[mask] = pd.to_datetime(series[mask], format=fmt, errors='coerce')
        except:
            continue
    if result.isna().any():
        result[result.isna()] = pd.to_datetime(series[result.isna()], dayfirst=True, errors='coerce')
    return result


def process_data(df: pd.DataFrame, date_col: str, amount_col: str, desc_col: str, cat_col: Optional[str]) -> pd.DataFrame:
    result = df.copy()
    result['תאריך'] = parse_dates(result[date_col])
    result['סכום'] = result[amount_col].apply(clean_amount)

    # אם סכום חיוב ריק, השתמש בסכום עסקה מקורי
    if amount_col.strip() == 'סכום חיוב' and 'סכום עסקה מקורי' in result.columns:
        fallback = result['סכום עסקה מקורי'].apply(clean_amount)
        result.loc[result['סכום'] == 0, 'סכום'] = fallback
    
    # המרת סכומים חיוביים לשליליים (הוצאות)
    non_zero = result['סכום'][result['סכום'] != 0]
    if len(non_zero) > 0 and (non_zero > 0).sum() / len(non_zero) > 0.9:
        result['סכום'] = -result['סכום'].abs()
    
    result['תיאור'] = result[desc_col].astype(str).str.strip()
    result['קטגוריה'] = result[cat_col].astype(str).str.strip() if cat_col and cat_col in result.columns else 'שונות'
    result.loc[result['קטגוריה'].isin(['', 'nan', 'None']), 'קטגוריה'] = 'שונות'
    
    result = result[(result['סכום'] != 0) & result['תאריך'].notna()].reset_index(drop=True)
    
    if not result.empty:
        result['סכום_מוחלט'] = result['סכום'].abs()
        result['חודש'] = result['תאריך'].dt.strftime('%m/%Y')
        result['יום_בשבוע'] = result['תאריך'].dt.dayofweek
    
    return result


@st.cache_data
def load_excel(file) -> Dict[str, pd.DataFrame]:
    try:
        xlsx = pd.ExcelFile(file, engine='openpyxl')
        sheets = {}
        for name in xlsx.sheet_names:
            df = pd.read_excel(xlsx, sheet_name=name, header=None)
            if not df.empty:
                df = clean_dataframe(df)
                if not df.empty:
                    sheets[name] = df
        return sheets
    except Exception as e:
        st.error(f"שגיאה בטעינה: {e}")
        return {}


@st.cache_data
def load_csv(file) -> pd.DataFrame:
    for enc in ['utf-8', 'utf-8-sig', 'windows-1255', 'iso-8859-8']:
        try:
            file.seek(0)
            return pd.read_csv(file, encoding=enc)
        except:
            continue
    return pd.DataFrame()


# =============================================================================
# גרפים
# =============================================================================

def create_donut_chart(df: pd.DataFrame) -> go.Figure:
    """גרף דונאט מקצועי"""
    expenses = df[df['סכום'] < 0].copy()
    cat_data = expenses.groupby('קטגוריה')['סכום_מוחלט'].sum().reset_index()
    cat_data = cat_data.sort_values('סכום_מוחלט', ascending=False)

    if cat_data.empty:
        fig = go.Figure()
        fig.add_annotation(
            text="אין נתונים להצגה",
            x=0.5, y=0.5, font=dict(size=14, color='#8b949e', family='Heebo'),
            showarrow=False
        )
        fig.update_layout(
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            margin=dict(t=10, b=10, l=10, r=10),
            height=260
        )
        return fig

    # הצגת 6 קטגוריות מובילות + "אחר"
    if len(cat_data) > 6:
        top = cat_data.head(6).copy()
        other_sum = cat_data.iloc[6:]['סכום_מוחלט'].sum()
        other = pd.DataFrame([{'קטגוריה': 'אחר', 'סכום_מוחלט': other_sum}])
        cat_data = pd.concat([top, other], ignore_index=True)
    else:
        cat_data = cat_data.copy()
    
    fig = go.Figure(data=[go.Pie(
        labels=cat_data['קטגוריה'],
        values=cat_data['סכום_מוחלט'],
        hole=0.65,
        marker=dict(colors=CATEGORY_COLORS[:len(cat_data)]),
        textinfo='none',
        hovertemplate='<b>%{label}</b><br>₪%{value:,.0f}<br>%{percent}<extra></extra>',
        showlegend=False
    )])
    
    total = cat_data['סכום_מוחלט'].sum()
    fig.add_annotation(
        text=f"<b>₪{total:,.0f}</b>",
        x=0.5, y=0.55, font=dict(size=22, color='#f0f6fc', family='Heebo'),
        showarrow=False
    )
    fig.add_annotation(
        text="סה״כ הוצאות",
        x=0.5, y=0.42, font=dict(size=12, color='#8b949e', family='Heebo'),
        showarrow=False
    )
    
    fig.update_layout(
        showlegend=False,
        margin=dict(t=10, b=10, l=10, r=10),
        paper_bgcolor='rgba(0,0,0,0)',
        height=260
    )
    return fig


def create_monthly_bars(df: pd.DataFrame) -> go.Figure:
    """גרף עמודות חודשי"""
    expenses = df[df['סכום'] < 0].copy()
    monthly = expenses.groupby(['חודש']).agg({'סכום_מוחלט': 'sum', 'תאריך': 'first'}).reset_index()
    monthly = monthly.sort_values('תאריך')
    
    fig = go.Figure(data=[go.Bar(
        x=monthly['חודש'],
        y=monthly['סכום_מוחלט'],
        marker=dict(color='#58a6ff', cornerradius=4),
        hovertemplate='%{x}<br>₪%{y:,.0f}<extra></extra>'
    )])
    
    fig.update_layout(
        xaxis=dict(title='', gridcolor='#30363d', tickfont=dict(color='#8b949e', size=10)),
        yaxis=dict(title='', gridcolor='#30363d', tickfont=dict(color='#8b949e', size=10)),
        paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=10, b=30, l=50, r=10), height=250,
        font=dict(family='Heebo')
    )
    return fig


def create_weekday_chart(df: pd.DataFrame) -> go.Figure:
    """גרף ימים בשבוע"""
    days_heb = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
    expenses = df[df['סכום'] < 0].copy()
    daily = expenses.groupby('יום_בשבוע')['סכום_מוחלט'].sum().reset_index()
    daily['יום'] = daily['יום_בשבוע'].apply(lambda x: days_heb[x] if x < 7 else '')
    
    fig = go.Figure(data=[go.Bar(
        x=daily['יום'],
        y=daily['סכום_מוחלט'],
        marker=dict(color='#a371f7', cornerradius=4),
        hovertemplate='יום %{x}<br>₪%{y:,.0f}<extra></extra>'
    )])
    
    fig.update_layout(
        xaxis=dict(title='', gridcolor='#30363d', tickfont=dict(color='#8b949e', size=11)),
        yaxis=dict(title='', gridcolor='#30363d', tickfont=dict(color='#8b949e', size=10)),
        paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=10, b=30, l=50, r=10), height=220,
        font=dict(family='Heebo')
    )
    return fig


def create_merchants_chart(df: pd.DataFrame, n: int = 8) -> go.Figure:
    """גרף בתי עסק"""
    expenses = df[df['סכום'] < 0].copy()
    merchants = expenses.groupby('תיאור')['סכום_מוחלט'].sum().nlargest(n).reset_index()
    merchants = merchants.sort_values('סכום_מוחלט', ascending=True)
    
    # קיצור שמות ארוכים
    merchants['תיאור_קצר'] = merchants['תיאור'].apply(lambda x: x[:25] + '...' if len(x) > 28 else x)
    
    fig = go.Figure(data=[go.Bar(
        x=merchants['סכום_מוחלט'],
        y=merchants['תיאור_קצר'],
        orientation='h',
        marker=dict(color='#3fb950', cornerradius=4),
        hovertemplate='%{y}<br>₪%{x:,.0f}<extra></extra>'
    )])
    
    fig.update_layout(
        xaxis=dict(title='', gridcolor='#30363d', tickfont=dict(color='#8b949e', size=10)),
        yaxis=dict(title='', gridcolor='#30363d', tickfont=dict(color='#f0f6fc', size=10)),
        paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=10, b=30, l=140, r=10), height=max(220, n * 28),
        font=dict(family='Heebo')
    )
    return fig


def create_trend_chart(df: pd.DataFrame) -> go.Figure:
    """גרף מגמה"""
    df_sorted = df.sort_values('תאריך').copy()
    df_sorted['מצטבר'] = df_sorted['סכום'].cumsum()
    
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=df_sorted['תאריך'], y=df_sorted['מצטבר'],
        mode='lines', fill='tozeroy',
        line=dict(color='#58a6ff', width=2),
        fillcolor='rgba(88, 166, 255, 0.1)',
        hovertemplate='%{x|%d/%m}<br>₪%{y:,.0f}<extra></extra>'
    ))
    fig.add_hline(y=0, line_dash='dash', line_color='#f85149', line_width=1)
    
    fig.update_layout(
        xaxis=dict(title='', gridcolor='#30363d', tickfont=dict(color='#8b949e', size=10)),
        yaxis=dict(title='', gridcolor='#30363d', tickfont=dict(color='#8b949e', size=10)),
        paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=10, b=30, l=60, r=10), height=280,
        font=dict(family='Heebo')
    )
    return fig


# =============================================================================
# רכיבי UI
# =============================================================================

def render_metrics(df: pd.DataFrame):
    total = len(df)
    spent = abs(df[df['סכום'] < 0]['סכום'].sum())
    income = df[df['סכום'] > 0]['סכום'].sum()
    avg = df['סכום_מוחלט'].mean()
    
    st.markdown(f"""
    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-icon">💳</div>
            <div class="metric-value">{total:,}</div>
            <div class="metric-label">עסקאות</div>
        </div>
        <div class="metric-card">
            <div class="metric-icon">📉</div>
            <div class="metric-value">{format_currency(spent)}</div>
            <div class="metric-label">הוצאות</div>
        </div>
        <div class="metric-card">
            <div class="metric-icon">📈</div>
            <div class="metric-value">{format_currency(income)}</div>
            <div class="metric-label">הכנסות</div>
        </div>
        <div class="metric-card">
            <div class="metric-icon">📊</div>
            <div class="metric-value">{format_currency(avg)}</div>
            <div class="metric-label">ממוצע</div>
        </div>
    </div>
    """, unsafe_allow_html=True)


def render_category_list(df: pd.DataFrame):
    expenses = df[df['סכום'] < 0].copy()
    total = expenses['סכום_מוחלט'].sum()
    
    cat_data = expenses.groupby('קטגוריה').agg({'סכום_מוחלט': ['sum', 'count']}).reset_index()
    cat_data.columns = ['קטגוריה', 'סכום', 'מספר']
    if total > 0:
        cat_data['אחוז'] = (cat_data['סכום'] / total * 100).round(1)
    else:
        cat_data['אחוז'] = 0
    cat_data = cat_data.sort_values('סכום', ascending=False).head(8)
    
    if cat_data.empty:
        st.info("אין נתונים להצגה")
        return

    for _, row in cat_data.iterrows():
        col1, col2, col3 = st.columns([1, 6, 2])
        with col1:
            st.markdown(f"**{get_icon(row['קטגוריה'])}**")
        with col2:
            st.markdown(f"**{row['קטגוריה']}**")
            st.progress(int(row['אחוז']))
        with col3:
            st.markdown(f"**{format_currency(row['סכום'])}**")
            st.caption(f"{row['אחוז']}%")


def export_excel(df: pd.DataFrame) -> bytes:
    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='עסקאות', index=False)
    return output.getvalue()


# =============================================================================
# ראשי
# =============================================================================

def main():
    # כותרת
    st.markdown('''
    <div class="app-header">
        <h1 class="app-title">💳 מנתח עסקאות</h1>
        <p class="app-subtitle">ניתוח חכם של הוצאות כרטיס האשראי</p>
    </div>
    ''', unsafe_allow_html=True)
    
    # סרגל צד
    with st.sidebar:
        st.markdown('<div class="sidebar-title">📁 העלאת קובץ</div>', unsafe_allow_html=True)
        uploaded = st.file_uploader(
            "העלה קובץ אקסל או CSV",
            type=['xlsx', 'xls', 'csv'],
            label_visibility='visible'
        )
        st.markdown("---")
        st.markdown('<p style="color: #8b949e; font-size: 0.85rem; text-align: right; direction: rtl;">תומך ב־MAX, לאומי, דיסקונט ועוד</p>', unsafe_allow_html=True)
    
    # מצב ריק
    if not uploaded:
        st.markdown('''
        <div class="empty-state">
            <div class="empty-icon">📊</div>
            <div class="empty-title">ברוכים הבאים!</div>
            <div class="empty-text">העלה קובץ אקסל או CSV כדי להתחיל</div>
        </div>
        ''', unsafe_allow_html=True)
        
        cols = st.columns(3)
        features = [
            ("📊", "ניתוח ויזואלי", "גרפים אינטראקטיביים"),
            ("🏷️", "קטגוריות", "סיווג אוטומטי"),
            ("📑", "אקסל", "תמיכה במספר גליונות")
        ]
        for col, (icon, title, desc) in zip(cols, features):
            with col:
                st.markdown(f'''
                <div class="metric-card">
                    <div class="metric-icon">{icon}</div>
                    <div class="metric-label" style="color: #f0f6fc; font-weight: 600;">{title}</div>
                    <div class="metric-label">{desc}</div>
                </div>
                ''', unsafe_allow_html=True)
        return
    
    # טעינה
    sheets = load_excel(uploaded) if uploaded.name.endswith(('.xlsx', '.xls')) else {'main': load_csv(uploaded)}
    if not sheets:
        st.error("❌ שגיאה בטעינת הקובץ")
        return
    if len(sheets) == 1 and list(sheets.values())[0].empty:
        st.error("❌ הקובץ ריק או לא תקין")
        return
    
    # בחירת גליונות
    if len(sheets) > 1:
        selected = st.multiselect("בחר גליונות", list(sheets.keys()), default=list(sheets.keys()))
        if not selected:
            st.warning("בחר לפחות גליון אחד")
            return
        df_raw = pd.concat([sheets[s].assign(_sheet=s) for s in selected], ignore_index=True)
    else:
        df_raw = list(sheets.values())[0]
    
    # זיהוי עמודות
    date_col = find_column(df_raw, ['תאריך עסקה', 'תאריך'])
    amount_col = detect_amount_column(df_raw)
    desc_col = find_column(df_raw, ['שם בית העסק', 'תיאור'])
    cat_col = find_column(df_raw, ['קטגוריה'])
    
    if not all([date_col, amount_col, desc_col]):
        st.error("❌ לא זוהו עמודות נדרשות - נא להגדיר ידנית:")
        cols = df_raw.columns.tolist()
        c1, c2 = st.columns(2)
        with c1:
            date_col = st.selectbox("עמודת תאריך", cols)
            amount_col = st.selectbox("עמודת סכום", cols)
        with c2:
            desc_col = st.selectbox("עמודת תיאור", cols)
            cat_col = st.selectbox("עמודת קטגוריה", ['אין'] + cols)
            cat_col = None if cat_col == 'אין' else cat_col
        if st.button("המשך"):
            pass
        else:
            st.stop()
    
    # עיבוד
    try:
        df = process_data(df_raw, date_col, amount_col, desc_col, cat_col)
        if df.empty:
            st.error("❌ לא נמצאו עסקאות")
            return
        st.success(f"✅ נטענו {len(df):,} עסקאות")
    except Exception as e:
        st.error(f"❌ שגיאה: {e}")
        return
    
    # סינון
    st.markdown('<div class="section-title"><span>🔍</span> סינון</div>', unsafe_allow_html=True)
    c1, c2, c3 = st.columns(3)
    with c1:
        dates = st.date_input("תאריכים", [df['תאריך'].min(), df['תאריך'].max()])
    with c2:
        cat_filter = st.selectbox("קטגוריה", ['הכל'] + sorted(df['קטגוריה'].unique().tolist()))
    with c3:
        search = st.text_input("חיפוש")
    
    df_f = df.copy()
    if len(dates) == 2:
        df_f = df_f[(df_f['תאריך'].dt.date >= dates[0]) & (df_f['תאריך'].dt.date <= dates[1])]
    if cat_filter != 'הכל':
        df_f = df_f[df_f['קטגוריה'] == cat_filter]
    if search:
        df_f = df_f[df_f['תיאור'].str.contains(search, case=False, na=False)]
    
    if df_f.empty:
        st.warning("אין תוצאות")
        return
    
    # מדדים
    render_metrics(df_f)
    
    # טאבים
    tabs = st.tabs(["📊 סקירה", "📈 מגמות", "🏪 בתי עסק", "📋 עסקאות"])
    
    with tabs[0]:
        c1, c2 = st.columns([2, 1])
        
        with c1:
            st.markdown('<div class="section-title"><span>📅</span> הוצאות חודשיות</div>', unsafe_allow_html=True)
            st.plotly_chart(create_monthly_bars(df_f), use_container_width=True, key="monthly")

            st.markdown('<div class="section-title"><span>📆</span> לפי יום בשבוע</div>', unsafe_allow_html=True)
            st.plotly_chart(create_weekday_chart(df_f), use_container_width=True, key="weekday")
        
        with c2:
            st.markdown('<div class="section-title"><span>🏷️</span> לפי קטגוריה</div>', unsafe_allow_html=True)
            st.plotly_chart(create_donut_chart(df_f), use_container_width=True, key="donut")

            st.markdown('<div class="section-title"><span>📊</span> פירוט קטגוריות</div>', unsafe_allow_html=True)
            render_category_list(df_f)
    
    with tabs[1]:
        st.markdown('<div class="section-title"><span>📈</span> מגמת מאזן</div>', unsafe_allow_html=True)
        st.plotly_chart(create_trend_chart(df_f), use_container_width=True, key="trend")
        
        # סטטיסטיקות
        exp = df_f[df_f['סכום'] < 0]
        st.markdown('<div class="section-title"><span>📊</span> סטטיסטיקות</div>', unsafe_allow_html=True)
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("הוצאה גדולה", format_currency(exp['סכום_מוחלט'].max()) if len(exp) > 0 else "₪0")
        c2.metric("הוצאה קטנה", format_currency(exp['סכום_מוחלט'].min()) if len(exp) > 0 else "₪0")
        c3.metric("חציון", format_currency(exp['סכום_מוחלט'].median()) if len(exp) > 0 else "₪0")
        c4.metric("קטגוריות", df_f['קטגוריה'].nunique())
    
    with tabs[2]:
        n = st.slider("מספר בתי עסק", 5, 15, 8)
        st.markdown('<div class="section-title"><span>🏆</span> בתי עסק מובילים</div>', unsafe_allow_html=True)
        st.plotly_chart(create_merchants_chart(df_f, n), use_container_width=True, key="merchants")
    
    with tabs[3]:
        st.markdown('<div class="section-title"><span>📋</span> רשימת עסקאות</div>', unsafe_allow_html=True)
        sort_opt = st.selectbox("מיון", ['תאריך ↓', 'תאריך ↑', 'סכום ↓', 'סכום ↑'])
        
        if sort_opt == 'תאריך ↓':
            display = df_f.sort_values('תאריך', ascending=False)
        elif sort_opt == 'תאריך ↑':
            display = df_f.sort_values('תאריך', ascending=True)
        elif sort_opt == 'סכום ↓':
            display = df_f.sort_values('סכום_מוחלט', ascending=False)
        else:
            display = df_f.sort_values('סכום_מוחלט', ascending=True)
        
        # הכנת הנתונים לתצוגה
        view = display[['סכום', 'קטגוריה', 'תיאור', 'תאריך']].head(100).copy()
        view['תאריך'] = view['תאריך'].dt.strftime('%d/%m/%Y')
        view['סכום'] = view['סכום'].apply(lambda x: f"₪{x:,.0f}")
        view = view.reset_index(drop=True)
        
        # טבלת HTML עם יישור מלא לימין
        st.markdown("""
        <style>
            .transactions-table {
                width: 100%;
                border-collapse: collapse;
                direction: rtl;
                background: #161b22;
                border-radius: 8px;
                overflow: hidden;
                font-family: 'Heebo', sans-serif;
            }
            .transactions-table th {
                background: #1c2128;
                color: #58a6ff;
                padding: 14px 16px;
                text-align: right !important;
                font-weight: 600;
                border-bottom: 2px solid #30363d;
            }
            .transactions-table td {
                padding: 12px 16px;
                text-align: right !important;
                border-bottom: 1px solid #30363d;
                color: #f0f6fc;
            }
            .transactions-table tr:hover td {
                background: #1c2128;
            }
            .transactions-table .col-amount {
                font-weight: 600;
                color: #f85149;
            }
            .transactions-table .col-date {
                color: #8b949e;
            }
            .table-scroll {
                max-height: 450px;
                overflow-y: auto;
                border: 1px solid #30363d;
                border-radius: 8px;
            }
        </style>
        """, unsafe_allow_html=True)
        
        # בניית הטבלה
        rows_html = ""
        for _, row in view.iterrows():
            rows_html += f"""<tr>
                <td class="col-amount">{row['סכום']}</td>
                <td>{row['קטגוריה']}</td>
                <td>{row['תיאור']}</td>
                <td class="col-date">{row['תאריך']}</td>
            </tr>"""
        
        table_html = f"""
        <div class="table-scroll">
            <table class="transactions-table">
                <thead>
                    <tr>
                        <th>סכום</th>
                        <th>קטגוריה</th>
                        <th>תיאור</th>
                        <th>תאריך</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
            </table>
        </div>
        """
        st.markdown(table_html, unsafe_allow_html=True)
        st.caption(f"מציג {len(view):,} עסקאות (מקסימום 100)")
    
    # ייצוא
    st.markdown("---")
    c1, c2 = st.columns(2)
    with c1:
        st.download_button("📥 הורד אקסל", export_excel(df_f), "עסקאות.xlsx", 
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    with c2:
        st.download_button("📥 הורד CSV", df_f.to_csv(index=False, encoding='utf-8-sig'), 
                          "עסקאות.csv", "text/csv")


if __name__ == "__main__":
    main()
