"""
מנתח עסקאות כרטיס אשראי - Dashboard מקצועי
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import numpy as np
from io import BytesIO
import re
from typing import Optional, Dict
import warnings
from auth import (
    init_auth_state, is_configured, is_logged_in, get_current_user,
    sign_in, sign_up, reset_password, logout,
    save_income, load_incomes, delete_all_incomes,
    save_upload_history, load_upload_history,
    save_user_settings, load_user_settings,
    save_transactions, load_transactions, delete_transactions, delete_all_user_data,
    validate_email, validate_password
)

warnings.filterwarnings('ignore')

# =============================================================================
# Page Config
# =============================================================================
st.set_page_config(
    page_title="מנתח עסקאות",
    page_icon="💳",
    layout="wide",
    initial_sidebar_state="expanded"
)

# =============================================================================
# Theme System
# =============================================================================
if 'theme' not in st.session_state:
    st.session_state.theme = 'dark'

IS_DARK = st.session_state.theme == 'dark'

# Color tokens
T = {
    'bg':        '#0c111d' if IS_DARK else '#f8fafc',
    'surface':   '#161d2f' if IS_DARK else '#ffffff',
    'surface2':  '#1e2740' if IS_DARK else '#f1f5f9',
    'border':    'rgba(255,255,255,0.07)' if IS_DARK else 'rgba(0,0,0,0.08)',
    'border_h':  'rgba(255,255,255,0.14)' if IS_DARK else 'rgba(0,0,0,0.14)',
    'text1':     '#f1f5f9' if IS_DARK else '#0f172a',
    'text2':     '#94a3b8' if IS_DARK else '#64748b',
    'text3':     '#64748b' if IS_DARK else '#94a3b8',
    'accent':    '#818cf8',
    'accent_bg': 'rgba(129,140,248,0.12)' if IS_DARK else 'rgba(99,102,241,0.08)',
    'green':     '#34d399',
    'green_bg':  'rgba(52,211,153,0.12)',
    'red':       '#f87171',
    'red_bg':    'rgba(248,113,113,0.12)',
    'amber':     '#fbbf24',
    'chart_bg':  'rgba(0,0,0,0)' ,
    'grid':      'rgba(255,255,255,0.04)' if IS_DARK else 'rgba(0,0,0,0.04)',
    'sidebar':   '#0f1525' if IS_DARK else '#ffffff',
    'input':     '#1e2740' if IS_DARK else '#f1f5f9',
}

# Unified chart palette
CHART_COLORS = ['#818cf8', '#34d399', '#f87171', '#38bdf8', '#fbbf24', '#a78bfa', '#fb923c', '#94a3b8']

# =============================================================================
# CSS
# =============================================================================
st.markdown(f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap');

/* === Reset & Base === */
*, *::before, *::after {{
    font-family: 'Heebo', sans-serif !important;
    box-sizing: border-box;
}}

html, body, .stApp {{
    background: {T['bg']} !important;
    color: {T['text1']};
    direction: rtl;
    text-align: right;
}}

/* === Hide Streamlit chrome === */
#MainMenu, footer, header, .stDeployButton,
[data-testid="stElementToolbar"],
[data-testid="StyledFullScreenButton"],
[data-testid="stBaseButton-minimal"],
[data-testid="collapsedControl"],
[data-testid="stSidebarCollapseButton"],
button[aria-label="Collapse sidebar"],
button[aria-label="Expand sidebar"],
.stSidebarCollapsedControl {{
    display: none !important;
    visibility: hidden !important;
    width: 0 !important; height: 0 !important;
    overflow: hidden !important;
    pointer-events: none !important;
}}

/* === Sidebar === */
section[data-testid="stSidebar"] {{
    background: {T['sidebar']} !important;
    border-left: 1px solid {T['border']};
    min-width: 280px !important;
    max-width: 310px !important;
    width: 295px !important;
}}
section[data-testid="stSidebar"] > div {{
    direction: rtl; text-align: right;
    padding: 1.75rem 1.25rem 3rem;
}}

/* -- File uploader complete override -- */
[data-testid="stFileUploader"] {{
    direction: rtl !important;
    text-align: right !important;
}}
/* Hide ALL default English text from uploader */
[data-testid="stFileUploader"] section > div:first-child {{
    display: none !important;
}}
[data-testid="stFileUploader"] small {{
    display: none !important;
}}
[data-testid="stFileUploader"] section {{
    background: {T['input']} !important;
    border: 2px dashed {T['border_h']} !important;
    border-radius: 12px !important;
    padding: 1rem 1rem 0.75rem !important;
    transition: border-color 0.2s !important;
    min-height: auto !important;
}}
[data-testid="stFileUploader"] section:hover {{
    border-color: {T['accent']} !important;
    background: {T['accent_bg']} !important;
}}
/* Style the Browse button */
[data-testid="stFileUploader"] button {{
    background: {T['accent']} !important;
    color: #fff !important;
    border: none !important;
    border-radius: 8px !important;
    font-weight: 600 !important;
    padding: 0.55rem 1.5rem !important;
    width: 100% !important;
    margin: 0 !important;
    font-size: 0.9rem !important;
}}
[data-testid="stFileUploader"] button:hover {{
    opacity: 0.9 !important;
}}
/* Uploaded file chip */
[data-testid="stFileUploaderFile"] {{
    direction: rtl !important;
    background: {T['surface2']} !important;
    border: 1px solid {T['border']} !important;
    border-radius: 8px !important;
    padding: 0.4rem 0.75rem !important;
    margin-top: 0.5rem !important;
    font-size: 0.8rem !important;
    color: {T['text2']} !important;
}}
[data-testid="stFileUploaderFile"] span {{
    color: {T['text2']} !important;
    direction: ltr !important;
    unicode-bidi: embed !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    max-width: 180px !important;
    display: inline-block !important;
}}
[data-testid="stFileUploaderFile"] button {{
    background: transparent !important;
    color: {T['red']} !important;
    border: none !important;
    padding: 2px !important;
    width: auto !important;
    min-width: auto !important;
}}

/* === Typography === */
.dash-header {{
    text-align: center; padding: 1.5rem 0 0.5rem;
}}
.dash-title {{
    font-size: 2rem; font-weight: 800;
    color: {T['accent']}; margin: 0;
}}
.dash-subtitle {{
    color: {T['text2']}; font-size: 0.95rem; margin-top: 4px;
}}
.section-label {{
    display: flex; align-items: center; gap: 6px;
    color: {T['text1']}; font-weight: 600; font-size: 1rem;
    margin: 0.5rem 0 0.75rem; padding-bottom: 0.5rem;
    border-bottom: 1px solid {T['border']};
}}

/* === KPI Cards === */
.kpi-row {{ display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; margin: 1.25rem 0; }}
@media(max-width:900px) {{ .kpi-row {{ grid-template-columns: repeat(2,1fr); }} }}
@media(max-width:500px) {{ .kpi-row {{ grid-template-columns: 1fr; }} }}
.kpi {{
    background: {T['surface']};
    border: 1px solid {T['border']};
    border-radius: 14px; padding: 1.25rem; text-align: center;
    transition: border-color 0.2s, box-shadow 0.2s;
}}
.kpi:hover {{ border-color: {T['border_h']}; box-shadow: 0 4px 24px rgba(0,0,0,0.12); }}
.kpi-icon {{
    width: 44px; height: 44px; border-radius: 10px; margin: 0 auto 10px;
    display: flex; align-items: center; justify-content: center; font-size: 1.4rem;
}}
.kpi-val {{ font-size: 1.6rem; font-weight: 700; color: {T['text1']}; direction: ltr; }}
.kpi-label {{ font-size: 0.8rem; color: {T['text2']}; margin-top: 2px; letter-spacing: 0.3px; }}

/* === Category Cards === */
.cat-card {{
    background: {T['surface']};
    border: 1px solid {T['border']};
    border-radius: 12px; padding: 0.85rem 1rem;
    margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.85rem;
    transition: border-color 0.2s;
}}
.cat-card:hover {{ border-color: {T['border_h']}; }}
.cat-icon {{
    width: 38px; height: 38px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;
}}
.cat-info {{ flex: 1; min-width: 0; }}
.cat-name {{ font-weight: 600; font-size: 0.85rem; color: {T['text1']}; margin-bottom: 4px; }}
.cat-bar-bg {{ height: 5px; background: {T['surface2']}; border-radius: 99px; overflow: hidden; }}
.cat-bar {{ height: 100%; border-radius: 99px; }}
.cat-stats {{ text-align: left; direction: ltr; flex-shrink: 0; }}
.cat-amount {{ font-weight: 700; font-size: 0.9rem; color: {T['text1']}; }}
.cat-pct {{ font-size: 0.7rem; color: {T['text2']}; }}

/* === Feature Cards (empty state) === */
.feat-row {{ display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; margin-top: 1.5rem; }}
@media(max-width:700px) {{ .feat-row {{ grid-template-columns: 1fr; }} }}
.feat {{
    background: {T['surface']}; border: 1px solid {T['border']};
    border-radius: 14px; padding: 2rem 1.5rem; text-align: center;
    transition: border-color 0.2s, transform 0.2s;
}}
.feat:hover {{ border-color: {T['accent']}; transform: translateY(-3px); }}
.feat-icon {{ font-size: 2rem; margin-bottom: 0.75rem; }}
.feat-title {{ font-weight: 600; color: {T['text1']}; font-size: 1rem; }}
.feat-desc {{ color: {T['text2']}; font-size: 0.82rem; margin-top: 4px; }}

/* === Alerts === */
.alert {{
    border-radius: 12px; padding: 0.85rem 1.25rem; margin: 0.75rem 0;
    display: flex; align-items: center; gap: 0.75rem; direction: rtl;
}}
.alert-ok {{ background: {T['green_bg']}; border: 1px solid rgba(52,211,153,0.25); }}
.alert-ok .alert-text {{ color: {T['green']}; }}
.alert-err {{ background: {T['red_bg']}; border: 1px solid rgba(248,113,113,0.25); }}
.alert-err .alert-text {{ color: {T['red']}; }}
.alert-icon {{ font-size: 1.3rem; }}
.alert-text {{ font-weight: 600; font-size: 0.9rem; }}
.alert-sub {{ color: {T['text2']}; font-size: 0.8rem; }}
.alert-badge {{
    margin-right: auto; margin-left: 0;
    background: {T['green_bg']}; color: {T['green']};
    padding: 0.3rem 0.7rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600;
}}

/* === Form elements === */
[data-testid="stWidgetLabel"] {{ direction: rtl !important; text-align: right !important; color: {T['text2']} !important; font-weight: 500 !important; }}
[data-testid="stSelectbox"], [data-testid="stMultiSelect"], [data-testid="stTextInput"] {{ direction: rtl !important; }}
[data-testid="stMarkdownContainer"] p, [data-testid="stMarkdownContainer"] div {{ direction: rtl; text-align: right; }}
.stMultiSelect [data-baseweb="tag"] {{ direction: rtl !important; }}
[data-testid="stFileUploader"] label {{ direction: rtl !important; text-align: right !important; }}
.stSlider label, .stSlider [data-testid="stWidgetLabel"] {{ direction: rtl !important; text-align: right !important; }}
[data-baseweb="select"] > div {{ background: {T['input']} !important; border: 1px solid {T['border']} !important; border-radius: 8px !important; color: {T['text1']} !important; }}
[data-baseweb="select"] span, [data-baseweb="select"] div {{ color: {T['text1']} !important; }}
[data-baseweb="popover"], [data-baseweb="menu"], ul[role="listbox"] {{ background: {T['surface']} !important; border: 1px solid {T['border']} !important; border-radius: 8px !important; direction: rtl !important; text-align: right !important; }}
ul[role="listbox"] li {{ color: {T['text1']} !important; direction: rtl !important; text-align: right !important; padding: 10px 14px !important; }}
ul[role="listbox"] li:hover {{ background: {T['surface2']} !important; }}
ul[role="listbox"] li[aria-selected="true"] {{ background: {T['accent']} !important; color: #fff !important; }}
[data-testid="stDateInput"] > div {{ direction: ltr !important; }}
[data-testid="stDateInput"] input {{ background: {T['input']} !important; border: 1px solid {T['border']} !important; border-radius: 8px !important; color: {T['text1']} !important; text-align: center !important; direction: ltr !important; }}
[data-testid="stTextInput"] input {{ background: {T['input']} !important; border: 1px solid {T['border']} !important; border-radius: 8px !important; color: {T['text1']} !important; direction: rtl !important; text-align: right !important; }}
[data-testid="stTextInput"] input::placeholder {{ color: {T['text3']} !important; }}
[data-testid="column"] {{ direction: rtl !important; }}

/* === Tabs === */
.stTabs [data-baseweb="tab-list"] {{ gap: 4px; background: {T['surface']}; border-radius: 10px; padding: 4px; direction: rtl; border: 1px solid {T['border']}; }}
.stTabs [data-baseweb="tab"] {{ background: transparent; border-radius: 8px; color: {T['text2']}; padding: 0.5rem 1rem; font-weight: 500; }}
.stTabs [data-baseweb="tab"]:hover {{ color: {T['text1']}; background: {T['surface2']}; }}
.stTabs [aria-selected="true"] {{ background: {T['accent']} !important; color: #fff !important; box-shadow: 0 2px 8px rgba(129,140,248,0.25); }}

/* === Chart containers === */
div[data-testid="stPlotlyChart"] {{ background: {T['surface']}; border: 1px solid {T['border']}; border-radius: 12px; padding: 0.75rem; margin-bottom: 0.75rem; }}

/* === Buttons === */
.stButton > button {{ background: {T['accent']}; color: #fff; border: none; border-radius: 8px; font-weight: 600; padding: 0.5rem 1.5rem; }}
.stButton > button:hover {{ opacity: 0.9; }}
.stDownloadButton > button {{ background: {T['green']}; color: #0f172a; border: none; border-radius: 8px; font-weight: 600; }}
.stDownloadButton > button:hover {{ opacity: 0.9; }}

/* === Slider fix === */
.stSlider [data-baseweb="slider"] div {{ background: {T['accent']} !important; }}
.stSlider [data-baseweb="slider"] [role="slider"] {{ background: {T['accent']} !important; border-color: {T['accent']} !important; }}

/* === Merchant count buttons === */
[data-testid="stHorizontalBlock"]:has(button[kind="secondary"]) button[kind="secondary"] {{
    background: {T['surface2']} !important; color: {T['text1']} !important;
    border: 1px solid {T['border']} !important; border-radius: 8px !important;
    font-weight: 600 !important; font-size: 0.85rem !important;
    padding: 0.35rem 0 !important;
}}

/* === Checkbox === */
.stCheckbox label span {{ color: {T['text2']} !important; }}

/* === Scrollbar === */
::-webkit-scrollbar {{ width: 6px; }}
::-webkit-scrollbar-track {{ background: transparent; }}
::-webkit-scrollbar-thumb {{ background: {T['border']}; border-radius: 99px; }}

/* === Dataframe === */
[data-testid="stDataFrame"] {{ border-radius: 12px; overflow: hidden; border: 1px solid {T['border']}; }}

/* === Divider === */
hr {{ border: none; height: 1px; background: {T['border']}; margin: 1.5rem 0; }}

/* === Number input in income === */
[data-testid="stNumberInput"] input {{
    background: {T['input']} !important;
    border: 1px solid {T['border']} !important;
    border-radius: 8px !important;
    color: {T['text1']} !important;
    direction: ltr !important;
    text-align: right !important;
}}
[data-testid="stNumberInput"] button {{
    background: {T['surface2']} !important;
    color: {T['text1']} !important;
    border: 1px solid {T['border']} !important;
}}

/* === Print === */
@media print {{ section[data-testid="stSidebar"] {{ display: none !important; }} }}
</style>
""", unsafe_allow_html=True)

