"""
מנתח עסקאות כרטיס אשראי - גרסה מקצועית
========================================
Dashboard מקצועי לניתוח עסקאות כרטיס אשראי
עוצב ברמה של מפתח Frontend עם 10+ שנות ניסיון
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
import json
import time
import os

warnings.filterwarnings('ignore')

# #region agent log
def log_debug(message, data, hypothesis_id, location):
    try:
        log_dir = r"d:\Transactions\.cursor"
        os.makedirs(log_dir, exist_ok=True)
        log_entry = {
            "sessionId": "debug-session",
            "runId": "run1",
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000)
        }
        with open(os.path.join(log_dir, "debug.log"), "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    except Exception:
        pass
# #endregion

# =============================================================================
# הגדרות
# =============================================================================

st.set_page_config(
    page_title="מנתח עסקאות | Dashboard",
    page_icon="💳",
    layout="wide",
    initial_sidebar_state="expanded"
)

# =============================================================================
# Design System - עיצוב CSS מקצועי ברמה גבוהה
# =============================================================================

st.markdown("""
<style>
    /* ========== Google Fonts ========== */
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
    
    /* ========== CSS Variables - Design System (Slate Theme) ========== */
    :root {
        /* Background Colors - Slate Palette */
        --bg-primary: #0f172a; /* slate-900 */
        --bg-secondary: #1e293b; /* slate-800 */
        --bg-card: #1e293b; /* slate-800 */
        --bg-card-hover: #334155; /* slate-700 */
        --bg-elevated: #334155; /* slate-700 */
        --bg-overlay: rgba(15, 23, 42, 0.7);
        
        /* Text Colors - High Contrast */
        --text-primary: #f8fafc; /* slate-50 */
        --text-secondary: #cbd5e1; /* slate-300 */
        --text-muted: #94a3b8; /* slate-400 */
        --text-disabled: #64748b; /* slate-500 */
        
        /* Accent Colors - Indigo & Emerald */
        --accent-primary: #6366f1; /* indigo-500 */
        --accent-primary-light: #818cf8; /* indigo-400 */
        --accent-primary-dark: #4f46e5; /* indigo-600 */
        --accent-secondary: #10b981; /* emerald-500 */
        --accent-warning: #f59e0b; /* amber-500 */
        --accent-danger: #ef4444; /* red-500 */
        --accent-info: #0ea5e9; /* sky-500 */
        --accent-purple: #8b5cf6; /* violet-500 */
        --accent-pink: #ec4899; /* pink-500 */
        --accent-cyan: #06b6d4; /* cyan-500 */
        
        /* Gradients */
        --gradient-primary: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        --gradient-secondary: linear-gradient(135deg, #10b981 0%, #34d399 100%);
        --gradient-danger: linear-gradient(135deg, #f43f5e 0%, #ef4444 100%);
        --gradient-card: linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, rgba(30, 41, 59, 0) 100%);
        --gradient-glow: radial-gradient(circle at center, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
        
        /* Borders */
        --border-color: #334155; /* slate-700 */
        --border-color-hover: #475569; /* slate-600 */
        --border-accent: rgba(99, 102, 241, 0.5);
        
        /* Shadows */
        --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        --shadow-glow: 0 0 20px rgba(99, 102, 241, 0.2);
        --shadow-glow-sm: 0 0 10px rgba(99, 102, 241, 0.15);
        
        /* Spacing */
        --space-xs: 0.25rem;
        --space-sm: 0.5rem;
        --space-md: 1rem;
        --space-lg: 1.5rem;
        --space-xl: 2rem;
        --space-2xl: 3rem;
        
        /* Border Radius */
        --radius-sm: 6px;
        --radius-md: 10px;
        --radius-lg: 16px;
        --radius-xl: 24px;
        --radius-full: 9999px;
        
        /* Transitions */
        --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
        --transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
        --transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
        --transition-bounce: 500ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }
    
    /* ========== Keyframe Animations ========== */
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(-30px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes scaleIn {
        from {
            opacity: 0;
            transform: scale(0.9);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
    }
    
    @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
    }
    
    @keyframes glow {
        0%, 100% { box-shadow: 0 0 15px rgba(102, 126, 234, 0.3); }
        50% { box-shadow: 0 0 25px rgba(102, 126, 234, 0.5); }
    }
    
    @keyframes progressFill {
        from { width: 0; }
    }
    
    @keyframes countUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    /* ========== Global Styles ========== */
    * {
        font-family: 'Heebo', -apple-system, BlinkMacSystemFont, sans-serif !important;
        box-sizing: border-box;
    }
    
    html, body, .stApp {
        background: #1a1f2e !important;
        color: #ffffff;
        direction: rtl;
        text-align: right;
    }
    
    .stApp {
        background: 
            radial-gradient(ellipse at center, rgba(129, 140, 248, 0.06) 0%, transparent 60%),
            radial-gradient(ellipse at top right, rgba(167, 139, 250, 0.05) 0%, transparent 50%),
            var(--bg-primary) !important;
        background-attachment: fixed;
    }
    
    /* ========== Hide Streamlit Elements ========== */
    #MainMenu, footer, header, .stDeployButton,
    [data-testid="collapsedControl"],
    [data-testid="stSidebarCollapseButton"],
    button[kind="headerNoPadding"],
    div[data-testid="stSidebarNav"],
    .stSidebarCollapsedControl,
    button[aria-label="Collapse sidebar"],
    button[aria-label="Expand sidebar"],
    [data-testid="stElementToolbar"],
    [data-testid="stElementToolbarButton"],
    [data-testid="stBaseButton-minimal"],
    .stElementToolbar,
    div[data-baseweb="tooltip"],
    [data-testid="StyledFullScreenButton"] {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
        pointer-events: none !important;
    }
    
    /* ========== App Header ========== */
    .app-header {
        text-align: center;
        padding: var(--space-xl) 0 var(--space-lg) 0;
        animation: fadeInUp 0.6s ease-out;
    }
    
    .app-title {
        font-size: 2.75rem;
        font-weight: 800;
        background: var(--gradient-primary);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin: 0;
        letter-spacing: -0.5px;
        text-shadow: 0 0 40px rgba(102, 126, 234, 0.4);
    }
    
    .app-subtitle {
        color: var(--text-secondary);
        font-size: 1.1rem;
        font-weight: 400;
        margin-top: var(--space-sm);
        opacity: 0;
        animation: fadeIn 0.5s ease-out 0.3s forwards;
    }
    
    /* ========== Metrics Cards - Premium Design ========== */
    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-lg);
        margin: var(--space-xl) 0;
    }
    
    @media (max-width: 1024px) {
        .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: var(--space-md); }
    }
    
    @media (max-width: 600px) {
        .metrics-grid { grid-template-columns: 1fr; }
    }
    
    .metric-card {
        background: linear-gradient(180deg, rgba(129, 140, 248, 0.08) 0%, rgba(167, 139, 250, 0.04) 100%), #2a3347;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 16px;
        padding: 1.5rem;
        text-align: center;
        position: relative;
        overflow: hidden;
        transition: all 0.25s ease;
    }
    
    .metric-card:nth-child(1) { animation-delay: 0.05s; }
    .metric-card:nth-child(2) { animation-delay: 0.1s; }
    .metric-card:nth-child(3) { animation-delay: 0.15s; }
    .metric-card:nth-child(4) { animation-delay: 0.2s; }
    
    .metric-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--gradient-primary);
        opacity: 0;
        transition: opacity var(--transition-normal);
    }
    
    .metric-card:hover {
        transform: translateY(-4px);
        border-color: var(--border-accent);
        box-shadow: var(--shadow-glow);
    }
    
    .metric-card:hover::before {
        opacity: 1;
    }
    
    .metric-icon-wrapper {
        width: 56px;
        height: 56px;
        margin: 0 auto var(--space-md);
        background: var(--gradient-primary);
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: var(--shadow-glow-sm);
    }
    
    .metric-icon {
        font-size: 1.75rem;
        line-height: 1;
    }
    
    .metric-value {
        font-size: 1.875rem;
        font-weight: 700;
        color: var(--text-primary);
        direction: ltr;
        display: block;
        margin-bottom: var(--space-xs);
        animation: countUp 0.6s ease-out;
    }
    
    .metric-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .metric-trend {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: var(--radius-full);
        margin-top: var(--space-sm);
    }
    
    .metric-trend.up {
        background: rgba(72, 187, 120, 0.15);
        color: var(--accent-secondary);
    }
    
    .metric-trend.down {
        background: rgba(252, 129, 129, 0.15);
        color: var(--accent-danger);
    }
    
    /* ========== Section Titles ========== */
    .section-title {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        color: var(--text-primary);
        font-weight: 600;
        font-size: 1.1rem;
        margin: var(--space-sm) 0 var(--space-md) 0;
        padding-bottom: var(--space-sm);
        border-bottom: 1px solid var(--border-color);
    }
    
    .section-title span {
        font-size: 1.25rem;
    }
    
    /* ========== Chart Containers ========== */
    div[data-testid="stPlotlyChart"] {
        background: #2a3347;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1rem;
        transition: all 0.2s ease;
    }
    
    div[data-testid="stPlotlyChart"]:hover {
        border-color: var(--border-color-hover);
        box-shadow: var(--shadow-md);
    }
    
    div[data-testid="stPlotlyChart"] > div {
        border-radius: var(--radius-md);
        overflow: hidden;
    }
    
    /* ========== Sidebar - Premium Design ========== */
    section[data-testid="stSidebar"] {
        background: linear-gradient(180deg, #232a3b 0%, #2a3347 100%) !important;
        border-left: 1px solid rgba(255,255,255,0.1);
        direction: rtl;
        min-width: 280px;
        max-width: 320px;
        width: 300px;
    }
    
    section[data-testid="stSidebar"] > div {
        direction: rtl;
        text-align: right;
        padding: var(--space-xl) var(--space-md) var(--space-2xl) var(--space-md);
    }
    
    .sidebar-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text-primary);
        text-align: center;
        margin-bottom: var(--space-lg);
        padding-bottom: var(--space-md);
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-sm);
    }
    
    .sidebar-title::before {
        content: '📁';
        font-size: 1.25rem;
    }
    
    /* ========== File Uploader - Enhanced ========== */
    [data-testid="stFileUploader"] {
        direction: rtl !important;
        text-align: right !important;
    }
    
    [data-testid="stFileUploader"] section {
        direction: rtl !important;
        text-align: right !important;
        background: #333d52 !important;
        border: 2px dashed rgba(255,255,255,0.2) !important;
        border-radius: 10px !important;
        padding: 1.5rem !important;
        transition: all 0.2s ease !important;
    }
    
    [data-testid="stFileUploader"] section:hover {
        border-color: #818cf8 !important;
        background: rgba(129, 140, 248, 0.08) !important;
    }
    
    [data-testid="stFileUploader"] section > div:first-child > div:first-child,
    [data-testid="stFileUploader"] small {
        display: none !important;
    }
    
    [data-testid="stFileUploader"] button {
        background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%) !important;
        color: white !important;
        border-radius: 6px !important;
        padding: 0.75rem 1.5rem !important;
        font-weight: 600 !important;
        border: none !important;
        margin-top: var(--space-sm) !important;
        transition: all var(--transition-normal) !important;
        box-shadow: var(--shadow-sm) !important;
    }
    
    [data-testid="stFileUploader"] button:hover {
        transform: translateY(-2px) !important;
        box-shadow: var(--shadow-glow-sm) !important;
    }
    
    [data-testid="stFileUploaderFile"] {
        direction: rtl !important;
        text-align: right !important;
        background: var(--bg-card) !important;
        border: 1px solid var(--border-color) !important;
        border-radius: var(--radius-sm) !important;
        padding: var(--space-sm) var(--space-md) !important;
        margin-top: var(--space-sm) !important;
    }
    
    /* ========== RTL Form Elements ========== */
    [data-testid="stWidgetLabel"],
    .stSelectbox label,
    .stMultiSelect label,
    .stDateInput label,
    .stTextInput label {
        direction: rtl !important;
        text-align: right !important;
        width: 100% !important;
        display: block !important;
        color: var(--text-secondary) !important;
        font-weight: 500 !important;
        margin-bottom: var(--space-xs) !important;
    }
    
    [data-testid="stSelectbox"],
    [data-testid="stMultiSelect"],
    [data-testid="stTextInput"] {
        direction: rtl !important;
    }
    
    [data-baseweb="select"],
    [data-baseweb="select"] > div {
        direction: rtl !important;
        text-align: right !important;
        background: #3a4560 !important;
        border: 1px solid rgba(255,255,255,0.15) !important;
        border-radius: var(--radius-sm) !important;
        color: #ffffff !important;
    }
    
    [data-baseweb="select"] span,
    [data-baseweb="select"] div {
        color: #ffffff !important;
    }
    
    [data-baseweb="select"] [data-baseweb="icon"] {
        order: -1 !important;
        margin-left: 8px !important;
        margin-right: 0 !important;
        color: #c5cdd9 !important;
    }
    
    [data-baseweb="popover"],
    [data-baseweb="menu"],
    ul[role="listbox"] {
        direction: rtl !important;
        text-align: right !important;
        background: #3a4560 !important;
        border: 1px solid rgba(255,255,255,0.2) !important;
        border-radius: var(--radius-sm) !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
    }
    
    ul[role="listbox"] li {
        direction: rtl !important;
        text-align: right !important;
        color: #ffffff !important;
        padding: 10px 16px !important;
    }
    
    ul[role="listbox"] li:hover {
        background: #4a5873 !important;
    }
    
    ul[role="listbox"] li[aria-selected="true"] {
        background: #818cf8 !important;
        color: #ffffff !important;
    }
    
    [data-testid="stDateInput"] > div {
        direction: ltr !important;
    }
    
    [data-testid="stDateInput"] input {
        direction: ltr !important;
        text-align: center !important;
        background: #3a4560 !important;
        border: 1px solid rgba(255,255,255,0.15) !important;
        border-radius: 6px !important;
        color: #ffffff !important;
        padding: 10px 12px !important;
    }
    
    [data-testid="stTextInput"] input {
        direction: rtl !important;
        text-align: right !important;
        background: #3a4560 !important;
        border: 1px solid rgba(255,255,255,0.15) !important;
        border-radius: 6px !important;
        color: #ffffff !important;
        padding: 10px 12px !important;
    }
    
    [data-testid="stTextInput"] input::placeholder {
        color: #94a3b8 !important;
    }
    
    [data-testid="stMultiSelect"] [data-baseweb="tag"] {
        direction: rtl !important;
        background: var(--accent-primary) !important;
        border-radius: var(--radius-full) !important;
    }
    
    [data-testid="column"] {
        direction: rtl !important;
    }
    
    /* ========== Tabs - Modern Design ========== */
    .stTabs [data-baseweb="tab-list"] {
        gap: 4px;
        background: #2a3347;
        border-radius: 10px;
        padding: 4px;
        direction: rtl;
        border: 1px solid rgba(255,255,255,0.1);
    }
    
    .stTabs [data-baseweb="tab"] {
        background: transparent;
        border-radius: 6px;
        color: #c5cdd9;
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
        font-weight: 500;
        transition: all 0.15s ease;
    }
    
    .stTabs [data-baseweb="tab"]:hover {
        color: #ffffff;
        background: #3a4560;
    }
    
    .stTabs [aria-selected="true"] {
        background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%) !important;
        color: white !important;
        box-shadow: 0 2px 8px rgba(129, 140, 248, 0.3);
    }
    
    /* ========== Buttons - Enhanced ========== */
    .stButton > button {
        background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 0.5rem 1.5rem;
        font-weight: 600;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(129, 140, 248, 0.3);
    }
    
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(129, 140, 248, 0.4);
    }
    
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-glow-sm);
    }
    
    .stDownloadButton > button {
        background: var(--gradient-secondary);
    }
    
    /* ========== Category List - Premium ========== */
    .category-card {
        background: #2a3347;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 1rem;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        transition: all 0.2s ease;
    }
    
    .category-card:hover {
        background: #333d52;
        border-color: rgba(129, 140, 248, 0.4);
    }
    
    .category-card:nth-child(1) { animation-delay: 0.02s; }
    .category-card:nth-child(2) { animation-delay: 0.04s; }
    .category-card:nth-child(3) { animation-delay: 0.06s; }
    .category-card:nth-child(4) { animation-delay: 0.2s; }
    .category-card:nth-child(5) { animation-delay: 0.25s; }
    .category-card:nth-child(6) { animation-delay: 0.3s; }
    .category-card:nth-child(7) { animation-delay: 0.35s; }
    .category-card:nth-child(8) { animation-delay: 0.4s; }
    
    .category-card:hover {
        border-color: var(--border-accent);
        transform: translateX(-4px);
        box-shadow: var(--shadow-md);
    }
    
    .category-icon-wrapper {
        width: 44px;
        height: 44px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        flex-shrink: 0;
    }
    
    .category-info {
        flex: 1;
        min-width: 0;
    }
    
    .category-name {
        color: var(--text-primary);
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: var(--space-xs);
    }
    
    .category-bar-container {
        height: 6px;
        background: var(--bg-elevated);
        border-radius: var(--radius-full);
        overflow: hidden;
    }
    
    .category-bar {
        height: 100%;
        border-radius: var(--radius-full);
        animation: progressFill 0.8s ease-out;
    }
    
    .category-stats {
        text-align: left;
        direction: ltr;
        flex-shrink: 0;
    }
    
    .category-amount {
        color: var(--text-primary);
        font-weight: 700;
        font-size: 1rem;
    }
    
    .category-percent {
        color: var(--text-muted);
        font-size: 0.75rem;
    }
    
    /* ========== Empty State ========== */
    .empty-state {
        text-align: center;
        padding: var(--space-2xl) var(--space-lg);
        animation: fadeInUp 0.6s ease-out;
    }
    
    .empty-icon {
        font-size: 4rem;
        margin-bottom: var(--space-lg);
        animation: pulse 2s ease-in-out infinite;
    }
    
    .empty-title {
        color: var(--text-primary);
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: var(--space-sm);
    }
    
    .empty-text {
        color: var(--text-secondary);
        font-size: 1rem;
    }
    
    /* ========== Feature Cards ========== */
    .feature-card {
        background: linear-gradient(180deg, rgba(129, 140, 248, 0.08) 0%, rgba(167, 139, 250, 0.04) 100%), #2a3347;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 2rem;
        text-align: center;
        transition: all 0.2s ease;
    }
    
    .feature-card:nth-child(1) { animation-delay: 0.1s; }
    .feature-card:nth-child(2) { animation-delay: 0.15s; }
    .feature-card:nth-child(3) { animation-delay: 0.2s; }
    
    .feature-card:hover {
        transform: translateY(-4px);
        border-color: rgba(129, 140, 248, 0.4);
        border-color: var(--border-accent);
        box-shadow: var(--shadow-glow-sm);
    }
    
    .feature-icon {
        font-size: 2.5rem;
        margin-bottom: var(--space-md);
    }
    
    .feature-title {
        color: var(--text-primary);
        font-weight: 600;
        font-size: 1.1rem;
        margin-bottom: var(--space-xs);
    }
    
    .feature-desc {
        color: var(--text-secondary);
        font-size: 0.875rem;
    }
    
    /* ========== Alerts - Styled ========== */
    .stSuccess, .stError, .stWarning, .stInfo {
        border-radius: var(--radius-md) !important;
        border: none !important;
    }
    
    .stSuccess {
        background: rgba(72, 187, 120, 0.15) !important;
        color: var(--accent-secondary) !important;
    }
    
    .stError {
        background: rgba(252, 129, 129, 0.15) !important;
        color: var(--accent-danger) !important;
    }
    
    .stWarning {
        background: rgba(237, 137, 54, 0.15) !important;
        color: var(--accent-warning) !important;
    }
    
    /* ========== Transactions Table ========== */
    .transactions-table {
        width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        direction: rtl !important;
        background: #2a3347 !important;
        border-radius: 12px !important;
        overflow: hidden !important;
        font-family: 'Heebo', sans-serif !important;
    }
    
    .transactions-table th {
        background: #333d52 !important;
        color: #a5b4fc !important;
        padding: 14px 18px !important;
        text-align: right !important;
        direction: rtl !important;
        font-weight: 600 !important;
        font-size: 0.85rem !important;
        letter-spacing: 0.3px !important;
        border-bottom: 2px solid rgba(255,255,255,0.1) !important;
    }
    
    .transactions-table td {
        padding: 12px 18px;
        text-align: right !important;
        direction: rtl !important;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        color: #ffffff;
        background: #2a3347;
        unicode-bidi: embed;
    }
    
    .transactions-table tr:nth-child(even) td {
        background: #2f3a4d;
    }
    
    .transactions-table tr:hover td {
        background: #3a4560 !important;
    }
    
    .transactions-table tr:last-child td {
        border-bottom: none;
    }
    
    .transactions-table .col-amount {
        font-weight: 700;
        color: #f87171;
        font-variant-numeric: tabular-nums;
        text-align: right !important;
        direction: rtl !important;
    }
    
    .transactions-table .col-date {
        color: #94a3b8;
        font-variant-numeric: tabular-nums;
        text-align: right !important;
        direction: rtl !important;
    }
    
    .transactions-table .col-category {
        color: #c4b5fd;
        text-align: right !important;
        direction: rtl !important;
    }
    
    .transactions-table td * {
        text-align: right !important;
        direction: rtl !important;
    }
    
    .table-scroll {
        max-height: 500px;
        overflow-y: auto;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        background: #2a3347;
    }
    
    /* ========== Metrics in Tabs ========== */
    [data-testid="stMetric"] {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: var(--space-md);
    }
    
    [data-testid="stMetricLabel"] {
        color: var(--text-secondary) !important;
    }
    
    [data-testid="stMetricValue"] {
        color: var(--text-primary) !important;
        font-weight: 700 !important;
    }
    
    /* ========== Slider ========== */
    .stSlider > div > div {
        background: var(--bg-elevated) !important;
    }
    
    .stSlider [data-baseweb="slider"] > div {
        background: var(--gradient-primary) !important;
    }
    
    /* ========== Scrollbars ========== */
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    
    ::-webkit-scrollbar-track {
        background: var(--bg-primary);
        border-radius: var(--radius-full);
    }
    
    ::-webkit-scrollbar-thumb {
        background: var(--border-color);
        border-radius: var(--radius-full);
        transition: background var(--transition-fast);
    }
    
    ::-webkit-scrollbar-thumb:hover {
        background: var(--text-muted);
    }
    
    section[data-testid="stSidebar"]::-webkit-scrollbar {
        width: 4px;
    }
    
    /* ========== Loading Skeleton ========== */
    .skeleton {
        background: linear-gradient(
            90deg,
            var(--bg-elevated) 25%,
            var(--bg-card-hover) 50%,
            var(--bg-elevated) 75%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: var(--radius-sm);
    }
    
    /* ========== Expander ========== */
    .streamlit-expanderHeader {
        background: var(--bg-card) !important;
        border-radius: var(--radius-md) !important;
        direction: rtl;
    }
    
    [data-testid="stExpander"] {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
    }
    
    /* ========== Divider ========== */
    hr {
        border: none;
        height: 1px;
        background: var(--border-color);
        margin: var(--space-lg) 0;
    }
    
    /* ========== Caption ========== */
    .stCaption {
        color: var(--text-muted) !important;
    }
    
    /* ========== Performance Optimizations ========== */
    /* CSS Containment for better rendering performance */
    .metric-card,
    .category-card,
    .feature-card,
    div[data-testid="stPlotlyChart"] {
        contain: layout style;
        will-change: transform;
    }
    
    /* GPU acceleration for animations */
    .metric-card:hover,
    .category-card:hover,
    .feature-card:hover {
        transform: translateZ(0);
    }
    
    /* Optimize scrolling performance */
    .table-scroll {
        contain: strict;
        overflow: auto;
        overscroll-behavior: contain;
    }
    
    /* Reduce paint areas */
    .stApp > div {
        contain: layout;
    }
    
    /* Optimize font rendering */
    * {
        text-rendering: optimizeSpeed;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }
    
    /* Reduce reflows on animations */
    @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
        }
    }
    
    /* ========== Print Styles ========== */
    @media print {
        .stApp {
            background: white !important;
        }
        .metric-card,
        .category-card,
        .transactions-table {
            break-inside: avoid;
        }
        section[data-testid="stSidebar"] {
            display: none !important;
        }
    }
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
        row_str = ' '.join(row.astype(str).str.lower())
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


