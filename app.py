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
    keywords = ['תאריך', 'שם בית העסק', 'סכום', 'קטגוריה', 'תיאור', 'חיוב', 'עסקה']
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
def chart_donut(df):
    exp = df[df['סכום'] < 0].copy()
    cd = exp.groupby('קטגוריה')['סכום_מוחלט'].sum().reset_index().sort_values('סכום_מוחלט', ascending=False)
    if cd.empty:
        fig = go.Figure()
        fig.add_annotation(text="אין נתונים", x=0.5, y=0.5, showarrow=False, font=dict(size=15, color=T['text3']))
        fig.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', height=300, margin=dict(t=10,b=10,l=10,r=10))
        return fig
    if len(cd) > 6:
        top = cd.head(6).copy()
        other_sum = cd.iloc[6:]['סכום_מוחלט'].sum()
        cd = pd.concat([top, pd.DataFrame([{'קטגוריה':'אחר','סכום_מוחלט':other_sum}])], ignore_index=True)
    total = cd['סכום_מוחלט'].sum()
    cd['pct_label'] = (cd['סכום_מוחלט'] / total * 100).round(1).astype(str) + '%'
    fig = go.Figure(go.Pie(
        labels=cd['קטגוריה'], values=cd['סכום_מוחלט'], hole=0.65,
        marker=dict(colors=CHART_COLORS[:len(cd)], line=dict(color=T['bg'], width=2)),
        textinfo='label+percent',
        textposition='outside',
        textfont=dict(size=11, color=T['text2'], family='Heebo'),
        hovertemplate='<b>%{label}</b><br>₪%{value:,.0f}<br>%{percent}<extra></extra>',
        pull=[0.03]*len(cd),
    ))
    fig.add_annotation(text=f"<b style='font-size:20px'>₪{total:,.0f}</b>", x=0.5, y=0.55, showarrow=False,
                       font=dict(size=20, color=T['text1'], family='Heebo'))
    fig.add_annotation(text=f"<span style='font-size:11px'>סה״כ הוצאות</span>", x=0.5, y=0.43, showarrow=False,
                       font=dict(size=11, color=T['text2'], family='Heebo'))
    fig.update_layout(
        showlegend=False,
        paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=30, b=30, l=30, r=30),
        height=350,
        uniformtext_minsize=10, uniformtext_mode='hide',
    )
    return fig

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
        # -- Logo / Brand --
        st.markdown(f'''
        <div style="text-align:center;padding:0.5rem 0 1.25rem">
            <div style="font-size:2rem;margin-bottom:0.25rem">💳</div>
            <div style="font-weight:800;font-size:1.1rem;color:{T['text1']}">מנתח עסקאות</div>
            <div style="font-size:0.75rem;color:{T['text3']};margin-top:2px">v2.0</div>
        </div>
        <div style="height:1px;background:{T['border']};margin-bottom:1.25rem"></div>
        ''', unsafe_allow_html=True)

        # -- Upload section --
        st.markdown(f'''
        <div style="margin-bottom:0.6rem">
            <div style="font-weight:600;font-size:0.9rem;color:{T['text1']};margin-bottom:0.4rem">📁 העלאת קובץ</div>
            <div style="font-size:0.78rem;color:{T['text3']}">Excel או CSV מחברת האשראי</div>
        </div>
        ''', unsafe_allow_html=True)
        uploaded = st.file_uploader("upload", type=['xlsx','xls','csv'], label_visibility='collapsed')

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

    # Empty state
    if not uploaded:
        st.markdown(f'''<div style="text-align:center;padding:3rem 1rem">
            <div style="font-size:3.5rem;margin-bottom:1rem">📊</div>
            <div style="font-size:1.4rem;font-weight:700;color:{T['text1']}">ברוכים הבאים!</div>
            <div style="color:{T['text2']};margin-top:0.5rem">העלה קובץ אקסל או CSV מחברת האשראי כדי להתחיל</div>
        </div>''', unsafe_allow_html=True)
        feats = [("📊","ניתוח ויזואלי","גרפים אינטראקטיביים לתובנות מיידיות"),
                 ("🏷️","קטגוריות","זיהוי אוטומטי של קטגוריות מהקובץ"),
                 ("📑","תמיכה מלאה","Excel, CSV, מרובה גליונות")]
        html = '<div class="feat-row">'
        for ic, t, d in feats:
            html += f'<div class="feat"><div class="feat-icon">{ic}</div><div class="feat-title">{t}</div><div class="feat-desc">{d}</div></div>'
        html += '</div>'
        st.markdown(html, unsafe_allow_html=True)
        return

    # Load
    with st.spinner('טוען...'):
        sheets = load_excel(uploaded) if uploaded.name.endswith(('.xlsx','.xls')) else {'main': load_csv(uploaded)}
    if not sheets or (len(sheets)==1 and list(sheets.values())[0].empty):
        st.markdown(f'<div class="alert alert-err"><span class="alert-icon">❌</span><div><div class="alert-text">שגיאה בטעינה</div><div class="alert-sub">וודא שהקובץ תקין</div></div></div>', unsafe_allow_html=True)
        return

    # Sheet selection
    if len(sheets) > 1:
        selected = st.multiselect("בחר גליונות", list(sheets.keys()), default=list(sheets.keys()))
        if not selected: st.warning("בחר לפחות גליון אחד"); return
        df_raw = pd.concat([sheets[s].assign(_s=s) for s in selected], ignore_index=True)
    else:
        df_raw = list(sheets.values())[0]

    # Detect columns
    date_col = find_column(df_raw, ['תאריך עסקה','תאריך'])
    amount_col = detect_amount_column(df_raw)
    desc_col = find_column(df_raw, ['שם בית העסק','תיאור'])
    cat_col = find_column(df_raw, ['קטגוריה'])

    if not all([date_col, amount_col, desc_col]):
        st.markdown(f'<div class="section-label">⚙️ הגדרה ידנית</div>', unsafe_allow_html=True)
        cols = df_raw.columns.tolist()
        c1, c2 = st.columns(2)
        with c1:
            date_col = st.selectbox("📅 תאריך", cols)
            amount_col = st.selectbox("💰 סכום", cols)
        with c2:
            desc_col = st.selectbox("📝 תיאור", cols)
            cat_col = st.selectbox("🏷️ קטגוריה", ['ללא'] + cols)
            cat_col = None if cat_col == 'ללא' else cat_col
        if not st.button("▶️ המשך", use_container_width=True): st.stop()

    # Process
    try:
        df = process_data(df_raw, date_col, amount_col, desc_col, cat_col)
        if df.empty:
            st.markdown(f'<div class="alert alert-err"><span class="alert-icon">📭</span><div><div class="alert-text">לא נמצאו עסקאות</div></div></div>', unsafe_allow_html=True)
            return
        dr = f"{df['תאריך'].min().strftime('%d/%m/%Y')} — {df['תאריך'].max().strftime('%d/%m/%Y')}"
        st.markdown(f'''<div class="alert alert-ok">
            <span class="alert-icon">✅</span>
            <div><div class="alert-text">נטענו {len(df):,} עסקאות</div><div class="alert-sub">{dr}</div></div>
            <div class="alert-badge">{df['קטגוריה'].nunique()} קטגוריות</div>
        </div>''', unsafe_allow_html=True)
    except Exception as e:
        st.markdown(f'<div class="alert alert-err"><span class="alert-icon">❌</span><div><div class="alert-text">שגיאה</div><div class="alert-sub">{e}</div></div></div>', unsafe_allow_html=True)
        return

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
    tabs = st.tabs(["📊 סקירה","📈 מגמות","🏪 בתי עסק","📋 עסקאות","💰 הכנסות ותקציב"])

    with tabs[0]:
        c1, c2 = st.columns([3, 2])
        with c1:
            st.markdown(f'<div class="section-label">📅 הוצאות חודשיות</div>', unsafe_allow_html=True)
            st.plotly_chart(chart_monthly(df_f), use_container_width=True, key="m")
            st.markdown(f'<div class="section-label">📆 לפי יום בשבוע</div>', unsafe_allow_html=True)
            st.plotly_chart(chart_weekday(df_f), use_container_width=True, key="w")
        with c2:
            st.markdown(f'<div class="section-label">🥧 לפי קטגוריה</div>', unsafe_allow_html=True)
            st.plotly_chart(chart_donut(df_f), use_container_width=True, key="d")
            st.markdown(f'<div class="section-label">📋 פירוט</div>', unsafe_allow_html=True)
            render_categories(df_f)

    with tabs[1]:
        st.markdown(f'<div class="section-label">📈 מאזן מצטבר</div>', unsafe_allow_html=True)
        st.plotly_chart(chart_trend(df_f), use_container_width=True, key="t")
        exp = df_f[df_f['סכום'] < 0]
        if len(exp) > 0:
            st.markdown(f'<div class="section-label">📊 סטטיסטיקות</div>', unsafe_allow_html=True)
            c1,c2,c3,c4 = st.columns(4)
            stats = [
                ('הוצאה מקסימלית', fmt(exp['סכום_מוחלט'].max()), T['red']),
                ('הוצאה מינימלית', fmt(exp['סכום_מוחלט'].min()), T['green']),
                ('חציון', fmt(exp['סכום_מוחלט'].median()), T['accent']),
                ('קטגוריות', str(df_f['קטגוריה'].nunique()), T['amber']),
            ]
            for col, (label, val, color) in zip([c1,c2,c3,c4], stats):
                with col:
                    st.markdown(f'''<div class="kpi" style="padding:1rem">
                        <div style="color:{T['text2']};font-size:0.78rem;margin-bottom:6px">{label}</div>
                        <div style="color:{color};font-size:1.4rem;font-weight:700">{val}</div>
                    </div>''', unsafe_allow_html=True)

    with tabs[2]:
        st.markdown(f'<div class="section-label">🏆 בתי עסק מובילים</div>', unsafe_allow_html=True)
        
        # Professional count selector
        if 'merchant_count' not in st.session_state:
            st.session_state.merchant_count = 8
        
        st.markdown(f'<div style="color:{T["text2"]};font-size:0.85rem;margin-bottom:0.5rem">מספר בתי עסק להצגה:</div>', unsafe_allow_html=True)
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

    with tabs[3]:
        st.markdown(f'<div class="section-label">📋 עסקאות</div>', unsafe_allow_html=True)
        col1, _ = st.columns([2, 3])
        with col1:
            sort = st.selectbox("מיון", ['תאריך ↓','תאריך ↑','סכום ↓','סכום ↑'])
        smap = {'תאריך ↓':('תאריך',False),'תאריך ↑':('תאריך',True),'סכום ↓':('סכום_מוחלט',False),'סכום ↑':('סכום_מוחלט',True)}
        sc, sa = smap[sort]
        view = df_f.sort_values(sc, ascending=sa)[['תאריך','תיאור','קטגוריה','סכום']].copy()
        st.dataframe(view,
            column_config={
                "תאריך": st.column_config.DateColumn("תאריך", format="DD/MM/YYYY", width="small"),
                "תיאור": st.column_config.TextColumn("בית עסק", width="large"),
                "קטגוריה": st.column_config.TextColumn("קטגוריה", width="medium"),
                "סכום": st.column_config.NumberColumn("סכום (₪)", format="₪%.2f", width="small"),
            },
            hide_index=True, use_container_width=True, height=500)
        st.markdown(f'<div style="color:{T["text3"]};font-size:0.82rem;margin-top:0.5rem;text-align:center">{len(view):,} עסקאות</div>', unsafe_allow_html=True)

    with tabs[4]:
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


if __name__ == "__main__":
    main()