# =============================================================================
# JavaScript enhancements
# =============================================================================
st.markdown(f"""
<script>
// === Animated counter for KPI values ===
function animateCounters() {{
    document.querySelectorAll('.kpi-val').forEach(el => {{
        if (el.dataset.animated) return;
        el.dataset.animated = 'true';
        const text = el.innerText;
        const match = text.match(/[\\d,]+/);
        if (!match) return;
        const target = parseInt(match[0].replace(/,/g, ''));
        if (isNaN(target) || target === 0) return;
        const prefix = text.slice(0, text.indexOf(match[0]));
        const suffix = text.slice(text.indexOf(match[0]) + match[0].length);
        const duration = 800;
        const start = performance.now();
        function step(now) {{
            const progress = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(target * ease);
            el.innerText = prefix + current.toLocaleString() + suffix;
            if (progress < 1) requestAnimationFrame(step);
        }}
        requestAnimationFrame(step);
    }});
}}

// === Smooth scroll for tab changes ===
function initSmoothTabs() {{
    document.querySelectorAll('[data-baseweb="tab"]').forEach(tab => {{
        tab.addEventListener('click', () => {{
            setTimeout(() => {{
                const panel = document.querySelector('[data-baseweb="tab-panel"]');
                if (panel) panel.scrollIntoView({{ behavior: 'smooth', block: 'start' }});
            }}, 100);
        }});
    }});
}}

// === Keyboard shortcuts ===
document.addEventListener('keydown', (e) => {{
    // Ctrl+K = Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {{
        e.preventDefault();
        const searchInput = document.querySelector('[data-testid="stTextInput"] input');
        if (searchInput) searchInput.focus();
    }}
}});

// === Init on load ===
const initAll = () => {{
    animateCounters();
    initSmoothTabs();
}};

// Run after Streamlit renders
if (document.readyState === 'complete') {{
    setTimeout(initAll, 500);
}} else {{
    window.addEventListener('load', () => setTimeout(initAll, 500));
}}

// Re-run on Streamlit rerender
const observer = new MutationObserver(() => {{
    setTimeout(animateCounters, 200);
}});
observer.observe(document.body, {{ childList: true, subtree: true }});
</script>
""", unsafe_allow_html=True)

# =============================================================================
# Constants
# =============================================================================
CATEGORY_ICONS = {
    'מזון וצריכה': '🛒', 'מסעדות, קפה וברים': '☕', 'תחבורה ורכבים': '🚗',
    'דלק, חשמל וגז': '⛽', 'רפואה ובתי מרקחת': '💊', 'עירייה וממשלה': '🏛️',
    'חשמל ומחשבים': '💻', 'אופנה': '👔', 'עיצוב הבית': '🏠',
    'פנאי, בידור וספורט': '🎬', 'ביטוח': '🛡️', 'שירותי תקשורת': '📱',
    'העברת כספים': '💸', 'חיות מחמד': '🐕', 'שונות': '📦', 'משיכת מזומן': '🏧',
    'אחר': '📋',
}

# =============================================================================
# Helpers
# =============================================================================
def fmt(v):
    if pd.isna(v) or v == 0: return "₪0"
    return f"₪{abs(v):,.0f}"

def icon_for(cat): return CATEGORY_ICONS.get(cat, '📋')

def plotly_layout(**kw):
    """Base layout for all charts."""
    base = dict(
        paper_bgcolor=T['chart_bg'], plot_bgcolor=T['chart_bg'],
        font=dict(family='Heebo', color=T['text2'], size=12),
        margin=dict(t=20, b=40, l=50, r=20),
        hoverlabel=dict(bgcolor=T['surface'], font_size=13, font_family='Heebo', bordercolor=T['border_h']),
        xaxis=dict(gridcolor=T['grid'], tickfont=dict(color=T['text2'], size=11), showgrid=False, zeroline=False),
        yaxis=dict(gridcolor=T['grid'], tickfont=dict(color=T['text2'], size=11), showgrid=True, zeroline=False),
    )
    base.update(kw)
    return base

# =============================================================================
# Data Functions
# =============================================================================
def detect_header_row(df):
    keywords = ['תאריך', 'שם בית העסק', 'סכום', 'קטגוריה', 'תיאור', 'חיוב', 'עסקה', 'רכישה', 'פרטי', 'Date', 'Amount']
    for idx in range(min(20, len(df))):
        vals = [str(v).strip() for v in df.iloc[idx].tolist() if pd.notna(v)]
        hits = sum(1 for k in keywords if any(k in v for v in vals))
        if hits >= 3: return idx
    return 0

def clean_dataframe(df):
    if df.empty: return df
    hr = detect_header_row(df)
    if hr > 0:
        df.columns = df.iloc[hr].tolist()
        df = df.iloc[hr+1:].reset_index(drop=True)
    df.columns = [str(c).strip() for c in df.columns]
    bad = ['סך הכל', 'סה"כ', 'total', 'סיכום', 'יתרה']
    mask = df.apply(lambda r: not any(k in ' '.join(r.astype(str).str.lower()) for k in bad) and r.isnull().sum() <= len(r)*0.8, axis=1)
    return df[mask].reset_index(drop=True).dropna(axis=1, how='all')