def process_data(df: pd.DataFrame, date_col: str, amount_col: str, desc_col: str, cat_col: Optional[str]) -> pd.DataFrame:
    """עיבוד הנתונים עם טיפול מקיף ב-edge cases"""
    if df.empty:
        return pd.DataFrame()
    
    result = df.copy()
    
    # פרסור תאריכים
    try:
        result['תאריך'] = parse_dates(result[date_col])
    except Exception:
        result['תאריך'] = pd.NaT
    
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
    non_zero = result['סכום'][result['סכום'] != 0]
    if len(non_zero) > 0:
        positive_ratio = (non_zero > 0).sum() / len(non_zero)
        if positive_ratio > 0.8:  # אם יותר מ-80% חיוביים - אלה הוצאות
            result['סכום'] = -result['סכום'].abs()
    
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
    
    # סינון שורות לא תקינות
    result = result[(result['סכום'] != 0) & result['תאריך'].notna()].reset_index(drop=True)
    
    # הוספת עמודות נוספות
    if not result.empty:
        result['סכום_מוחלט'] = result['סכום'].abs()
        result['חודש'] = result['תאריך'].dt.strftime('%m/%Y')
        result['יום_בשבוע'] = result['תאריך'].dt.dayofweek
    else:
        # יצירת DataFrame ריק עם העמודות הנדרשות
        result = pd.DataFrame(columns=['תאריך', 'סכום', 'תיאור', 'קטגוריה', 'סכום_מוחלט', 'חודש', 'יום_בשבוע'])
    
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
    """גרף דונאט מקצועי עם gradient colors"""
    expenses = df[df['סכום'] < 0].copy()
    cat_data = expenses.groupby('קטגוריה')['סכום_מוחלט'].sum().reset_index()
    cat_data = cat_data.sort_values('סכום_מוחלט', ascending=False)

    # #region agent log
    log_debug(
        "Donut input summary",
        {"rows": len(df), "expense_rows": len(expenses), "cat_rows": len(cat_data)},
        "H3",
        "create_donut_chart:start"
    )
    # #endregion

    if cat_data.empty:
        fig = go.Figure()
        fig.add_annotation(
            text="📭 אין נתונים",
            x=0.5, y=0.5, font=dict(size=16, color='#718096', family='Heebo'),
            showarrow=False
        )
        fig.update_layout(
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            margin=dict(t=10, b=10, l=10, r=10),
            height=280
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
    
    # צבעי gradient מקצועיים
    premium_colors = ['#667eea', '#38ef7d', '#f5576c', '#4facfe', '#fa709a', '#b794f4', '#a0aec0']
    
    fig = go.Figure(data=[go.Pie(
        labels=cat_data['קטגוריה'],
        values=cat_data['סכום_מוחלט'],
        hole=0.7,
        marker=dict(
            colors=premium_colors[:len(cat_data)],
            line=dict(color='#0a0e14', width=2)
        ),
        textinfo='none',
        hovertemplate='<b>%{label}</b><br>₪%{value:,.0f}<br>%{percent}<extra></extra>',
        showlegend=False,
        rotation=90
    )])
    
    total = cat_data['סכום_מוחלט'].sum()
    fig.add_annotation(
        text=f"<b style='font-size:24px;color:#fff'>₪{total:,.0f}</b>",
        x=0.5, y=0.55, font=dict(size=24, color='#ffffff', family='Heebo'),
        showarrow=False
    )
    fig.add_annotation(
        text="<span style='color:#a0aec0'>סה״כ הוצאות</span>",
        x=0.5, y=0.42, font=dict(size=13, color='#a0aec0', family='Heebo'),
        showarrow=False
    )
    
    fig.update_layout(
        showlegend=False,
        margin=dict(t=40, b=40, l=40, r=40),
        paper_bgcolor='rgba(0,0,0,0)',
        height=400,
        width=400,
        autosize=False
    )

    # #region agent log
    log_debug("Donut chart layout config", {"layout": fig.layout.to_plotly_json()}, "H3", "create_donut_chart:end")
    # #endregion

    return fig


def create_monthly_bars(df: pd.DataFrame) -> go.Figure:
    """גרף עמודות חודשי עם gradient"""
    expenses = df[df['סכום'] < 0].copy()
    
    if expenses.empty:
        fig = go.Figure()
        fig.add_annotation(text="📭 אין נתונים", x=0.5, y=0.5, font=dict(size=16, color='#718096'), showarrow=False)
        fig.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', height=260, margin=dict(t=10,b=10,l=10,r=10))
        return fig
    
    monthly = expenses.groupby(['חודש']).agg({'סכום_מוחלט': 'sum', 'תאריך': 'first'}).reset_index()
    monthly = monthly.sort_values('תאריך')
    
    # Gradient colors for bars
    n_bars = len(monthly)
    colors = [f'rgba(102, 126, 234, {0.5 + 0.5 * i / max(n_bars-1, 1)})' for i in range(n_bars)]
    
    fig = go.Figure(data=[go.Bar(
        x=monthly['חודש'],
        y=monthly['סכום_מוחלט'],
        marker=dict(
            color=colors,
            line=dict(color='rgba(102, 126, 234, 0.8)', width=1),
            cornerradius=6
        ),
        hovertemplate='<b>%{x}</b><br>₪%{y:,.0f}<extra></extra>'
    )])
    
    fig.update_layout(
        xaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=11), showgrid=False),
        yaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=10), showgrid=True),
        paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=15, b=35, l=55, r=15), height=260,
        font=dict(family='Heebo'),
        bargap=0.3,
        hoverlabel=dict(bgcolor='#1e2530', font_size=13, font_family='Heebo', bordercolor='#667eea')
    )
    return fig


