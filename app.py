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
    init_auth_state, is_configured, is_logged_in, get_current_user, get_supabase,
    sign_in, sign_up, reset_password, logout,
    save_income, load_incomes, delete_all_incomes,
    save_upload_history, load_upload_history,
    save_user_settings, load_user_settings,
    save_transactions, load_transactions, delete_transactions, delete_all_user_data,
    save_file_transactions, delete_file_transactions, list_saved_files,
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
st.markdown('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">', unsafe_allow_html=True)
st.markdown(f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap');

/* === Reset & Base === */
*, *::before, *::after {{ font-family: 'Heebo', sans-serif !important; box-sizing: border-box; }}
html, body, .stApp {{
    background: {T['bg']} !important; color: {T['text1']}; direction: rtl; text-align: right;
    {'background-image: radial-gradient(ellipse at 70% 10%, rgba(129,140,248,0.04) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(139,92,246,0.03) 0%, transparent 50%) !important;' if IS_DARK else ''}
}}
/* Smooth rendering */
* {{ -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }}
img, svg {{ display: block; max-width: 100%; }}
/* Smooth transitions globally */
.kpi, .cat-card, .feat, div[data-testid="stPlotlyChart"] {{ transition: all 0.2s cubic-bezier(0.4,0,0.2,1); }}

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
    background: {'linear-gradient(180deg, #0f1525 0%, #0c111d 100%)' if IS_DARK else '#ffffff'} !important;
    border-left: 1px solid {T['border']};
    min-width: 280px !important; max-width: 310px !important; width: 295px !important;
    box-shadow: {'-4px 0 20px rgba(0,0,0,0.15)' if IS_DARK else '-2px 0 10px rgba(0,0,0,0.04)'};
}}
section[data-testid="stSidebar"] > div {{
    direction: rtl; text-align: right;
    padding: 1.5rem 1.25rem 3rem;
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
    text-align: center; padding: 1.25rem 0 0.25rem;
}}
.dash-title {{
    font-size: 1.75rem; font-weight: 800;
    background: linear-gradient(135deg, {T['accent']}, #a78bfa);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; margin: 0;
}}
.dash-subtitle {{
    color: {T['text2']}; font-size: 0.88rem; margin-top: 2px;
}}
.section-label {{
    display: flex; align-items: center; gap: 8px;
    color: {T['text1']}; font-weight: 700; font-size: 0.95rem;
    margin: 0.75rem 0 0.85rem; padding-bottom: 0.6rem;
    border-bottom: 2px solid {T['border']};
    letter-spacing: 0.2px;
}}

/* === KPI Cards === */
.kpi-row {{ display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; margin: 1.25rem 0; }}
@media(max-width:900px) {{ .kpi-row {{ grid-template-columns: repeat(2,1fr); }} }}
@media(max-width:500px) {{ .kpi-row {{ grid-template-columns: 1fr; }} }}
.kpi {{
    background: {T['surface']};
    border: 1px solid {T['border']};
    border-radius: 16px; padding: 1.25rem 1rem; text-align: center;
    position: relative; overflow: hidden;
}}
.kpi::before {{
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg, {T['accent']}, #a78bfa);
    opacity: 0; transition: opacity 0.2s;
}}
.kpi:hover::before {{ opacity: 1; }}
.kpi-icon {{
    width: 48px; height: 48px; border-radius: 14px; margin: 0 auto 12px;
    display: flex; align-items: center; justify-content: center; font-size: 1.5rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}}
.kpi-val {{ font-size: 1.65rem; font-weight: 800; color: {T['text1']}; direction: ltr; letter-spacing: -0.5px; }}
.kpi-label {{ font-size: 0.78rem; color: {T['text2']}; margin-top: 4px; letter-spacing: 0.5px; text-transform: uppercase; }}

/* === Category Cards === */
.cat-card {{
    background: {T['surface']};
    border: 1px solid {T['border']};
    border-radius: 14px; padding: 0.9rem 1.1rem;
    margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.9rem;
    transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
    cursor: default;
}}
.cat-card:hover {{ border-color: {T['accent']}40; background: {T['surface2']}; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }}
.cat-icon {{
    width: 40px; height: 40px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;
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
    border-radius: 14px; padding: 0.9rem 1.25rem; margin: 0.75rem 0;
    display: flex; align-items: center; gap: 0.85rem; direction: rtl;
    backdrop-filter: blur(8px);
}}
.alert-ok {{ background: {T['green_bg']}; border: 1px solid rgba(52,211,153,0.2); box-shadow: 0 2px 8px rgba(52,211,153,0.06); }}
.alert-ok .alert-text {{ color: {T['green']}; }}
.alert-err {{ background: {T['red_bg']}; border: 1px solid rgba(248,113,113,0.2); box-shadow: 0 2px 8px rgba(248,113,113,0.06); }}
.alert-err .alert-text {{ color: {T['red']}; }}
.alert-icon {{ font-size: 1.25rem; }}
.alert-text {{ font-weight: 700; font-size: 0.88rem; }}
.alert-sub {{ color: {T['text2']}; font-size: 0.78rem; }}
.alert-badge {{
    margin-right: auto; margin-left: 0;
    background: rgba(52,211,153,0.15); color: {T['green']};
    padding: 0.3rem 0.75rem; border-radius: 99px; font-size: 0.78rem; font-weight: 700;
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
.stTabs [data-baseweb="tab-list"] {{
    gap: 2px; background: {T['surface']}; border-radius: 12px; padding: 4px;
    direction: rtl; border: 1px solid {T['border']};
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}}
.stTabs [data-baseweb="tab"] {{
    background: transparent; border-radius: 10px; color: {T['text3']};
    padding: 0.55rem 0.9rem; font-weight: 500; font-size: 0.85rem;
    transition: all 0.15s ease;
}}
.stTabs [data-baseweb="tab"]:hover {{ color: {T['text1']}; background: {T['surface2']}; }}
.stTabs [aria-selected="true"] {{
    background: linear-gradient(135deg, {T['accent']}, #a78bfa) !important;
    color: #fff !important;
    box-shadow: 0 2px 12px rgba(129,140,248,0.3);
    font-weight: 600 !important;
}}

/* === Chart containers === */
div[data-testid="stPlotlyChart"] {{
    background: {T['surface']}; border: 1px solid {T['border']};
    border-radius: 16px; padding: 1rem; margin-bottom: 0.85rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}}

/* === Buttons === */
.stButton > button {{
    background: linear-gradient(135deg, {T['accent']}, #a78bfa); color: #fff;
    border: none; border-radius: 10px; font-weight: 600; padding: 0.55rem 1.5rem;
    box-shadow: 0 2px 8px rgba(129,140,248,0.2);
    transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
}}
.stButton > button:hover {{ transform: translateY(-1px); box-shadow: 0 4px 16px rgba(129,140,248,0.3); }}
.stButton > button:active {{ transform: translateY(0); }}
.stDownloadButton > button {{
    background: linear-gradient(135deg, {T['green']}, #059669); color: #fff;
    border: none; border-radius: 10px; font-weight: 600;
    box-shadow: 0 2px 8px rgba(52,211,153,0.2);
}}
.stDownloadButton > button:hover {{ transform: translateY(-1px); box-shadow: 0 4px 16px rgba(52,211,153,0.3); }}
/* Sidebar buttons - more subtle */
section[data-testid="stSidebar"] .stButton > button {{
    background: {T['surface2']} !important; color: {T['text1']} !important;
    border: 1px solid {T['border']} !important; font-size: 0.85rem !important;
    padding: 0.45rem 1rem !important; font-weight: 500 !important;
}}
section[data-testid="stSidebar"] .stButton > button:hover {{
    background: {T['border_h']} !important; opacity: 1 !important;
}}

/* === Slider === */
.stSlider [data-baseweb="slider"] div {{ background: {T['accent']} !important; }}
.stSlider [data-baseweb="slider"] [role="slider"] {{ background: {T['accent']} !important; border-color: {T['accent']} !important; }}

/* === Scrollbar === */
::-webkit-scrollbar {{ width: 5px; height: 5px; }}
::-webkit-scrollbar-track {{ background: transparent; }}
::-webkit-scrollbar-thumb {{ background: {T['border_h']}; border-radius: 99px; }}
::-webkit-scrollbar-thumb:hover {{ background: {T['text3']}; }}

/* === Dataframe === */
[data-testid="stDataFrame"] {{ border-radius: 12px; overflow: hidden; border: 1px solid {T['border']}; }}

/* === Divider === */
hr {{ border: none; height: 1px; background: {T['border']}; margin: 1.25rem 0; }}

/* === Number input === */
[data-testid="stNumberInput"] input {{ background: {T['input']} !important; border: 1px solid {T['border']} !important; border-radius: 8px !important; color: {T['text1']} !important; direction: ltr !important; text-align: right !important; }}
[data-testid="stNumberInput"] button {{ background: {T['surface2']} !important; color: {T['text1']} !important; border: 1px solid {T['border']} !important; }}

/* === Spinner === */
.stSpinner > div {{ border-color: {T['accent']} transparent transparent transparent !important; }}

/* === Expander === */
[data-testid="stExpander"] {{ background: {T['surface']} !important; border: 1px solid {T['border']} !important; border-radius: 12px !important; }}
[data-testid="stExpander"] summary {{ color: {T['text1']} !important; }}

/* === Tab panel smooth entrance === */
[data-baseweb="tab-panel"] {{ animation: fadeIn 0.25s ease-out; }}
@keyframes fadeIn {{ from {{ opacity: 0; transform: translateY(6px); }} to {{ opacity: 1; transform: translateY(0); }} }}

/* === KPI hover lift === */
.kpi:hover {{ transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.15); }}
.cat-card:hover {{ transform: translateX(-3px); }}

/* === Responsive – Tablet (768px) === */
@media(max-width:768px) {{
    .kpi-row {{ grid-template-columns: repeat(2,1fr) !important; gap: 0.75rem !important; }}
    .kpi-val {{ font-size: 1.3rem !important; }}
    .kpi {{ padding: 1rem 0.75rem !important; }}
    .feat-row {{ grid-template-columns: 1fr !important; }}
    .feat {{ padding: 1.25rem 1rem !important; }}
    .feat-icon {{ font-size: 1.5rem !important; }}
    .flow-row {{ gap: 0.75rem !important; }}
    .flow-card {{ padding: 1.1rem 1rem !important; }}
    .flow-val {{ font-size: 1.5rem !important; }}
    .flow-icon {{ width: 42px !important; height: 42px !important; font-size: 1.3rem !important; }}
    .mom-grid {{ grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important; }}
    .compare-summary {{ grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) !important; }}
    .compare-card {{ padding: 1rem !important; border-radius: 14px !important; }}
    .compare-month {{ font-size: 1rem !important; }}
    .compare-stat {{ gap: 0.75rem !important; }}
    .dash-title {{ font-size: 1.35rem !important; }}
    .section-label {{ font-size: 0.88rem !important; }}
    .insight-highlight {{ padding: 1rem !important; }}
    .pace-container {{ padding: 0.75rem 1rem !important; }}
    .section-divider {{ margin: 1.25rem 0 !important; }}
    div[data-testid="stPlotlyChart"] {{ padding: 0.6rem !important; border-radius: 12px !important; }}

    /* Sidebar: full-width overlay on tablet */
    section[data-testid="stSidebar"] {{
        min-width: 260px !important; max-width: 280px !important;
    }}

    /* Tabs: scroll horizontally */
    .stTabs [data-baseweb="tab-list"] {{
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        padding: 3px !important;
    }}
    .stTabs [data-baseweb="tab-list"]::-webkit-scrollbar {{ display: none; }}
    .stTabs [data-baseweb="tab"] {{ white-space: nowrap !important; font-size: 0.8rem !important; padding: 0.45rem 0.7rem !important; }}
}}

/* === Responsive – Phone (480px) === */
@media(max-width:480px) {{
    /* Sidebar: full screen overlay on phone */
    section[data-testid="stSidebar"] {{
        min-width: 100vw !important; max-width: 100vw !important; width: 100vw !important;
    }}
    section[data-testid="stSidebar"] > div {{
        padding: 1rem 0.75rem 2rem !important;
    }}

    /* Typography */
    .dash-title {{ font-size: 1.15rem !important; }}
    .dash-subtitle {{ font-size: 0.8rem !important; }}
    .section-label {{ font-size: 0.82rem !important; margin: 0.5rem 0 0.6rem !important; padding-bottom: 0.4rem !important; }}

    /* KPI cards */
    .kpi-row {{ grid-template-columns: repeat(2,1fr) !important; gap: 0.5rem !important; margin: 0.75rem 0 !important; }}
    .kpi {{ padding: 0.75rem 0.5rem !important; border-radius: 12px !important; }}
    .kpi-val {{ font-size: 1.1rem !important; }}
    .kpi-label {{ font-size: 0.68rem !important; }}
    .kpi-icon {{ width: 38px !important; height: 38px !important; font-size: 1.2rem !important; margin-bottom: 8px !important; border-radius: 10px !important; }}

    /* Category cards */
    .cat-card {{ padding: 0.65rem 0.8rem !important; }}
    .cat-icon {{ width: 34px !important; height: 34px !important; font-size: 1rem !important; }}
    .cat-name {{ font-size: 0.78rem !important; }}
    .cat-amount {{ font-size: 0.8rem !important; }}

    /* Feature cards (empty state) */
    .feat {{ padding: 1rem 0.75rem !important; border-radius: 12px !important; }}
    .feat-icon {{ font-size: 1.3rem !important; margin-bottom: 0.5rem !important; }}
    .feat-title {{ font-size: 0.88rem !important; }}
    .feat-desc {{ font-size: 0.75rem !important; }}

    /* Flow cards */
    .flow-row {{ gap: 0.5rem !important; margin: 0.75rem 0 !important; }}
    .flow-card {{ padding: 0.9rem 0.75rem !important; border-radius: 14px !important; }}
    .flow-val {{ font-size: 1.25rem !important; }}
    .flow-label {{ font-size: 0.75rem !important; }}
    .flow-icon {{ width: 38px !important; height: 38px !important; font-size: 1.2rem !important; margin-bottom: 0.6rem !important; }}
    .flow-mini {{ font-size: 0.7rem !important; margin-top: 0.5rem !important; padding-top: 0.5rem !important; }}

    /* MoM cards */
    .mom-grid {{ grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)) !important; gap: 0.5rem !important; }}
    .mom-card {{ padding: 0.7rem 0.5rem !important; border-radius: 10px !important; }}
    .mom-arrow {{ font-size: 1.2rem !important; }}

    /* Compare cards */
    .compare-card {{ border-radius: 12px !important; padding: 0.85rem !important; }}
    .compare-month {{ font-size: 0.95rem !important; }}
    .compare-stat {{ gap: 0.5rem !important; flex-wrap: wrap !important; }}
    .compare-stat-val {{ font-size: 0.88rem !important; }}
    .compare-stat-label {{ font-size: 0.6rem !important; }}
    .compare-summary {{ grid-template-columns: repeat(2, 1fr) !important; gap: 0.5rem !important; }}
    .compare-summary-card {{ padding: 0.7rem !important; }}

    /* Diff badges */
    .diff-badge {{ font-size: 0.7rem !important; padding: 0.2rem 0.5rem !important; }}

    /* Recurring cards */
    .recurring-card {{ padding: 0.7rem 0.8rem !important; gap: 0.6rem !important; }}

    /* Charts */
    div[data-testid="stPlotlyChart"] {{ padding: 0.4rem !important; border-radius: 10px !important; margin-bottom: 0.5rem !important; }}

    /* Alerts */
    .alert {{ padding: 0.7rem 0.9rem !important; gap: 0.6rem !important; border-radius: 10px !important; }}
    .alert-icon {{ font-size: 1rem !important; }}
    .alert-text {{ font-size: 0.8rem !important; }}
    .alert-sub {{ font-size: 0.7rem !important; }}

    /* Insight highlights */
    .insight-highlight {{ padding: 0.85rem !important; border-radius: 14px !important; }}

    /* Gauge */
    .gauge-ring {{ width: 110px !important; height: 110px !important; }}
    .gauge-inner {{ width: 85px !important; height: 85px !important; }}
    .gauge-container {{ padding: 0.75rem !important; }}

    /* Pace */
    .pace-container {{ padding: 0.6rem 0.75rem !important; }}

    /* Section divider */
    .section-divider {{ margin: 1rem 0 !important; }}

    /* Tabs: compact */
    .stTabs [data-baseweb="tab"] {{ padding: 0.4rem 0.55rem !important; font-size: 0.73rem !important; }}
    .stTabs [data-baseweb="tab-list"] {{ border-radius: 10px !important; }}

    /* Buttons */
    .stButton > button {{ padding: 0.45rem 1rem !important; font-size: 0.82rem !important; border-radius: 8px !important; }}

    /* Form controls */
    [data-baseweb="select"] > div {{ border-radius: 8px !important; }}
}}

/* === Very small phones (360px) === */
@media(max-width:360px) {{
    .kpi-row {{ grid-template-columns: 1fr !important; }}
    .mom-grid {{ grid-template-columns: repeat(2, 1fr) !important; }}
    .compare-summary {{ grid-template-columns: 1fr !important; }}
    .flow-row {{ grid-template-columns: 1fr !important; }}
    .dash-title {{ font-size: 1rem !important; }}
}}

/* === Touch-friendly improvements === */
@media(hover: none) and (pointer: coarse) {{
    /* Disable hover transforms on touch devices (causes sticky hover) */
    .kpi:hover, .cat-card:hover, .feat:hover, .flow-card:hover,
    .mom-card:hover, .compare-card:hover, .recurring-card:hover {{
        transform: none !important;
    }}
    /* Larger tap targets */
    .stTabs [data-baseweb="tab"] {{ min-height: 44px !important; }}
    .stButton > button {{ min-height: 44px !important; }}
    [data-baseweb="select"] > div {{ min-height: 44px !important; }}
    [data-testid="stTextInput"] input {{ min-height: 44px !important; }}
    /* Smooth scrolling */
    html {{ -webkit-overflow-scrolling: touch; scroll-behavior: smooth; }}
}}

/* === Glassmorphism Compare Cards === */
.compare-card {{
    background: {T['surface']}cc;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid {T['border']};
    border-radius: 18px;
    padding: 1.25rem;
    position: relative;
    overflow: hidden;
    transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
    margin-bottom: 0.75rem;
}}
.compare-card::before {{
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, {T['accent']}, #a78bfa, {T['accent']});
    background-size: 200% 100%;
    animation: gradientShift 3s ease infinite;
}}
.compare-card:hover {{
    border-color: {T['accent']}40;
    box-shadow: 0 8px 32px rgba(129,140,248,0.12);
    transform: translateY(-2px);
}}
.compare-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0;
}}
.compare-month {{
    font-size: 1.15rem;
    font-weight: 800;
    background: linear-gradient(135deg, {T['accent']}, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}}
.compare-stat {{
    display: flex;
    gap: 1.25rem;
    align-items: center;
}}
.compare-stat-item {{
    text-align: center;
}}
.compare-stat-val {{
    font-size: 1.05rem;
    font-weight: 700;
    color: {T['text1']};
    direction: ltr;
}}
.compare-stat-label {{
    font-size: 0.68rem;
    color: {T['text3']};
    text-transform: uppercase;
    letter-spacing: 0.3px;
}}

/* === Diff Badges === */
.diff-badge {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0.3rem 0.75rem;
    border-radius: 99px;
    font-size: 0.78rem;
    font-weight: 700;
    direction: ltr;
}}
.diff-badge.up {{
    background: {T['red_bg']};
    color: {T['red']};
}}
.diff-badge.down {{
    background: {T['green_bg']};
    color: {T['green']};
}}
.diff-badge.neutral {{
    background: {T['surface2']};
    color: {T['text3']};
}}