def clean_amount(v):
    if pd.isna(v) or v == '': return 0.0
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip().replace('₪','').replace('NIS','').replace('nis','')
    neg = '-' in s or '−' in s
    s = s.replace('-','').replace('−','').strip()
    s = re.sub(r'[^\d.,]', '', s)
    if not s: return 0.0
    if ',' in s and '.' in s:
        s = s.replace('.','').replace(',','.') if s.rfind(',') > s.rfind('.') else s.replace(',','')
    elif ',' in s:
        s = s.replace(',','.') if len(s.split(',')[-1]) == 2 else s.replace(',','')
    try:
        a = float(s)
        return -a if neg else a
    except: return 0.0

def has_valid_amounts(df, col):
    if col not in df.columns: return False
    try: return df[col].apply(clean_amount).abs().sum() > 0
    except: return False

def detect_amount_column(df):
    for n in ['סכום חיוב', 'סכום עסקה מקורי', 'סכום']:
        for c in df.columns:
            if str(c).strip() == n and has_valid_amounts(df, c): return c
    for c in df.columns:
        if any(k in str(c).lower() for k in ['סכום','חיוב','amount']) and has_valid_amounts(df, c): return c
    for c in df.columns:
        if has_valid_amounts(df, c): return c
    return None

def find_column(df, kws):
    for c in df.columns:
        if str(c).strip() in kws: return c
    for c in df.columns:
        for k in kws:
            if k.lower() in str(c).lower(): return c
    return None

def parse_dates(s):
    if s.empty: return pd.Series(dtype='datetime64[ns]')
    cleaned = s.astype(str).str.strip()
    result = pd.Series([pd.NaT]*len(s), index=s.index)
    for f in ['%d-%m-%Y','%d/%m/%Y','%Y-%m-%d','%d.%m.%Y','%Y/%m/%d','%m/%d/%Y']:
        m = result.isna()
        if not m.any(): break
        try: result[m] = pd.to_datetime(cleaned[m], format=f, errors='coerce')
        except: continue
    if result.isna().any():
        try:
            m = result.isna()
            result[m] = pd.to_datetime(cleaned[m], dayfirst=True, errors='coerce')
        except: pass
    return result

def process_data(df, date_col, amount_col, desc_col, cat_col):
    if df.empty: return pd.DataFrame()
    r = df.copy()
    try: r['תאריך'] = parse_dates(r[date_col])
    except: r['תאריך'] = pd.NaT
    try: r['סכום'] = pd.to_numeric(r[amount_col].apply(clean_amount), errors='coerce').fillna(0.0)
    except: r['סכום'] = 0.0
    ac = str(amount_col).strip() if amount_col else ''
    if ac == 'סכום חיוב' and 'סכום עסקה מקורי' in r.columns:
        try:
            fb = pd.to_numeric(r['סכום עסקה מקורי'].apply(clean_amount), errors='coerce').fillna(0.0)
            z = r['סכום'] == 0
            if z.any(): r.loc[z, 'סכום'] = fb[z]
        except: pass
    nz = r['סכום'][r['סכום'] != 0]
    if len(nz) > 0 and (nz > 0).sum() / len(nz) > 0.8:
        r['סכום'] = -r['סכום'].abs()
    try:
        r['תיאור'] = r[desc_col].astype(str).str.strip()
        r['תיאור'] = r['תיאור'].replace(['nan','None',''], 'לא ידוע')
    except: r['תיאור'] = 'לא ידוע'
    try:
        if cat_col and cat_col in r.columns:
            r['קטגוריה'] = r[cat_col].astype(str).str.strip()
        else:
            r['קטגוריה'] = 'שונות'
        r.loc[r['קטגוריה'].isin(['','nan','None','NaN']), 'קטגוריה'] = 'שונות'
    except: r['קטגוריה'] = 'שונות'
    r = r[(r['סכום'] != 0) & r['תאריך'].notna()].reset_index(drop=True)
    if not r.empty:
        r['סכום_מוחלט'] = r['סכום'].abs()
        r['חודש'] = r['תאריך'].dt.strftime('%m/%Y')
        r['יום_בשבוע'] = r['תאריך'].dt.dayofweek
    else:
        r = pd.DataFrame(columns=['תאריך','סכום','תיאור','קטגוריה','סכום_מוחלט','חודש','יום_בשבוע'])
    return r

@st.cache_data
def load_excel(file):
    try:
        xlsx = pd.ExcelFile(file, engine='openpyxl')
        sheets = {}
        for name in xlsx.sheet_names:
            df = pd.read_excel(xlsx, sheet_name=name, header=None)
            if not df.empty:
                df = clean_dataframe(df)
                if not df.empty: sheets[name] = df
        return sheets
    except Exception as e:
        st.error(f"שגיאה בטעינה: {e}")
        return {}

@st.cache_data
def load_csv(file):
    for enc in ['utf-8','utf-8-sig','windows-1255','iso-8859-8']:
        try:
            file.seek(0)
            return pd.read_csv(file, encoding=enc)
        except: continue
    return pd.DataFrame()

# =============================================================================
# Charts
# =============================================================================
def render_donut(df):
    """Pure HTML/CSS donut chart - no Plotly bugs."""
    exp = df[df['סכום'] < 0].copy()
    cd = exp.groupby('קטגוריה')['סכום_מוחלט'].sum().reset_index().sort_values('סכום_מוחלט', ascending=False)
    if cd.empty:
        st.markdown(f'<div style="text-align:center;padding:2rem;color:{T["text3"]}">אין נתונים</div>', unsafe_allow_html=True)
        return
    if len(cd) > 6:
        top = cd.head(6).copy()
        cd = pd.concat([top, pd.DataFrame([{'קטגוריה':'אחר','סכום_מוחלט':cd.iloc[6:]['סכום_מוחלט'].sum()}])], ignore_index=True)
    total = cd['סכום_מוחלט'].sum()
    cd['pct'] = (cd['סכום_מוחלט'] / total * 100).round(1)
    
    # Build conic-gradient stops
    stops = []
    cumulative = 0
    colors_used = []
    for i, (_, row) in enumerate(cd.iterrows()):
        c = CHART_COLORS[i % len(CHART_COLORS)]
        colors_used.append(c)
        start = cumulative
        cumulative += row['pct']
        stops.append(f"{c} {start}% {cumulative}%")
    gradient = ", ".join(stops)
    
    # Render donut circle
    donut_html = (
        '<div style="display:flex;flex-direction:column;align-items:center;padding:0.5rem 0">'
        '<div style="position:relative;width:200px;height:200px;margin-bottom:1.25rem">'
        '<div style="width:200px;height:200px;border-radius:50%;'
        f'background:conic-gradient({gradient});'
        'display:flex;align-items:center;justify-content:center">'
        f'<div style="width:130px;height:130px;border-radius:50%;background:{T["surface"]};'
        'display:flex;flex-direction:column;align-items:center;justify-content:center;'
        'box-shadow:0 0 20px rgba(0,0,0,0.15)">'
        f'<div style="font-size:1.25rem;font-weight:800;color:{T["text1"]};direction:ltr">'
        f'₪{total:,.0f}</div>'
        f'<div style="font-size:0.72rem;color:{T["text3"]};margin-top:2px">סה״כ הוצאות</div>'
        '</div></div></div></div>'
    )
    st.markdown(donut_html, unsafe_allow_html=True)
    
    # Render legend separately
    for i, (_, row) in enumerate(cd.iterrows()):
        c = colors_used[i]
        amount_str = f'₪{row["סכום_מוחלט"]:,.0f}'
        pct_str = f'{row["pct"]}%'
        line = (
            '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;direction:rtl">'
            f'<div style="width:10px;height:10px;border-radius:3px;background:{c};flex-shrink:0"></div>'
            f'<div style="flex:1;font-size:0.82rem;color:{T["text1"]};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{row["קטגוריה"]}</div>'
            f'<div style="font-size:0.8rem;color:{T["text2"]};font-weight:600;direction:ltr;flex-shrink:0">{amount_str}</div>'
            f'<div style="font-size:0.72rem;color:{T["text3"]};flex-shrink:0;min-width:36px;text-align:left">{pct_str}</div>'
            '</div>'
        )
        st.markdown(line, unsafe_allow_html=True)

def chart_monthly(df):
    exp = df[df['סכום'] < 0].copy()
    if exp.empty:
        fig = go.Figure(); fig.add_annotation(text="אין נתונים", x=0.5, y=0.5, showarrow=False, font=dict(color=T['text3']))
        fig.update_layout(**plotly_layout(height=260)); return fig
    m = exp.groupby('חודש').agg({'סכום_מוחלט':'sum','תאריך':'first'}).reset_index().sort_values('תאריך')
    n = len(m)
    colors = [f'rgba(129,140,248,{0.45 + 0.55*i/max(n-1,1)})' for i in range(n)]
    fig = go.Figure(go.Bar(x=m['חודש'], y=m['סכום_מוחלט'], marker=dict(color=colors, cornerradius=5),
                           hovertemplate='<b>%{x}</b><br>₪%{y:,.0f}<extra></extra>'))
    fig.update_layout(**plotly_layout(height=260, bargap=0.3))
    return fig

def chart_weekday(df):
    days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
    exp = df[df['סכום'] < 0].copy()
    if exp.empty:
        fig = go.Figure(); fig.add_annotation(text="אין נתונים", x=0.5, y=0.5, showarrow=False, font=dict(color=T['text3']))
        fig.update_layout(**plotly_layout(height=240)); return fig
    d = exp.groupby('יום_בשבוע')['סכום_מוחלט'].sum().reset_index()
    d['יום'] = d['יום_בשבוע'].apply(lambda x: days[x] if x < 7 else '')
    purples = ['#c4b5fd','#a78bfa','#8b5cf6','#7c3aed','#6d28d9','#5b21b6','#4c1d95']
    fig = go.Figure(go.Bar(x=d['יום'], y=d['סכום_מוחלט'],
                           marker=dict(color=[purples[int(x)] for x in d['יום_בשבוע']], cornerradius=5),
                           hovertemplate='<b>יום %{x}</b><br>₪%{y:,.0f}<extra></extra>'))
    fig.update_layout(**plotly_layout(height=240, bargap=0.25))
    return fig