def create_weekday_chart(df: pd.DataFrame) -> go.Figure:
    """גרף ימים בשבוע עם צבעים מותאמים"""
    days_heb = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    expenses = df[df['סכום'] < 0].copy()
    
    if expenses.empty:
        fig = go.Figure()
        fig.add_annotation(text="📭 אין נתונים", x=0.5, y=0.5, font=dict(size=16, color='#718096'), showarrow=False)
        fig.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', height=230, margin=dict(t=10,b=10,l=10,r=10))
        return fig
    
    daily = expenses.groupby('יום_בשבוע')['סכום_מוחלט'].sum().reset_index()
    daily['יום'] = daily['יום_בשבוע'].apply(lambda x: days_heb[x] if x < 7 else '')
    
    # Purple gradient
    colors = ['#b794f4', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95']
    
    fig = go.Figure(data=[go.Bar(
        x=daily['יום'],
        y=daily['סכום_מוחלט'],
        marker=dict(
            color=[colors[int(d)] for d in daily['יום_בשבוע']],
            line=dict(color='rgba(167, 139, 250, 0.5)', width=1),
            cornerradius=6
        ),
        hovertemplate='<b>יום %{x}</b><br>₪%{y:,.0f}<extra></extra>'
    )])
    
    fig.update_layout(
        xaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=11), showgrid=False),
        yaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=10), showgrid=True),
        paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=15, b=35, l=55, r=15), height=230,
        font=dict(family='Heebo'),
        bargap=0.25,
        hoverlabel=dict(bgcolor='#1e2530', font_size=13, font_family='Heebo', bordercolor='#b794f4')
    )
    return fig