/* === Recurring Payment Cards === */
.recurring-card {{
    background: {T['surface']}cc;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid {T['border']};
    border-radius: 14px;
    padding: 1rem 1.1rem;
    display: flex;
    align-items: center;
    gap: 0.9rem;
    margin-bottom: 0.5rem;
    transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
    position: relative;
    overflow: hidden;
}}
.recurring-card::after {{
    content: '\U0001f504';
    position: absolute;
    top: 8px;
    left: 8px;
    font-size: 0.65rem;
    opacity: 0.4;
}}
.recurring-card:hover {{
    border-color: {T['accent']}40;
    background: {T['surface2']}cc;
    transform: translateX(-3px);
}}

/* === Category MoM Cards === */
.mom-card {{
    background: {T['surface']};
    border: 1px solid {T['border']};
    border-radius: 14px;
    padding: 1rem;
    text-align: center;
    transition: all 0.2s;
}}
.mom-card:hover {{
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}}
.mom-arrow {{
    font-size: 1.5rem;
    margin: 0.25rem 0;
}}
.mom-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-top: 0.75rem;
}}

/* === Spending Pace Bar === */
.pace-container {{
    background: {T['surface']};
    border: 1px solid {T['border']};
    border-radius: 14px;
    padding: 1rem 1.25rem;
    margin-bottom: 1rem;
}}
.pace-bar-bg {{
    height: 12px;
    background: {T['surface2']};
    border-radius: 99px;
    overflow: hidden;
    position: relative;
    margin: 0.75rem 0 0.5rem;
}}
.pace-bar {{
    height: 100%;
    border-radius: 99px;
    transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
}}
.pace-marker {{
    position: absolute;
    top: -6px;
    width: 3px;
    height: 24px;
    background: {T['text1']};
    border-radius: 2px;
    opacity: 0.6;
}}

/* === Comparison Summary === */
.compare-summary {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-top: 1.25rem;
}}
.compare-summary-card {{
    background: {T['surface']}cc;
    backdrop-filter: blur(10px);
    border: 1px solid {T['border']};
    border-radius: 14px;
    padding: 1rem;
    text-align: center;
}}

/* === Section Dividers Enhanced === */
.section-divider {{
    height: 1px;
    background: linear-gradient(90deg, transparent, {T['border_h']}, transparent);
    margin: 1.75rem 0;
}}

/* === Gradient Animated Border Keyframe === */
@keyframes gradientShift {{
    0% {{ background-position: 0% 50%; }}
    50% {{ background-position: 100% 50%; }}
    100% {{ background-position: 0% 50%; }}
}}

/* === Enhanced KPI Glow === */
.kpi:hover {{
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 0 20px rgba(129,140,248,0.08);
}}

/* === Print === */
@media print {{ section[data-testid="stSidebar"] {{ display: none !important; }} }}