def chart_merchants(df, n=8):
    exp = df[df['סכום'] < 0].copy()
    if exp.empty:
        fig = go.Figure(); fig.add_annotation(text="אין נתונים", x=0.5, y=0.5, showarrow=False, font=dict(color=T['text3']))
        fig.update_layout(**plotly_layout(height=280)); return fig
    m = exp.groupby('תיאור')['סכום_מוחלט'].sum().nlargest(n).reset_index().sort_values('סכום_מוחלט', ascending=True)
    m['short'] = m['תיאור'].apply(lambda x: x[:25]+'...' if len(x) > 28 else x)
    nb = len(m)
    colors = [f'rgba(52,211,153,{0.35 + 0.65*i/max(nb-1,1)})' for i in range(nb)]
    fig = go.Figure(go.Bar(x=m['סכום_מוחלט'], y=m['short'], orientation='h',
                           marker=dict(color=colors, cornerradius=5),
                           hovertemplate='<b>%{y}</b><br>₪%{x:,.0f}<extra></extra>'))
    fig.update_layout(**plotly_layout(height=max(280, n*38), margin=dict(t=10, b=30, l=160, r=15)))
    return fig

def chart_trend(df):
    if df.empty:
        fig = go.Figure(); fig.add_annotation(text="אין נתונים", x=0.5, y=0.5, showarrow=False, font=dict(color=T['text3']))
        fig.update_layout(**plotly_layout(height=300)); return fig
    s = df.sort_values('תאריך').copy()
    s['cum'] = s['סכום'].cumsum()
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=s['תאריך'], y=s['cum'], mode='lines', fill='tozeroy',
                             line=dict(color=T['accent'], width=2.5), fillcolor='rgba(129,140,248,0.08)',
                             hovertemplate='<b>%{x|%d/%m/%Y}</b><br>₪%{y:,.0f}<extra></extra>'))
    fig.add_hline(y=0, line_dash='dot', line_color=T['red'], opacity=0.5)
    fig.update_layout(**plotly_layout(height=300, hovermode='x unified'))
    return fig

# =============================================================================
# UI Components
# =============================================================================
def render_kpis(df):
    total = len(df)
    exp = df[df['סכום'] < 0]
    spent = abs(exp['סכום'].sum()) if len(exp) > 0 else 0
    income = df[df['סכום'] > 0]['סכום'].sum()
    avg = df['סכום_מוחלט'].mean() if not df.empty else 0
    cards = [
        ('💳', f'linear-gradient(135deg,{T["accent"]},#6d28d9)', f'{total:,}', 'עסקאות'),
        ('📉', f'linear-gradient(135deg,#f87171,#dc2626)', fmt(spent), 'הוצאות'),
        ('📈', f'linear-gradient(135deg,#34d399,#059669)', fmt(income), 'הכנסות'),
        ('📊', f'linear-gradient(135deg,#38bdf8,#0284c7)', fmt(avg), 'ממוצע לעסקה'),
    ]
    html = '<div class="kpi-row">'
    for ic, bg, val, label in cards:
        html += f'''<div class="kpi">
            <div class="kpi-icon" style="background:{bg}">{ic}</div>
            <div class="kpi-val">{val}</div>
            <div class="kpi-label">{label}</div>
        </div>'''
    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)

def render_categories(df):
    exp = df[df['סכום'] < 0].copy()
    exp['סכום_מוחלט'] = pd.to_numeric(exp['סכום_מוחלט'], errors='coerce').fillna(0)
    total = exp['סכום_מוחלט'].sum()
    cd = exp.groupby('קטגוריה').agg({'סכום_מוחלט':['sum','count']}).reset_index()
    cd.columns = ['קטגוריה','סכום','מספר']
    cd['pct'] = (cd['סכום']/total*100).round(1) if total > 0 else 0
    cd = cd.sort_values('סכום', ascending=False).head(8)
    if cd.empty:
        st.markdown(f'<div style="text-align:center;padding:2rem;color:{T["text3"]}">אין נתונים</div>', unsafe_allow_html=True)
        return
    html = ""
    for i, (_, r) in enumerate(cd.iterrows()):
        c = CHART_COLORS[i % len(CHART_COLORS)]
        html += f'''<div class="cat-card">
            <div class="cat-icon" style="background:{c}22;color:{c}">{icon_for(r['קטגוריה'])}</div>
            <div class="cat-info">
                <div class="cat-name">{r['קטגוריה']}</div>
                <div class="cat-bar-bg"><div class="cat-bar" style="width:{r['pct']}%;background:{c}"></div></div>
            </div>
            <div class="cat-stats">
                <div class="cat-amount">{fmt(r['סכום'])}</div>
                <div class="cat-pct">{r['pct']}%</div>
            </div>
        </div>'''
    st.markdown(html, unsafe_allow_html=True)

def export_excel(df):
    out = BytesIO()
    with pd.ExcelWriter(out, engine='xlsxwriter') as w:
        df.to_excel(w, sheet_name='עסקאות', index=False)
    return out.getvalue()

# =============================================================================
# Income Manager
# =============================================================================
def init_income_state():
    if 'incomes' not in st.session_state:
        st.session_state.incomes = []

def get_total_income():
    return sum(item['amount'] for item in st.session_state.incomes)

def render_income_tab(df_f):
    """Tab for managing income entries and showing budget overview."""
    init_income_state()
    
    c_left, c_right = st.columns([3, 2])
    
    with c_left:
        st.markdown(f'<div class="section-label">💰 הוספת הכנסה</div>', unsafe_allow_html=True)
        
        ic1, ic2 = st.columns(2)
        with ic1:
            inc_desc = st.text_input("תיאור ההכנסה", placeholder="משכורת, פרילנס...", key="inc_desc")
            inc_amount = st.number_input("סכום (₪)", min_value=0, max_value=999999, value=0, step=100, key="inc_amount")
        with ic2:
            inc_type = st.selectbox("סוג", ['משכורת', 'פרילנס', 'השקעות', 'מתנה', 'החזר', 'אחר'], key="inc_type")
            inc_recurring = st.selectbox("תדירות", ['חד-פעמי', 'חודשי', 'שנתי'], key="inc_recurring")
        
        if st.button("➕ הוסף הכנסה", use_container_width=True, key="add_income"):
            if inc_amount > 0 and inc_desc:
                st.session_state.incomes.append({
                    'desc': inc_desc,
                    'amount': inc_amount,
                    'type': inc_type,
                    'recurring': inc_recurring,
                })
                st.rerun()
            else:
                st.warning("נא למלא תיאור וסכום")
        
        # Income list
        if st.session_state.incomes:
            st.markdown(f'<div class="section-label" style="margin-top:1.5rem">📋 הכנסות שהוזנו</div>', unsafe_allow_html=True)
            for i, item in enumerate(st.session_state.incomes):
                type_icons = {'משכורת':'💼','פרילנס':'💻','השקעות':'📈','מתנה':'🎁','החזר':'🔄','אחר':'📌'}
                ic = type_icons.get(item['type'], '📌')
                rec_badge = f'<span style="background:{T["accent_bg"]};color:{T["accent"]};padding:2px 8px;border-radius:4px;font-size:0.7rem">{item["recurring"]}</span>' if item['recurring'] != 'חד-פעמי' else ''
                
                st.markdown(f'''<div class="cat-card" style="justify-content:space-between">
                    <div style="display:flex;align-items:center;gap:0.75rem">
                        <div class="cat-icon" style="background:{T['green']}22;color:{T['green']}">{ic}</div>
                        <div>
                            <div style="font-weight:600;color:{T['text1']};font-size:0.85rem">{item['desc']}</div>
                            <div style="color:{T['text3']};font-size:0.75rem">{item['type']} {rec_badge}</div>
                        </div>
                    </div>
                    <div style="font-weight:700;color:{T['green']};font-size:1rem;direction:ltr">₪{item['amount']:,.0f}</div>
                </div>''', unsafe_allow_html=True)
            
            # Delete button
            if st.button("🗑️ נקה הכל", key="clear_incomes"):
                st.session_state.incomes = []
                st.rerun()
    
    with c_right:
        # Budget overview
        total_income = get_total_income()
        expenses = df_f[df_f['סכום'] < 0]
        total_expenses = abs(expenses['סכום'].sum()) if len(expenses) > 0 else 0
        balance = total_income - total_expenses
        balance_color = T['green'] if balance >= 0 else T['red']
        savings_rate = (balance / total_income * 100) if total_income > 0 else 0
        
        st.markdown(f'<div class="section-label">📊 סיכום תקציב</div>', unsafe_allow_html=True)
        
        # Budget summary cards
        st.markdown(f'''
        <div style="display:flex;flex-direction:column;gap:0.75rem">
            <div class="kpi" style="padding:1rem;text-align:right">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="font-size:1.3rem;font-weight:700;color:{T['green']};direction:ltr">₪{total_income:,.0f}</div>
                    <div style="color:{T['text2']};font-size:0.82rem">💰 סה״כ הכנסות</div>
                </div>
            </div>
            <div class="kpi" style="padding:1rem;text-align:right">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="font-size:1.3rem;font-weight:700;color:{T['red']};direction:ltr">₪{total_expenses:,.0f}</div>
                    <div style="color:{T['text2']};font-size:0.82rem">📉 סה״כ הוצאות</div>
                </div>
            </div>
            <div class="kpi" style="padding:1rem;text-align:right;border-color:{balance_color}44">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div style="font-size:1.3rem;font-weight:700;color:{balance_color};direction:ltr">₪{balance:,.0f}</div>
                    <div style="color:{T['text2']};font-size:0.82rem">{'✅' if balance >= 0 else '⚠️'} מאזן</div>
                </div>
            </div>
        </div>
        ''', unsafe_allow_html=True)
        
        # Progress bar
        if total_income > 0:
            pct_used = min(total_expenses / total_income * 100, 100)
            bar_color = T['green'] if pct_used < 80 else T['amber'] if pct_used < 100 else T['red']
            st.markdown(f'''
            <div style="margin-top:1.25rem">
                <div style="display:flex;justify-content:space-between;margin-bottom:0.4rem">
                    <div style="color:{T['text2']};font-size:0.8rem">ניצול תקציב</div>
                    <div style="color:{bar_color};font-weight:700;font-size:0.85rem">{pct_used:.0f}%</div>
                </div>
                <div style="height:10px;background:{T['surface2']};border-radius:99px;overflow:hidden">
                    <div style="height:100%;width:{pct_used}%;background:{bar_color};border-radius:99px;transition:width 0.5s"></div>
                </div>
                <div style="color:{T['text3']};font-size:0.75rem;margin-top:0.4rem;text-align:center">
                    {'מצוין! חוסך ' + f'{savings_rate:.0f}%' if savings_rate > 0 else 'חריגה מהתקציב!'}
                </div>
            </div>
            ''', unsafe_allow_html=True)
        else:
            st.markdown(f'''
            <div style="text-align:center;padding:1.5rem;color:{T['text3']};margin-top:1rem">
                <div style="font-size:1.5rem;margin-bottom:0.5rem">💡</div>
                <div style="font-size:0.85rem">הוסף הכנסות כדי לראות את מאזן התקציב</div>
            </div>
            ''', unsafe_allow_html=True)

        # Income vs Expenses chart
        if total_income > 0:
            fig = go.Figure()
            fig.add_trace(go.Bar(x=['הכנסות'], y=[total_income], name='הכנסות',
                                marker=dict(color=T['green'], cornerradius=5)))
            fig.add_trace(go.Bar(x=['הוצאות'], y=[total_expenses], name='הוצאות',
                                marker=dict(color=T['red'], cornerradius=5)))
            if balance > 0:
                fig.add_trace(go.Bar(x=['חיסכון'], y=[balance], name='חיסכון',
                                    marker=dict(color=T['accent'], cornerradius=5)))
            fig.update_layout(
                showlegend=False,
                paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
                margin=dict(t=10, b=30, l=40, r=10), height=200,
                yaxis=dict(gridcolor=T['grid'], tickfont=dict(color=T['text2'], size=10), showgrid=True),
                xaxis=dict(tickfont=dict(color=T['text2'], size=11)),
                font=dict(family='Heebo'),
                bargap=0.4,
            )
            st.plotly_chart(fig, use_container_width=True, key="budget_chart")