def create_merchants_chart(df: pd.DataFrame, n: int = 8) -> go.Figure:
    """גרף בתי עסק מובילים"""
    expenses = df[df['סכום'] < 0].copy()
    
    if expenses.empty:
        fig = go.Figure()
        fig.add_annotation(text="📭 אין נתונים", x=0.5, y=0.5, font=dict(size=16, color='#718096'), showarrow=False)
        fig.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', height=280, margin=dict(t=10,b=10,l=10,r=10))
        return fig
    
    merchants = expenses.groupby('תיאור')['סכום_מוחלט'].sum().nlargest(n).reset_index()
    merchants = merchants.sort_values('סכום_מוחלט', ascending=True)
    
    # קיצור שמות ארוכים
    merchants['תיאור_קצר'] = merchants['תיאור'].apply(lambda x: x[:22] + '...' if len(x) > 25 else x)
    
    # Green gradient
    n_bars = len(merchants)
    colors = [f'rgba(56, 239, 125, {0.4 + 0.6 * i / max(n_bars-1, 1)})' for i in range(n_bars)]
    
    fig = go.Figure(data=[go.Bar(
        x=merchants['סכום_מוחלט'],
        y=merchants['תיאור_קצר'],
        orientation='h',
        marker=dict(
            color=colors,
            line=dict(color='rgba(56, 239, 125, 0.6)', width=1),
            cornerradius=6
        ),
        hovertemplate='<b>%{y}</b><br>₪%{x:,.0f}<extra></extra>'
    )])
    
    fig.update_layout(
        xaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=10), showgrid=True),
        yaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#e2e8f0', size=11), showgrid=False),
        paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=15, b=35, l=150, r=15), height=max(280, n * 32),
        font=dict(family='Heebo'),
        bargap=0.2,
        hoverlabel=dict(bgcolor='#1e2530', font_size=13, font_family='Heebo', bordercolor='#38ef7d')
    )
    return fig


