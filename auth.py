"""
Authentication & Database module using Supabase
"""
import streamlit as st
from supabase import create_client, Client
from typing import Optional
import re
import json


# =============================================================================
# Supabase Client (cached)
# =============================================================================
@st.cache_resource
def _get_client():
    try:
        url = st.secrets["supabase"]["url"]
        key = st.secrets["supabase"]["key"]
        if "YOUR_PROJECT_ID" in url or "YOUR_ANON" in key:
            return None
        return create_client(url, key)
    except Exception:
        return None

def get_supabase() -> Optional[Client]:
    return _get_client()

def is_configured() -> bool:
    return get_supabase() is not None


# =============================================================================
# Auth State - with session persistence
# =============================================================================
def init_auth_state():
    if 'auth_user' not in st.session_state:
        st.session_state.auth_user = None
    if 'auth_token' not in st.session_state:
        st.session_state.auth_token = None
    if 'auth_page' not in st.session_state:
        st.session_state.auth_page = 'login'
    if 'auth_refresh' not in st.session_state:
        st.session_state.auth_refresh = None
    # Try to restore session from refresh token
    if st.session_state.auth_user is None and st.session_state.auth_refresh:
        _try_restore_session()

def _try_restore_session():
    """Try to restore user session using refresh token."""
    sb = get_supabase()
    if not sb or not st.session_state.auth_refresh:
        return
    try:
        res = sb.auth.refresh_session(st.session_state.auth_refresh)
        if res and res.user:
            st.session_state.auth_user = {
                "id": res.user.id,
                "email": res.user.email,
                "name": res.user.user_metadata.get("full_name", res.user.email.split("@")[0]),
            }
            st.session_state.auth_token = res.session.access_token
            st.session_state.auth_refresh = res.session.refresh_token
    except:
        st.session_state.auth_refresh = None

def get_current_user():
    return st.session_state.get('auth_user')

def is_logged_in() -> bool:
    return st.session_state.get('auth_user') is not None

def logout():
    sb = get_supabase()
    if sb:
        try: sb.auth.sign_out()
        except: pass
    st.session_state.auth_user = None
    st.session_state.auth_token = None
    st.session_state.auth_refresh = None
    # Clear saved transactions
    if 'saved_transactions' in st.session_state:
        del st.session_state['saved_transactions']


# =============================================================================
# Auth Actions
# =============================================================================
def sign_up(email: str, password: str, full_name: str) -> tuple[bool, str]:
    sb = get_supabase()
    if not sb:
        return False, "Supabase לא מוגדר"
    try:
        res = sb.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"full_name": full_name}}
        })
        if res.user:
            return True, "נרשמת בהצלחה! בדוק את המייל לאימות"
        return False, "שגיאה בהרשמה"
    except Exception as e:
        msg = str(e)
        if "already registered" in msg.lower():
            return False, "כתובת המייל כבר רשומה"
        if "password" in msg.lower():
            return False, "הסיסמה חייבת להכיל לפחות 6 תווים"
        return False, f"שגיאה: {msg}"


def sign_in(email: str, password: str) -> tuple[bool, str]:
    sb = get_supabase()
    if not sb:
        return False, "Supabase לא מוגדר"
    try:
        res = sb.auth.sign_in_with_password({"email": email, "password": password})
        if res.user:
            st.session_state.auth_user = {
                "id": res.user.id,
                "email": res.user.email,
                "name": res.user.user_metadata.get("full_name", res.user.email.split("@")[0]),
            }
            st.session_state.auth_token = res.session.access_token
            st.session_state.auth_refresh = res.session.refresh_token
            return True, "התחברת בהצלחה!"
        return False, "שגיאה בהתחברות"
    except Exception as e:
        msg = str(e)
        if "invalid" in msg.lower():
            return False, "מייל או סיסמה שגויים"
        return False, f"שגיאה: {msg}"


def reset_password(email: str) -> tuple[bool, str]:
    sb = get_supabase()
    if not sb:
        return False, "Supabase לא מוגדר"
    try:
        sb.auth.reset_password_email(email)
        return True, "נשלח מייל לאיפוס סיסמה"
    except Exception as e:
        return False, f"שגיאה: {e}"