# =============================================================================
# Main
# =============================================================================
def main():
    # Header
    st.markdown(f'<div class="dash-header"><h1 class="dash-title">מנתח עסקאות</h1><p class="dash-subtitle">ניתוח חכם של הוצאות כרטיס האשראי שלך</p></div>', unsafe_allow_html=True)

    # Sidebar
    with st.sidebar:
        # -- Logo / Brand + User --
        user = get_current_user()
        user_name = user.get('name', '') if user else ''
        user_badge = ''
        if user and user.get('id') != 'guest':
            user_badge = f'<div style="font-size:0.72rem;color:{T["green"]};margin-top:4px">👤 {user_name}</div>'
        elif user and user.get('id') == 'guest':
            user_badge = f'<div style="font-size:0.72rem;color:{T["amber"]};margin-top:4px">👤 מצב אורח</div>'
        
        st.markdown(f'''
        <div style="text-align:center;padding:0.5rem 0 1.25rem">
            <div style="font-size:2rem;margin-bottom:0.25rem">💳</div>
            <div style="font-weight:800;font-size:1.1rem;color:{T['text1']}">מנתח עסקאות</div>
            {user_badge}
        </div>
        <div style="height:1px;background:{T['border']};margin-bottom:1.25rem"></div>
        ''', unsafe_allow_html=True)

        # -- Upload section --
        st.markdown(f'''
        <div style="margin-bottom:0.6rem">
            <div style="font-weight:600;font-size:0.9rem;color:{T['text1']};margin-bottom:0.4rem">📁 העלאת קבצים</div>
            <div style="font-size:0.78rem;color:{T['text3']}">ניתן להעלות מספר קבצים בו-זמנית</div>
        </div>
        ''', unsafe_allow_html=True)
        uploaded_files = st.file_uploader("upload", type=['xlsx','xls','csv'], label_visibility='collapsed', accept_multiple_files=True)

        st.markdown(f'<div style="height:1px;background:{T["border"]};margin:1.25rem 0"></div>', unsafe_allow_html=True)

        # -- Theme toggle --
        theme_icon = "🌙" if IS_DARK else "☀️"
        theme_text = "עבור למצב בהיר" if IS_DARK else "עבור למצב כהה"
        st.markdown(f'''
        <div style="font-weight:600;font-size:0.9rem;color:{T['text1']};margin-bottom:0.5rem">🎨 ערכת נושא</div>
        ''', unsafe_allow_html=True)
        if st.button(f"{theme_icon} {theme_text}", use_container_width=True, key="theme_btn"):
            st.session_state.theme = 'light' if IS_DARK else 'dark'
            st.rerun()

        st.markdown(f'<div style="height:1px;background:{T["border"]};margin:1.25rem 0"></div>', unsafe_allow_html=True)

        # -- Logout --
        if user and user.get('id') != 'guest' and is_configured():
            if st.button("🚪 התנתק", use_container_width=True, key="logout_btn"):
                logout()
                st.rerun()
            st.markdown(f'<div style="height:1px;background:{T["border"]};margin:1.25rem 0"></div>', unsafe_allow_html=True)
        
        # -- Data Management --
        if user and user.get('id') != 'guest' and is_configured():
            with st.expander("🗄️ ניהול נתונים"):
                st.markdown(f'<div style="font-size:0.8rem;color:{T["text2"]};margin-bottom:0.75rem">מחיקת נתונים שמורים בחשבון</div>', unsafe_allow_html=True)
                
                if st.button("🗑️ מחק עסקאות", use_container_width=True, key="del_data"):
                    if delete_transactions():
                        st.success("העסקאות נמחקו בהצלחה")
                    else:
                        st.error("שגיאה במחיקה")
                
                if st.button("🗑️ מחק הכנסות", use_container_width=True, key="del_incomes"):
                    if delete_all_incomes():
                        st.session_state.incomes = []
                        st.success("ההכנסות נמחקו")
                    else:
                        st.error("שגיאה במחיקה")
                
                st.markdown(f'<div style="height:1px;background:{T["border"]};margin:0.75rem 0"></div>', unsafe_allow_html=True)
                
                confirm = st.checkbox("אני מבין שזה בלתי הפיך", key="del_confirm_check")
                if st.button("⚠️ מחק את כל המידע שלי", use_container_width=True, key="del_all", disabled=not confirm):
                    if delete_all_user_data():
                        st.success("כל המידע נמחק")
                        st.rerun()
                    else:
                        st.error("שגיאה במחיקה")
            
            st.markdown(f'<div style="height:1px;background:{T["border"]};margin:1.25rem 0"></div>', unsafe_allow_html=True)

        # -- Supported formats --
        st.markdown(f'''
        <div style="padding:0.85rem;background:{T['accent_bg']};border-radius:10px;border:1px solid rgba(129,140,248,0.12)">
            <div style="font-weight:600;font-size:0.85rem;color:{T['accent']};margin-bottom:0.5rem">💡 פורמטים נתמכים</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
                <span style="background:{T['surface2']};color:{T['text2']};padding:3px 10px;border-radius:6px;font-size:0.75rem;font-weight:500">MAX</span>
                <span style="background:{T['surface2']};color:{T['text2']};padding:3px 10px;border-radius:6px;font-size:0.75rem;font-weight:500">לאומי</span>
                <span style="background:{T['surface2']};color:{T['text2']};padding:3px 10px;border-radius:6px;font-size:0.75rem;font-weight:500">דיסקונט</span>
                <span style="background:{T['surface2']};color:{T['text2']};padding:3px 10px;border-radius:6px;font-size:0.75rem;font-weight:500">כאל</span>
                <span style="background:{T['surface2']};color:{T['text2']};padding:3px 10px;border-radius:6px;font-size:0.75rem;font-weight:500">CSV</span>
            </div>
        </div>
        ''', unsafe_allow_html=True)

    # Empty state -- try loading saved data first
    if not uploaded_files:
        saved_df = load_transactions()
        if saved_df is not None and not saved_df.empty:
            # Jump directly to dashboard with saved data
            st.markdown(f'''<div class="alert alert-ok">
                <span class="alert-icon">☁️</span>
                <div><div class="alert-text">נטענו {len(saved_df):,} עסקאות שמורות</div><div class="alert-sub">הנתונים נשמרו מההעלאה הקודמת שלך. העלה קבצים חדשים כדי לעדכן.</div></div>
            </div>''', unsafe_allow_html=True)
            _render_dashboard(saved_df)
            return
        else:
            st.markdown(f'''<div style="text-align:center;padding:3rem 1rem">
                <div style="font-size:3.5rem;margin-bottom:1rem">📊</div>
                <div style="font-size:1.4rem;font-weight:700;color:{T['text1']}">ברוכים הבאים!</div>
                <div style="color:{T['text2']};margin-top:0.5rem">העלה קובץ אקסל או CSV מחברת האשראי כדי להתחיל</div>
            </div>''', unsafe_allow_html=True)
            feats = [("📊","ניתוח ויזואלי","גרפים אינטראקטיביים לתובנות מיידיות"),
                     ("🏷️","קטגוריות","זיהוי אוטומטי של קטגוריות מהקובץ"),
                     ("📑","תמיכה מלאה","מספר קבצים בו-זמנית, Excel, CSV")]
            html = '<div class="feat-row">'
            for ic, t, d in feats:
                html += f'<div class="feat"><div class="feat-icon">{ic}</div><div class="feat-title">{t}</div><div class="feat-desc">{d}</div></div>'
            html += '</div>'
            st.markdown(html, unsafe_allow_html=True)
            return

    # Load all files, process EACH independently, then merge results
    all_processed = []
    file_results = []
    
    date_kws = ['תאריך עסקה','תאריך','תאריך רכישה','תאריך חיוב','Date']
    desc_kws = ['שם בית העסק','תיאור','שם בית עסק','פרטי העסקה','Description']
    cat_kws = ['קטגוריה','סוג עסקה','Category']
    
    with st.spinner('טוען ומעבד קבצים...'):
        for uploaded in uploaded_files:
            fname = uploaded.name
            # Load raw sheets
            if fname.endswith(('.xlsx', '.xls')):
                raw_sheets = load_excel(uploaded)
            else:
                csv_df = load_csv(uploaded)
                raw_sheets = {fname: csv_df} if not csv_df.empty else {}
            
            if not raw_sheets:
                file_results.append((fname, 0, False, "קובץ ריק"))
                continue
            
            # Combine all sheets from this file
            combined = pd.concat(list(raw_sheets.values()), ignore_index=True) if len(raw_sheets) > 1 else list(raw_sheets.values())[0]
            
            # Detect columns for THIS file
            dc = find_column(combined, date_kws)
            ac = detect_amount_column(combined)
            dsc = find_column(combined, desc_kws)
            cc = find_column(combined, cat_kws)
            
            if not all([dc, ac, dsc]):
                file_results.append((fname, len(combined), False, "לא זוהו עמודות"))
                continue
            
            # Process this file
            try:
                processed = process_data(combined, dc, ac, dsc, cc)
                if not processed.empty:
                    processed['_מקור'] = fname
                    all_processed.append(processed)
                    file_results.append((fname, len(processed), True, ""))
                else:
                    file_results.append((fname, 0, False, "אין עסקאות"))
            except Exception as e:
                file_results.append((fname, 0, False, str(e)))

    if not all_processed:
        # No file succeeded -- show manual config for the first file
        st.markdown(f'<div class="alert alert-err"><span class="alert-icon">❌</span><div><div class="alert-text">לא הצלחנו לנתח אף קובץ</div></div></div>', unsafe_allow_html=True)
        
        # Try manual column selection for the first file
        uploaded = uploaded_files[0]
        fname = uploaded.name
        if fname.endswith(('.xlsx','.xls')):
            raw_sheets = load_excel(uploaded)
        else:
            csv_df = load_csv(uploaded)
            raw_sheets = {fname: csv_df} if not csv_df.empty else {}
        
        if raw_sheets:
            df_raw = pd.concat(list(raw_sheets.values()), ignore_index=True) if len(raw_sheets) > 1 else list(raw_sheets.values())[0]
            st.markdown(f'<div class="section-label">⚙️ הגדרה ידנית עבור {fname}</div>', unsafe_allow_html=True)
            cols = df_raw.columns.tolist()
            c1, c2 = st.columns(2)
            with c1:
                date_col = st.selectbox("📅 תאריך", cols, key="man_date")
                amount_col = st.selectbox("💰 סכום", cols, key="man_amount")
            with c2:
                desc_col = st.selectbox("📝 תיאור", cols, key="man_desc")
                cat_col = st.selectbox("🏷️ קטגוריה", ['ללא'] + cols, key="man_cat")
                cat_col = None if cat_col == 'ללא' else cat_col
            if st.button("▶️ המשך", use_container_width=True, key="man_go"):
                try:
                    df = process_data(df_raw, date_col, amount_col, desc_col, cat_col)
                    if not df.empty:
                        df['_מקור'] = fname
                        all_processed.append(df)
                    else:
                        st.error("אין עסקאות בקובץ"); return
                except Exception as e:
                    st.error(f"שגיאה: {e}"); return
            else:
                st.stop()

    # Merge all processed data
    df = pd.concat(all_processed, ignore_index=True)
    
    # Show results per file
    if len(uploaded_files) > 1:
        for fname, count, ok, err in file_results:
            if ok:
                st.markdown(f'<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;direction:rtl"><span style="color:{T["green"]}">✅</span><span style="color:{T["text1"]};font-size:0.85rem;font-weight:600">{fname}</span><span style="color:{T["text2"]};font-size:0.8rem">{count:,} עסקאות</span></div>', unsafe_allow_html=True)
            else:
                st.markdown(f'<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;direction:rtl"><span style="color:{T["red"]}">❌</span><span style="color:{T["text1"]};font-size:0.85rem">{fname}</span><span style="color:{T["text3"]};font-size:0.8rem">{err}</span></div>', unsafe_allow_html=True)
    
    if df.empty:
        st.markdown(f'<div class="alert alert-err"><span class="alert-icon">📭</span><div><div class="alert-text">לא נמצאו עסקאות</div></div></div>', unsafe_allow_html=True)
        return
    
    dr = f"{df['תאריך'].min().strftime('%d/%m/%Y')} — {df['תאריך'].max().strftime('%d/%m/%Y')}"
    total_files = sum(1 for _,_,ok,_ in file_results if ok)
    st.markdown(f'''<div class="alert alert-ok">
        <span class="alert-icon">✅</span>
        <div><div class="alert-text">נטענו {len(df):,} עסקאות{f" מ-{total_files} קבצים" if total_files > 1 else ""}</div><div class="alert-sub">{dr}</div></div>
        <div class="alert-badge">{df['קטגוריה'].nunique()} קטגוריות</div>
    </div>''', unsafe_allow_html=True)
    
    # Save to DB for persistence
    save_transactions(df)

    _render_dashboard(df)