def create_trend_chart(df: pd.DataFrame) -> go.Figure:
    """גרף מגמה מקצועי עם gradient fill"""
    if df.empty:
        fig = go.Figure()
        fig.add_annotation(text="📭 אין נתונים", x=0.5, y=0.5, font=dict(size=16, color='#718096'), showarrow=False)
        fig.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', height=300, margin=dict(t=10,b=10,l=10,r=10))
        return fig
    
    df_sorted = df.sort_values('תאריך').copy()
    df_sorted['מצטבר'] = df_sorted['סכום'].cumsum()
    
    fig = go.Figure()
    
    # Area with gradient
    fig.add_trace(go.Scatter(
        x=df_sorted['תאריך'], y=df_sorted['מצטבר'],
        mode='lines', fill='tozeroy',
        line=dict(color='#667eea', width=3),
        fillcolor='rgba(102, 126, 234, 0.15)',
        hovertemplate='<b>%{x|%d/%m/%Y}</b><br>מאזן: ₪%{y:,.0f}<extra></extra>'
    ))
    
    # Zero line
    fig.add_hline(y=0, line_dash='dash', line_color='#fc8181', line_width=2, opacity=0.7)
    
    # Add markers for min/max points
    min_idx = df_sorted['מצטבר'].idxmin()
    max_idx = df_sorted['מצטבר'].idxmax()
    
    fig.add_trace(go.Scatter(
        x=[df_sorted.loc[min_idx, 'תאריך']],
        y=[df_sorted.loc[min_idx, 'מצטבר']],
        mode='markers',
        marker=dict(size=12, color='#fc8181', symbol='diamond'),
        hovertemplate='<b>נקודת מינימום</b><br>₪%{y:,.0f}<extra></extra>',
        showlegend=False
    ))
    
    fig.add_trace(go.Scatter(
        x=[df_sorted.loc[max_idx, 'תאריך']],
        y=[df_sorted.loc[max_idx, 'מצטבר']],
        mode='markers',
        marker=dict(size=12, color='#38ef7d', symbol='diamond'),
        hovertemplate='<b>נקודת מקסימום</b><br>₪%{y:,.0f}<extra></extra>',
        showlegend=False
    ))
    
    fig.update_layout(
        xaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=10), showgrid=True),
        yaxis=dict(title='', gridcolor='rgba(255,255,255,0.05)', tickfont=dict(color='#a0aec0', size=10), showgrid=True, zeroline=False),
        paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=20, b=40, l=65, r=20), height=300,
        font=dict(family='Heebo'),
        hoverlabel=dict(bgcolor='#1e2530', font_size=13, font_family='Heebo', bordercolor='#667eea'),
        hovermode='x unified'
    )
    return fig


# =============================================================================
# רכיבי UI
# =============================================================================

def render_metrics(df: pd.DataFrame):
    """רינדור כרטיסי מדדים מקצועיים עם אנימציות"""
    total = len(df)
    expenses = df[df['סכום'] < 0]
    spent = abs(expenses['סכום'].sum()) if len(expenses) > 0 else 0
    income = df[df['סכום'] > 0]['סכום'].sum()
    avg = df['סכום_מוחלט'].mean() if not df.empty else 0
    
    # חישוב מגמה (אם יש מספיק נתונים)
    trend_text = ""
    if len(df) > 10:
        mid = len(df) // 2
        first_half_avg = df.iloc[:mid]['סכום_מוחלט'].mean()
        second_half_avg = df.iloc[mid:]['סכום_מוחלט'].mean()
        if first_half_avg > 0:
            trend_pct = ((second_half_avg - first_half_avg) / first_half_avg) * 100
            if trend_pct > 0:
                trend_text = f'<div class="metric-trend up">↑ {abs(trend_pct):.1f}%</div>'
            else:
                trend_text = f'<div class="metric-trend down">↓ {abs(trend_pct):.1f}%</div>'
    
    # צבעים לאייקונים
    icon_colors = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',  # סגול
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',  # ורוד-אדום
        'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',  # ירוק
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',  # כחול
    ]
    
    st.markdown(f"""
    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-icon-wrapper" style="background: {icon_colors[0]}">
                <span class="metric-icon">💳</span>
            </div>
            <span class="metric-value">{total:,}</span>
            <div class="metric-label">עסקאות</div>
        </div>
        <div class="metric-card">
            <div class="metric-icon-wrapper" style="background: {icon_colors[1]}">
                <span class="metric-icon">📉</span>
            </div>
            <span class="metric-value">{format_currency(spent)}</span>
            <div class="metric-label">הוצאות</div>
            {trend_text}
        </div>
        <div class="metric-card">
            <div class="metric-icon-wrapper" style="background: {icon_colors[2]}">
                <span class="metric-icon">📈</span>
            </div>
            <span class="metric-value">{format_currency(income)}</span>
            <div class="metric-label">הכנסות</div>
        </div>
        <div class="metric-card">
            <div class="metric-icon-wrapper" style="background: {icon_colors[3]}">
                <span class="metric-icon">📊</span>
            </div>
            <span class="metric-value">{format_currency(avg)}</span>
            <div class="metric-label">ממוצע לעסקה</div>
        </div>
    </div>
    """, unsafe_allow_html=True)