/* === Cash Flow Cards === */
.flow-row {{ display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; margin: 1.25rem 0; }}
@media(max-width:768px) {{ .flow-row {{ grid-template-columns: 1fr; }} }}
.flow-card {{
    background: {T['surface']};
    border: 1px solid {T['border']};
    border-radius: 18px;
    padding: 1.5rem 1.25rem;
    position: relative;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
}}
.flow-card::before {{
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    border-radius: 18px 18px 0 0;
}}
.flow-card:hover {{
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.12);
}}
.flow-card.income::before {{ background: linear-gradient(90deg, #34d399, #059669); }}
.flow-card.expense::before {{ background: linear-gradient(90deg, #f87171, #dc2626); }}
.flow-card.balance::before {{ background: linear-gradient(90deg, #818cf8, #6d28d9); }}
.flow-card.income:hover {{ box-shadow: 0 12px 40px rgba(52,211,153,0.15); }}
.flow-card.expense:hover {{ box-shadow: 0 12px 40px rgba(248,113,113,0.15); }}
.flow-card.balance:hover {{ box-shadow: 0 12px 40px rgba(129,140,248,0.15); }}
.flow-icon {{
    width: 52px; height: 52px; border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.6rem; margin-bottom: 1rem;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}}
.flow-val {{
    font-size: 2rem; font-weight: 800; direction: ltr;
    letter-spacing: -1px; line-height: 1.2;
}}
.flow-label {{
    font-size: 0.82rem; color: {T['text2']}; margin-top: 4px;
    font-weight: 500; letter-spacing: 0.3px;
}}
.flow-mini {{
    display: flex; align-items: center; gap: 6px;
    margin-top: 0.75rem; padding-top: 0.75rem;
    border-top: 1px solid {T['border']};
    font-size: 0.78rem; color: {T['text3']};
}}
.flow-mini-badge {{
    padding: 2px 8px; border-radius: 6px;
    font-size: 0.72rem; font-weight: 700;
}}

/* === Income vs Expense Bar === */
.ie-bar-container {{
    display: flex; height: 10px; border-radius: 99px;
    overflow: hidden; background: {T['surface2']};
    margin: 0.5rem 0;
}}
.ie-bar-income {{ background: linear-gradient(90deg, #34d399, #059669); height: 100%; transition: width 0.6s ease; }}
.ie-bar-expense {{ background: linear-gradient(90deg, #f87171, #dc2626); height: 100%; transition: width 0.6s ease; }}

/* === Gauge Chart === */
.gauge-container {{
    display: flex; flex-direction: column; align-items: center;
    padding: 1.25rem;
}}
.gauge-ring {{
    width: 140px; height: 140px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    position: relative;
}}
.gauge-inner {{
    width: 110px; height: 110px; border-radius: 50%;
    background: {T['surface']};
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.1);
}}

/* === Staggered card entrance === */
@keyframes slideInUp {{
    from {{ opacity: 0; transform: translateY(20px); }}
    to {{ opacity: 1; transform: translateY(0); }}
}}
.stagger-1 {{ animation: slideInUp 0.4s ease-out 0.05s both; }}
.stagger-2 {{ animation: slideInUp 0.4s ease-out 0.12s both; }}
.stagger-3 {{ animation: slideInUp 0.4s ease-out 0.19s both; }}
.stagger-4 {{ animation: slideInUp 0.4s ease-out 0.26s both; }}

/* === Insight Highlight Cards === */
.insight-highlight {{
    background: linear-gradient(135deg, {T['surface']}, {T['surface2']});
    border: 1px solid {T['border']};
    border-radius: 18px;
    padding: 1.5rem;
    text-align: center;
    position: relative;
    overflow: hidden;
}}
.insight-highlight::after {{
    content: '';
    position: absolute;
    top: -50%; right: -50%;
    width: 100%; height: 100%;
    background: radial-gradient(circle, rgba(129,140,248,0.06) 0%, transparent 70%);
    pointer-events: none;
}}

/* === Pulse glow for important numbers === */
@keyframes pulseGlow {{
    0%, 100% {{ text-shadow: 0 0 0 transparent; }}
    50% {{ text-shadow: 0 0 20px rgba(129,140,248,0.3); }}
}}
.glow-number {{ animation: pulseGlow 3s ease-in-out infinite; }}

/* === Monthly flow mini-bars === */
.minibar-row {{
    display: flex; gap: 3px; align-items: flex-end;
    height: 40px; margin-top: 0.5rem;
}}
.minibar {{
    flex: 1; border-radius: 3px 3px 0 0;
    min-width: 4px; transition: height 0.4s ease;
}}
</style>
""", unsafe_allow_html=True)

# =============================================================================
# JavaScript enhancements
# =============================================================================
st.markdown(f"""
<script>
// === Animated counter for KPI values with easing ===
function animateCounters() {{
    document.querySelectorAll('.kpi-val, .flow-val').forEach(el => {{
        if (el.dataset.animated) return;
        el.dataset.animated = 'true';
        const text = el.innerText;
        const match = text.match(/[\\d,]+/);
        if (!match) return;
        const target = parseInt(match[0].replace(/,/g, ''));
        if (isNaN(target) || target === 0) return;
        const prefix = text.slice(0, text.indexOf(match[0]));
        const suffix = text.slice(text.indexOf(match[0]) + match[0].length);
        const duration = 1000;
        const start = performance.now();
        function step(now) {{
            const progress = Math.min((now - start) / duration, 1);
            // Exponential ease-out for professional feel
            const ease = 1 - Math.pow(1 - progress, 4);
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {{
        e.preventDefault();
        const searchInput = document.querySelector('[data-testid="stTextInput"] input');
        if (searchInput) searchInput.focus();
    }}
}});

// === Scroll-reveal animations ===
function initScrollReveal() {{
    const observer = new IntersectionObserver((entries) => {{
        entries.forEach(entry => {{
            if (entry.isIntersecting) {{
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }}
        }});
    }}, {{ threshold: 0.1, rootMargin: '0px 0px -40px 0px' }});

    document.querySelectorAll('.flow-card, .compare-card, .insight-highlight, .cat-card').forEach(el => {{
        if (el.dataset.revealed) return;
        el.dataset.revealed = 'true';
        el.style.opacity = '0';
        el.style.transform = 'translateY(15px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    }});
}}

// === Sparkline mini charts in flow cards ===
function drawMiniSparklines() {{
    document.querySelectorAll('.minibar-row').forEach(row => {{
        if (row.dataset.drawn) return;
        row.dataset.drawn = 'true';
        const bars = row.querySelectorAll('.minibar');
        bars.forEach((bar, i) => {{
            const h = bar.dataset.height || '0';
            setTimeout(() => {{ bar.style.height = h + '%'; }}, i * 50);
        }});
    }});
}}

// === Tooltip for KPI cards ===
function addKpiTooltips() {{
    document.querySelectorAll('.kpi, .flow-card').forEach(el => {{
        if (el.dataset.tipped) return;
        el.dataset.tipped = 'true';
        el.style.cursor = 'default';
        const label = el.querySelector('.kpi-label, .flow-label');
        if (label) el.title = label.innerText;
    }});
}}

// === Number hover effect ===
function addNumberHover() {{
    document.querySelectorAll('.flow-val, .kpi-val').forEach(el => {{
        if (el.dataset.hovered) return;
        el.dataset.hovered = 'true';
        el.addEventListener('mouseenter', () => {{
            el.style.transform = 'scale(1.05)';
            el.style.transition = 'transform 0.2s ease';
        }});
        el.addEventListener('mouseleave', () => {{
            el.style.transform = 'scale(1)';
        }});
    }});
}}

// === Init ===
const initAll = () => {{
    animateCounters(); initSmoothTabs(); addKpiTooltips();
    initScrollReveal(); drawMiniSparklines(); addNumberHover();
}};
if (document.readyState === 'complete') setTimeout(initAll, 400);
else window.addEventListener('load', () => setTimeout(initAll, 400));

// Debounced observer for Streamlit rerenders
let _animTimeout;
const observer = new MutationObserver(() => {{
    clearTimeout(_animTimeout);
    _animTimeout = setTimeout(() => {{
        animateCounters(); addKpiTooltips();
        initScrollReveal(); drawMiniSparklines(); addNumberHover();
    }}, 150);
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
    """Base layout for all charts -- optimized for speed, dark/light theme, and mobile."""
    base = dict(
        paper_bgcolor=T['chart_bg'], plot_bgcolor=T['chart_bg'],
        font=dict(family='Heebo', color=T['text2'], size=12),
        margin=dict(t=16, b=36, l=40, r=12),
        hoverlabel=dict(bgcolor=T['surface'], font_size=12, font_family='Heebo', bordercolor=T['border_h']),
        xaxis=dict(gridcolor=T['grid'], tickfont=dict(color=T['text2'], size=10), showgrid=False, zeroline=False),
        yaxis=dict(gridcolor=T['grid'], tickfont=dict(color=T['text2'], size=10), showgrid=True, zeroline=False, gridwidth=1),
        dragmode=False,
        modebar_remove=['zoom','pan','select','lasso','zoomIn','zoomOut','autoScale','resetScale'],
        autosize=True,
    )
    base.update(kw)
    return base

# =============================================================================
# Smart Analysis Functions
# =============================================================================
def detect_recurring_payments(df):
    """Detect merchants that appear across 2+ months with consistent amounts."""
    exp = df[df['סכום'] < 0].copy()
    if exp.empty or exp['חודש'].nunique() < 2:
        return pd.DataFrame()
    merchant_months = exp.groupby(['תיאור', 'חודש']).agg(
        monthly_total=('סכום_מוחלט', 'sum'),
        count=('סכום_מוחלט', 'count')
    ).reset_index()
    merchant_month_counts = merchant_months.groupby('תיאור')['חודש'].nunique()
    recurring_merchants = merchant_month_counts[merchant_month_counts >= 2].index
    if len(recurring_merchants) == 0:
        return pd.DataFrame()
    results = []
    for merchant in recurring_merchants:
        m_data = merchant_months[merchant_months['תיאור'] == merchant]
        amounts = m_data['monthly_total'].values
        avg = amounts.mean()
        std = amounts.std() if len(amounts) > 1 else 0
        if avg > 0 and (std / avg) < 0.20:
            results.append({
                'merchant': merchant,
                'avg_amount': avg,
                'frequency': len(amounts),
                'std_pct': (std / avg * 100) if avg > 0 else 0,
                'months_list': ', '.join(m_data['חודש'].tolist()),
                'total': amounts.sum(),
            })
    if not results:
        return pd.DataFrame()
    return pd.DataFrame(results).sort_values('avg_amount', ascending=False)

def compute_category_mom(df, prev_month=None, curr_month=None):
    """Compute month-over-month change per category for the 2 most recent months."""
    exp = df[df['סכום'] < 0].copy()
    if exp.empty:
        return []
    months_sorted = exp.drop_duplicates('חודש').sort_values('תאריך')['חודש'].unique()
    if len(months_sorted) < 2:
        return []
    if prev_month is None:
        prev_month = months_sorted[-2]
    if curr_month is None:
        curr_month = months_sorted[-1]
    prev_data = exp[exp['חודש'] == prev_month].groupby('קטגוריה')['סכום_מוחלט'].sum()
    curr_data = exp[exp['חודש'] == curr_month].groupby('קטגוריה')['סכום_מוחלט'].sum()
    all_cats = set(prev_data.index) | set(curr_data.index)
    results = []
    for cat in all_cats:
        prev_val = prev_data.get(cat, 0)
        curr_val = curr_data.get(cat, 0)
        if prev_val > 0:
            change_pct = ((curr_val - prev_val) / prev_val) * 100
        elif curr_val > 0:
            change_pct = 100.0
        else:
            change_pct = 0
        direction = 'up' if change_pct > 5 else 'down' if change_pct < -5 else 'neutral'
        results.append({
            'category': cat, 'prev_amount': prev_val, 'curr_amount': curr_val,
            'change_pct': change_pct, 'direction': direction,
            'prev_month': prev_month, 'curr_month': curr_month,
        })
    return sorted(results, key=lambda x: abs(x['change_pct']), reverse=True)


def chart_category_pct_by_month(df):
    """100% stacked bar chart: category spending as % of total per month."""
    exp = df[df['סכום'] < 0].copy()
    if exp.empty:
        fig = go.Figure()
        fig.add_annotation(text="אין נתונים", x=0.5, y=0.5, showarrow=False, font=dict(color=T['text3']))
        fig.update_layout(**plotly_layout(height=340))
        return fig, pd.DataFrame()

    # Build pivot: months as columns, categories as rows, values = absolute amounts
    months_sorted = exp.drop_duplicates('חודש').sort_values('תאריך')['חודש'].tolist()
    pivot = exp.groupby(['חודש', 'קטגוריה'])['סכום_מוחלט'].sum().reset_index()
    month_totals = exp.groupby('חודש')['סכום_מוחלט'].sum()

    # Compute percentages
    pivot['אחוז'] = pivot.apply(lambda r: (r['סכום_מוחלט'] / month_totals[r['חודש']] * 100) if month_totals[r['חודש']] > 0 else 0, axis=1)

    # Top categories (by overall total), rest -> "אחר"
    top_cats = exp.groupby('קטגוריה')['סכום_מוחלט'].sum().nlargest(8).index.tolist()

    fig = go.Figure()
    for i, cat in enumerate(top_cats):
        cat_data = pivot[pivot['קטגוריה'] == cat]
        y_vals = []
        amounts = []
        for m in months_sorted:
            row = cat_data[cat_data['חודש'] == m]
            y_vals.append(row['אחוז'].values[0] if len(row) > 0 else 0)
            amounts.append(row['סכום_מוחלט'].values[0] if len(row) > 0 else 0)
        fig.add_trace(go.Bar(
            x=months_sorted, y=y_vals, name=cat,
            marker=dict(color=CHART_COLORS[i % len(CHART_COLORS)], cornerradius=3),
            customdata=amounts,
            hovertemplate=f'<b>{cat}</b><br>%{{y:.1f}}% &middot; ₪%{{customdata:,.0f}}<extra></extra>',
        ))

    # "Other" categories
    other_cats = [c for c in exp['קטגוריה'].unique() if c not in top_cats]
    if other_cats:
        y_vals = []
        amounts = []
        for m in months_sorted:
            m_data = pivot[(pivot['קטגוריה'].isin(other_cats)) & (pivot['חודש'] == m)]
            y_vals.append(m_data['אחוז'].sum())
            amounts.append(m_data['סכום_מוחלט'].sum())
        fig.add_trace(go.Bar(
            x=months_sorted, y=y_vals, name='אחר',
            marker=dict(color='#64748b', cornerradius=3),
            customdata=amounts,
            hovertemplate='<b>אחר</b><br>%{y:.1f}% &middot; ₪%{customdata:,.0f}<extra></extra>',
        ))

    fig.update_layout(**plotly_layout(
        height=380, barmode='stack', bargap=0.25,
        yaxis=dict(gridcolor=T['grid'], tickfont=dict(color=T['text2'], size=10),
                   showgrid=True, zeroline=False, ticksuffix='%', range=[0, 100]),
        legend=dict(orientation='h', y=-0.22, x=0.5, xanchor='center',
                    font=dict(size=10, color=T['text2'])),
    ))

    # Build detail table
    table_data = []
    all_cats = top_cats + (['אחר'] if other_cats else [])
    for cat in all_cats:
        row_data = {'קטגוריה': cat}
        for m in months_sorted:
            if cat == 'אחר':
                m_data = pivot[(pivot['קטגוריה'].isin(other_cats)) & (pivot['חודש'] == m)]
                row_data[m] = round(m_data['אחוז'].sum(), 1)
            else:
                m_data = pivot[(pivot['קטגוריה'] == cat) & (pivot['חודש'] == m)]
                row_data[m] = round(m_data['אחוז'].values[0], 1) if len(m_data) > 0 else 0
        table_data.append(row_data)
    detail_df = pd.DataFrame(table_data)

    return fig, detail_df


def compute_spending_pace(df):
    """Compare current month's spending pace to previous month."""
    from datetime import datetime
    exp = df[df['סכום'] < 0].copy()
    if exp.empty:
        return None
    today = datetime.now()
    current_month_str = today.strftime('%m/%Y')
    day_of_month = today.day
    if current_month_str not in exp['חודש'].values:
        return None
    months_sorted = exp.drop_duplicates('חודש').sort_values('תאריך')['חודש'].unique()
    if len(months_sorted) < 2:
        return None
    curr_idx = list(months_sorted).index(current_month_str) if current_month_str in months_sorted else -1
    if curr_idx <= 0:
        return None
    prev_month_str = months_sorted[curr_idx - 1]
    curr_exp = exp[exp['חודש'] == current_month_str]
    curr_total = curr_exp['סכום_מוחלט'].sum()
    prev_exp = exp[exp['חודש'] == prev_month_str]
    prev_total = prev_exp['סכום_מוחלט'].sum()
    prev_by_today = prev_exp[prev_exp['תאריך'].dt.day <= day_of_month]['סכום_מוחלט'].sum()
    projected = (curr_total / day_of_month) * 30 if day_of_month > 0 else 0
    pace_vs_prev = ((curr_total / max(prev_by_today, 1)) - 1) * 100 if prev_by_today > 0 else 0
    return {
        'current_total': curr_total, 'prev_total': prev_total,
        'prev_by_today': prev_by_today, 'projected': projected,
        'pace_pct': pace_vs_prev, 'day_of_month': day_of_month,
        'current_month': current_month_str, 'prev_month': prev_month_str,
        'progress_pct': min((day_of_month / 30) * 100, 100),
    }

# =============================================================================
# Data Functions
# =============================================================================
def detect_header_row(df):
    keywords = ['תאריך', 'שם בית העסק', 'סכום', 'קטגוריה', 'תיאור', 'חיוב', 'עסקה', 'רכישה', 'פרטי', 'Date', 'Amount', 'זכות', 'חובה', 'תנועה', 'ערך']
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
    mask = df.apply(lambda r: not any(k in ' '.join(str(x).lower() for x in r if pd.notna(x)) for k in bad) and r.isnull().sum() <= len(r)*0.8, axis=1)
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
    for n in ['סכום חיוב', 'סכום עסקה מקורי', 'סכום', '₪ זכות/חובה', 'אם זכות/חובה']:
        for c in df.columns:
            if str(c).strip() == n and has_valid_amounts(df, c): return c
    for c in df.columns:
        if any(k in str(c).lower() for k in ['סכום','חיוב','amount','זכות/חובה']) and has_valid_amounts(df, c): return c
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
    # If already datetime dtype, return directly (no string conversion needed)
    if pd.api.types.is_datetime64_any_dtype(s):
        return pd.to_datetime(s, errors='coerce')
    # Check if values are native datetime/Timestamp objects (common from Excel)
    sample = s.dropna().head(5)
    if len(sample) > 0:
        from datetime import datetime as _dt
        if all(isinstance(v, (pd.Timestamp, _dt)) for v in sample):
            return pd.to_datetime(s, errors='coerce')
    # String-based parsing with explicit formats
    cleaned = s.astype(str).str.strip()
    result = pd.Series([pd.NaT]*len(s), index=s.index)
    # %Y-%m-%d %H:%M:%S first — matches stringified Excel datetime objects
    for f in ['%Y-%m-%d %H:%M:%S','%d-%m-%Y','%d/%m/%Y','%Y-%m-%d','%d.%m.%Y','%Y/%m/%d','%m/%d/%Y']:
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
    # Auto-negate only for credit card statements (not bank accounts which have mixed +/-)
    is_bank_statement = 'זכות/חובה' in ac
    nz = r['סכום'][r['סכום'] != 0]
    if not is_bank_statement and len(nz) > 0 and (nz > 0).sum() / len(nz) > 0.8:
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
        '<div style="position:relative;width:min(200px,50vw);height:min(200px,50vw);margin-bottom:1.25rem">'
        '<div style="width:min(200px,50vw);height:min(200px,50vw);border-radius:50%;'
        f'background:conic-gradient({gradient});'
        'display:flex;align-items:center;justify-content:center">'
        f'<div style="width:65%;height:65%;border-radius:50%;background:{T["surface"]};'
        'display:flex;flex-direction:column;align-items:center;justify-content:center;'
        'box-shadow:0 0 20px rgba(0,0,0,0.15)">'
        f'<div style="font-size:clamp(0.9rem,3vw,1.25rem);font-weight:800;color:{T["text1"]};direction:ltr">'
        f'₪{total:,.0f}</div>'
        f'<div style="font-size:clamp(0.6rem,2vw,0.72rem);color:{T["text3"]};margin-top:2px">סה״כ הוצאות</div>'
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
    months = exp.drop_duplicates('חודש').sort_values('תאריך')['חודש'].unique()
    fig = go.Figure()
    if len(months) > 1:
        # Grouped bars: one bar per month within each weekday group
        for i, month in enumerate(months):
            m_exp = exp[exp['חודש'] == month]
            d = m_exp.groupby('יום_בשבוע')['סכום_מוחלט'].sum().reindex(range(7), fill_value=0).reset_index()
            d.columns = ['יום_בשבוע', 'סכום_מוחלט']
            d['יום'] = d['יום_בשבוע'].apply(lambda x: days[x] if x < 7 else '')
            fig.add_trace(go.Bar(x=d['יום'], y=d['סכום_מוחלט'], name=month,
                                 marker=dict(color=CHART_COLORS[i % len(CHART_COLORS)], cornerradius=5),
                                 hovertemplate=f'<b>{month}</b> · יום %{{x}}<br>₪%{{y:,.0f}}<extra></extra>'))
        fig.update_layout(**plotly_layout(height=240, bargap=0.25, barmode='group',
                          legend=dict(orientation='h', y=-0.2, x=0.5, xanchor='center',
                                      font=dict(size=10, color=T['text2']))))
    else:
        # Single month: original style
        d = exp.groupby('יום_בשבוע')['סכום_מוחלט'].sum().reset_index()
        d['יום'] = d['יום_בשבוע'].apply(lambda x: days[x] if x < 7 else '')
        purples = ['#c4b5fd','#a78bfa','#8b5cf6','#7c3aed','#6d28d9','#5b21b6','#4c1d95']
        fig.add_trace(go.Bar(x=d['יום'], y=d['סכום_מוחלט'],
                             marker=dict(color=[purples[int(x)] for x in d['יום_בשבוע']], cornerradius=5),
                             hovertemplate='<b>יום %{x}</b><br>₪%{y:,.0f}<extra></extra>'))
        fig.update_layout(**plotly_layout(height=240, bargap=0.25))
    return fig

def chart_merchants(df, n=8):
    exp = df[df['סכום'] < 0].copy()
    if exp.empty:
        fig = go.Figure(); fig.add_annotation(text="אין נתונים", x=0.5, y=0.5, showarrow=False, font=dict(color=T['text3']))
        fig.update_layout(**plotly_layout(height=280)); return fig
    # Find top N merchants by total spending across all months
    top_merchants = exp.groupby('תיאור')['סכום_מוחלט'].sum().nlargest(n).index.tolist()
    exp_top = exp[exp['תיאור'].isin(top_merchants)]
    months = exp_top.drop_duplicates('חודש').sort_values('תאריך')['חודש'].unique()
    fig = go.Figure()
    if len(months) > 1:
        # Grouped horizontal bars: one bar per month within each merchant group
        # Sort merchants by total ascending for horizontal layout
        merchant_order = exp_top.groupby('תיאור')['סכום_מוחלט'].sum().sort_values(ascending=True).index.tolist()
        short_names = {m: (m[:25]+'...' if len(m) > 28 else m) for m in merchant_order}
        y_labels = [short_names[m] for m in merchant_order]
        for i, month in enumerate(months):
            m_exp = exp_top[exp_top['חודש'] == month]
            m_totals = m_exp.groupby('תיאור')['סכום_מוחלט'].sum()
            values = [m_totals.get(merchant, 0) for merchant in merchant_order]
            fig.add_trace(go.Bar(x=values, y=y_labels, orientation='h', name=month,
                                 marker=dict(color=CHART_COLORS[i % len(CHART_COLORS)], cornerradius=5),
                                 hovertemplate=f'<b>{month}</b> · %{{y}}<br>₪%{{x:,.0f}}<extra></extra>'))
        fig.update_layout(**plotly_layout(height=max(280, n*50), barmode='group',
                          margin=dict(t=10, b=40, l=160, r=15),
                          legend=dict(orientation='h', y=-0.15, x=0.5, xanchor='center',
                                      font=dict(size=10, color=T['text2']))))
    else:
        # Single month: original style
        m = exp_top.groupby('תיאור')['סכום_מוחלט'].sum().reset_index().sort_values('סכום_מוחלט', ascending=True)
        m['short'] = m['תיאור'].apply(lambda x: x[:25]+'...' if len(x) > 28 else x)
        nb = len(m)
        colors = [f'rgba(52,211,153,{0.35 + 0.65*i/max(nb-1,1)})' for i in range(nb)]
        fig.add_trace(go.Bar(x=m['סכום_מוחלט'], y=m['short'], orientation='h',
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

def chart_income_vs_expenses(df):
    """Grouped bar chart comparing income and expenses per month."""
    months = df.drop_duplicates('חודש').sort_values('תאריך')['חודש'].unique()
    income_vals = []
    expense_vals = []
    for m in months:
        m_df = df[df['חודש'] == m]
        income_vals.append(m_df[m_df['סכום'] > 0]['סכום'].sum())
        expense_vals.append(abs(m_df[m_df['סכום'] < 0]['סכום'].sum()))
    fig = go.Figure()
    fig.add_trace(go.Bar(x=list(months), y=income_vals, name='הכנסות',
                         marker=dict(color='rgba(52,211,153,0.85)', cornerradius=5),
                         hovertemplate='<b>%{x}</b><br>הכנסות: ₪%{y:,.0f}<extra></extra>'))
    fig.add_trace(go.Bar(x=list(months), y=expense_vals, name='הוצאות',
                         marker=dict(color='rgba(248,113,113,0.85)', cornerradius=5),
                         hovertemplate='<b>%{x}</b><br>הוצאות: ₪%{y:,.0f}<extra></extra>'))
    # Add net line
    net_vals = [i - e for i, e in zip(income_vals, expense_vals)]
    fig.add_trace(go.Scatter(x=list(months), y=net_vals, name='מאזן נטו', mode='lines+markers',
                             line=dict(color=T['accent'], width=2.5, dash='dot'),
                             marker=dict(size=8, color=T['accent']),
                             hovertemplate='<b>%{x}</b><br>מאזן: ₪%{y:,.0f}<extra></extra>'))
    fig.add_hline(y=0, line_dash='dot', line_color=T['text3'], opacity=0.3)
    fig.update_layout(**plotly_layout(height=320, barmode='group', bargap=0.25,
                      legend=dict(orientation='h', y=-0.18, x=0.5, xanchor='center',
                                  font=dict(size=11, color=T['text2']))))
    return fig

def chart_net_savings(df):
    """Area chart showing cumulative savings over time."""
    months = df.drop_duplicates('חודש').sort_values('תאריך')['חודש'].unique()
    cum_savings = []
    running = 0
    for m in months:
        m_df = df[df['חודש'] == m]
        income = m_df[m_df['סכום'] > 0]['סכום'].sum()
        expense = abs(m_df[m_df['סכום'] < 0]['סכום'].sum())
        running += (income - expense)
        cum_savings.append(running)
    fig = go.Figure()
    colors_fill = ['rgba(52,211,153,0.12)' if v >= 0 else 'rgba(248,113,113,0.12)' for v in cum_savings]
    fig.add_trace(go.Scatter(
        x=list(months), y=cum_savings, mode='lines+markers', fill='tozeroy',
        line=dict(color=T['green'], width=2.5),
        fillcolor='rgba(52,211,153,0.08)',
        marker=dict(size=7, color=[T['green'] if v >= 0 else T['red'] for v in cum_savings]),
        hovertemplate='<b>%{x}</b><br>חיסכון מצטבר: ₪%{y:,.0f}<extra></extra>'
    ))
    fig.add_hline(y=0, line_dash='dot', line_color=T['red'], opacity=0.4)
    fig.update_layout(**plotly_layout(height=280, hovermode='x unified'))
    return fig

def render_cashflow_cards(df):
    """Render premium cash flow summary cards with mini-bars."""
    init_income_state()
    exp = df[df['סכום'] < 0]
    tx_income = df[df['סכום'] > 0]['סכום'].sum()
    manual_income = get_total_income()
    total_income = tx_income + manual_income
    total_expenses = abs(exp['סכום'].sum()) if len(exp) > 0 else 0
    balance = total_income - total_expenses
    savings_rate = (balance / total_income * 100) if total_income > 0 else 0

    # Monthly mini-bars data
    months = df.drop_duplicates('חודש').sort_values('תאריך')['חודש'].unique()
    inc_monthly = []
    exp_monthly = []
    for m in months:
        m_df = df[df['חודש'] == m]
        inc_monthly.append(m_df[m_df['סכום'] > 0]['סכום'].sum())
        exp_monthly.append(abs(m_df[m_df['סכום'] < 0]['סכום'].sum()))

    inc_max = max(inc_monthly) if inc_monthly and max(inc_monthly) > 0 else 1
    exp_max = max(exp_monthly) if exp_monthly and max(exp_monthly) > 0 else 1

    def mini_bars(values, max_val, color):
        bars = ''
        for v in values[-6:]:
            h = max(5, (v / max_val) * 100) if max_val > 0 else 5
            bars += f'<div class="minibar" data-height="{h:.0f}" style="background:{color};height:0%"></div>'
        return f'<div class="minibar-row">{bars}</div>'

    # Balance indicator
    bal_color = T['green'] if balance >= 0 else T['red']
    bal_icon = '📈' if balance >= 0 else '📉'
    bal_badge_bg = T['green_bg'] if balance >= 0 else T['red_bg']
    savings_text = f'חיסכון {savings_rate:.0f}%' if savings_rate > 0 else f'גירעון {abs(savings_rate):.0f}%'

    html = f'''<div class="flow-row">
        <div class="flow-card income stagger-1">
            <div class="flow-icon" style="background:linear-gradient(135deg,#34d399,#059669)">📈</div>
            <div class="flow-val" style="color:{T['green']}">{fmt(total_income)}</div>
            <div class="flow-label">סה״כ הכנסות</div>
            {mini_bars(inc_monthly, inc_max, T['green'])}
            <div class="flow-mini">
                <span>ממוצע חודשי:</span>
                <span style="color:{T['text1']};font-weight:600;direction:ltr">{fmt(total_income / max(len(months), 1))}</span>
            </div>
        </div>
        <div class="flow-card expense stagger-2">
            <div class="flow-icon" style="background:linear-gradient(135deg,#f87171,#dc2626)">📉</div>
            <div class="flow-val" style="color:{T['red']}">{fmt(total_expenses)}</div>
            <div class="flow-label">סה״כ הוצאות</div>
            {mini_bars(exp_monthly, exp_max, T['red'])}
            <div class="flow-mini">
                <span>ממוצע חודשי:</span>
                <span style="color:{T['text1']};font-weight:600;direction:ltr">{fmt(total_expenses / max(len(months), 1))}</span>
            </div>
        </div>
        <div class="flow-card balance stagger-3">
            <div class="flow-icon" style="background:linear-gradient(135deg,{T['accent']},#6d28d9)">{bal_icon}</div>
            <div class="flow-val glow-number" style="color:{bal_color}">{fmt(balance)}</div>
            <div class="flow-label">מאזן נטו</div>
            <div style="margin-top:0.75rem">
                <div class="ie-bar-container">
                    <div class="ie-bar-income" style="width:{min(total_income / max(total_income + total_expenses, 1) * 100, 100):.0f}%"></div>
                    <div class="ie-bar-expense" style="width:{min(total_expenses / max(total_income + total_expenses, 1) * 100, 100):.0f}%"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:{T['text3']};margin-top:4px">
                    <span>הכנסות</span><span>הוצאות</span>
                </div>
            </div>
            <div class="flow-mini">
                <span class="flow-mini-badge" style="background:{bal_badge_bg};color:{bal_color}">{savings_text}</span>
            </div>
        </div>
    </div>'''
    st.markdown(html, unsafe_allow_html=True)

# =============================================================================
# UI Components
# =============================================================================
def render_kpis(df):
    init_income_state()
    total = len(df)
    exp = df[df['סכום'] < 0]
    spent = abs(exp['סכום'].sum()) if len(exp) > 0 else 0
    # Income = transactions income + manually entered incomes
    tx_income = df[df['סכום'] > 0]['סכום'].sum()
    manual_income = get_total_income()
    income = tx_income + manual_income
    avg = df['סכום_מוחלט'].mean() if not df.empty else 0
    balance = income - spent
    bal_color = T['green'] if balance >= 0 else T['red']
    cards = [
        ('💳', f'linear-gradient(135deg,{T["accent"]},#6d28d9)', f'{total:,}', 'עסקאות'),
        ('📉', f'linear-gradient(135deg,#f87171,#dc2626)', fmt(spent), 'הוצאות'),
        ('📈', f'linear-gradient(135deg,#34d399,#059669)', fmt(income), 'הכנסות'),
        ('💰', f'linear-gradient(135deg,#38bdf8,#0284c7)', fmt(balance), 'מאזן'),
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


def render_data_management_tab(df_f):
    """Full data management page with view, edit, delete capabilities."""
    init_income_state()
    user = get_current_user()
    is_guest = not user or user.get('id') == 'guest'

    # Show status message from previous action (file delete, etc.)
    if 'dm_msg' in st.session_state:
        st.markdown(f'''<div class="alert alert-ok">
            <span class="alert-icon">✅</span>
            <div><div class="alert-text">{st.session_state.dm_msg}</div></div>
        </div>''', unsafe_allow_html=True)
        del st.session_state['dm_msg']

    # ── Overview ──
    st.markdown(f'<div class="section-label">📊 סיכום נתונים שמורים</div>', unsafe_allow_html=True)
    
    exp = df_f[df_f['סכום'] < 0]
    n_tx = len(df_f)
    n_incomes = len(st.session_state.get('incomes', []))
    n_categories = df_f['קטגוריה'].nunique() if not df_f.empty else 0
    total_exp = abs(exp['סכום'].sum()) if len(exp) > 0 else 0
    total_inc = get_total_income()
    
    # Stats cards
    sc1, sc2, sc3, sc4 = st.columns(4)
    overview = [
        (sc1, '📋', f'{n_tx:,}', 'עסקאות', T['accent']),
        (sc2, '💰', f'{n_incomes}', 'הכנסות', T['green']),
        (sc3, '🏷️', f'{n_categories}', 'קטגוריות', T['amber']),
        (sc4, '📂', f'{len(set(df_f["_מקור"].tolist())) if "_מקור" in df_f.columns else 1}', 'קבצים', T['accent']),
    ]
    for col, icon, val, label, color in overview:
        with col:
            st.markdown(
                f'<div class="kpi" style="padding:0.85rem">'
                f'<div style="font-size:1.2rem;margin-bottom:4px">{icon}</div>'
                f'<div style="font-size:1.2rem;font-weight:700;color:{color}">{val}</div>'
                f'<div style="font-size:0.75rem;color:{T["text2"]}">{label}</div>'
                f'</div>', unsafe_allow_html=True)
    
    st.markdown(f'<div style="height:1rem"></div>', unsafe_allow_html=True)

    # ── Section: File Manager ──
    file_list = []
    if '_מקור' in df_f.columns:
        for fname in df_f['_מקור'].unique():
            fdata = df_f[df_f['_מקור'] == fname]
            total = fdata['סכום'].sum()
            dates = fdata['תאריך']
            file_list.append({
                'name': fname,
                'count': len(fdata),
                'total': total,
                'date_range': f"{dates.min().strftime('%d/%m/%Y')} — {dates.max().strftime('%d/%m/%Y')}" if not dates.empty else "",
            })

    n_files = len(file_list)
    st.markdown(f'<div class="section-label">📂 ניהול קבצים ({n_files})</div>', unsafe_allow_html=True)

    if file_list:
        for i, f in enumerate(file_list):
            amt_abs = abs(f['total'])
            amt_color = T['red'] if f['total'] < 0 else T['green']
            amt_sign = '-' if f['total'] < 0 else '+'
            ext = f['name'].rsplit('.', 1)[-1].upper() if '.' in f['name'] else '?'
            ext_color = T['green'] if ext in ('XLSX', 'XLS') else T['accent']

            col_info, col_del = st.columns([6, 1])
            with col_info:
                st.markdown(f'''<div class="cat-card" style="margin-bottom:0.35rem">
                    <div style="display:flex;align-items:center;gap:0.75rem;flex:1">
                        <div class="cat-icon" style="background:{ext_color}22;color:{ext_color};font-size:0.7rem;font-weight:700">{ext}</div>
                        <div style="flex:1">
                            <div style="font-weight:600;color:{T['text1']};font-size:0.85rem">{f['name']}</div>
                            <div style="color:{T['text3']};font-size:0.73rem">{f['count']:,} עסקאות &bull; {f['date_range']}</div>
                        </div>
                    </div>
                    <div style="font-weight:700;color:{amt_color};font-size:0.9rem;direction:ltr">{amt_sign}₪{amt_abs:,.0f}</div>
                </div>''', unsafe_allow_html=True)
            with col_del:
                if not is_guest:
                    if st.button("🗑️", key=f"del_file_{i}", help=f"מחק {f['name']}"):
                        delete_file_transactions(f['name'])
                        st.session_state.pop('cached_df', None)
                        st.session_state['dm_msg'] = f"הקובץ {f['name']} נמחק"
                        st.rerun()

        st.markdown(f'<div style="color:{T["text3"]};font-size:0.75rem;margin-top:0.5rem">💡 מחיקת קובץ מסירה רק את העסקאות שלו. קבצים אחרים לא מושפעים.</div>', unsafe_allow_html=True)
    else:
        st.markdown(f'<div style="text-align:center;padding:1rem;color:{T["text3"]}">אין קבצים שמורים</div>', unsafe_allow_html=True)

    st.markdown(f'<div style="height:1px;background:{T["border"]};margin:1.25rem 0"></div>', unsafe_allow_html=True)

    # ── Section: Transactions ──
    st.markdown(f'<div class="section-label">📋 עסקאות שמורות ({n_tx:,})</div>', unsafe_allow_html=True)

    if not df_f.empty:
        # Filter tools
        fc1, fc2, fc3 = st.columns([2, 2, 1])
        with fc1:
            dm_cat = st.selectbox("סנן לפי קטגוריה", ['הכל'] + sorted(df_f['קטגוריה'].unique().tolist()), key="dm_cat")
        with fc2:
            dm_search = st.text_input("חיפוש", placeholder="שם בית עסק...", key="dm_search")
        with fc3:
            dm_sort = st.selectbox("מיון", ['תאריך ↓', 'סכום ↓'], key="dm_sort")

        # Apply filters
        dm_df = df_f.copy()
        if dm_cat != 'הכל':
            dm_df = dm_df[dm_df['קטגוריה'] == dm_cat]
        if dm_search:
            dm_df = dm_df[dm_df['תיאור'].str.contains(dm_search, case=False, na=False)]

        sort_col = 'תאריך' if 'תאריך' in dm_sort else 'סכום_מוחלט'
        dm_df = dm_df.sort_values(sort_col, ascending=False)

        st.markdown(f'<div style="color:{T["text2"]};font-size:0.8rem;margin-bottom:0.5rem">{len(dm_df):,} עסקאות מוצגות</div>', unsafe_allow_html=True)

        # Show table
        view_cols = ['תאריך', 'תיאור', 'קטגוריה', 'סכום']
        if '_מקור' in dm_df.columns and dm_df['_מקור'].nunique() > 1:
            view_cols.append('_מקור')

        st.dataframe(
            dm_df[view_cols],
            column_config={
                "תאריך": st.column_config.DateColumn("תאריך", format="DD/MM/YYYY", width="small"),
                "תיאור": st.column_config.TextColumn("בית עסק", width="large"),
                "קטגוריה": st.column_config.TextColumn("קטגוריה", width="medium"),
                "סכום": st.column_config.NumberColumn("סכום (₪)", format="₪%.2f", width="small"),
                "_מקור": st.column_config.TextColumn("מקור", width="medium"),
            },
            hide_index=True, use_container_width=True, height=350)

        if not is_guest:
            if st.button("🗑️ מחק את כל העסקאות", key="dm_del_tx", use_container_width=True):
                delete_transactions()
                st.session_state.pop('cached_df', None)
                st.session_state['dm_msg'] = "כל העסקאות נמחקו"
                st.rerun()
    else:
        st.markdown(f'<div style="text-align:center;padding:1.5rem;color:{T["text3"]}">אין עסקאות שמורות</div>', unsafe_allow_html=True)

    st.markdown(f'<div style="height:1px;background:{T["border"]};margin:1.5rem 0"></div>', unsafe_allow_html=True)

    # ── Section: Incomes ──
    st.markdown(f'<div class="section-label">💰 הכנסות ({n_incomes})</div>', unsafe_allow_html=True)
    
    incomes = st.session_state.get('incomes', [])
    if incomes:
        type_icons = {'משכורת':'💼','פרילנס':'💻','השקעות':'📈','מתנה':'🎁','החזר':'🔄','אחר':'📌'}
        
        for i, item in enumerate(incomes):
            ic = type_icons.get(item.get('type',''), '📌')
            desc = item.get('desc', '')
            amt = item.get('amount', 0)
            typ = item.get('type', '')
            rec = item.get('recurring', 'חד-פעמי')
            amt_str = f"₪{amt:,.0f}"
            
            rec_html = ''
            if rec != 'חד-פעמי':
                rec_html = f' <span style="background:{T["accent_bg"]};color:{T["accent"]};padding:1px 6px;border-radius:4px;font-size:0.68rem">{rec}</span>'
            
            col_info, col_del = st.columns([6, 1])
            with col_info:
                st.markdown(
                    f'<div class="cat-card" style="margin-bottom:0.25rem">'
                    f'<div style="display:flex;align-items:center;gap:0.75rem;flex:1">'
                    f'<div class="cat-icon" style="background:{T["green"]}22;color:{T["green"]}">{ic}</div>'
                    f'<div><div style="font-weight:600;color:{T["text1"]};font-size:0.85rem">{desc}</div>'
                    f'<div style="color:{T["text3"]};font-size:0.75rem">{typ}{rec_html}</div></div></div>'
                    f'<div style="font-weight:700;color:{T["green"]};font-size:0.95rem;direction:ltr">{amt_str}</div>'
                    f'</div>', unsafe_allow_html=True)
            with col_del:
                if not is_guest:
                    if st.button("🗑️", key=f"del_inc_{i}"):
                        # Delete from DB
                        sb = get_supabase()
                        uid = user["id"] if user else None
                        if sb and uid:
                            # Load from DB, find matching, delete
                            try:
                                db_incomes = sb.table("incomes").select("id,description,amount").eq("user_id", uid).execute()
                                if db_incomes.data:
                                    for db_item in db_incomes.data:
                                        if db_item['description'] == desc and float(db_item['amount']) == float(amt):
                                            sb.table("incomes").delete().eq("id", db_item['id']).execute()
                                            break
                            except:
                                pass
                        # Remove from session
                        st.session_state.incomes.pop(i)
                        st.rerun()
        
        # Total
        total_inc_display = sum(x.get('amount', 0) for x in incomes)
        st.markdown(
            f'<div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;'
            f'background:{T["green"]}11;border:1px solid {T["green"]}33;border-radius:10px;margin-top:0.5rem">'
            f'<div style="color:{T["text1"]};font-weight:600;font-size:0.9rem">סה״כ הכנסות</div>'
            f'<div style="color:{T["green"]};font-weight:700;font-size:1.1rem;direction:ltr">₪{total_inc_display:,.0f}</div>'
            f'</div>', unsafe_allow_html=True)
        
        if not is_guest:
            if st.button("🗑️ מחק את כל ההכנסות", key="dm_del_all_inc", use_container_width=True):
                delete_all_incomes()
                st.session_state.incomes = []
                st.rerun()
    else:
        st.markdown(f'<div style="text-align:center;padding:1.5rem;color:{T["text3"]}">אין הכנסות. הוסף בטאב "תקציב".</div>', unsafe_allow_html=True)
    
    st.markdown(f'<div style="height:1px;background:{T["border"]};margin:1.5rem 0"></div>', unsafe_allow_html=True)

    # ── Section: Storage info ──
    if not is_guest:
        st.markdown(f'<div class="section-label">☁️ אחסון בענן</div>', unsafe_allow_html=True)
        
        st.markdown(
            f'<div class="kpi" style="padding:1rem">'
            f'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">'
            f'<div style="color:{T["text1"]};font-weight:600;font-size:0.9rem">סטטוס חשבון</div>'
            f'<div style="background:{T["green"]}22;color:{T["green"]};padding:3px 10px;border-radius:6px;font-size:0.75rem;font-weight:600">מחובר</div>'
            f'</div>'
            f'<div style="display:flex;gap:2rem;flex-wrap:wrap">'
            f'<div><div style="color:{T["text3"]};font-size:0.75rem">משתמש</div><div style="color:{T["text1"]};font-size:0.85rem">{user.get("email","")}</div></div>'
            f'<div><div style="color:{T["text3"]};font-size:0.75rem">עסקאות</div><div style="color:{T["text1"]};font-size:0.85rem">{n_tx:,}</div></div>'
            f'<div><div style="color:{T["text3"]};font-size:0.75rem">הכנסות</div><div style="color:{T["text1"]};font-size:0.85rem">{n_incomes}</div></div>'
            f'</div>'
            f'</div>', unsafe_allow_html=True)
        
        st.markdown(f'<div style="height:0.75rem"></div>', unsafe_allow_html=True)
        
        # Danger zone
        st.markdown(
            f'<div style="background:{T["red"]}08;border:1px solid {T["red"]}22;border-radius:12px;padding:1rem">'
            f'<div style="font-weight:600;color:{T["red"]};font-size:0.9rem;margin-bottom:0.5rem">⚠️ אזור מסוכן</div>'
            f'<div style="color:{T["text2"]};font-size:0.8rem;margin-bottom:0.75rem">מחיקת כל המידע מהחשבון לצמיתות. פעולה בלתי הפיכה.</div>'
            f'</div>', unsafe_allow_html=True)
        
        confirm_del = st.text_input("הקלד 'מחק הכל' לאישור", key="dm_danger_confirm", placeholder="מחק הכל", label_visibility="collapsed")
        if confirm_del == "מחק הכל":
            if st.button("🚨 מחק את כל המידע שלי", key="dm_danger_go", use_container_width=True):
                delete_all_user_data()
                st.session_state.incomes = []
                st.session_state.pop('cached_df', None)
                st.success("כל המידע נמחק לצמיתות")
                st.rerun()
    else:
        st.markdown(
            f'<div style="text-align:center;padding:1.5rem;color:{T["text3"]}">'
            f'<div style="font-size:1.5rem;margin-bottom:0.5rem">🔒</div>'
            f'<div>התחבר כדי לשמור ולנהל נתונים בענן</div>'
            f'</div>', unsafe_allow_html=True)

# =============================================================================
# Income Manager
# =============================================================================
def init_income_state():
    if 'incomes' not in st.session_state:
        # Try loading from DB
        db_incomes = load_incomes()
        if db_incomes:
            st.session_state.incomes = [
                {'desc': i.get('description',''), 'amount': float(i.get('amount',0)),
                 'type': i.get('income_type','אחר'), 'recurring': i.get('recurring','חד-פעמי')}
                for i in db_incomes
            ]
        else:
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
                # Save to session
                st.session_state.incomes.append({
                    'desc': inc_desc, 'amount': inc_amount,
                    'type': inc_type, 'recurring': inc_recurring,
                })
                # Save to DB
                save_income(inc_desc, inc_amount, inc_type, inc_recurring)
                st.rerun()
            else:
                st.warning("נא למלא תיאור וסכום")
        
        # Income list
        if st.session_state.incomes:
            st.markdown(f'<div class="section-label" style="margin-top:1.5rem">📋 הכנסות ({len(st.session_state.incomes)})</div>', unsafe_allow_html=True)
            type_icons = {'משכורת':'💼','פרילנס':'💻','השקעות':'📈','מתנה':'🎁','החזר':'🔄','אחר':'📌'}
            for i, item in enumerate(st.session_state.incomes):
                ic = type_icons.get(item['type'], '📌')
                amt_str = f"₪{item['amount']:,.0f}"
                rec_text = item['recurring']
                rec_html = ''
                if rec_text != 'חד-פעמי':
                    rec_html = f' <span style="background:{T["accent_bg"]};color:{T["accent"]};padding:1px 6px;border-radius:4px;font-size:0.68rem">{rec_text}</span>'
                st.markdown(
                    f'<div class="cat-card" style="justify-content:space-between">'
                    f'<div style="display:flex;align-items:center;gap:0.75rem">'
                    f'<div class="cat-icon" style="background:{T["green"]}22;color:{T["green"]}">{ic}</div>'
                    f'<div><div style="font-weight:600;color:{T["text1"]};font-size:0.85rem">{item["desc"]}</div>'
                    f'<div style="color:{T["text3"]};font-size:0.75rem">{item["type"]}{rec_html}</div></div></div>'
                    f'<div style="font-weight:700;color:{T["green"]};font-size:1rem;direction:ltr">{amt_str}</div>'
                    f'</div>', unsafe_allow_html=True)
            
            if st.button("🗑️ נקה הכל", key="clear_incomes"):
                delete_all_incomes()
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
    st.markdown(f'<div class="dash-header"><h1 class="dash-title">מנתח עסקאות</h1><p class="dash-subtitle">ניתוח חכם של הכנסות, הוצאות ותזרים מזומנים</p></div>', unsafe_allow_html=True)

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
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
                <span style="background:rgba(52,211,153,0.12);color:{T['green']};padding:3px 10px;border-radius:6px;font-size:0.75rem;font-weight:600">עו"ש בנק</span>
                <span style="background:rgba(52,211,153,0.12);color:{T['green']};padding:3px 10px;border-radius:6px;font-size:0.75rem;font-weight:600">הכנסות</span>
            </div>
        </div>
        ''', unsafe_allow_html=True)

    # Empty state -- try session cache first, then DB
    if not uploaded_files:
        saved_df = st.session_state.get('cached_df')
        if saved_df is None:
            saved_df = load_transactions()
            if saved_df is not None:
                st.session_state.cached_df = saved_df
        if saved_df is not None and not saved_df.empty:
            n_files = saved_df['_מקור'].nunique() if '_מקור' in saved_df.columns else 1
            st.markdown(f'''<div class="alert alert-ok">
                <span class="alert-icon">☁️</span>
                <div><div class="alert-text">נטענו {len(saved_df):,} עסקאות מ-{n_files} קבצים</div><div class="alert-sub">העלה קבצים נוספים כדי להוסיף, או נהל את הקבצים בטאב "ניהול נתונים"</div></div>
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
    desc_kws = ['שם בית העסק','תיאור','תיאור התנועה','שם בית עסק','פרטי העסקה','Description']
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
    
    # Save each file separately (preserves previously uploaded files)
    files_dict = {}
    for proc_df in all_processed:
        if '_מקור' in proc_df.columns:
            for fname in proc_df['_מקור'].unique():
                files_dict[fname] = proc_df[proc_df['_מקור'] == fname]
    if files_dict:
        save_file_transactions(files_dict)

    # Reload ALL saved data (existing + newly uploaded) for a complete view
    full_df = load_transactions()
    if full_df is not None and not full_df.empty:
        n_total_files = full_df['_מקור'].nunique() if '_מקור' in full_df.columns else total_files
        if n_total_files > total_files:
            st.markdown(f'''<div class="alert alert-ok" style="margin-top:0.5rem">
                <span class="alert-icon">☁️</span>
                <div><div class="alert-text">סה״כ {len(full_df):,} עסקאות מ-{n_total_files} קבצים (כולל קבצים קודמים)</div></div>
            </div>''', unsafe_allow_html=True)
        df = full_df

    # Update session cache
    st.session_state.cached_df = df

    _render_dashboard(df)


def _render_dashboard(df):
    """Render the main dashboard (filters, KPIs, tabs)."""
    # Filters
    st.markdown(f'<div class="section-label">🔍 סינון</div>', unsafe_allow_html=True)
    # Build chronologically sorted month list from transaction dates
    month_order = df.drop_duplicates('חודש').sort_values('תאריך')['חודש'].tolist()
    c1, c2, c3 = st.columns(3)
    with c1: selected_months = st.multiselect("בחר חודשים להשוואה", options=month_order, default=month_order)
    with c2: cat_f = st.selectbox("קטגוריה", ['הכל'] + sorted(df['קטגוריה'].unique().tolist()))
    with c3: search = st.text_input("חיפוש בית עסק", placeholder="הקלד...")

    df_f = df.copy()
    if selected_months:
        df_f = df_f[df_f['חודש'].isin(selected_months)]
    if cat_f != 'הכל': df_f = df_f[df_f['קטגוריה'] == cat_f]
    if search: df_f = df_f[df_f['תיאור'].str.contains(search, case=False, na=False)]

    if df_f.empty:
        st.markdown(f'''<div style="text-align:center;padding:2rem">
            <div style="font-size:2.5rem">🔍</div>
            <div style="color:{T['amber']};font-weight:600;margin-top:0.5rem">לא נמצאו תוצאות</div>
            <div style="color:{T['text2']};font-size:0.9rem">נסה לשנות את הפילטרים</div>
        </div>''', unsafe_allow_html=True)
        return

    # Cash Flow Cards (replaces basic KPIs with premium version)
    render_cashflow_cards(df_f)

    # Tabs
    tabs = st.tabs(["📊 סקירה","💹 הכנסות מול הוצאות","📈 מגמות","🏪 בתי עסק","🔍 תובנות","📋 עסקאות","💰 תקציב","🗄️ ניהול נתונים"])

    # ══════════════════════════════════════════════
    # TAB 0: Overview
    # ══════════════════════════════════════════════
    with tabs[0]:
        # ── Spending Pace Indicator ──
        pace = compute_spending_pace(df_f)
        if pace:
            pace_color = T['red'] if pace['pace_pct'] > 10 else T['green'] if pace['pace_pct'] < -10 else T['amber']
            pace_arrow = '↑' if pace['pace_pct'] > 0 else '↓' if pace['pace_pct'] < 0 else '―'
            pace_word = 'מהיר מ' if pace['pace_pct'] > 0 else 'איטי מ' if pace['pace_pct'] < 0 else 'זהה ל'
            projected_color = T['red'] if pace['projected'] > pace['prev_total'] else T['green']

            st.markdown(f'''<div class="pace-container">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div style="font-weight:700;color:{T['text1']};font-size:0.95rem">⏱️ קצב הוצאות - {pace['current_month']}</div>
                        <div style="color:{T['text2']};font-size:0.8rem;margin-top:2px">
                            יום {pace['day_of_month']} בחודש &bull;
                            {pace_word}חודש קודם ({pace['prev_month']})
                        </div>
                    </div>
                    <div style="text-align:left">
                        <span class="diff-badge {'up' if pace['pace_pct'] > 10 else 'down' if pace['pace_pct'] < -10 else 'neutral'}">
                            {pace_arrow} {abs(pace['pace_pct']):.0f}%
                        </span>
                    </div>
                </div>
                <div class="pace-bar-bg">
                    <div class="pace-bar" style="width:{min(pace['progress_pct'], 100):.0f}%;background:{pace_color}"></div>
                    <div class="pace-marker" style="left:{min((pace['prev_by_today'] / max(pace['prev_total'], 1)) * 100, 100):.0f}%"
                         title="חודש קודם בנקודה זו"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:{T['text3']}">
                    <div>הוצאות עד כה: <span style="color:{T['text1']};font-weight:600;direction:ltr">₪{pace['current_total']:,.0f}</span></div>
                    <div>צפי חודשי: <span style="color:{projected_color};font-weight:600;direction:ltr">₪{pace['projected']:,.0f}</span></div>
                </div>
                <div style="font-size:0.72rem;color:{T['text3']};margin-top:4px;text-align:center">
                    חודש קודם סה״כ: ₪{pace['prev_total']:,.0f} &bull; בנקודה זו: ₪{pace['prev_by_today']:,.0f}
                </div>
            </div>''', unsafe_allow_html=True)

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
    # TAB 1: Income vs Expenses (NEW!)
    # ══════════════════════════════════════════════
    with tabs[1]:
        has_income = len(df_f[df_f['סכום'] > 0]) > 0
        has_expenses = len(df_f[df_f['סכום'] < 0]) > 0
        n_months = df_f['חודש'].nunique()

        # Income vs Expenses grouped bar chart
        st.markdown(f'<div class="section-label">💹 הכנסות מול הוצאות - השוואה חודשית</div>', unsafe_allow_html=True)
        if has_income or has_expenses:
            st.plotly_chart(chart_income_vs_expenses(df_f), use_container_width=True, key="ie_chart")
        else:
            st.markdown(f'<div style="text-align:center;padding:2rem;color:{T["text3"]}">אין נתוני הכנסות להשוואה. העלה קובץ הכנסות (עו"ש) או הוסף הכנסות ידנית בלשונית "תקציב".</div>', unsafe_allow_html=True)

        # Monthly breakdown table
        if has_income or has_expenses:
            st.markdown('<div class="section-divider"></div>', unsafe_allow_html=True)
            st.markdown(f'<div class="section-label">📊 פירוט חודשי</div>', unsafe_allow_html=True)
            months_sorted = df_f.drop_duplicates('חודש').sort_values('תאריך', ascending=False)['חודש'].unique()
            for m in months_sorted:
                m_df = df_f[df_f['חודש'] == m]
                m_income = m_df[m_df['סכום'] > 0]['סכום'].sum()
                m_expense = abs(m_df[m_df['סכום'] < 0]['סכום'].sum())
                m_balance = m_income - m_expense
                m_savings = (m_balance / m_income * 100) if m_income > 0 else 0
                bal_color = T['green'] if m_balance >= 0 else T['red']
                inc_pct = (m_income / max(m_income + m_expense, 1)) * 100

                st.markdown(f'''<div class="compare-card" style="margin-bottom:0.5rem">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
                        <div style="font-weight:800;font-size:clamp(0.88rem,3vw,1.05rem);color:{T['text1']};min-width:60px">{m}</div>
                        <div style="display:flex;gap:clamp(0.5rem,2vw,1.5rem);align-items:center;flex-wrap:wrap">
                            <div style="text-align:center">
                                <div style="font-size:0.65rem;color:{T['text3']};text-transform:uppercase;letter-spacing:0.5px">הכנסות</div>
                                <div style="font-weight:700;color:{T['green']};direction:ltr">{fmt(m_income)}</div>
                            </div>
                            <div style="text-align:center">
                                <div style="font-size:0.65rem;color:{T['text3']};text-transform:uppercase;letter-spacing:0.5px">הוצאות</div>
                                <div style="font-weight:700;color:{T['red']};direction:ltr">{fmt(m_expense)}</div>
                            </div>
                            <div style="text-align:center">
                                <div style="font-size:0.65rem;color:{T['text3']};text-transform:uppercase;letter-spacing:0.5px">מאזן</div>
                                <div style="font-weight:700;color:{bal_color};direction:ltr">{fmt(m_balance)}</div>
                            </div>
                            <span class="diff-badge {'down' if m_balance >= 0 else 'up'}" style="font-size:0.72rem">
                                {'↑' if m_savings > 0 else '↓'} {abs(m_savings):.0f}% חיסכון
                            </span>
                        </div>
                    </div>
                    <div class="ie-bar-container" style="margin-top:0.75rem">
                        <div class="ie-bar-income" style="width:{inc_pct:.0f}%"></div>
                        <div class="ie-bar-expense" style="width:{100 - inc_pct:.0f}%"></div>
                    </div>
                </div>''', unsafe_allow_html=True)

        # Cumulative savings chart
        if n_months >= 2 and (has_income or has_expenses):
            st.markdown('<div class="section-divider"></div>', unsafe_allow_html=True)
            st.markdown(f'<div class="section-label">📈 חיסכון מצטבר לאורך זמן</div>', unsafe_allow_html=True)
            st.plotly_chart(chart_net_savings(df_f), use_container_width=True, key="savings_chart")

    # ══════════════════════════════════════════════
    # TAB 2: Trends - Enhanced
    # ══════════════════════════════════════════════
    with tabs[2]:
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

        # ── Category % by Month ──
        st.markdown('<div class="section-divider"></div>', unsafe_allow_html=True)
        st.markdown(f'<div class="section-label">📊 התפלגות קטגוריות לפי חודש (%)</div>', unsafe_allow_html=True)
        st.markdown(f'<div style="color:{T["text2"]};font-size:0.8rem;margin-bottom:0.5rem">כמה אחוז מסך ההוצאות של כל חודש הלך לכל קטגוריה</div>', unsafe_allow_html=True)

        # Month selector for this section
        cat_pct_exp = df_f[df_f['סכום'] < 0]
        cat_pct_months = cat_pct_exp.drop_duplicates('חודש').sort_values('תאריך')['חודש'].tolist() if not cat_pct_exp.empty else []
        cat_pct_selected = st.multiselect("בחר חודשים להשוואה", options=cat_pct_months, default=cat_pct_months, key="cat_pct_months")

        cat_pct_data = df_f[df_f['חודש'].isin(cat_pct_selected)] if cat_pct_selected else df_f
        cat_pct_fig, cat_pct_table = chart_category_pct_by_month(cat_pct_data)
        st.plotly_chart(cat_pct_fig, use_container_width=True, key="cat_pct_chart")

        if not cat_pct_table.empty and len(cat_pct_table.columns) > 1:
            st.markdown(f'<div class="section-label" style="font-size:0.85rem">📋 טבלת פירוט אחוזים</div>', unsafe_allow_html=True)
            month_cols = [c for c in cat_pct_table.columns if c != 'קטגוריה']

            # Build styled HTML table
            tbl = f'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.82rem;direction:rtl">'
            tbl += f'<thead><tr style="border-bottom:2px solid {T["border"]}">'
            tbl += f'<th style="text-align:right;padding:8px 10px;color:{T["text1"]};font-weight:700">קטגוריה</th>'
            for m in month_cols:
                tbl += f'<th style="text-align:center;padding:8px 6px;color:{T["text1"]};font-weight:700">{m}</th>'
            tbl += '</tr></thead><tbody>'

            for _, row in cat_pct_table.iterrows():
                cat = row['קטגוריה']
                tbl += f'<tr style="border-bottom:1px solid {T["border"]}">'
                tbl += f'<td style="padding:6px 10px;color:{T["text1"]};font-weight:600">{icon_for(cat)} {cat}</td>'
                vals = [row[m] for m in month_cols]
                max_val = max(vals) if vals else 0
                for v in vals:
                    intensity = v / max_val if max_val > 0 else 0
                    bg = f'rgba(129,140,248,{intensity * 0.25})' if v > 0 else 'transparent'
                    tbl += f'<td style="text-align:center;padding:6px;color:{T["text1"]};background:{bg};font-weight:500">{v:.1f}%</td>'
                tbl += '</tr>'

            tbl += '</tbody></table></div>'
            st.markdown(tbl, unsafe_allow_html=True)

        # ── Category MoM Comparison ──
        mom_exp = df_f[df_f['סכום'] < 0]
        mom_months_sorted = mom_exp.drop_duplicates('חודש').sort_values('תאריך')['חודש'].tolist() if not mom_exp.empty else []
        if len(mom_months_sorted) >= 2:
            st.markdown('<div class="section-divider"></div>', unsafe_allow_html=True)
            st.markdown(f'<div class="section-label">🏷️ שינוי בקטגוריות חודש-על-חודש</div>', unsafe_allow_html=True)

            mom_c1, mom_c2 = st.columns(2)
            with mom_c1:
                mom_prev = st.selectbox("חודש קודם", options=mom_months_sorted, index=len(mom_months_sorted) - 2, key="mom_prev_month")
            with mom_c2:
                mom_curr = st.selectbox("חודש נוכחי", options=mom_months_sorted, index=len(mom_months_sorted) - 1, key="mom_curr_month")

            mom_data = compute_category_mom(df_f, prev_month=mom_prev, curr_month=mom_curr)
        else:
            mom_data = []
        if mom_data:
            prev_m = mom_data[0]['prev_month']
            curr_m = mom_data[0]['curr_month']
            st.markdown(
                f'<div style="color:{T["text2"]};font-size:0.82rem;margin-bottom:0.75rem">'
                f'השוואה: {prev_m} ← {curr_m}'
                f'</div>', unsafe_allow_html=True)

            grid_html = '<div class="mom-grid">'
            for item in mom_data:
                cat = item['category']
                icon = icon_for(cat)
                prev_val = item['prev_amount']
                curr_val = item['curr_amount']
                change = item['change_pct']
                direction = item['direction']

                if direction == 'up':
                    arrow = '↑'; color = T['red']; bg_tint = T['red'] + '11'
                elif direction == 'down':
                    arrow = '↓'; color = T['green']; bg_tint = T['green'] + '11'
                else:
                    arrow = '―'; color = T['text3']; bg_tint = T['surface2']

                grid_html += f'''<div class="mom-card" style="border-color:{color}33">
                    <div style="font-size:1.3rem">{icon}</div>
                    <div style="font-size:0.78rem;font-weight:600;color:{T['text1']}">{cat}</div>
                    <div class="mom-arrow" style="color:{color}">{arrow}</div>
                    <div style="font-size:0.85rem;font-weight:700;color:{color};direction:ltr">{abs(change):.0f}%</div>
                    <div style="display:flex;justify-content:space-around;margin-top:6px;font-size:0.7rem;color:{T['text3']};direction:ltr">
                        <span>₪{prev_val:,.0f}</span><span>→</span><span>₪{curr_val:,.0f}</span>
                    </div>
                </div>'''
            grid_html += '</div>'
            st.markdown(grid_html, unsafe_allow_html=True)

    # ══════════════════════════════════════════════
    # TAB 3: Merchants - Enhanced
    # ══════════════════════════════════════════════
    with tabs[3]:
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
    # TAB 4: Insights
    # ══════════════════════════════════════════════
    with tabs[4]:
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

            # ── Recurring Payments Detection ──
            st.markdown('<div class="section-divider"></div>', unsafe_allow_html=True)
            st.markdown(f'<div class="section-label">🔄 תשלומים חוזרים (מנויים)</div>', unsafe_allow_html=True)

            recurring = detect_recurring_payments(df_f)
            if not recurring.empty:
                st.markdown(
                    f'<div style="color:{T["text2"]};font-size:0.82rem;margin-bottom:0.75rem">'
                    f'זוהו {len(recurring)} תשלומים חוזרים עם סכום עקבי לאורך חודשים'
                    f'</div>', unsafe_allow_html=True)

                for _, rrow in recurring.iterrows():
                    merchant_name = str(rrow['merchant'])[:35]
                    avg_str = fmt(rrow['avg_amount'])
                    freq = int(rrow['frequency'])
                    consistency = 100 - rrow['std_pct']
                    total_str = fmt(rrow['total'])
                    months_str = rrow['months_list']

                    st.markdown(f'''<div class="recurring-card">
                        <div class="cat-icon" style="background:{T['accent']}22;color:{T['accent']}">💳</div>
                        <div style="flex:1;min-width:0">
                            <div style="font-weight:600;color:{T['text1']};font-size:0.88rem">{merchant_name}</div>
                            <div style="color:{T['text3']};font-size:0.75rem;margin-top:2px">
                                {freq} חודשים &bull; עקביות {consistency:.0f}%
                            </div>
                            <div style="color:{T['text3']};font-size:0.7rem;margin-top:2px;direction:ltr">{months_str}</div>
                        </div>
                        <div style="text-align:left;flex-shrink:0">
                            <div style="font-weight:700;color:{T['accent']};font-size:1rem;direction:ltr">{avg_str}</div>
                            <div style="font-size:0.7rem;color:{T['text3']}">ממוצע/חודש</div>
                        </div>
                    </div>''', unsafe_allow_html=True)

                total_recurring = recurring['avg_amount'].sum()
                st.markdown(f'''
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;
                    background:{T['accent']}11;border:1px solid {T['accent']}33;border-radius:10px;margin-top:0.5rem">
                    <div style="color:{T['text1']};font-weight:600;font-size:0.9rem">סה״כ תשלומים חוזרים (חודשי)</div>
                    <div style="color:{T['accent']};font-weight:700;font-size:1.1rem;direction:ltr">₪{total_recurring:,.0f}</div>
                </div>''', unsafe_allow_html=True)
            else:
                st.markdown(
                    f'<div style="text-align:center;padding:1.5rem;color:{T["text3"]}">'
                    f'<div style="font-size:1.5rem;margin-bottom:0.5rem">🔍</div>'
                    f'<div>לא זוהו תשלומים חוזרים. נדרשים לפחות 2 חודשי נתונים.</div>'
                    f'</div>', unsafe_allow_html=True)

    # ══════════════════════════════════════════════
    # TAB 5: Transactions - Side-by-Side Comparison
    # ══════════════════════════════════════════════
    with tabs[5]:
        st.markdown(f'<div class="section-label">📋 השוואת עסקאות חודשית</div>', unsafe_allow_html=True)

        available_months = df_f.drop_duplicates('חודש').sort_values('תאריך')['חודש'].tolist()

        sel_c1, sel_c2, sel_c3 = st.columns([2, 2, 2])
        with sel_c1:
            left_month = st.selectbox("📅 חודש ראשון", options=available_months,
                index=0 if len(available_months) > 0 else 0, key="compare_left_month")
        with sel_c2:
            right_month = st.selectbox("📅 חודש שני", options=available_months,
                index=min(1, len(available_months) - 1) if len(available_months) > 1 else 0, key="compare_right_month")
        with sel_c3:
            cmp_sort = st.selectbox("מיון", ['תאריך ↓','תאריך ↑','סכום ↓','סכום ↑'], key="compare_sort")

        smap = {'תאריך ↓':('תאריך',False),'תאריך ↑':('תאריך',True),'סכום ↓':('סכום_מוחלט',False),'סכום ↑':('סכום_מוחלט',True)}
        sc, sa = smap[cmp_sort]

        col_config = {
            "תאריך": st.column_config.DateColumn("תאריך", format="DD/MM/YYYY", width="small"),
            "תיאור": st.column_config.TextColumn("בית עסק", width="large"),
            "קטגוריה": st.column_config.TextColumn("קטגוריה", width="medium"),
            "סכום": st.column_config.NumberColumn("סכום (₪)", format="₪%.2f", width="small"),
        }

        # --- Side by Side Tables ---
        left_col, right_col = st.columns(2)

        left_df = df_f[df_f['חודש'] == left_month].sort_values(sc, ascending=sa)
        left_exp = left_df[left_df['סכום'] < 0]
        left_total = abs(left_exp['סכום'].sum()) if len(left_exp) > 0 else 0
        left_count = len(left_df)

        with left_col:
            st.markdown(f'''<div class="compare-card">
                <div class="compare-header">
                    <div class="compare-month">{left_month}</div>
                    <div class="compare-stat">
                        <div class="compare-stat-item">
                            <div class="compare-stat-val">₪{left_total:,.0f}</div>
                            <div class="compare-stat-label">הוצאות</div>
                        </div>
                        <div class="compare-stat-item">
                            <div class="compare-stat-val">{left_count}</div>
                            <div class="compare-stat-label">עסקאות</div>
                        </div>
                    </div>
                </div>
            </div>''', unsafe_allow_html=True)
            st.dataframe(left_df[['תאריך','תיאור','קטגוריה','סכום']], column_config=col_config,
                hide_index=True, use_container_width=True, height=400)

        right_df = df_f[df_f['חודש'] == right_month].sort_values(sc, ascending=sa)
        right_exp = right_df[right_df['סכום'] < 0]
        right_total = abs(right_exp['סכום'].sum()) if len(right_exp) > 0 else 0
        right_count = len(right_df)

        with right_col:
            st.markdown(f'''<div class="compare-card">
                <div class="compare-header">
                    <div class="compare-month">{right_month}</div>
                    <div class="compare-stat">
                        <div class="compare-stat-item">
                            <div class="compare-stat-val">₪{right_total:,.0f}</div>
                            <div class="compare-stat-label">הוצאות</div>
                        </div>
                        <div class="compare-stat-item">
                            <div class="compare-stat-val">{right_count}</div>
                            <div class="compare-stat-label">עסקאות</div>
                        </div>
                    </div>
                </div>
            </div>''', unsafe_allow_html=True)
            st.dataframe(right_df[['תאריך','תיאור','קטגוריה','סכום']], column_config=col_config,
                hide_index=True, use_container_width=True, height=400)

        # --- Comparison Summary ---
        st.markdown('<div class="section-divider"></div>', unsafe_allow_html=True)
        st.markdown(f'<div class="section-label">📊 סיכום השוואה</div>', unsafe_allow_html=True)

        if left_month != right_month:
            diff_total = right_total - left_total
            diff_pct = ((diff_total / left_total) * 100) if left_total > 0 else 0
            diff_class = 'up' if diff_total > 0 else 'down' if diff_total < 0 else 'neutral'
            diff_arrow = '↑' if diff_total > 0 else '↓' if diff_total < 0 else '―'
            diff_word = 'עלייה' if diff_total > 0 else 'ירידה' if diff_total < 0 else 'ללא שינוי'

            s1, s2, s3 = st.columns(3)
            with s1:
                st.markdown(f'''<div class="compare-summary-card">
                    <div style="color:{T['text3']};font-size:0.75rem;margin-bottom:4px">הפרש הוצאות</div>
                    <div style="font-size:1.2rem;font-weight:700;color:{T['red'] if diff_total > 0 else T['green']};direction:ltr">
                        {diff_arrow} ₪{abs(diff_total):,.0f}
                    </div>
                    <span class="diff-badge {diff_class}">{diff_word} {abs(diff_pct):.0f}%</span>
                </div>''', unsafe_allow_html=True)
            with s2:
                diff_count = right_count - left_count
                st.markdown(f'''<div class="compare-summary-card">
                    <div style="color:{T['text3']};font-size:0.75rem;margin-bottom:4px">הפרש עסקאות</div>
                    <div style="font-size:1.2rem;font-weight:700;color:{T['text1']};direction:ltr">
                        {'↑' if diff_count > 0 else '↓' if diff_count < 0 else '―'} {abs(diff_count)}
                    </div>
                </div>''', unsafe_allow_html=True)
            with s3:
                left_avg = (left_total / left_count) if left_count > 0 else 0
                right_avg = (right_total / right_count) if right_count > 0 else 0
                st.markdown(f'''<div class="compare-summary-card">
                    <div style="color:{T['text3']};font-size:0.75rem;margin-bottom:4px">ממוצע לעסקה</div>
                    <div style="font-size:1.2rem;font-weight:700;color:{T['text1']};direction:ltr">
                        ₪{right_avg:,.0f} vs ₪{left_avg:,.0f}
                    </div>
                </div>''', unsafe_allow_html=True)

            # --- Category Comparison ---
            st.markdown(f'<div class="section-label">🏷️ השוואת קטגוריות</div>', unsafe_allow_html=True)
            left_cats = left_exp.groupby('קטגוריה')['סכום_מוחלט'].sum() if len(left_exp) > 0 else pd.Series(dtype=float)
            right_cats = right_exp.groupby('קטגוריה')['סכום_מוחלט'].sum() if len(right_exp) > 0 else pd.Series(dtype=float)
            all_categories = sorted(set(left_cats.index) | set(right_cats.index))

            cat_html = '<div class="mom-grid">'
            for cat in all_categories:
                lv = left_cats.get(cat, 0)
                rv = right_cats.get(cat, 0)
                cat_diff = rv - lv
                cat_diff_pct = ((cat_diff / lv) * 100) if lv > 0 else (100 if rv > 0 else 0)
                cat_color = T['red'] if cat_diff > 0 else T['green'] if cat_diff < 0 else T['text3']
                cat_arrow = '↑' if cat_diff > 0 else '↓' if cat_diff < 0 else '―'

                cat_html += f'''<div class="mom-card" style="border-color:{cat_color}33">
                    <div style="font-size:1.25rem;margin-bottom:4px">{icon_for(cat)}</div>
                    <div style="font-size:0.78rem;font-weight:600;color:{T['text1']}">{cat}</div>
                    <div class="mom-arrow" style="color:{cat_color}">{cat_arrow}</div>
                    <div style="font-size:0.85rem;font-weight:700;color:{cat_color};direction:ltr">{abs(cat_diff_pct):.0f}%</div>
                    <div style="display:flex;justify-content:space-around;margin-top:6px;font-size:0.7rem;color:{T['text3']};direction:ltr">
                        <span>₪{lv:,.0f}</span><span>→</span><span>₪{rv:,.0f}</span>
                    </div>
                </div>'''
            cat_html += '</div>'
            st.markdown(cat_html, unsafe_allow_html=True)
        else:
            st.markdown(f'<div style="text-align:center;padding:1.5rem;color:{T["text3"]}">בחר שני חודשים שונים להשוואה</div>', unsafe_allow_html=True)

        st.markdown(f'<div style="color:{T["text3"]};font-size:0.82rem;margin-top:1rem;text-align:center">{len(df_f):,} עסקאות בסה״כ (כל החודשים המסוננים)</div>', unsafe_allow_html=True)

    # ══════════════════════════════════════════════
    # TAB 6: Budget
    # ══════════════════════════════════════════════
    with tabs[6]:
        render_income_tab(df_f)

    with tabs[7]:
        render_data_management_tab(df_f)

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
    """Compact login page -- two-column layout like modern SaaS."""
    init_auth_state()
    page = st.session_state.auth_page

    # Auth CSS
    st.markdown(f"""
    <style>
    section[data-testid="stSidebar"],
    [data-testid="collapsedControl"],
    button[aria-label="Collapse sidebar"],
    button[aria-label="Expand sidebar"] {{ display: none !important; }}
    [data-testid="stAppViewBlockContainer"] {{ max-width: 900px !important; margin: 0 auto !important; padding-top: 2rem !important; }}
    @media(max-width:480px) {{
        [data-testid="stAppViewBlockContainer"] {{ padding: 0.75rem !important; padding-top: 1rem !important; }}
    }}
    [data-testid="stTextInput"] {{ margin-bottom: 0.2rem; }}
    [data-testid="stTextInput"] input {{
        background: {T['surface2']} !important; border: 1.5px solid {T['border']} !important;
        border-radius: 10px !important; padding: 0.7rem 0.9rem !important;
        font-size: 0.92rem !important; color: {T['text1']} !important;
    }}
    [data-testid="stTextInput"] input:focus {{ border-color: {T['accent']} !important; box-shadow: 0 0 0 3px rgba(129,140,248,0.1) !important; }}
    [data-testid="stTextInput"] input::placeholder {{ color: {T['text3']} !important; }}
    .stButton > button {{
        background: linear-gradient(135deg, #818cf8, #6d28d9) !important; color: #fff !important;
        border: none !important; border-radius: 10px !important; padding: 0.7rem !important;
        font-size: 0.95rem !important; font-weight: 700 !important;
        box-shadow: 0 4px 16px rgba(129,140,248,0.25) !important;
    }}
    .stButton > button:hover {{ transform: translateY(-1px) !important; box-shadow: 0 6px 24px rgba(129,140,248,0.35) !important; }}
    </style>
    """, unsafe_allow_html=True)

    # Two-column layout: left = branding, right = form
    col_brand, col_form = st.columns([1, 1], gap="large")

    with col_brand:
        st.markdown(f'''
        <div style="display:flex;flex-direction:column;justify-content:center;height:100%;padding:2rem 1rem">
            <div style="width:clamp(42px,12vw,56px);height:clamp(42px,12vw,56px);background:linear-gradient(135deg,#818cf8,#6d28d9);
                border-radius:16px;display:flex;align-items:center;justify-content:center;
                font-size:clamp(1.2rem,4vw,1.6rem);box-shadow:0 6px 24px rgba(129,140,248,0.2);margin-bottom:1.25rem">💳</div>
            <div style="font-size:clamp(1.1rem,4vw,1.5rem);font-weight:800;color:{T['text1']};margin-bottom:0.4rem">מנתח עסקאות</div>
            <div style="color:{T['text2']};font-size:clamp(0.78rem,2.5vw,0.88rem);line-height:1.6;margin-bottom:1.5rem">ניתוח חכם של הוצאות כרטיס האשראי שלך. העלה קובץ, קבל תובנות.</div>
            <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
                <div style="display:flex;align-items:center;gap:0.4rem"><span style="font-size:1rem">🔒</span><span style="font-size:0.78rem;color:{T['text3']}">מאובטח</span></div>
                <div style="display:flex;align-items:center;gap:0.4rem"><span style="font-size:1rem">☁️</span><span style="font-size:0.78rem;color:{T['text3']}">שמירה בענן</span></div>
                <div style="display:flex;align-items:center;gap:0.4rem"><span style="font-size:1rem">📊</span><span style="font-size:0.78rem;color:{T['text3']}">ניתוח חכם</span></div>
            </div>
        </div>
        ''', unsafe_allow_html=True)

    with col_form:
        # ─── LOGIN ───
        if page == 'login':
            st.markdown(f'<div style="font-size:1.1rem;font-weight:700;color:{T["text1"]};margin-bottom:1rem">👋 התחברות</div>', unsafe_allow_html=True)
            email = st.text_input("אימייל", placeholder="name@example.com", key="login_email", label_visibility="collapsed")
            password = st.text_input("סיסמה", type="password", placeholder="סיסמה", key="login_pass", label_visibility="collapsed")
            if st.button("התחבר →", use_container_width=True, key="login_btn"):
                if not email or not password: st.error("נא למלא אימייל וסיסמה")
                elif not validate_email(email): st.error("כתובת מייל לא תקינה")
                else:
                    ok, msg = sign_in(email, password)
                    if ok:
                        settings = load_user_settings()
                        if settings.get('theme'): st.session_state.theme = settings['theme']
                        st.rerun()
                    else: st.error(msg)
            c1, c2 = st.columns(2)
            with c1:
                if st.button("צור חשבון", use_container_width=True, key="goto_register"):
                    st.session_state.auth_page = 'register'; st.rerun()
            with c2:
                if st.button("שכחתי סיסמה", use_container_width=True, key="goto_reset"):
                    st.session_state.auth_page = 'reset'; st.rerun()

        # ─── REGISTER ───
        elif page == 'register':
            st.markdown(f'<div style="font-size:1.1rem;font-weight:700;color:{T["text1"]};margin-bottom:1rem">✨ הרשמה</div>', unsafe_allow_html=True)
            full_name = st.text_input("שם", placeholder="שם מלא", key="reg_name", label_visibility="collapsed")
            email = st.text_input("אימייל", placeholder="name@example.com", key="reg_email", label_visibility="collapsed")
            c1, c2 = st.columns(2)
            with c1: password = st.text_input("סיסמה", type="password", placeholder="6+ תווים", key="reg_pass", label_visibility="collapsed")
            with c2: password2 = st.text_input("אימות", type="password", placeholder="שוב", key="reg_pass2", label_visibility="collapsed")
            if st.button("צור חשבון →", use_container_width=True, key="reg_btn"):
                if not all([full_name, email, password, password2]): st.error("נא למלא את כל השדות")
                elif not validate_email(email): st.error("מייל לא תקין")
                elif password != password2: st.error("הסיסמאות לא תואמות")
                else:
                    ok_p, msg_p = validate_password(password)
                    if not ok_p: st.error(msg_p)
                    else:
                        ok, msg = sign_up(email, password, full_name)
                        if ok: st.success(msg); st.session_state.auth_page = 'login'
                        else: st.error(msg)
            if st.button("← חזור", use_container_width=True, key="back_login"):
                st.session_state.auth_page = 'login'; st.rerun()

        # ─── RESET ───
        elif page == 'reset':
            st.markdown(f'<div style="font-size:1.1rem;font-weight:700;color:{T["text1"]};margin-bottom:0.5rem">🔑 איפוס סיסמה</div>', unsafe_allow_html=True)
            st.markdown(f'<div style="color:{T["text2"]};font-size:0.82rem;margin-bottom:0.75rem">נשלח לך קישור למייל</div>', unsafe_allow_html=True)
            email = st.text_input("אימייל", placeholder="name@example.com", key="reset_email", label_visibility="collapsed")
            if st.button("שלח →", use_container_width=True, key="reset_btn"):
                if not email: st.error("נא להזין מייל")
                elif not validate_email(email): st.error("מייל לא תקין")
                else:
                    ok, msg = reset_password(email)
                    if ok: st.success(msg)
                    else: st.error(msg)
            if st.button("← חזור", use_container_width=True, key="back_login2"):
                st.session_state.auth_page = 'login'; st.rerun()

        # Guest + theme
        st.markdown(f'<div style="height:1px;background:{T["border"]};margin:1rem 0 0.75rem"></div>', unsafe_allow_html=True)
        gc1, gc2 = st.columns(2)
        with gc1:
            if st.button("🚀 המשך כאורח", use_container_width=True, key="skip_auth"):
                st.session_state.auth_user = {"id": "guest", "email": "guest", "name": "אורח"}; st.rerun()
        with gc2:
            theme_icon = "☀️" if IS_DARK else "🌙"
            theme_txt = "בהיר" if IS_DARK else "כהה"
            if st.button(f"{theme_icon} {theme_txt}", use_container_width=True, key="auth_theme"):
                st.session_state.theme = 'light' if IS_DARK else 'dark'; st.rerun()


# =============================================================================
# Entry Point
# =============================================================================
if __name__ == "__main__":
    init_auth_state()
    
    if is_configured() and not is_logged_in():
        render_auth_page()
    else:
        main()