def _render_dashboard(df):
    """Render the main dashboard (filters, KPIs, tabs)."""
    # Filters
    st.markdown(f'<div class="section-label">🔍 סינון</div>', unsafe_allow_html=True)
    c1, c2, c3 = st.columns(3)
    with c1: dates = st.date_input("טווח תאריכים", [df['תאריך'].min(), df['תאריך'].max()])
    with c2: cat_f = st.selectbox("קטגוריה", ['הכל'] + sorted(df['קטגוריה'].unique().tolist()))
    with c3: search = st.text_input("חיפוש בית עסק", placeholder="הקלד...")

    df_f = df.copy()
    if len(dates) == 2:
        df_f = df_f[(df_f['תאריך'].dt.date >= dates[0]) & (df_f['תאריך'].dt.date <= dates[1])]
    if cat_f != 'הכל': df_f = df_f[df_f['קטגוריה'] == cat_f]
    if search: df_f = df_f[df_f['תיאור'].str.contains(search, case=False, na=False)]

    if df_f.empty:
        st.markdown(f'''<div style="text-align:center;padding:2rem">
            <div style="font-size:2.5rem">🔍</div>
            <div style="color:{T['amber']};font-weight:600;margin-top:0.5rem">לא נמצאו תוצאות</div>
            <div style="color:{T['text2']};font-size:0.9rem">נסה לשנות את הפילטרים</div>
        </div>''', unsafe_allow_html=True)
        return

    # KPIs
    render_kpis(df_f)

    # Tabs
    tabs = st.tabs(["📊 סקירה","📈 מגמות","🏪 בתי עסק","🔍 תובנות","📋 עסקאות","💰 תקציב"])

    # ══════════════════════════════════════════════
    # TAB 0: Overview
    # ══════════════════════════════════════════════
    with tabs[0]:
        c1, c2 = st.columns([3, 2])
        with c1:
            st.markdown(f'<div class="section-label">📅 הוצאות חודשיות</div>', unsafe_allow_html=True)
            st.plotly_chart(chart_monthly(df_f), use_container_width=True, key="m")
            st.markdown(f'<div class="section-label">📆 לפי יום בשבוע</div>', unsafe_allow_html=True)
            st.plotly_chart(chart_weekday(df_f), use_container_width=True, key="w")
        with c2:
            st.markdown(f'<div class="section-label">🥧 לפי קטגוריה</div>', unsafe_allow_html=True)
            render_donut(df_f)
            st.markdown(f'<div class="section-label">📋 פירוט</div>', unsafe_allow_html=True)
            render_categories(df_f)

    # ══════════════════════════════════════════════
    # TAB 1: Trends - Enhanced
    # ══════════════════════════════════════════════
    with tabs[1]:
        st.markdown(f'<div class="section-label">📈 מאזן מצטבר</div>', unsafe_allow_html=True)
        st.plotly_chart(chart_trend(df_f), use_container_width=True, key="t")

        exp = df_f[df_f['סכום'] < 0]
        if len(exp) > 0:
            # Stats row
            st.markdown(f'<div class="section-label">📊 סטטיסטיקות</div>', unsafe_allow_html=True)
            c1,c2,c3,c4 = st.columns(4)
            avg_daily = exp['סכום_מוחלט'].sum() / max((df_f['תאריך'].max() - df_f['תאריך'].min()).days, 1)
            stats = [
                ('הוצאה מקסימלית', fmt(exp['סכום_מוחלט'].max()), T['red']),
                ('ממוצע יומי', fmt(avg_daily), T['accent']),
                ('חציון', fmt(exp['סכום_מוחלט'].median()), T['amber']),
                ('מספר עסקאות', f'{len(exp):,}', T['green']),
            ]
            for col, (label, val, color) in zip([c1,c2,c3,c4], stats):
                with col:
                    st.markdown(f'''<div class="kpi" style="padding:1rem">
                        <div style="color:{T['text2']};font-size:0.78rem;margin-bottom:6px">{label}</div>
                        <div style="color:{color};font-size:1.4rem;font-weight:700">{val}</div>
                    </div>''', unsafe_allow_html=True)

            # Monthly comparison table
            st.markdown(f'<div class="section-label">📅 השוואה חודשית</div>', unsafe_allow_html=True)
            monthly = exp.groupby('חודש').agg({'סכום_מוחלט':['sum','count','mean'],'תאריך':'first'}).reset_index()
            monthly.columns = ['חודש','סה״כ','עסקאות','ממוצע','_d']
            monthly = monthly.sort_values('_d', ascending=False).drop('_d', axis=1)
            # Show change %
            monthly['שינוי'] = monthly['סה״כ'].pct_change(periods=-1) * 100
            for _, row in monthly.iterrows():
                month_label = str(row['חודש'])
                tx_count = int(row['עסקאות'])
                total_str = fmt(row['סה״כ'])
                # Build change badge
                badge = ''
                if pd.notna(row['שינוי']) and row['שינוי'] != 0:
                    ch = row['שינוי']
                    arrow = '↑' if ch > 0 else '↓'
                    ch_color = T['red'] if ch > 0 else T['green']
                    badge = f'{arrow} {abs(ch):.0f}%'
                    st.markdown(
                        f'<div class="cat-card" style="justify-content:space-between">'
                        f'<div style="display:flex;align-items:center;gap:0.75rem">'
                        f'<div style="font-weight:700;color:{T["text1"]};font-size:0.9rem;min-width:65px">{month_label}</div>'
                        f'<div style="color:{T["text2"]};font-size:0.8rem">{tx_count} עסקאות</div>'
                        f'<span style="color:{ch_color};font-weight:600;font-size:0.8rem">{badge}</span>'
                        f'</div>'
                        f'<div style="font-weight:700;color:{T["red"]};font-size:0.95rem;direction:ltr">{total_str}</div>'
                        f'</div>', unsafe_allow_html=True)
                else:
                    st.markdown(
                        f'<div class="cat-card" style="justify-content:space-between">'
                        f'<div style="display:flex;align-items:center;gap:0.75rem">'
                        f'<div style="font-weight:700;color:{T["text1"]};font-size:0.9rem;min-width:65px">{month_label}</div>'
                        f'<div style="color:{T["text2"]};font-size:0.8rem">{tx_count} עסקאות</div>'
                        f'</div>'
                        f'<div style="font-weight:700;color:{T["red"]};font-size:0.95rem;direction:ltr">{total_str}</div>'
                        f'</div>', unsafe_allow_html=True)

    # ══════════════════════════════════════════════
    # TAB 2: Merchants - Enhanced
    # ══════════════════════════════════════════════
    with tabs[2]:
        st.markdown(f'<div class="section-label">🏆 בתי עסק מובילים</div>', unsafe_allow_html=True)
        if 'merchant_count' not in st.session_state:
            st.session_state.merchant_count = 8
        st.markdown(f'<div style="color:{T["text2"]};font-size:0.85rem;margin-bottom:0.5rem">מספר בתי עסק:</div>', unsafe_allow_html=True)
        bc1, bc2, bc3, bc4, spacer = st.columns([1,1,1,1,5])
        with bc1:
            if st.button("5", key="m5", use_container_width=True): st.session_state.merchant_count = 5; st.rerun()
        with bc2:
            if st.button("8", key="m8", use_container_width=True): st.session_state.merchant_count = 8; st.rerun()
        with bc3:
            if st.button("10", key="m10", use_container_width=True): st.session_state.merchant_count = 10; st.rerun()
        with bc4:
            if st.button("15", key="m15", use_container_width=True): st.session_state.merchant_count = 15; st.rerun()
        st.plotly_chart(chart_merchants(df_f, st.session_state.merchant_count), use_container_width=True, key="mr")

        # Merchant detail cards
        if len(exp) > 0:
            st.markdown(f'<div class="section-label">📊 פירוט בתי עסק</div>', unsafe_allow_html=True)
            merch = exp.groupby('תיאור').agg({'סכום_מוחלט':['sum','count','mean']}).reset_index()
            merch.columns = ['בית עסק','סה״כ','ביקורים','ממוצע']
            merch = merch.sort_values('סה״כ', ascending=False).head(10)
            for _, row in merch.iterrows():
                name = row['בית עסק'][:30] + ('...' if len(row['בית עסק']) > 30 else '')
                st.markdown(f'''<div class="cat-card" style="justify-content:space-between">
                    <div>
                        <div style="font-weight:600;color:{T['text1']};font-size:0.85rem">{name}</div>
                        <div style="color:{T['text3']};font-size:0.75rem">{int(row['ביקורים'])} ביקורים &bull; ממוצע {fmt(row['ממוצע'])}</div>
                    </div>
                    <div style="font-weight:700;color:{T['red']};font-size:0.95rem;direction:ltr">{fmt(row['סה״כ'])}</div>
                </div>''', unsafe_allow_html=True)

    # ══════════════════════════════════════════════
    # TAB 3: Insights (NEW!)
    # ══════════════════════════════════════════════
    with tabs[3]:
        if len(exp) > 0:
            total_exp = exp['סכום_מוחלט'].sum()
            num_days = max((df_f['תאריך'].max() - df_f['תאריך'].min()).days, 1)

            # Top insights
            st.markdown(f'<div class="section-label">💡 תובנות חכמות</div>', unsafe_allow_html=True)

            # 1. Biggest single expense
            biggest = exp.loc[exp['סכום_מוחלט'].idxmax()]
            st.markdown(f'''<div class="cat-card">
                <div class="cat-icon" style="background:{T['red']}22;color:{T['red']}">🔥</div>
                <div class="cat-info">
                    <div class="cat-name">ההוצאה הגדולה ביותר</div>
                    <div style="color:{T['text2']};font-size:0.8rem">{biggest['תיאור']} • {biggest['תאריך'].strftime('%d/%m/%Y')}</div>
                </div>
                <div class="cat-stats"><div class="cat-amount" style="color:{T['red']}">{fmt(biggest['סכום_מוחלט'])}</div></div>
            </div>''', unsafe_allow_html=True)

            # 2. Most visited merchant
            top_merch = exp.groupby('תיאור').size().idxmax()
            top_merch_count = exp.groupby('תיאור').size().max()
            top_merch_sum = exp[exp['תיאור'] == top_merch]['סכום_מוחלט'].sum()
            st.markdown(f'''<div class="cat-card">
                <div class="cat-icon" style="background:{T['accent']}22;color:{T['accent']}">🔄</div>
                <div class="cat-info">
                    <div class="cat-name">בית העסק עם הכי הרבה ביקורים</div>
                    <div style="color:{T['text2']};font-size:0.8rem">{top_merch} • {top_merch_count} ביקורים</div>
                </div>
                <div class="cat-stats"><div class="cat-amount">{fmt(top_merch_sum)}</div></div>
            </div>''', unsafe_allow_html=True)

            # 3. Most expensive day of week
            days_heb = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
            day_totals = exp.groupby('יום_בשבוע')['סכום_מוחלט'].sum()
            expensive_day = day_totals.idxmax()
            st.markdown(f'''<div class="cat-card">
                <div class="cat-icon" style="background:{T['amber']}22;color:{T['amber']}">📅</div>
                <div class="cat-info">
                    <div class="cat-name">היום הכי יקר בשבוע</div>
                    <div style="color:{T['text2']};font-size:0.8rem">יום {days_heb[expensive_day]}</div>
                </div>
                <div class="cat-stats"><div class="cat-amount">{fmt(day_totals[expensive_day])}</div></div>
            </div>''', unsafe_allow_html=True)

            # 4. Average per transaction
            avg_tx = exp['סכום_מוחלט'].mean()
            st.markdown(f'''<div class="cat-card">
                <div class="cat-icon" style="background:{T['green']}22;color:{T['green']}">📊</div>
                <div class="cat-info">
                    <div class="cat-name">ממוצע לעסקה</div>
                    <div style="color:{T['text2']};font-size:0.8rem">{len(exp):,} עסקאות ב-{num_days} ימים</div>
                </div>
                <div class="cat-stats"><div class="cat-amount">{fmt(avg_tx)}</div></div>
            </div>''', unsafe_allow_html=True)

            # Spending heatmap by category & month
            st.markdown(f'<div class="section-label">🗓️ מפת חום: קטגוריות x חודשים</div>', unsafe_allow_html=True)
            heatmap_data = exp.groupby(['קטגוריה','חודש'])['סכום_מוחלט'].sum().reset_index()
            if not heatmap_data.empty:
                pivot = heatmap_data.pivot_table(index='קטגוריה', columns='חודש', values='סכום_מוחלט', fill_value=0)
                # Sort by total
                pivot['_total'] = pivot.sum(axis=1)
                pivot = pivot.sort_values('_total', ascending=False).drop('_total', axis=1).head(8)
                fig_heat = go.Figure(go.Heatmap(
                    z=pivot.values, x=pivot.columns.tolist(), y=pivot.index.tolist(),
                    colorscale=[[0,'#0c111d'],[0.5,'#818cf8'],[1,'#c084fc']],
                    hovertemplate='<b>%{y}</b><br>%{x}<br>₪%{z:,.0f}<extra></extra>',
                    showscale=False,
                ))
                fig_heat.update_layout(
                    paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
                    margin=dict(t=10, b=40, l=120, r=10), height=max(250, len(pivot)*35),
                    font=dict(family='Heebo', color=T['text2']),
                    xaxis=dict(tickfont=dict(color=T['text2'], size=10), side='bottom'),
                    yaxis=dict(tickfont=dict(color=T['text1'], size=11), autorange='reversed'),
                )
                st.plotly_chart(fig_heat, use_container_width=True, key="heatmap")

            # Large transactions alert
            threshold = exp['סכום_מוחלט'].quantile(0.9)
            large_tx = exp[exp['סכום_מוחלט'] >= threshold].sort_values('סכום_מוחלט', ascending=False).head(5)
            if len(large_tx) > 0:
                st.markdown(f'<div class="section-label">⚠️ עסקאות חריגות (עשירון עליון)</div>', unsafe_allow_html=True)
                for _, row in large_tx.iterrows():
                    desc_short = str(row['תיאור'])[:35]
                    date_str = row['תאריך'].strftime('%d/%m/%Y')
                    amount_str = fmt(row['סכום_מוחלט'])
                    st.markdown(
                        f'<div class="cat-card">'
                        f'<div style="font-weight:600;color:{T["text1"]};font-size:0.85rem;flex:1">{desc_short}</div>'
                        f'<div style="color:{T["text3"]};font-size:0.78rem">{date_str}</div>'
                        f'<div style="font-weight:700;color:{T["red"]};font-size:0.9rem;direction:ltr;min-width:70px;text-align:left">{amount_str}</div>'
                        f'</div>', unsafe_allow_html=True)

    # ══════════════════════════════════════════════
    # TAB 4: Transactions
    # ══════════════════════════════════════════════
    with tabs[4]:
        st.markdown(f'<div class="section-label">📋 עסקאות</div>', unsafe_allow_html=True)
        col1, _ = st.columns([2, 3])
        with col1:
            sort = st.selectbox("מיון", ['תאריך ↓','תאריך ↑','סכום ↓','סכום ↑'])
        smap = {'תאריך ↓':('תאריך',False),'תאריך ↑':('תאריך',True),'סכום ↓':('סכום_מוחלט',False),'סכום ↑':('סכום_מוחלט',True)}
        sc, sa = smap[sort]
        # Include source file column if multiple files were uploaded
        cols_to_show = ['תאריך','תיאור','קטגוריה','סכום']
        col_config = {
            "תאריך": st.column_config.DateColumn("תאריך", format="DD/MM/YYYY", width="small"),
            "תיאור": st.column_config.TextColumn("בית עסק", width="large"),
            "קטגוריה": st.column_config.TextColumn("קטגוריה", width="medium"),
            "סכום": st.column_config.NumberColumn("סכום (₪)", format="₪%.2f", width="small"),
        }
        if '_מקור' in df_f.columns and df_f['_מקור'].nunique() > 1:
            cols_to_show = ['תאריך','תיאור','קטגוריה','סכום','_מקור']
            col_config["_מקור"] = st.column_config.TextColumn("מקור (קובץ)", width="medium")
        
        view = df_f.sort_values(sc, ascending=sa)[cols_to_show].copy()
        st.dataframe(view, column_config=col_config,
            hide_index=True, use_container_width=True, height=500)
        st.markdown(f'<div style="color:{T["text3"]};font-size:0.82rem;margin-top:0.5rem;text-align:center">{len(view):,} עסקאות</div>', unsafe_allow_html=True)

    # ══════════════════════════════════════════════
    # TAB 5: Budget
    # ══════════════════════════════════════════════
    with tabs[5]:
        render_income_tab(df_f)

    # Export
    st.markdown("---")
    st.markdown(f'<div class="section-label">📥 ייצוא</div>', unsafe_allow_html=True)
    c1, c2 = st.columns(2)
    with c1:
        st.download_button("📊 Excel", export_excel(df_f), "עסקאות.xlsx",
                           "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", use_container_width=True)
    with c2:
        st.download_button("📄 CSV", df_f.to_csv(index=False, encoding='utf-8-sig'), "עסקאות.csv", "text/csv", use_container_width=True)