def render_category_list(df: pd.DataFrame):
    """רינדור רשימת קטגוריות מקצועית עם אנימציות"""
    expenses = df[df['סכום'] < 0].copy()
    # Ensure numeric
    expenses['סכום_מוחלט'] = pd.to_numeric(expenses['סכום_מוחלט'], errors='coerce').fillna(0)
    
    total = expenses['סכום_מוחלט'].sum()
    
    cat_data = expenses.groupby('קטגוריה').agg({'סכום_מוחלט': ['sum', 'count']}).reset_index()
    cat_data.columns = ['קטגוריה', 'סכום', 'מספר']
    if total > 0:
        cat_data['אחוז'] = (cat_data['סכום'] / total * 100).round(1)
    else:
        cat_data['אחוז'] = 0
    cat_data = cat_data.sort_values('סכום', ascending=False).head(8)
    
    if cat_data.empty:
        st.markdown('''
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
            <div>אין נתונים להצגה</div>
        </div>
        ''', unsafe_allow_html=True)
        return
    
    # צבעי gradient לאייקונים
    icon_gradients = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
        'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
    ]
    
    # צבעי progress bar
    bar_colors = ['#667eea', '#38ef7d', '#f5576c', '#00f2fe', '#fee140', '#fed6e3', '#fef9d7', '#66a6ff']
    
    html_cards = ""
    for i, (_, row) in enumerate(cat_data.iterrows()):
        icon = get_icon(row['קטגוריה'])
        gradient = icon_gradients[i % len(icon_gradients)]
        bar_color = bar_colors[i % len(bar_colors)]
        
        html_cards += f'''
        <div class="category-card">
            <div class="category-icon-wrapper" style="background: {gradient}">
                {icon}
            </div>
            <div class="category-info">
                <div class="category-name">{row['קטגוריה']}</div>
                <div class="category-bar-container">
                    <div class="category-bar" style="width: {row['אחוז']}%; background: {bar_color};"></div>
                </div>
            </div>
            <div class="category-stats">
                <div class="category-amount">{format_currency(row['סכום'])}</div>
                <div class="category-percent">{row['אחוז']}%</div>
            </div>
        </div>
        '''
    
    st.markdown(html_cards, unsafe_allow_html=True)


def export_excel(df: pd.DataFrame) -> bytes:
    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='עסקאות', index=False)
    return output.getvalue()


# =============================================================================
# ראשי
# =============================================================================

