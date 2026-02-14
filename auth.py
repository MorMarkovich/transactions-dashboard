"""
Authentication & Database module using Supabase
Session persistence via st.query_params (survives refresh, no external deps)
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
# Auth State -- persisted via URL query_params
# =============================================================================
def init_auth_state():
    if 'auth_user' not in st.session_state:
        st.session_state.auth_user = None
    if 'auth_token' not in st.session_state:
        st.session_state.auth_token = None
    if 'auth_page' not in st.session_state:
        st.session_state.auth_page = 'login'
    
    # On refresh: session_state is empty but query_params survive
    if st.session_state.auth_user is None:
        _try_restore_session()


def _try_restore_session():
    """Restore session from URL query param."""
    sb = get_supabase()
    if not sb:
        return
    try:
        rt = st.query_params.get("_rt")
        if not rt:
            return
        res = sb.auth.refresh_session(rt)
        if res and res.user:
            st.session_state.auth_user = {
                "id": res.user.id,
                "email": res.user.email,
                "name": res.user.user_metadata.get("full_name", res.user.email.split("@")[0]),
            }
            st.session_state.auth_token = res.session.access_token
            # Update the query param with the new refresh token
            st.query_params["_rt"] = res.session.refresh_token
        else:
            # Bad token, clean up
            _clear_params()
    except:
        _clear_params()


def _clear_params():
    try:
        if "_rt" in st.query_params:
            del st.query_params["_rt"]
    except:
        pass


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
    _clear_params()


# =============================================================================
# Auth Actions
# =============================================================================
def sign_up(email: str, password: str, full_name: str) -> tuple[bool, str]:
    sb = get_supabase()
    if not sb:
        return False, "Supabase לא מוגדר"
    try:
        res = sb.auth.sign_up({
            "email": email, "password": password,
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
            # Persist refresh token in URL (survives refresh)
            st.query_params["_rt"] = res.session.refresh_token
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
# Transaction Persistence
# =============================================================================
def save_transactions(df) -> bool:
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user or user.get('id') == 'guest':
        return False
    try:
        data = df[['תאריך','תיאור','קטגוריה','סכום','סכום_מוחלט']].copy()
        data['תאריך'] = data['תאריך'].dt.strftime('%Y-%m-%d')
        records = data.to_dict('records')
        sb.table("saved_transactions").delete().eq("user_id", user["id"]).execute()
        for i in range(0, len(records), 500):
            batch = records[i:i+500]
            rows = [{"user_id": user["id"], "data": json.dumps(r, ensure_ascii=False)} for r in batch]
            sb.table("saved_transactions").insert(rows).execute()
        return True
    except:
        return False

def load_transactions():
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
        if '_מקור' not in df.columns:
            df['_מקור'] = 'לא ידוע'
        return df if not df.empty else None
    except:
        return None

def delete_transactions() -> bool:
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user: return False
    try:
        sb.table("saved_transactions").delete().eq("user_id", user["id"]).execute()
        return True
    except: return False

def delete_all_user_data() -> bool:
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user: return False
    try:
        uid = user["id"]
        sb.table("saved_transactions").delete().eq("user_id", uid).execute()
        sb.table("incomes").delete().eq("user_id", uid).execute()
        sb.table("upload_history").delete().eq("user_id", uid).execute()
        sb.table("user_settings").delete().eq("user_id", uid).execute()
        return True
    except: return False


# =============================================================================
# Per-File Transaction Storage (Smart File Management)
# =============================================================================
def save_file_transactions(files_dict):
    """Save transactions for specific files, preserving other files' data.
    files_dict: {file_name: DataFrame}
    """
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user or user.get('id') == 'guest':
        return False
    try:
        new_file_names = set(files_dict.keys())

        # Load existing and keep only non-replaced files
        res = sb.table("saved_transactions").select("data").eq("user_id", user["id"]).execute()
        keep_records = []
        if res.data:
            for r in res.data:
                d = json.loads(r['data'])
                if d.get('_מקור') not in new_file_names:
                    keep_records.append(r['data'])

        # Prepare new records from uploaded files
        new_records = []
        for file_name, df in files_dict.items():
            cols = ['תאריך', 'תיאור', 'קטגוריה', 'סכום', 'סכום_מוחלט']
            data = df[cols].copy()
            data['תאריך'] = data['תאריך'].dt.strftime('%Y-%m-%d')
            data['_מקור'] = file_name
            new_records.extend(
                [json.dumps(r, ensure_ascii=False) for r in data.to_dict('records')]
            )

        # Atomic: delete all then insert all (keep + new)
        sb.table("saved_transactions").delete().eq("user_id", user["id"]).execute()
        all_records = keep_records + new_records
        for i in range(0, len(all_records), 500):
            batch = all_records[i:i + 500]
            rows = [{"user_id": user["id"], "data": d} for d in batch]
            sb.table("saved_transactions").insert(rows).execute()
        return True
    except:
        return False


def delete_file_transactions(file_name):
    """Delete transactions from a specific file only, keeping all other files."""
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user:
        return False
    try:
        res = sb.table("saved_transactions").select("data").eq("user_id", user["id"]).execute()
        if not res.data:
            return True

        keep = [r['data'] for r in res.data
                if json.loads(r['data']).get('_מקור') != file_name]

        sb.table("saved_transactions").delete().eq("user_id", user["id"]).execute()

        for i in range(0, len(keep), 500):
            batch = keep[i:i + 500]
            rows = [{"user_id": user["id"], "data": d} for d in batch]
            sb.table("saved_transactions").insert(rows).execute()
        return True
    except:
        return False


def list_saved_files():
    """List all saved files with metadata (count, total amount, date range)."""
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user or user.get('id') == 'guest':
        return []
    try:
        res = sb.table("saved_transactions").select("data").eq("user_id", user["id"]).execute()
        if not res.data:
            return []

        files = {}
        for r in res.data:
            d = json.loads(r['data'])
            fname = d.get('_מקור', 'לא ידוע')
            if fname not in files:
                files[fname] = {'name': fname, 'count': 0, 'total': 0, 'dates': []}
            files[fname]['count'] += 1
            files[fname]['total'] += abs(float(d.get('סכום', 0)))
            if d.get('תאריך'):
                files[fname]['dates'].append(d['תאריך'])

        result = []
        for f in files.values():
            dates = sorted(f['dates'])
            f['date_range'] = f"{dates[0]} — {dates[-1]}" if dates else ""
            del f['dates']
            result.append(f)
        return result
    except:
        return []


# =============================================================================
# Income Operations
# =============================================================================
def save_income(description, amount, income_type, recurring):
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user: return False
    try:
        sb.table("incomes").insert({"user_id": user["id"], "description": description,
            "amount": amount, "income_type": income_type, "recurring": recurring}).execute()
        return True
    except: return False

def load_incomes():
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user: return []
    try:
        res = sb.table("incomes").select("*").eq("user_id", user["id"]).order("created_at", desc=True).execute()
        return res.data or []
    except: return []

def delete_all_incomes():
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user: return False
    try:
        sb.table("incomes").delete().eq("user_id", user["id"]).execute()
        return True
    except: return False


# =============================================================================
# Settings & History
# =============================================================================
def save_user_settings(theme):
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user: return False
    try:
        sb.table("user_settings").upsert({"user_id": user["id"], "theme": theme}).execute()
        return True
    except: return False

def load_user_settings():
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user: return {}
    try:
        res = sb.table("user_settings").select("*").eq("user_id", user["id"]).single().execute()
        return res.data or {}
    except: return {}

def save_upload_history(file_name, row_count, total_expenses, total_income, date_start, date_end):
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user: return False
    try:
        sb.table("upload_history").insert({"user_id": user["id"], "file_name": file_name,
            "row_count": row_count, "total_expenses": total_expenses, "total_income": total_income,
            "date_range_start": str(date_start) if date_start else None,
            "date_range_end": str(date_end) if date_end else None}).execute()
        return True
    except: return False

def load_upload_history():
    sb = get_supabase()
    user = get_current_user()
    if not sb or not user: return []
    try:
        res = sb.table("upload_history").select("*").eq("user_id", user["id"]).order("uploaded_at", desc=True).limit(10).execute()
        return res.data or []
    except: return []


# =============================================================================
# Validation
# =============================================================================
def validate_email(email):
    return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email))

def validate_password(password):
    if len(password) < 6:
        return False, "הסיסמה חייבת להכיל לפחות 6 תווים"
    return True, ""