# =============================================================================
# Auth UI - Premium Design
# =============================================================================
def render_auth_page():
    """Premium login/register page -- no broken HTML wrappers."""
    init_auth_state()
    page = st.session_state.auth_page

    # Auth-only CSS: style the COLUMN itself as the card, hide sidebar
    st.markdown(f"""
    <style>
    /* Hide sidebar completely on auth */
    section[data-testid="stSidebar"],
    [data-testid="collapsedControl"],
    button[aria-label="Collapse sidebar"],
    button[aria-label="Expand sidebar"] {{
        display: none !important;
    }}
    /* Make the center column LOOK like a card */
    [data-testid="stAppViewBlockContainer"] {{
        max-width: 460px !important;
        margin: 0 auto !important;
        padding-top: 3rem !important;
    }}
    /* Glassmorphism card effect on the main block */
    .stMainBlockContainer {{
        max-width: 480px !important;
        margin: 0 auto !important;
    }}
    /* Input styling */
    [data-testid="stTextInput"] {{
        margin-bottom: 0.25rem;
    }}
    [data-testid="stTextInput"] input {{
        background: {T['surface2']} !important;
        border: 1.5px solid {T['border']} !important;
        border-radius: 12px !important;
        padding: 0.8rem 1rem !important;
        font-size: 0.95rem !important;
        color: {T['text1']} !important;
        transition: border-color 0.2s, box-shadow 0.2s !important;
    }}
    [data-testid="stTextInput"] input:focus {{
        border-color: {T['accent']} !important;
        box-shadow: 0 0 0 3px rgba(129,140,248,0.12) !important;
    }}
    [data-testid="stTextInput"] input::placeholder {{
        color: {T['text3']} !important;
    }}
    /* Primary button - gradient */
    .stButton > button {{
        background: linear-gradient(135deg, #818cf8, #6d28d9) !important;
        color: #fff !important;
        border: none !important;
        border-radius: 12px !important;
        padding: 0.8rem !important;
        font-size: 1rem !important;
        font-weight: 700 !important;
        box-shadow: 0 4px 20px rgba(129,140,248,0.3) !important;
        transition: transform 0.15s, box-shadow 0.15s !important;
        letter-spacing: 0.3px !important;
    }}
    .stButton > button:hover {{
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 30px rgba(129,140,248,0.4) !important;
    }}
    .stButton > button:active {{
        transform: translateY(0) !important;
    }}
    </style>
    """, unsafe_allow_html=True)

    # ─── Logo ───
    st.markdown(f'''
    <div style="text-align:center;padding:1rem 0 0.5rem">
        <div style="width:72px;height:72px;background:linear-gradient(135deg,#818cf8,#6d28d9);
            border-radius:20px;display:inline-flex;align-items:center;justify-content:center;
            font-size:2rem;box-shadow:0 8px 32px rgba(129,140,248,0.25);margin-bottom:1rem">💳</div>
        <div style="font-size:1.7rem;font-weight:800;color:{T['text1']}">מנתח עסקאות</div>
        <div style="color:{T['text2']};font-size:0.88rem;margin-top:4px">ניתוח חכם של הוצאות כרטיס האשראי שלך</div>
    </div>
    ''', unsafe_allow_html=True)

    # ─── Card area (styled via column background) ───
    st.markdown(f'''
    <div style="background:{T['surface']};border:1px solid {T['border']};border-radius:20px;
        padding:1.75rem 1.5rem 0.5rem;margin:1rem 0;box-shadow:0 8px 40px rgba(0,0,0,0.12)">
    </div>
    ''', unsafe_allow_html=True)

    # Since we can't wrap st widgets in HTML divs, we use CSS to style
    # the entire page container as our "card". The visual card above is decorative.
    # The real trick: constrain max-width to 460px and style all children.

    # ─── LOGIN ───
    if page == 'login':
        st.markdown(f'<div style="text-align:center;font-size:1.15rem;font-weight:700;color:{T["text1"]};margin:0.5rem 0 1.25rem">👋 ברוך הבא!</div>', unsafe_allow_html=True)

        email = st.text_input("אימייל", placeholder="name@example.com", key="login_email", label_visibility="collapsed")
        password = st.text_input("סיסמה", type="password", placeholder="הסיסמה שלך", key="login_pass", label_visibility="collapsed")

        if st.button("התחבר  →", use_container_width=True, key="login_btn"):
            if not email or not password:
                st.error("נא למלא אימייל וסיסמה")
            elif not validate_email(email):
                st.error("כתובת מייל לא תקינה")
            else:
                ok, msg = sign_in(email, password)
                if ok:
                    settings = load_user_settings()
                    if settings.get('theme'):
                        st.session_state.theme = settings['theme']
                    st.rerun()
                else:
                    st.error(msg)

        st.markdown(f'<div style="display:flex;align-items:center;gap:1rem;margin:1.25rem 0"><div style="flex:1;height:1px;background:{T["border"]}"></div><span style="color:{T["text3"]};font-size:0.8rem">אין לך חשבון?</span><div style="flex:1;height:1px;background:{T["border"]}"></div></div>', unsafe_allow_html=True)

        c1, c2 = st.columns(2)
        with c1:
            if st.button("📝 צור חשבון", use_container_width=True, key="goto_register"):
                st.session_state.auth_page = 'register'; st.rerun()
        with c2:
            if st.button("🔑 שכחתי סיסמה", use_container_width=True, key="goto_reset"):
                st.session_state.auth_page = 'reset'; st.rerun()

    # ─── REGISTER ───
    elif page == 'register':
        st.markdown(f'<div style="text-align:center;font-size:1.15rem;font-weight:700;color:{T["text1"]};margin:0.5rem 0 1.25rem">✨ יצירת חשבון</div>', unsafe_allow_html=True)

        full_name = st.text_input("שם", placeholder="השם המלא שלך", key="reg_name", label_visibility="collapsed")
        email = st.text_input("אימייל", placeholder="name@example.com", key="reg_email", label_visibility="collapsed")
        password = st.text_input("סיסמה", type="password", placeholder="לפחות 6 תווים", key="reg_pass", label_visibility="collapsed")
        password2 = st.text_input("אימות", type="password", placeholder="הקלד סיסמה שוב", key="reg_pass2", label_visibility="collapsed")

        if st.button("צור חשבון  →", use_container_width=True, key="reg_btn"):
            if not all([full_name, email, password, password2]):
                st.error("נא למלא את כל השדות")
            elif not validate_email(email):
                st.error("כתובת מייל לא תקינה")
            elif password != password2:
                st.error("הסיסמאות לא תואמות")
            else:
                ok_p, msg_p = validate_password(password)
                if not ok_p:
                    st.error(msg_p)
                else:
                    ok, msg = sign_up(email, password, full_name)
                    if ok:
                        st.success(msg); st.session_state.auth_page = 'login'
                    else:
                        st.error(msg)

        st.markdown(f'<div style="display:flex;align-items:center;gap:1rem;margin:1.25rem 0"><div style="flex:1;height:1px;background:{T["border"]}"></div><span style="color:{T["text3"]};font-size:0.8rem">כבר יש לך חשבון?</span><div style="flex:1;height:1px;background:{T["border"]}"></div></div>', unsafe_allow_html=True)

        if st.button("← חזור להתחברות", use_container_width=True, key="back_login"):
            st.session_state.auth_page = 'login'; st.rerun()

    # ─── RESET ───
    elif page == 'reset':
        st.markdown(f'<div style="text-align:center;font-size:1.15rem;font-weight:700;color:{T["text1"]};margin:0.5rem 0 0.5rem">🔑 איפוס סיסמה</div>', unsafe_allow_html=True)
        st.markdown(f'<div style="text-align:center;color:{T["text2"]};font-size:0.85rem;margin-bottom:1.25rem">נשלח לך קישור לאיפוס למייל</div>', unsafe_allow_html=True)

        email = st.text_input("אימייל", placeholder="name@example.com", key="reset_email", label_visibility="collapsed")

        if st.button("שלח קישור  →", use_container_width=True, key="reset_btn"):
            if not email:
                st.error("נא להזין כתובת מייל")
            elif not validate_email(email):
                st.error("כתובת מייל לא תקינה")
            else:
                ok, msg = reset_password(email)
                if ok: st.success(msg)
                else: st.error(msg)

        if st.button("← חזור להתחברות", use_container_width=True, key="back_login2"):
            st.session_state.auth_page = 'login'; st.rerun()

    # ─── Guest option ───
    st.markdown(f'<div style="display:flex;align-items:center;gap:1rem;margin:1.5rem 0 1rem"><div style="flex:1;height:1px;background:{T["border"]}"></div><span style="color:{T["text3"]};font-size:0.8rem">או</span><div style="flex:1;height:1px;background:{T["border"]}"></div></div>', unsafe_allow_html=True)

    if st.button("🚀 המשך ללא חשבון", use_container_width=True, key="skip_auth"):
        st.session_state.auth_user = {"id": "guest", "email": "guest", "name": "אורח"}
        st.rerun()

    # ─── Theme toggle on auth page ───
    theme_icon = "☀️" if IS_DARK else "🌙"
    theme_txt = "מצב בהיר" if IS_DARK else "מצב כהה"
    if st.button(f"{theme_icon} {theme_txt}", use_container_width=True, key="auth_theme"):
        st.session_state.theme = 'light' if IS_DARK else 'dark'
        st.rerun()
    
    # ─── Feature badges ───
    st.markdown(f'''
    <div style="display:flex;justify-content:center;gap:2.5rem;margin:2rem 0 1rem;flex-wrap:wrap">
        <div style="text-align:center"><div style="font-size:1.3rem">🔒</div><div style="font-size:0.7rem;color:{T['text3']}">מאובטח</div></div>
        <div style="text-align:center"><div style="font-size:1.3rem">📊</div><div style="font-size:0.7rem;color:{T['text3']}">ניתוח חכם</div></div>
        <div style="text-align:center"><div style="font-size:1.3rem">☁️</div><div style="font-size:0.7rem;color:{T['text3']}">שמירה בענן</div></div>
        <div style="text-align:center"><div style="font-size:1.3rem">🇮🇱</div><div style="font-size:0.7rem;color:{T['text3']}">עברית מלאה</div></div>
    </div>
    ''', unsafe_allow_html=True)


# =============================================================================
# Entry Point
# =============================================================================
if __name__ == "__main__":
    init_auth_state()
    
    if is_configured() and not is_logged_in():
        render_auth_page()
    else:
        main()