def main():
    # כותרת ראשית
    st.markdown('''
    <div class="app-header">
        <h1 class="app-title">💳 מנתח עסקאות</h1>
        <p class="app-subtitle">ניתוח חכם ומקצועי של הוצאות כרטיס האשראי שלך</p>
    </div>
    ''', unsafe_allow_html=True)
    
    # סרגל צד מעוצב
    with st.sidebar:
        st.markdown('<div class="sidebar-title">העלאת קובץ</div>', unsafe_allow_html=True)
        uploaded = st.file_uploader(
            "גרור קובץ לכאן או לחץ לבחירה",
            type=['xlsx', 'xls', 'csv'],
            label_visibility='visible'
        )
        
        st.markdown("---")
        
        # מידע נוסף בסרגל צד
        st.markdown('''
        <div style="padding: 1rem; background: rgba(102, 126, 234, 0.1); border-radius: 10px; border: 1px solid rgba(102, 126, 234, 0.2);">
            <div style="font-weight: 600; color: #667eea; margin-bottom: 0.5rem;">💡 פורמטים נתמכים</div>
            <div style="color: #a0aec0; font-size: 0.85rem; line-height: 1.6;">
                • MAX<br>
                • לאומי<br>
                • דיסקונט<br>
                • ויזה כאל<br>
                • CSV כללי
            </div>
        </div>
        ''', unsafe_allow_html=True)
    
    # מצב ריק - עיצוב מקצועי
    if not uploaded:
        st.markdown('''
        <div class="empty-state">
            <div class="empty-icon">📊</div>
            <div class="empty-title">ברוכים הבאים לדאשבורד!</div>
            <div class="empty-text">העלה קובץ אקסל או CSV מחברת האשראי שלך כדי להתחיל בניתוח</div>
        </div>
        ''', unsafe_allow_html=True)
        
        # Feature cards
        cols = st.columns(3)
        features = [
            ("📊", "ניתוח ויזואלי", "גרפים אינטראקטיביים וחכמים לתובנות מיידיות"),
            ("🏷️", "קטגוריות אוטומטיות", "זיהוי אוטומטי של קטגוריות מהקובץ המקורי"),
            ("📑", "תמיכה מלאה", "Excel עם מספר גליונות, CSV בעברית מלאה")
        ]
        
        for col, (icon, title, desc) in zip(cols, features):
            with col:
                st.markdown(f'''
                <div class="feature-card">
                    <div class="feature-icon">{icon}</div>
                    <div class="feature-title">{title}</div>
                    <div class="feature-desc">{desc}</div>
                </div>
                ''', unsafe_allow_html=True)
        return
    
    # טעינת הקובץ
    with st.spinner('🔄 טוען את הקובץ...'):
        sheets = load_excel(uploaded) if uploaded.name.endswith(('.xlsx', '.xls')) else {'main': load_csv(uploaded)}
    
    if not sheets:
        st.markdown('''
        <div style="background: rgba(252, 129, 129, 0.1); border: 1px solid rgba(252, 129, 129, 0.3); 
                    border-radius: 12px; padding: 1.5rem; text-align: center; margin: 1rem 0;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">❌</div>
            <div style="color: #fc8181; font-weight: 600; font-size: 1.1rem;">שגיאה בטעינת הקובץ</div>
            <div style="color: #a0aec0; font-size: 0.9rem; margin-top: 0.5rem;">וודא שהקובץ בפורמט Excel או CSV תקין</div>
        </div>
        ''', unsafe_allow_html=True)
        return
    
    if len(sheets) == 1 and list(sheets.values())[0].empty:
        st.markdown('''
        <div style="background: rgba(252, 129, 129, 0.1); border: 1px solid rgba(252, 129, 129, 0.3); 
                    border-radius: 12px; padding: 1.5rem; text-align: center; margin: 1rem 0;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
            <div style="color: #fc8181; font-weight: 600; font-size: 1.1rem;">הקובץ ריק או לא תקין</div>
            <div style="color: #a0aec0; font-size: 0.9rem; margin-top: 0.5rem;">נסה להעלות קובץ אחר</div>
        </div>
        ''', unsafe_allow_html=True)
        return
    
    # בחירת גליונות (אם יש כמה)
    if len(sheets) > 1:
        st.markdown('<div class="section-title"><span>📑</span> בחירת גליונות</div>', unsafe_allow_html=True)
        selected = st.multiselect("בחר גליונות לניתוח", list(sheets.keys()), default=list(sheets.keys()))
        if not selected:
            st.markdown('''
            <div style="background: rgba(237, 137, 54, 0.1); border: 1px solid rgba(237, 137, 54, 0.3); 
                        border-radius: 10px; padding: 1rem; text-align: center;">
                <span style="color: #ed8936;">⚠️ נא לבחור לפחות גליון אחד</span>
            </div>
            ''', unsafe_allow_html=True)
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
        st.markdown('''
        <div style="background: rgba(237, 137, 54, 0.1); border: 1px solid rgba(237, 137, 54, 0.3); 
                    border-radius: 12px; padding: 1.5rem; margin: 1rem 0;">
            <div style="font-weight: 600; color: #ed8936; margin-bottom: 1rem;">⚙️ הגדרה ידנית של עמודות</div>
            <div style="color: #a0aec0; font-size: 0.9rem;">לא הצלחנו לזהות את כל העמודות באופן אוטומטי. נא להגדיר:</div>
        </div>
        ''', unsafe_allow_html=True)
        
        cols = df_raw.columns.tolist()
        c1, c2 = st.columns(2)
        with c1:
            date_col = st.selectbox("📅 עמודת תאריך", cols)
            amount_col = st.selectbox("💰 עמודת סכום", cols)
        with c2:
            desc_col = st.selectbox("📝 עמודת תיאור", cols)
            cat_col = st.selectbox("🏷️ עמודת קטגוריה", ['ללא'] + cols)
            cat_col = None if cat_col == 'ללא' else cat_col
        
        if st.button("▶️ המשך לניתוח", use_container_width=True):
            pass
        else:
            st.stop()
    
    # עיבוד הנתונים
    try:
        with st.spinner('🔄 מעבד נתונים...'):
            df = process_data(df_raw, date_col, amount_col, desc_col, cat_col)
        
        if df.empty:
            st.markdown('''
            <div style="background: rgba(252, 129, 129, 0.1); border: 1px solid rgba(252, 129, 129, 0.3); 
                        border-radius: 12px; padding: 1.5rem; text-align: center; margin: 1rem 0;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
                <div style="color: #fc8181; font-weight: 600;">לא נמצאו עסקאות בקובץ</div>
            </div>
            ''', unsafe_allow_html=True)
            return
        
        # הודעת הצלחה מעוצבת
        date_range = f"{df['תאריך'].min().strftime('%d/%m/%Y')} - {df['תאריך'].max().strftime('%d/%m/%Y')}"
        st.markdown(f'''
        <div style="background: rgba(56, 239, 125, 0.1); border: 1px solid rgba(56, 239, 125, 0.3); 
                    border-radius: 12px; padding: 1rem 1.5rem; margin: 1rem 0; display: flex; 
                    align-items: center; justify-content: space-between; direction: rtl;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.5rem;">✅</span>
                <div>
                    <div style="color: #38ef7d; font-weight: 600;">נטענו {len(df):,} עסקאות בהצלחה</div>
                    <div style="color: #a0aec0; font-size: 0.85rem;">{date_range}</div>
                </div>
            </div>
            <div style="color: #38ef7d; font-size: 0.9rem; background: rgba(56, 239, 125, 0.15); 
                        padding: 0.4rem 0.8rem; border-radius: 20px;">
                {df['קטגוריה'].nunique()} קטגוריות
            </div>
        </div>
        ''', unsafe_allow_html=True)
        
    except Exception as e:
        st.markdown(f'''
        <div style="background: rgba(252, 129, 129, 0.1); border: 1px solid rgba(252, 129, 129, 0.3); 
                    border-radius: 12px; padding: 1.5rem; margin: 1rem 0;">
            <div style="font-weight: 600; color: #fc8181; margin-bottom: 0.5rem;">❌ שגיאה בעיבוד</div>
            <div style="color: #a0aec0; font-size: 0.9rem;">{str(e)}</div>
        </div>
        ''', unsafe_allow_html=True)
        return
    
    # סינון - עיצוב משופר
    st.markdown('<div class="section-title"><span>🔍</span> סינון וחיפוש</div>', unsafe_allow_html=True)
    
    c1, c2, c3 = st.columns(3)
    with c1:
        dates = st.date_input("📅 טווח תאריכים", [df['תאריך'].min(), df['תאריך'].max()])
    with c2:
        cat_filter = st.selectbox("🏷️ קטגוריה", ['הכל'] + sorted(df['קטגוריה'].unique().tolist()))
    with c3:
        search = st.text_input("🔎 חיפוש בית עסק", placeholder="הקלד לחיפוש...")
    
    # החלת פילטרים
    df_f = df.copy()
    if len(dates) == 2:
        df_f = df_f[(df_f['תאריך'].dt.date >= dates[0]) & (df_f['תאריך'].dt.date <= dates[1])]
    if cat_filter != 'הכל':
        df_f = df_f[df_f['קטגוריה'] == cat_filter]
    if search:
        df_f = df_f[df_f['תיאור'].str.contains(search, case=False, na=False)]
    
    if df_f.empty:
        st.markdown('''
        <div style="background: rgba(237, 137, 54, 0.1); border: 1px solid rgba(237, 137, 54, 0.3); 
                    border-radius: 12px; padding: 2rem; text-align: center; margin: 1rem 0;">
            <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🔍</div>
            <div style="color: #ed8936; font-weight: 600; font-size: 1.1rem;">לא נמצאו תוצאות</div>
            <div style="color: #a0aec0; font-size: 0.9rem; margin-top: 0.5rem;">נסה לשנות את הפילטרים</div>
        </div>
        ''', unsafe_allow_html=True)
        return
    
    # מדדים ראשיים
    render_metrics(df_f)
    
    # טאבים עם עיצוב מקצועי
    tabs = st.tabs(["📊 סקירה כללית", "📈 מגמות ונתונים", "🏪 בתי עסק מובילים", "📋 רשימת עסקאות"])
    
    with tabs[0]:
        # סקירה - layout שני עמודות
        c1, c2 = st.columns([3, 2])
        
        with c1:
            st.markdown('<div class="section-title"><span>📅</span> הוצאות לפי חודש</div>', unsafe_allow_html=True)
            st.plotly_chart(create_monthly_bars(df_f), use_container_width=True, key="monthly")

            st.markdown('<div class="section-title"><span>📆</span> התפלגות לפי יום בשבוע</div>', unsafe_allow_html=True)
            st.plotly_chart(create_weekday_chart(df_f), use_container_width=True, key="weekday")
        
        with c2:
            st.markdown('<div class="section-title"><span>🥧</span> חלוקה לפי קטגוריה</div>', unsafe_allow_html=True)
            
            # Center the chart using CSS wrapper
            donut_fig = create_donut_chart(df_f)
            
            # #region agent log
            log_debug("Donut chart rendering", {"fig_width": donut_fig.layout.width, "fig_height": donut_fig.layout.height, "use_container_width": False}, "H3", "main:donut_render")
            # #endregion
            
            # Center chart with CSS wrapper
            st.markdown("""
            <style>
            div[data-testid="stPlotlyChart"]:has(> div > div[data-testid="stPlotlyChart"]) {
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                width: 100% !important;
            }
            div[data-testid="stPlotlyChart"] > div {
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                width: 100% !important;
            }
            </style>
            <div style="display: flex !important; justify-content: center !important; align-items: center !important; width: 100% !important; padding: 20px 0 !important;">
            """, unsafe_allow_html=True)
            st.plotly_chart(donut_fig, use_container_width=False, key="donut")
            st.markdown("</div>", unsafe_allow_html=True)

            st.markdown('<div class="section-title"><span>📋</span> פירוט קטגוריות</div>', unsafe_allow_html=True)
            render_category_list(df_f)
    
    with tabs[1]:
        # מגמות
        st.markdown('<div class="section-title"><span>📈</span> מגמת מאזן מצטבר</div>', unsafe_allow_html=True)
        st.plotly_chart(create_trend_chart(df_f), use_container_width=True, key="trend")
        
        # סטטיסטיקות מפורטות
        exp = df_f[df_f['סכום'] < 0]
        st.markdown('<div class="section-title"><span>📊</span> סטטיסטיקות מפורטות</div>', unsafe_allow_html=True)
        
        c1, c2, c3, c4 = st.columns(4)
        
        with c1:
            max_expense = exp['סכום_מוחלט'].max() if len(exp) > 0 else 0
            st.markdown(f'''
            <div class="metric-card" style="padding: 1rem;">
                <div style="color: #a0aec0; font-size: 0.8rem; margin-bottom: 0.5rem;">💰 הוצאה הגדולה ביותר</div>
                <div style="color: #fc8181; font-size: 1.5rem; font-weight: 700;">{format_currency(max_expense)}</div>
            </div>
            ''', unsafe_allow_html=True)
        
        with c2:
            min_expense = exp['סכום_מוחלט'].min() if len(exp) > 0 else 0
            st.markdown(f'''
            <div class="metric-card" style="padding: 1rem;">
                <div style="color: #a0aec0; font-size: 0.8rem; margin-bottom: 0.5rem;">💵 הוצאה הקטנה ביותר</div>
                <div style="color: #38ef7d; font-size: 1.5rem; font-weight: 700;">{format_currency(min_expense)}</div>
            </div>
            ''', unsafe_allow_html=True)
        
        with c3:
            median_expense = exp['סכום_מוחלט'].median() if len(exp) > 0 else 0
            st.markdown(f'''
            <div class="metric-card" style="padding: 1rem;">
                <div style="color: #a0aec0; font-size: 0.8rem; margin-bottom: 0.5rem;">📊 חציון הוצאות</div>
                <div style="color: #667eea; font-size: 1.5rem; font-weight: 700;">{format_currency(median_expense)}</div>
            </div>
            ''', unsafe_allow_html=True)
        
        with c4:
            num_cats = df_f['קטגוריה'].nunique()
            st.markdown(f'''
            <div class="metric-card" style="padding: 1rem;">
                <div style="color: #a0aec0; font-size: 0.8rem; margin-bottom: 0.5rem;">🏷️ מספר קטגוריות</div>
                <div style="color: #b794f4; font-size: 1.5rem; font-weight: 700;">{num_cats}</div>
            </div>
            ''', unsafe_allow_html=True)
        
        # תובנות נוספות
        if len(exp) > 0:
            st.markdown("---")
            top_cat = exp.groupby('קטגוריה')['סכום_מוחלט'].sum().idxmax()
            top_merchant = exp.groupby('תיאור')['סכום_מוחלט'].sum().idxmax()
            
            st.markdown(f'''
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="background: rgba(102, 126, 234, 0.1); border: 1px solid rgba(102, 126, 234, 0.2); 
                            border-radius: 12px; padding: 1rem;">
                    <div style="color: #667eea; font-weight: 600; margin-bottom: 0.5rem;">🏆 הקטגוריה המובילה</div>
                    <div style="color: #fff; font-size: 1.1rem;">{top_cat}</div>
                </div>
                <div style="background: rgba(56, 239, 125, 0.1); border: 1px solid rgba(56, 239, 125, 0.2); 
                            border-radius: 12px; padding: 1rem;">
                    <div style="color: #38ef7d; font-weight: 600; margin-bottom: 0.5rem;">🏪 בית העסק המוביל</div>
                    <div style="color: #fff; font-size: 1.1rem;">{top_merchant[:30]}{"..." if len(top_merchant) > 30 else ""}</div>
                </div>
            </div>
            ''', unsafe_allow_html=True)
    
    with tabs[2]:
        # בתי עסק
        st.markdown('<div class="section-title"><span>⚙️</span> הגדרות תצוגה</div>', unsafe_allow_html=True)
        n = st.slider("מספר בתי עסק להצגה", 5, 15, 8, help="בחר כמה בתי עסק להציג בגרף")
        
        st.markdown('<div class="section-title"><span>🏆</span> בתי העסק המובילים בהוצאות</div>', unsafe_allow_html=True)
        st.plotly_chart(create_merchants_chart(df_f, n), use_container_width=True, key="merchants")
    
    with tabs[3]:
        # טבלת עסקאות
        st.markdown('<div class="section-title"><span>📋</span> רשימת עסקאות מלאה</div>', unsafe_allow_html=True)
        
        # שורת בקרה
        col1, col2 = st.columns([2, 3])
        with col1:
            sort_opt = st.selectbox("🔀 מיון לפי", ['תאריך (חדש לישן)', 'תאריך (ישן לחדש)', 'סכום (גדול לקטן)', 'סכום (קטן לגדול)'])
        
        # מיון
        if sort_opt == 'תאריך (חדש לישן)':
            display = df_f.sort_values('תאריך', ascending=False)
        elif sort_opt == 'תאריך (ישן לחדש)':
            display = df_f.sort_values('תאריך', ascending=True)
        elif sort_opt == 'סכום (גדול לקטן)':
            display = df_f.sort_values('סכום_מוחלט', ascending=False)
        else:
            display = df_f.sort_values('סכום_מוחלט', ascending=True)
        
        # #region agent log
        log_debug("Columns in display dataframe before selection", {"columns": display.columns.tolist(), "shape": display.shape}, "H1", "main:before_view_creation")
        # #endregion

        # הכנת הנתונים
        # בחירת עמודות ספציפיות בלבד לתצוגה נקייה
        view = display[['תאריך', 'תיאור', 'קטגוריה', 'סכום']].copy()

        # #region agent log
        log_debug("Columns in view dataframe after selection", {"columns": view.columns.tolist(), "shape": view.shape}, "H1", "main:after_view_creation")
        # #endregion

        # #region agent log
        log_debug(
            "Dataframe dtypes before rendering",
            {"dtypes": {k: str(v) for k, v in view.dtypes.items()}},
            "H2",
            "main:before_dataframe_render"
        )
        # #endregion
        
        # רינדור טבלה עם st.dataframe ו-CSS לייש ור לימין
        # #region agent log
        log_debug("Table rendering with st.dataframe", {
            "rows_count": len(view), 
            "columns": view.columns.tolist(),
            "first_row": view.iloc[0].to_dict() if len(view) > 0 else None
        }, "H2", "main:table_dataframe_render")
        # #endregion
        
        st.dataframe(
            view,
            column_config={
                "תאריך": st.column_config.DateColumn(
                    "תאריך",
                    help="תאריך ביצוע העסקה",
                    format="DD/MM/YYYY",
                ),
                "תיאור": st.column_config.TextColumn(
                    "בית עסק",
                    help="שם בית העסק ותיאור העסקה",
                    width="large",
                ),
                "קטגוריה": st.column_config.TextColumn(
                    "קטגוריה",
                    help="קטגוריית ההוצאה",
                    width="medium",
                ),
                "סכום": st.column_config.NumberColumn(
                    "סכום",
                    help="סכום העסקה בשקלים",
                    format="₪%.2f",
                ),
            },
            hide_index=True,
            use_container_width=True,
            height=500
        )
        
        # #region agent log
        log_debug("After dataframe render", {"success": True}, "H2", "main:after_dataframe_render")
        # #endregion
        
        # מידע נוסף
        total_shown = len(view)
        st.markdown(f'''
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; 
                    padding: 0.75rem 1rem; background: rgba(99, 102, 241, 0.1); border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.2);">
            <span style="color: #94a3b8; font-size: 0.9rem;">
                מציג {total_shown:,} עסקאות
            </span>
            <span style="color: #818cf8; font-size: 0.85rem;">
                💡 ניתן למיין ולסנן את הטבלה בלחיצה על כותרות העמודות
            </span>
        </div>
        ''', unsafe_allow_html=True)
    
    # ייצוא נתונים - עיצוב משופר
    st.markdown("---")
    st.markdown('<div class="section-title"><span>📥</span> ייצוא נתונים</div>', unsafe_allow_html=True)
    
    c1, c2, c3 = st.columns([2, 2, 3])
    with c1:
        st.download_button(
            "📊 הורד כקובץ Excel", 
            export_excel(df_f), 
            "עסקאות_מנותחות.xlsx", 
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True
        )
    with c2:
        st.download_button(
            "📄 הורד כקובץ CSV", 
            df_f.to_csv(index=False, encoding='utf-8-sig'), 
            "עסקאות_מנותחות.csv", 
            "text/csv",
            use_container_width=True
        )
    with c3:
        st.markdown(f'''
        <div style="color: #a0aec0; font-size: 0.85rem; padding: 0.75rem; 
                    background: rgba(102, 126, 234, 0.05); border-radius: 8px; text-align: center;">
            📊 סה"כ {len(df_f):,} עסקאות | 
            💰 {format_currency(abs(df_f[df_f["סכום"] < 0]["סכום"].sum()))} הוצאות
        </div>
        ''', unsafe_allow_html=True)


if __name__ == "__main__":
    main()
