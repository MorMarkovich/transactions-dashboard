"""
Authentication & Database module using Supabase
"""
import streamlit as st
from supabase import create_client, Client
from typing import Optional
import re


# =============================================================================
# Supabase Client
# =============================================================================
def get_supabase() -> Optional[Client]:
    """Get Supabase client from secrets."""
    try:
        url = st.secrets["supabase"]["url"]
        key = st.secrets["supabase"]["key"]
        if "YOUR_PROJECT_ID" in url or "YOUR_ANON" in key:
            return None
        return create_client(url, key)
    except Exception:
        return None


def is_configured() -> bool:
    """Check if Supabase is properly configured."""
    return get_supabase() is not None


# =============================================================================
# Auth State
# =============================================================================
def init_auth_state():
    """Initialize session state for auth."""
    if 'auth_user' not in st.session_state:
        st.session_state.auth_user = None
    if 'auth_token' not in st.session_state:
        st.session_state.auth_token = None
    if 'auth_page' not in st.session_state:
        st.session_state.auth_page = 'login'


def get_current_user():
    """Get the currently logged in user."""
    return st.session_state.get('auth_user')


def is_logged_in() -> bool:
    """Check if user is logged in."""
    return st.session_state.get('auth_user') is not None


def logout():
    """Clear auth state."""
    st.session_state.auth_user = None
    st.session_state.auth_token = None


# =============================================================================
# Auth Actions
# =============================================================================
def sign_up(email: str, password: str, full_name: str) -> tuple[bool, str]:
    """Register a new user."""
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
    """Sign in with email and password."""
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
            return True, "התחברת בהצלחה!"
        return False, "שגיאה בהתחברות"
    except Exception as e:
        msg = str(e)
        if "invalid" in msg.lower():
            return False, "מייל או סיסמה שגויים"
        return False, f"שגיאה: {msg}"


def reset_password(email: str) -> tuple[bool, str]:
    """Send password reset email."""
    sb = get_supabase()
    if not sb:
        return False, "Supabase לא מוגדר"
    try:
        sb.auth.reset_password_email(email)
        return True, "נשלח מייל לאיפוס סיסמה"
    except Exception as e:
        return False, f"שגיאה: {e}"


# =============================================================================
# Database Operations
# =============================================================================
def save_income(description: str, amount: float, income_type: str, recurring: str) -> bool:
    """Save income to database."""
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
    """Load user's incomes from database."""
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
    """Delete all user's incomes."""
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user:
        return False
    try:
        sb.table("incomes").delete().eq("user_id", user["id"]).execute()
        return True
    except:
        return False


def save_upload_history(file_name: str, row_count: int, total_expenses: float,
                        total_income: float, date_start, date_end) -> bool:
    """Save file upload record."""
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
    """Load user's upload history."""
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
    """Save user preferences."""
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
    """Load user preferences."""
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