# =============================================================================
# Transaction Data Persistence
# =============================================================================
def save_transactions(df) -> bool:
    """Save processed transactions to Supabase as JSON."""
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user or user.get('id') == 'guest':
        return False
    try:
        # Convert to JSON-safe format
        data = df[['תאריך','תיאור','קטגוריה','סכום','סכום_מוחלט']].copy()
        data['תאריך'] = data['תאריך'].dt.strftime('%Y-%m-%d')
        records = data.to_dict('records')
        
        # Delete old data first
        sb.table("saved_transactions").delete().eq("user_id", user["id"]).execute()
        
        # Insert in batches of 500
        for i in range(0, len(records), 500):
            batch = records[i:i+500]
            rows = [{"user_id": user["id"], "data": json.dumps(r, ensure_ascii=False)} for r in batch]
            sb.table("saved_transactions").insert(rows).execute()
        return True
    except:
        return False


def load_transactions():
    """Load saved transactions from Supabase."""
    import pandas as pd
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user or user.get('id') == 'guest':
        return None
    try:
        res = sb.table("saved_transactions").select("data").eq("user_id", user["id"]).execute()
        if not res.data:
            return None
        records = [json.loads(r['data']) for r in res.data]
        df = pd.DataFrame(records)
        df['תאריך'] = pd.to_datetime(df['תאריך'])
        df['סכום'] = pd.to_numeric(df['סכום'], errors='coerce').fillna(0)
        df['סכום_מוחלט'] = pd.to_numeric(df['סכום_מוחלט'], errors='coerce').fillna(0)
        df['חודש'] = df['תאריך'].dt.strftime('%m/%Y')
        df['יום_בשבוע'] = df['תאריך'].dt.dayofweek
        return df if not df.empty else None
    except:
        return None


def delete_transactions() -> bool:
    """Delete all saved transactions for current user."""
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user:
        return False
    try:
        sb.table("saved_transactions").delete().eq("user_id", user["id"]).execute()
        return True
    except:
        return False


def delete_all_user_data() -> bool:
    """Delete ALL user data (transactions, incomes, uploads, settings)."""
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user:
        return False
    try:
        uid = user["id"]
        sb.table("saved_transactions").delete().eq("user_id", uid).execute()
        sb.table("incomes").delete().eq("user_id", uid).execute()
        sb.table("upload_history").delete().eq("user_id", uid).execute()
        sb.table("user_settings").delete().eq("user_id", uid).execute()
        return True
    except:
        return False


# =============================================================================
# Income Operations
# =============================================================================
def save_income(description: str, amount: float, income_type: str, recurring: str) -> bool:
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user:
        return False
    try:
        sb.table("incomes").insert({
            "user_id": user["id"],
            "description": description,
            "amount": amount,
            "income_type": income_type,
            "recurring": recurring,
        }).execute()
        return True
    except:
        return False


def load_incomes() -> list:
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user:
        return []
    try:
        res = sb.table("incomes").select("*").eq("user_id", user["id"]).order("created_at", desc=True).execute()
        return res.data or []
    except:
        return []


def delete_all_incomes() -> bool:
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user:
        return False
    try:
        sb.table("incomes").delete().eq("user_id", user["id"]).execute()
        return True
    except:
        return False


# =============================================================================
# Other DB Operations
# =============================================================================
def save_upload_history(file_name: str, row_count: int, total_expenses: float,
                        total_income: float, date_start, date_end) -> bool:
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user:
        return False
    try:
        sb.table("upload_history").insert({
            "user_id": user["id"],
            "file_name": file_name,
            "row_count": row_count,
            "total_expenses": total_expenses,
            "total_income": total_income,
            "date_range_start": str(date_start) if date_start else None,
            "date_range_end": str(date_end) if date_end else None,
        }).execute()
        return True
    except:
        return False

def load_upload_history() -> list:
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user:
        return []
    try:
        res = sb.table("upload_history").select("*").eq("user_id", user["id"]).order("uploaded_at", desc=True).limit(10).execute()
        return res.data or []
    except:
        return []

def save_user_settings(theme: str) -> bool:
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user:
        return False
    try:
        sb.table("user_settings").upsert({
            "user_id": user["id"],
            "theme": theme,
        }).execute()
        return True
    except:
        return False

def load_user_settings() -> dict:
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user:
        return {}
    try:
        res = sb.table("user_settings").select("*").eq("user_id", user["id"]).single().execute()
        return res.data or {}
    except:
        return {}


# =============================================================================
# Validation
# =============================================================================
def validate_email(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_password(password: str) -> tuple[bool, str]:
    if len(password) < 6:
        return False, "הסיסמה חייבת להכיל לפחות 6 תווים"
    return True, ""
