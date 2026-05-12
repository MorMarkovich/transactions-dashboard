"""
API routes for transactions dashboard
"""
import uuid
import os
import math
import re
from typing import Optional, Any
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
import json as _json
import datetime as _dt
from pydantic import BaseModel, field_validator
from fastapi.responses import FileResponse, StreamingResponse
import pandas as pd
import numpy as np
from io import BytesIO


_MONTH_RE = re.compile(r'^(0[1-9]|1[0-2])/\d{4}$')


def _parse_month_key(m: Optional[str]) -> Optional[tuple[int, int]]:
    """Parse 'MM/YYYY' into a (year, month) tuple. Returns None if invalid."""
    if not m or not isinstance(m, str) or not _MONTH_RE.match(m):
        return None
    mm, yyyy = m.split('/')
    return (int(yyyy), int(mm))


def _validated_month_or_none(value: Optional[str], param: str) -> Optional[str]:
    """Return value if it matches MM/YYYY, raise HTTPException 400 otherwise. None/empty pass through."""
    if value is None or value == "":
        return None
    if not _MONTH_RE.match(value):
        raise HTTPException(status_code=400, detail=f"Invalid {param} format, expected MM/YYYY")
    return value


def _spending_only(df: pd.DataFrame) -> pd.DataFrame:
    """
    Expenses minus internal transfers (investments, money moved between the
    user's own accounts). Use this for any KPI labeled "expenses" or
    "spending" so transfers don't inflate the picture.
    """
    if df.empty or 'סכום' not in df.columns:
        return df.iloc[0:0]
    exp = df[df['סכום'] < 0]
    if 'קטגוריה' in exp.columns:
        exp = exp[~exp['קטגוריה'].isin(TRANSFER_CATEGORIES)]
    return exp


def _real_income_only(df: pd.DataFrame) -> pd.DataFrame:
    """
    Positive-amount rows in income categories (salary, pension, benefits).
    Excludes refunds, BIT receipts, credit-card reimbursements, and
    investment / between-account transfers.
    """
    if df.empty or 'סכום' not in df.columns:
        return df.iloc[0:0]
    inc = df[df['סכום'] > 0]
    if 'קטגוריה' in inc.columns:
        inc = inc[inc['קטגוריה'].isin(INCOME_CATEGORIES)]
    return inc


def _round_money(value) -> float:
    """Round to agorot. Eliminates floating-point noise like 61430.909999... ."""
    if value is None:
        return 0.0
    try:
        return float(round(float(value) + 1e-9, 2))
    except (TypeError, ValueError):
        return 0.0


def _apply_month_range(df: pd.DataFrame, month_from: Optional[str], month_to: Optional[str], date_type: str = "transaction") -> pd.DataFrame:
    """Filter df to a [month_from, month_to] inclusive range (MM/YYYY)."""
    if df.empty or (not month_from and not month_to):
        return df
    date_col = 'תאריך_חיוב' if (date_type == 'billing' and 'תאריך_חיוב' in df.columns) else 'תאריך'
    if date_col not in df.columns:
        return df
    month_series = df[date_col].dt.strftime('%m/%Y')
    out = df
    if month_from:
        from_key = _parse_month_key(month_from)
        if from_key is not None:
            out = out[month_series.apply(
                lambda m: (k := _parse_month_key(m)) is not None and k >= from_key
            )]
            month_series = out[date_col].dt.strftime('%m/%Y')
    if month_to:
        to_key = _parse_month_key(month_to)
        if to_key is not None:
            out = out[month_series.apply(
                lambda m: (k := _parse_month_key(m)) is not None and k <= to_key
            )]
    return out

from ..services.data_loader import load_transaction_file
from ..services.data_processor import process_data, clean_dataframe
from ..core.constants import CREDIT_CARD_PAYMENT_KEYWORDS, KEYWORD_TO_CATEGORY, EXACT_WORD_KEYWORDS, TRANSFER_CATEGORIES, INCOME_CATEGORIES
from ..services.ai_categorizer import categorize_transactions
from ..services.chart_generator import (
    create_donut_chart,
    create_monthly_bars,
    create_weekday_chart,
    create_trend_chart
)
from ..services.export_service import export_to_excel
from ..utils.validators import detect_amount_column, find_column

router = APIRouter()

logger = __import__("logging").getLogger(__name__)

@router.get("/test")
async def test():
    return {"status": "ok"}

# In-memory storage for sessions (in production, use Redis or database)
sessions: dict[str, pd.DataFrame] = {}

# Directory for uploaded files
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Cap upload size at 25 MB. Real transaction exports are well under 1 MB; this
# stops trivial DoS by an oversized upload from filling memory or disk.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def _safe_remove(path: Optional[str]) -> None:
    """Best-effort cleanup of a temp upload file."""
    if not path:
        return
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        # File may still be locked on Windows; one short retry then give up.
        try:
            import time as _time
            _time.sleep(0.2)
            if os.path.exists(path):
                os.remove(path)
        except OSError:
            logger.warning("Could not remove temp upload %s", path)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload and process transaction file"""
    file_path: Optional[str] = None
    try:
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large (limit {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)",
            )

        # Save file temporarily under a UUID name (ignore user-supplied filename
        # for the on-disk path to avoid path traversal via the filename).
        ext = ""
        if file.filename:
            _, ext = os.path.splitext(file.filename)
            ext = ext.lower() if ext.lower() in {".xlsx", ".xls", ".csv", ".pdf"} else ""
        file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{ext}")
        with open(file_path, "wb") as f:
            f.write(content)

        # Load and process file (ensure file is closed before processing)
        df_raw = load_transaction_file(file_path)
        # PDFs come out of the extractor already shaped with named Hebrew
        # columns ('תאריך', 'תיאור', 'סכום', 'קטגוריה'), so skip the
        # header-row autodetection that clean_dataframe runs.
        if ext == '.pdf':
            df_clean = df_raw
        else:
            df_clean = clean_dataframe(df_raw)

        # Detect columns
        date_col = find_column(df_clean, ['תאריך עסקה', 'תאריך', 'date', 'Date'])
        amount_col = detect_amount_column(df_clean)
        desc_col = find_column(df_clean, ['שם בית העסק', 'שם בית עסק', 'תיאור', 'תיאור התנועה', 'description', 'merchant'])
        cat_col = find_column(df_clean, ['קטגוריה', 'category', 'Category'])
        billing_date_col = find_column(df_clean, ['תאריך חיוב', 'תאריך_חיוב', 'Billing Date', 'billing date', 'תאריך חיוב:'])

        if not date_col or not amount_col or not desc_col:
            raise HTTPException(
                status_code=400,
                detail=f"Required columns not found. Found columns: {list(df_clean.columns)}"
            )

        # Process data
        df = process_data(df_clean, date_col, amount_col, desc_col, cat_col, billing_date_col)

        if df.empty:
            raise HTTPException(status_code=400, detail="No valid transactions found")

        # Create session
        session_id = str(uuid.uuid4())
        sessions[session_id] = df

        return {
            "success": True,
            "message": f"Loaded {len(df)} transactions",
            "session_id": session_id,
            "transaction_count": len(df)
        }
    except HTTPException:
        raise
    except ValueError as e:
        # Bad input (unsupported format, unparseable, etc.) — client error, not server error.
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Upload failed")
        raise HTTPException(status_code=500, detail=f"Failed to process file: {e}")
    finally:
        _safe_remove(file_path)


class RestoreSessionRequest(BaseModel):
    transactions: list[Any]

    @field_validator('transactions', mode='before')
    @classmethod
    def parse_if_string(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return _json.loads(v)
            except _json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON in transactions: {e}") from e
        return v


class UpdateTransactionNoteRequest(BaseModel):
    session_id: str
    transaction_id: int
    notes: Optional[str] = None


@router.post("/restore-session")
async def restore_session(body: RestoreSessionRequest):
    """Restore a backend session from saved transaction JSON data."""
    if not body.transactions:
        raise HTTPException(status_code=400, detail="No transactions provided")

    try:
        df = pd.DataFrame(body.transactions)

        # Parse date column
        if 'תאריך' in df.columns:
            df['תאריך'] = pd.to_datetime(df['תאריך'], errors='coerce')

        # Parse billing date column if present
        if 'תאריך_חיוב' in df.columns:
            df['תאריך_חיוב'] = pd.to_datetime(df['תאריך_חיוב'], errors='coerce')

        # Ensure numeric columns
        if 'סכום' in df.columns:
            df['סכום'] = pd.to_numeric(df['סכום'], errors='coerce')

        # Compute derived columns if missing
        if 'סכום_מוחלט' not in df.columns and 'סכום' in df.columns:
            df['סכום_מוחלט'] = df['סכום'].abs()
        elif 'סכום_מוחלט' in df.columns:
            df['סכום_מוחלט'] = pd.to_numeric(df['סכום_מוחלט'], errors='coerce')

        if 'יום_בשבוע' not in df.columns and 'תאריך' in df.columns:
            df['יום_בשבוע'] = df['תאריך'].dt.dayofweek

        if 'חודש_חיוב' not in df.columns and 'תאריך_חיוב' in df.columns:
            df['חודש_חיוב'] = df['תאריך_חיוב'].dt.strftime('%m/%Y')

        # ── Deduplicate transactions ────────────────────────────────────
        # Only remove rows that match on ALL three fields (date + amount +
        # description).  Requiring the description prevents dropping
        # legitimate different transactions that happen to share the same
        # date and amount.
        original_count = len(df)
        dedup_cols = ['תאריך', 'סכום', 'תיאור']

        if all(c in df.columns for c in dedup_cols):
            df = df.drop_duplicates(subset=dedup_cols, keep='first').reset_index(drop=True)

        duplicates_removed = original_count - len(df)

        # ── Auto-categorize "שונות" by description keywords ──────────
        if 'קטגוריה' in df.columns and 'תיאור' in df.columns:
            desc_lower = df['תיאור'].str.lower()
            # Psagot investment transfers override any existing category
            psagot_mask = desc_lower.str.contains('פסגות', na=False) | desc_lower.str.contains('psagot', na=False)
            if psagot_mask.any():
                df.loc[psagot_mask, 'קטגוריה'] = 'העברה להשקעות'
            misc_mask = df['קטגוריה'] == 'שונות'
            if misc_mask.any():
                for kw, cat in KEYWORD_TO_CATEGORY.items():
                    match = misc_mask & desc_lower.str.contains(kw, na=False, regex=False)
                    if match.any():
                        df.loc[match, 'קטגוריה'] = cat
                        misc_mask = misc_mask & ~match
                for kw, cat in EXACT_WORD_KEYWORDS.items():
                    if not misc_mask.any():
                        break
                    pattern = r'(?:^|[\s\-/])' + re.escape(kw) + r'(?:$|[\s\-/])'
                    match = misc_mask & desc_lower.str.contains(pattern, na=False, regex=True)
                    if match.any():
                        df.loc[match, 'קטגוריה'] = cat
                        misc_mask = misc_mask & ~match

            # AI categorization for remaining "שונות" transactions
            misc_mask = df['קטגוריה'] == 'שונות'
            if misc_mask.any():
                misc_descs = df.loc[misc_mask, 'תיאור'].tolist()
                ai_map = categorize_transactions(misc_descs)
                if ai_map:
                    misc_idx = df.index[misc_mask].tolist()
                    for local_i, cat in ai_map.items():
                        if 0 <= local_i < len(misc_idx):
                            df.at[misc_idx[local_i], 'קטגוריה'] = cat

        # ── Remove credit-card bill payments from bank statement rows ──
        # When the user uploads both a bank file and a credit-card file,
        # the bank file contains a lump-sum payment to the card company
        # (e.g. "ישראכרט חיוב ₪5,376") while the card file already lists
        # all the individual charges.  Keeping both would double-count.
        cc_payments_removed = 0
        has_billing_date = 'תאריך_חיוב' in df.columns
        has_desc = 'תיאור' in df.columns
        if has_billing_date and has_desc:
            # Rows from credit-card files have a valid billing date;
            # rows from bank statements have NaT.
            has_cc_rows = df['תאריך_חיוב'].notna().any()
            has_bank_rows = df['תאריך_חיוב'].isna().any()

            if has_cc_rows and has_bank_rows:
                # Among bank-statement rows (NaT billing date), drop those
                # whose description matches a credit-card company name.
                desc_lower = df['תיאור'].str.lower()
                is_bank_row = df['תאריך_חיוב'].isna()
                is_cc_payment = desc_lower.str.contains(
                    '|'.join(CREDIT_CARD_PAYMENT_KEYWORDS),
                    na=False,
                )
                cc_payment_mask = is_bank_row & is_cc_payment
                cc_payments_removed = int(cc_payment_mask.sum())
                if cc_payments_removed > 0:
                    df = df[~cc_payment_mask].reset_index(drop=True)

        # Ensure notes column exists
        if 'הערות' not in df.columns:
            df['הערות'] = None

        # Ensure stable id column exists and is integer-typed
        if 'id' not in df.columns:
            df['id'] = pd.Series(range(len(df)), dtype='int64')
        else:
            df['id'] = pd.to_numeric(df['id'], errors='coerce')
            if df['id'].isna().any():
                missing_mask = df['id'].isna()
                df.loc[missing_mask, 'id'] = df.index[missing_mask]
            df['id'] = df['id'].astype('int64')

        session_id = str(uuid.uuid4())
        sessions[session_id] = df

        msg = f"Restored {len(df)} transactions"
        removed_parts = []
        if duplicates_removed > 0:
            removed_parts.append(f"{duplicates_removed} כפילויות")
        if cc_payments_removed > 0:
            removed_parts.append(f"{cc_payments_removed} חיובי כרטיס אשראי כפולים")
        if removed_parts:
            msg += f" (הוסרו: {', '.join(removed_parts)})"

        return {
            "success": True,
            "session_id": session_id,
            "transaction_count": len(df),
            "duplicates_removed": duplicates_removed,
            "cc_payments_removed": cc_payments_removed,
            "message": msg,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("restore-session failed")
        raise HTTPException(status_code=500, detail=f"Failed to restore session: {e}")


@router.post("/transactions/note")
async def update_transaction_note(body: UpdateTransactionNoteRequest):
    """Update the manual notes (הערות) field for a single transaction."""
    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[body.session_id]

    if 'id' not in df.columns:
        raise HTTPException(status_code=400, detail="Session does not support transaction updates")

    mask = df['id'] == body.transaction_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Normalize empty/whitespace-only strings to None
    value = body.notes.strip() if body.notes is not None else None
    if value == "":
        value = None

    if 'הערות' not in df.columns:
        df['הערות'] = None

    df.loc[mask, 'הערות'] = value
    sessions[body.session_id] = df

    return {"success": True}


@router.get("/transactions")
async def get_transactions(
    sessionId: str = Query(...),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc",
    page: int = 1,
    page_size: int = 100
):
    """Get transactions with filters"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId].copy()

    # Apply filters
    if start_date:
        df = df[df['תאריך'] >= pd.to_datetime(start_date)]
    if end_date:
        df = df[df['תאריך'] <= pd.to_datetime(end_date)]
    if category:
        df = df[df['קטגוריה'] == category]
    if search:
        df = df[df['תיאור'].str.contains(search, case=False, na=False)]
    if (min_amount is not None or max_amount is not None) and 'סכום_מוחלט' in df.columns:
        if min_amount is not None:
            df = df[df['סכום_מוחלט'] >= min_amount]
        if max_amount is not None:
            df = df[df['סכום_מוחלט'] <= max_amount]
    
    # Sort
    if sort_by:
        ascending = sort_order == "asc"
        df = df.sort_values(by=sort_by, ascending=ascending)
    else:
        df = df.sort_values(by='תאריך', ascending=False)
    
    # Aggregate stats (computed on the full filtered dataset, before pagination)
    total = len(df)
    total_amount = _round_money(float(df['סכום_מוחלט'].sum())) if 'סכום_מוחלט' in df.columns and total > 0 else 0
    expense_count = int((df['סכום'] < 0).sum()) if 'סכום' in df.columns else 0

    # Enhanced stats. We split into expenses, real income (salary/pension),
    # and "spending" (expenses minus internal transfers like investments /
    # between-account moves) so KPIs aren't skewed by money you didn't
    # actually consume or earn.
    expenses_df = df[df['סכום'] < 0] if 'סכום' in df.columns else pd.DataFrame()
    income_df = _real_income_only(df)
    income_count = int(len(income_df))
    if not expenses_df.empty and 'קטגוריה' in expenses_df.columns:
        spending_df = expenses_df[~expenses_df['קטגוריה'].isin(TRANSFER_CATEGORIES)]
    else:
        spending_df = expenses_df
    total_expenses = _round_money(float(spending_df['סכום_מוחלט'].sum())) if not spending_df.empty and 'סכום_מוחלט' in spending_df.columns else 0
    total_income = _round_money(float(income_df['סכום'].sum())) if not income_df.empty else 0
    spending_count = int(len(spending_df)) if not spending_df.empty else 0
    # Average per *spending* transaction — consistent with /api/metrics
    avg_transaction = _round_money(total_expenses / spending_count) if spending_count > 0 else 0
    median_transaction = _round_money(float(spending_df['סכום_מוחלט'].median())) if not spending_df.empty and 'סכום_מוחלט' in spending_df.columns else 0

    # Max/min transactions — excludes transfers so "highest expense" isn't
    # an investment move or between-account transfer.
    max_transaction = None
    min_transaction = None
    if not spending_df.empty and 'סכום_מוחלט' in spending_df.columns:
        max_idx = spending_df['סכום_מוחלט'].idxmax()
        min_idx = spending_df['סכום_מוחלט'].idxmin()
        max_row = spending_df.loc[max_idx]
        min_row = spending_df.loc[min_idx]
        max_transaction = {"description": str(max_row.get('תיאור', '')), "amount": round(_sanitize(float(max_row['סכום_מוחלט'])), 2)}
        min_transaction = {"description": str(min_row.get('תיאור', '')), "amount": round(_sanitize(float(min_row['סכום_מוחלט'])), 2)}

    # Category breakdown (top 10, expenses excluding transfers)
    category_breakdown = []
    if 'קטגוריה' in df.columns and 'סכום_מוחלט' in df.columns and not spending_df.empty:
        cat_group = spending_df.groupby('קטגוריה')['סכום_מוחלט'].agg(['sum', 'count']).reset_index()
        cat_group = cat_group.sort_values('sum', ascending=False).head(10)
        cat_total = cat_group['sum'].sum()
        for _, row in cat_group.iterrows():
            category_breakdown.append({
                "name": str(row['קטגוריה']),
                "total": round(_sanitize(float(row['sum'])), 2),
                "count": int(row['count']),
                "percent": round(_sanitize(float(row['sum'] / cat_total * 100)), 1) if cat_total > 0 else 0,
            })

    # Date range
    date_from = None
    date_to = None
    if 'תאריך' in df.columns and total > 0:
        valid_dates = df['תאריך'].dropna()
        if len(valid_dates) > 0:
            date_from = _to_json_safe(valid_dates.min())
            date_to = _to_json_safe(valid_dates.max())

    # Pagination
    start = (page - 1) * page_size
    end = start + page_size
    df_page = df.iloc[start:end]

    # Whitelist the columns we expose. The raw frame has ~60 columns harvested
    # from every source-file template (most are null per row); leaking them
    # all is wasteful and also exposes sensitive fields (card last-4, source
    # filename). Anything not in this list is dropped from the response.
    _ALLOWED_COLS = {
        'id', 'תאריך', 'תאריך_חיוב', 'תיאור', 'סכום', 'סכום_מוחלט',
        'קטגוריה', 'חודש', 'חודש_חיוב', 'יום_בשבוע', 'הערות', 'סוג עסקה',
    }
    transactions = [
        {k: _to_json_safe(v) for k, v in record.items() if k in _ALLOWED_COLS}
        for record in df_page.to_dict('records')
    ]

    return {
        "transactions": transactions,
        "total": total,
        "total_amount": total_amount,
        "avg_transaction": avg_transaction,
        "expense_count": expense_count,
        "income_count": income_count,
        "total_expenses": total_expenses,
        "total_income": total_income,
        "median_transaction": median_transaction,
        "max_transaction": max_transaction,
        "min_transaction": min_transaction,
        "category_breakdown": category_breakdown,
        "date_from": date_from,
        "date_to": date_to,
        "page": page,
        "page_size": page_size
    }


@router.get("/session-files")
async def get_session_files(sessionId: str = Query(...)):
    """List source files in the current session with per-file stats."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if '_source_file' not in df.columns:
        return {"files": []}

    files = []
    for name, group in df.groupby('_source_file'):
        expenses = group[group['סכום'] < 0] if 'סכום' in group.columns else pd.DataFrame()
        income = group[group['סכום'] > 0] if 'סכום' in group.columns else pd.DataFrame()
        date_from = None
        date_to = None
        if 'תאריך' in group.columns:
            valid_dates = group['תאריך'].dropna()
            if not valid_dates.empty:
                date_from = str(valid_dates.min().date())
                date_to = str(valid_dates.max().date())
        files.append({
            "name": str(name),
            "transaction_count": len(group),
            "expense_count": len(expenses),
            "income_count": len(income),
            "total_expenses": round(_sanitize(float(expenses['סכום_מוחלט'].sum())), 2) if not expenses.empty and 'סכום_מוחלט' in expenses.columns else 0,
            "total_income": round(_sanitize(float(income['סכום'].sum())), 2) if not income.empty else 0,
            "date_from": date_from,
            "date_to": date_to,
        })

    return {"files": files}


@router.delete("/session-files")
async def delete_session_file(sessionId: str = Query(...), file_name: str = Query(...)):
    """Remove all transactions from a specific source file."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if '_source_file' not in df.columns:
        raise HTTPException(status_code=400, detail="No source file tracking in this session")

    before = len(df)
    df = df[df['_source_file'] != file_name].reset_index(drop=True)
    removed = before - len(df)

    if removed == 0:
        raise HTTPException(status_code=404, detail=f"File '{file_name}' not found in session")

    sessions[sessionId] = df
    return {
        "success": True,
        "removed": removed,
        "remaining": len(df),
        "message": f"הוסרו {removed} עסקאות מקובץ {file_name}",
    }


@router.delete("/session")
async def delete_session(sessionId: str = Query(...)):
    """Delete an entire session and all its in-memory data."""
    if sessionId in sessions:
        del sessions[sessionId]
    return {"success": True, "message": "Session cleared"}


@router.get("/session-info")
async def get_session_info(sessionId: str = Query(...)):
    """Get detailed metadata about the current session data."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    total = len(df)

    # Columns available
    columns = list(df.columns)

    # Date range
    date_from = None
    date_to = None
    if 'תאריך' in df.columns:
        valid = df['תאריך'].dropna()
        if len(valid) > 0:
            date_from = _to_json_safe(valid.min())
            date_to = _to_json_safe(valid.max())

    # Billing date range
    billing_date_from = None
    billing_date_to = None
    if 'תאריך_חיוב' in df.columns:
        valid_b = df['תאריך_חיוב'].dropna()
        if len(valid_b) > 0:
            billing_date_from = _to_json_safe(valid_b.min())
            billing_date_to = _to_json_safe(valid_b.max())

    # Expense / income split
    expenses = df[df['סכום'] < 0] if 'סכום' in df.columns else pd.DataFrame()
    income = df[df['סכום'] > 0] if 'סכום' in df.columns else pd.DataFrame()
    total_expenses = round(_sanitize(float(expenses['סכום_מוחלט'].sum())), 2) if not expenses.empty and 'סכום_מוחלט' in expenses.columns else 0
    total_income = round(_sanitize(float(income['סכום'].sum())), 2) if not income.empty else 0

    # Categories with counts
    categories = []
    if 'קטגוריה' in df.columns and 'סכום_מוחלט' in df.columns:
        cat_group = df.groupby('קטגוריה').agg(
            count=('סכום', 'size'),
            expense_total=('סכום_מוחלט', lambda x: round(float(x[df.loc[x.index, 'סכום'] < 0].sum()), 2) if (df.loc[x.index, 'סכום'] < 0).any() else 0),
            income_total=('סכום', lambda x: round(float(x[x > 0].sum()), 2) if (x > 0).any() else 0),
        ).reset_index()
        cat_group = cat_group.sort_values('expense_total', ascending=False)
        for _, row in cat_group.iterrows():
            categories.append({
                "name": str(row['קטגוריה']),
                "count": int(row['count']),
                "expense_total": _sanitize(row['expense_total']),
                "income_total": _sanitize(row['income_total']),
            })

    # Months in data
    months = []
    if 'חודש' in df.columns:
        months = sorted(df['חודש'].dropna().unique().tolist())

    return {
        "total_rows": total,
        "columns": columns,
        "date_from": date_from,
        "date_to": date_to,
        "billing_date_from": billing_date_from,
        "billing_date_to": billing_date_to,
        "expense_count": int(len(expenses)),
        "income_count": int(len(income)),
        "total_expenses": total_expenses,
        "total_income": total_income,
        "categories": categories,
        "months": months,
        "has_billing_date": 'תאריך_חיוב' in df.columns and df['תאריך_חיוב'].notna().any(),
    }


@router.get("/metrics")
async def get_metrics(sessionId: str = Query(...)):
    """Get metrics data"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]

    expenses = df[df['סכום'] < 0]
    spending = _spending_only(df)
    real_income = _real_income_only(df)
    # All positive-amount rows, kept for diagnostics (refunds + transfers + income)
    positive_total = float(df.loc[df['סכום'] > 0, 'סכום'].sum()) if 'סכום' in df.columns else 0.0

    total_transactions = len(spending)
    total_expenses = float(spending['סכום_מוחלט'].sum()) if not spending.empty and 'סכום_מוחלט' in spending.columns else 0.0
    total_income = float(real_income['סכום'].sum()) if not real_income.empty else 0.0
    average_transaction = float(spending['סכום_מוחלט'].mean()) if not spending.empty and 'סכום_מוחלט' in spending.columns else 0.0

    # Calculate trend (based on spending only)
    trend = None
    if len(spending) > 10:
        mid = len(spending) // 2
        first_half_avg = spending.iloc[:mid]['סכום_מוחלט'].mean()
        second_half_avg = spending.iloc[mid:]['סכום_מוחלט'].mean()
        if first_half_avg > 0:
            trend_pct = ((second_half_avg - first_half_avg) / first_half_avg) * 100
            trend = 'up' if trend_pct > 0 else 'down'

    has_billing_date = 'תאריך_חיוב' in df.columns and df['תאריך_חיוב'].notna().any()

    return {
        "total_transactions": total_transactions,
        "expense_count": int(len(expenses)),
        "income_count": int(len(real_income)),
        "total_expenses": _round_money(total_expenses),
        "total_income": _round_money(total_income),
        # Sum of all positive rows including refunds/transfers — useful for
        # debugging but not displayed as "income".
        "total_positive": _round_money(positive_total),
        "average_transaction": _round_money(average_transaction),
        "trend": trend,
        "has_billing_date": bool(has_billing_date),
    }


@router.get("/categories")
async def get_categories(sessionId: str = Query(...)):
    """Get list of unique categories"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]
    categories = df['קטגוריה'].unique().tolist()
    # Filter out None/NaN and sort
    categories = sorted([c for c in categories if c and str(c).lower() != 'nan'])
    
    return categories


@router.get("/charts/donut")
async def get_donut_chart(sessionId: str = Query(...)):
    """Get donut chart data"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]
    chart_data = create_donut_chart(df)
    return chart_data


@router.get("/charts/monthly")
async def get_monthly_chart(sessionId: str = Query(...)):
    """Get monthly chart data"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]
    chart_data = create_monthly_bars(df)
    return chart_data


@router.get("/charts/weekday")
async def get_weekday_chart(sessionId: str = Query(...)):
    """Get weekday chart data"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]
    chart_data = create_weekday_chart(df)
    return chart_data


@router.get("/charts/trend")
async def get_trend_chart(sessionId: str = Query(...)):
    """Get trend chart data"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]
    chart_data = create_trend_chart(df)
    return chart_data


@router.get("/export")
async def export_transactions(
    sessionId: str = Query(...),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None
):
    """Export transactions to Excel"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId].copy()
    
    # Apply filters
    if start_date:
        df = df[df['תאריך'] >= pd.to_datetime(start_date)]
    if end_date:
        df = df[df['תאריך'] <= pd.to_datetime(end_date)]
    if category:
        df = df[df['קטגוריה'] == category]
    
    # Export
    excel_buffer = export_to_excel(df)
    
    return StreamingResponse(
        BytesIO(excel_buffer.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=transactions.xlsx"}
    )


# ---------------------------------------------------------------------------
# V2 API endpoints – raw JSON data for frontend charting
# ---------------------------------------------------------------------------

def _sanitize(val):
    """Replace NaN/Infinity with None for JSON serialization."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return 0
    return val


def _to_json_safe(val):
    """Convert any pandas/numpy value to a JSON-serializable Python type.

    Handles: pd.NaT, pd.Timestamp, np.int64/float64, NaN, Inf.
    """
    try:
        if pd.isnull(val):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(val, (_dt.datetime, _dt.date)):
        return val.isoformat()
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if hasattr(val, 'item'):   # numpy int64, float64, bool_, etc.
        v = val.item()
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return v
    return val


@router.get("/charts/v2/donut")
async def get_donut_v2(sessionId: str = Query(...)):
    """Return raw category breakdown (top 10 + 'אחר')."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"categories": [], "total": 0}

    cat_totals = (
        expenses
        .groupby('קטגוריה')['סכום_מוחלט']
        .sum()
        .sort_values(ascending=False)
    )

    top = cat_totals.head(10)
    other = cat_totals.iloc[10:].sum() if len(cat_totals) > 10 else 0

    categories = [
        {"name": str(name), "value": round(_sanitize(val), 2)}
        for name, val in top.items()
    ]
    if other > 0:
        categories.append({"name": "אחר", "value": round(float(other), 2)})

    total = round(_sanitize(float(cat_totals.sum())), 2)
    return {"categories": categories, "total": total}


@router.get("/charts/v2/category-snapshot")
async def get_category_snapshot(
    sessionId: str = Query(...),
    month_from: str = Query(default=None),
    month_to: str = Query(default=None),
    date_type: str = Query(default="transaction"),
):
    """Return ALL categories with enriched analytical data. Optional month range filter (MM/YYYY)."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    # Use spending-only (exclude transfers/investments) so totals reconcile
    # with the dashboard's spending KPIs and the month-overview card.
    expenses = _spending_only(df).copy()

    # Determine which month column to use based on date_type
    month_col = 'חודש'
    if date_type == 'billing' and 'חודש_חיוב' in expenses.columns:
        month_col = 'חודש_חיוב'

    # Optional month range filtering
    month_from = _validated_month_or_none(month_from, "month_from")
    month_to = _validated_month_or_none(month_to, "month_to")
    if (month_from or month_to) and not expenses.empty:
        if month_from:
            from_key = _parse_month_key(month_from)
            expenses = expenses[expenses[month_col].apply(
                lambda m: (k := _parse_month_key(m)) is not None and k >= from_key
            )]
        if month_to:
            to_key = _parse_month_key(month_to)
            expenses = expenses[expenses[month_col].apply(
                lambda m: (k := _parse_month_key(m)) is not None and k <= to_key
            )]

    if expenses.empty:
        return {"categories": [], "total": 0, "total_count": 0, "month_count": 0}

    # -- Overall aggregation --
    cat_agg = (
        expenses
        .groupby('קטגוריה')
        .agg(
            total=('סכום_מוחלט', 'sum'),
            count=('סכום_מוחלט', 'size'),
        )
        .sort_values('total', ascending=False)
    )

    grand_total = float(cat_agg['total'].sum())
    total = round(_sanitize(grand_total), 2)
    total_count = int(cat_agg['count'].sum())

    # -- Per-category monthly breakdown for trends --
    # Sort months chronologically (MM/YYYY string sort is wrong: 01/2026 < 09/2025)
    all_months = sorted(
        (m for m in expenses[month_col].unique() if _parse_month_key(m) is not None),
        key=lambda m: _parse_month_key(m),
    )
    month_count = len(all_months)

    cat_month = (
        expenses
        .groupby(['קטגוריה', month_col])
        .agg(month_total=('סכום_מוחלט', 'sum'))
        .reset_index()
    )

    # -- Top merchant per category --
    cat_merchant = (
        expenses
        .groupby(['קטגוריה', 'תיאור'])
        .agg(merchant_total=('סכום_מוחלט', 'sum'))
        .reset_index()
    )
    top_merchants = (
        cat_merchant
        .sort_values('merchant_total', ascending=False)
        .drop_duplicates(subset='קטגוריה', keep='first')
        .set_index('קטגוריה')
    )

    # -- Last two months for trend calculation --
    last_month = all_months[-1] if all_months else None
    prev_month = all_months[-2] if len(all_months) >= 2 else None

    last_month_totals = {}
    prev_month_totals = {}
    if last_month:
        lm = cat_month[cat_month[month_col] == last_month].set_index('קטגוריה')
        last_month_totals = lm['month_total'].to_dict()
    if prev_month:
        pm = cat_month[cat_month[month_col] == prev_month].set_index('קטגוריה')
        prev_month_totals = pm['month_total'].to_dict()

    # -- Months active per category --
    months_active = cat_month.groupby('קטגוריה')[month_col].nunique().to_dict()

    # -- Build enriched response --
    categories = []
    for name, row in cat_agg.iterrows():
        cat_name = str(name)
        cat_total = round(_sanitize(float(row['total'])), 2)
        cat_count = int(row['count'])
        cat_avg = round(_sanitize(cat_total / cat_count), 2) if cat_count > 0 else 0
        cat_percent = round(cat_total / grand_total * 100, 1) if grand_total > 0 else 0
        cat_months_active = months_active.get(cat_name, 1)
        cat_monthly_avg = round(_sanitize(cat_total / cat_months_active), 2) if cat_months_active > 0 else 0

        # Month-over-month trend
        lm_val = last_month_totals.get(cat_name, 0)
        pm_val = prev_month_totals.get(cat_name, 0)
        if pm_val > 0:
            month_change = round((lm_val - pm_val) / pm_val * 100, 1)
        elif lm_val > 0 and prev_month is not None:
            month_change = 100.0  # new category this month (wasn't in prev month)
        else:
            month_change = 0.0

        # Top merchant
        merchant_name = None
        merchant_total_val = 0
        if cat_name in top_merchants.index:
            merchant_name = str(top_merchants.loc[cat_name, 'תיאור'])
            merchant_total_val = round(_sanitize(float(top_merchants.loc[cat_name, 'merchant_total'])), 2)

        # Monthly sparkline (last 6 months)
        cat_monthly_data = cat_month[cat_month['קטגוריה'] == cat_name].set_index(month_col)
        sparkline = [
            round(_sanitize(float(cat_monthly_data.loc[m, 'month_total'])), 2) if m in cat_monthly_data.index else 0
            for m in all_months[-6:]
        ]

        categories.append({
            "name": cat_name,
            "total": cat_total,
            "count": cat_count,
            "percent": cat_percent,
            "avg_transaction": cat_avg,
            "monthly_avg": cat_monthly_avg,
            "months_active": cat_months_active,
            "month_change": month_change,
            "top_merchant": merchant_name,
            "top_merchant_total": merchant_total_val,
            "sparkline": sparkline,
        })

    return {
        "categories": categories,
        "total": total,
        "total_count": total_count,
        "month_count": month_count,
        "last_month": last_month,
        "prev_month": prev_month,
    }


@router.get("/charts/v2/category-transactions")
async def get_category_transactions(
    sessionId: str = Query(...),
    month: str = Query(""),
    month_from: str = Query(""),
    month_to: str = Query(""),
    category: str = Query(...),
    date_type: str = Query("transaction"),
    sort_order: str = Query("asc"),
):
    """Return all transactions for a given category, optionally filtered by month or date range."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId].copy()
    if df.empty:
        return {"transactions": [], "total": 0, "count": 0}

    # Filter by category + expenses
    filtered = df[(df['קטגוריה'] == category) & (df['סכום'] < 0)]

    date_col = 'תאריך_חיוב' if (date_type == 'billing' and 'תאריך_חיוב' in df.columns) else 'תאריך'

    # Filter by single month or date range
    if month:
        filtered = filtered.copy()
        filtered['_month'] = filtered[date_col].dt.strftime('%m/%Y')
        filtered = filtered[filtered['_month'] == month]
    elif month_from or month_to:
        month_from = _validated_month_or_none(month_from, "month_from")
        month_to = _validated_month_or_none(month_to, "month_to")
        filtered = filtered.copy()
        filtered['_month'] = filtered[date_col].dt.strftime('%m/%Y')
        if month_from:
            from_key = _parse_month_key(month_from)
            filtered = filtered[filtered['_month'].apply(
                lambda m: (k := _parse_month_key(m)) is not None and k >= from_key
            )]
        if month_to:
            to_key = _parse_month_key(month_to)
            filtered = filtered[filtered['_month'].apply(
                lambda m: (k := _parse_month_key(m)) is not None and k <= to_key
            )]

    if filtered.empty:
        return {"transactions": [], "total": 0, "count": 0}

    ascending = sort_order == 'asc'
    filtered = filtered.sort_values('סכום_מוחלט', ascending=ascending)

    transactions = [
        {
            "תאריך": row['תאריך'].strftime('%Y-%m-%d') if hasattr(row['תאריך'], 'strftime') else str(row['תאריך']),
            "תיאור": str(row['תיאור']),
            "סכום": _sanitize(round(float(row['סכום']), 2)),
            "סכום_מוחלט": _sanitize(round(float(row['סכום_מוחלט']), 2)),
            "קטגוריה": str(row['קטגוריה']),
        }
        for _, row in filtered.iterrows()
    ]

    total = _sanitize(round(float(filtered['סכום_מוחלט'].sum()), 2))
    return {"transactions": transactions, "total": total, "count": len(transactions)}


@router.get("/charts/v2/category-merchants")
async def get_category_merchants(
    sessionId: str = Query(...),
    month: str = Query(...),
    category: str = Query(...),
    date_type: str = Query("transaction"),
):
    """Return merchant breakdown within a category for a specific month."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId].copy()
    if df.empty:
        return {"merchants": [], "total": 0}

    date_col = 'תאריך_חיוב' if (date_type == 'billing' and 'תאריך_חיוב' in df.columns) else 'תאריך'
    df['_month'] = df[date_col].dt.strftime('%m/%Y')
    filtered = df[(df['_month'] == month) & (df['קטגוריה'] == category) & (df['סכום'] < 0)]

    if filtered.empty:
        return {"merchants": [], "total": 0}

    merchant_agg = (
        filtered
        .groupby('תיאור')
        .agg(
            total=('סכום_מוחלט', 'sum'),
            count=('סכום_מוחלט', 'size'),
        )
        .sort_values('total', ascending=False)
    )

    merchants = [
        {
            "name": str(name),
            "total": _sanitize(round(float(row['total']), 2)),
            "count": int(row['count']),
        }
        for name, row in merchant_agg.iterrows()
    ]

    total = _sanitize(round(float(merchant_agg['total'].sum()), 2))
    return {"merchants": merchants, "total": total}


@router.get("/charts/v2/merchant-transactions")
async def get_merchant_transactions(
    sessionId: str = Query(...),
    month: str = Query(...),
    category: str = Query(...),
    merchant: str = Query(...),
    date_type: str = Query("transaction"),
):
    """Return individual transactions for a specific merchant within a category/month."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId].copy()
    if df.empty:
        return {"transactions": [], "total": 0}

    date_col = 'תאריך_חיוב' if (date_type == 'billing' and 'תאריך_חיוב' in df.columns) else 'תאריך'
    df['_month'] = df[date_col].dt.strftime('%m/%Y')
    filtered = df[
        (df['_month'] == month) &
        (df['קטגוריה'] == category) &
        (df['תיאור'] == merchant) &
        (df['סכום'] < 0)
    ]

    if filtered.empty:
        return {"transactions": [], "total": 0}

    filtered = filtered.sort_values('סכום_מוחלט', ascending=True)

    transactions = [
        {
            "תאריך": row['תאריך'].strftime('%Y-%m-%d') if hasattr(row['תאריך'], 'strftime') else str(row['תאריך']),
            "תיאור": str(row['תיאור']),
            "סכום": _sanitize(round(float(row['סכום']), 2)),
            "סכום_מוחלט": _sanitize(round(float(row['סכום_מוחלט']), 2)),
            "קטגוריה": str(row['קטגוריה']),
        }
        for _, row in filtered.iterrows()
    ]

    total = _sanitize(round(float(filtered['סכום_מוחלט'].sum()), 2))
    return {"transactions": transactions, "total": total}


@router.get("/charts/v2/monthly")
async def get_monthly_v2(sessionId: str = Query(...), date_type: str = Query("transaction")):
    """Return raw monthly expense totals."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"months": []}

    # Choose date column based on date_type
    date_col = 'תאריך_חיוב' if (date_type == 'billing' and 'תאריך_חיוב' in expenses.columns) else 'תאריך'
    expenses['month_period'] = expenses[date_col].dt.to_period('M')
    expenses = expenses.dropna(subset=['month_period'])
    monthly = (
        expenses
        .groupby('month_period')['סכום_מוחלט']
        .sum()
        .sort_index()
    )

    months = [
        {"month": period.strftime('%m/%Y'), "amount": round(_sanitize(v), 2)}
        for period, v in monthly.items()
    ]
    return {"months": months}


@router.get("/charts/v2/weekday")
async def get_weekday_v2(sessionId: str = Query(...)):
    """Return raw weekday expense totals with Hebrew day names."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    day_names = {
        0: 'שני',
        1: 'שלישי',
        2: 'רביעי',
        3: 'חמישי',
        4: 'שישי',
        5: 'שבת',
        6: 'ראשון',
    }

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"days": []}

    weekday_totals = (
        expenses
        .groupby('יום_בשבוע')['סכום_מוחלט']
        .sum()
    )

    days = [
        {
            "day": day_names.get(int(d), str(d)),
            "amount": round(_sanitize(v), 2),
        }
        for d, v in weekday_totals.sort_index().items()
    ]
    return {"days": days}


@router.get("/charts/v2/trend")
async def get_trend_v2(sessionId: str = Query(...)):
    """Return cumulative balance over time."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId].copy()

    if df.empty:
        return {"points": []}

    df = df.sort_values('תאריך')
    df['cumulative'] = df['סכום'].cumsum()

    points = [
        {
            "date": row['תאריך'].strftime('%Y-%m-%d') if hasattr(row['תאריך'], 'strftime') else str(row['תאריך']),
            "balance": round(_sanitize(row['cumulative']), 2),
        }
        for _, row in df.iterrows()
    ]
    return {"points": points}


@router.get("/insights")
async def get_insights(
    sessionId: str = Query(...),
    month_from: Optional[str] = Query(default=None),
    month_to: Optional[str] = Query(default=None),
    date_type: str = Query(default="transaction"),
):
    """Return smart insights derived from transaction data."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    month_from = _validated_month_or_none(month_from, "month_from")
    month_to = _validated_month_or_none(month_to, "month_to")
    df_scoped = _apply_month_range(df, month_from, month_to, date_type)
    expenses = _spending_only(df_scoped).copy()

    if expenses.empty:
        return {
            "biggest_expense": None,
            "top_merchant": None,
            "expensive_day": None,
            "avg_transaction": 0,
            "large_transactions": [],
        }

    # Biggest single expense (excludes transfers/investments)
    idx_max = expenses['סכום_מוחלט'].idxmax()
    biggest = expenses.loc[idx_max]
    biggest_expense = {
        "description": str(biggest['תיאור']),
        "amount": round(_sanitize(biggest['סכום_מוחלט']), 2),
        "date": biggest['תאריך'].strftime('%Y-%m-%d') if hasattr(biggest['תאריך'], 'strftime') else str(biggest['תאריך']),
        "category": str(biggest['קטגוריה']),
    }

    # Top merchant by count
    merchant_stats = expenses.groupby('תיאור').agg(
        count=('סכום_מוחלט', 'size'),
        total=('סכום_מוחלט', 'sum'),
    )
    top_merch = merchant_stats.sort_values('count', ascending=False).iloc[0]
    top_merchant = {
        "name": str(top_merch.name),
        "count": int(top_merch['count']),
        "total": round(_sanitize(top_merch['total']), 2),
    }

    # Most expensive day of week (by average daily spend)
    day_names = {
        0: 'שני', 1: 'שלישי', 2: 'רביעי', 3: 'חמישי',
        4: 'שישי', 5: 'שבת', 6: 'ראשון',
    }
    day_avg = expenses.groupby('יום_בשבוע')['סכום_מוחלט'].mean()
    exp_day_num = day_avg.idxmax()
    expensive_day = {
        "day": day_names.get(int(exp_day_num), str(exp_day_num)),
        "average": round(_sanitize(day_avg.loc[exp_day_num]), 2),
    }

    # Average transaction amount
    avg_transaction = round(_sanitize(expenses['סכום_מוחלט'].mean()), 2)

    # Large transactions (above 90th percentile, max 10)
    p90 = expenses['סכום_מוחלט'].quantile(0.9)
    large = expenses[expenses['סכום_מוחלט'] >= p90].nlargest(10, 'סכום_מוחלט')
    large_transactions = [
        {
            "תאריך": row['תאריך'].strftime('%Y-%m-%d') if hasattr(row['תאריך'], 'strftime') else str(row['תאריך']),
            "תיאור": str(row['תיאור']),
            "קטגוריה": str(row['קטגוריה']),
            "סכום": round(_sanitize(float(row['סכום'])), 2),
            "סכום_מוחלט": round(_sanitize(float(row['סכום_מוחלט'])), 2),
        }
        for _, row in large.iterrows()
    ]

    return {
        "biggest_expense": biggest_expense,
        "top_merchant": top_merchant,
        "expensive_day": expensive_day,
        "avg_transaction": avg_transaction,
        "large_transactions": large_transactions,
    }


@router.get("/merchants")
async def get_merchants(
    sessionId: str = Query(...),
    n: int = Query(default=20, ge=1, le=500),
):
    """Return top-n merchants by total spend. Also returns the full distinct
    merchant count so the UI can tell users that this is a truncated list."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = _spending_only(df).copy()

    if expenses.empty:
        return {"merchants": [], "total_merchants": 0, "shown": 0}

    merchant_agg = (
        expenses
        .groupby('תיאור')
        .agg(
            total=('סכום_מוחלט', 'sum'),
            count=('סכום_מוחלט', 'size'),
            average=('סכום_מוחלט', 'mean'),
        )
        .sort_values('total', ascending=False)
    )
    total_merchants = int(len(merchant_agg))
    top = merchant_agg.head(n)

    merchants = [
        {
            "name": str(name),
            "total": _round_money(row['total']),
            "count": int(row['count']),
            "average": _round_money(row['average']),
        }
        for name, row in top.iterrows()
    ]
    return {
        "merchants": merchants,
        "total_merchants": total_merchants,
        "shown": len(merchants),
    }


@router.get("/trend-stats")
async def get_trend_stats(sessionId: str = Query(...)):
    """Return trend statistics and month-over-month changes."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = _spending_only(df).copy()

    if expenses.empty:
        return {
            "max_expense": 0,
            "daily_avg": 0,
            "median": 0,
            "transaction_count": 0,
            "monthly": [],
        }

    max_expense = round(_sanitize(expenses['סכום_מוחלט'].max()), 2)
    median = round(_sanitize(expenses['סכום_מוחלט'].median()), 2)
    transaction_count = int(len(expenses))

    # Daily average: total spend / number of unique days with transactions
    unique_days = expenses['תאריך'].dt.date.nunique()
    daily_avg = round(_sanitize(expenses['סכום_מוחלט'].sum() / max(unique_days, 1)), 2)

    # Monthly totals with month-over-month change (sorted chronologically)
    expenses['month_period'] = expenses['תאריך'].dt.to_period('M')
    monthly_totals = (
        expenses
        .groupby('month_period')['סכום_מוחלט']
        .sum()
        .sort_index()
    )

    monthly_list = []
    prev_amount = None
    for month_period, amount in monthly_totals.items():
        amt = round(_sanitize(amount), 2)
        change_pct = None
        if prev_amount is not None and prev_amount != 0:
            change_pct = round(((amt - prev_amount) / prev_amount) * 100, 2)
        monthly_list.append({
            "month": month_period.strftime('%m/%Y'),
            "amount": amt,
            "change_pct": _sanitize(change_pct),
        })
        prev_amount = amt

    return {
        "max_expense": max_expense,
        "daily_avg": daily_avg,
        "median": median,
        "transaction_count": transaction_count,
        "monthly": monthly_list,
    }


@router.get("/charts/v2/heatmap")
async def get_heatmap_v2(sessionId: str = Query(...)):
    """Return category x month matrix for heatmap visualization."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"categories": [], "months": [], "data": []}

    expenses['month_period'] = expenses['תאריך'].dt.to_period('M')
    pivot = pd.pivot_table(
        expenses,
        values='סכום_מוחלט',
        index='קטגוריה',
        columns='month_period',
        aggfunc='sum',
        fill_value=0,
    )

    categories = [str(c) for c in pivot.index.tolist()]
    months = [period.strftime('%m/%Y') for period in pivot.columns.tolist()]
    data = [
        [round(_sanitize(val), 2) for val in row]
        for row in pivot.values.tolist()
    ]

    return {"categories": categories, "months": months, "data": data}


@router.get("/charts/v2/month-overview")
async def get_month_overview(
    sessionId: str = Query(...),
    month: str = Query(...),
    date_type: str = Query("transaction"),
):
    """Return income vs expenses breakdown by category for a specific month (MM/YYYY)."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId].copy()
    empty = {
        "month": month,
        "categories": [],
        "total_expenses": 0,
        "total_income": 0,
        "transaction_count": 0,
        "expense_count": 0,
        "income_count": 0,
    }
    if df.empty:
        return empty

    # Choose date column
    date_col = 'תאריך_חיוב' if (date_type == 'billing' and 'תאריך_חיוב' in df.columns) else 'תאריך'
    df['_month'] = df[date_col].dt.strftime('%m/%Y')
    month_df = df[df['_month'] == month].copy()

    if month_df.empty:
        return empty

    # Same definitions as /api/metrics so KPIs and counts reconcile across
    # pages: spending = expenses excluding transfers; income = real income only.
    spending = _spending_only(month_df)
    real_income = _real_income_only(month_df)
    # Per-category aggregates: use ALL expenses (incl. transfers) and ALL
    # positive amounts so the breakdown can still surface them as their own
    # categories — but the headline totals/counts reflect spending-only and
    # real-income-only.
    expenses = month_df[month_df['סכום'] < 0]
    income_all = month_df[month_df['סכום'] > 0]

    exp_by_cat = expenses.groupby('קטגוריה')['סכום_מוחלט'].sum()
    inc_by_cat = income_all.groupby('קטגוריה')['סכום'].sum()

    all_cats = set(exp_by_cat.index) | set(inc_by_cat.index)
    categories = []
    for cat in sorted(all_cats):
        exp_val = float(exp_by_cat.get(cat, 0))
        inc_val = float(inc_by_cat.get(cat, 0))
        categories.append({
            "name": str(cat),
            "expenses": _round_money(exp_val),
            "income": _round_money(inc_val),
        })

    # Sort by expenses descending
    categories.sort(key=lambda x: x["expenses"], reverse=True)

    expense_count = int(len(spending))
    income_count = int(len(real_income))

    return {
        "month": month,
        "categories": categories,
        "total_expenses": _round_money(float(spending['סכום_מוחלט'].sum())) if not spending.empty else 0,
        "total_income": _round_money(float(real_income['סכום'].sum())) if not real_income.empty else 0,
        # transaction_count is the headline "X עסקאות" badge on the month-
        # overview card. To match the category-snapshot endpoint (which counts
        # spending only), we use expense_count here.
        "transaction_count": expense_count,
        "expense_count": expense_count,
        "income_count": income_count,
    }


@router.get("/charts/v2/industry-monthly")
async def get_industry_monthly(
    sessionId: str = Query(...),
    date_type: str = Query("transaction"),
    top_n: int = Query(default=8, ge=1, le=20),
):
    """Return expenses per category per month for stacked bar chart comparison."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"months": [], "series": []}

    # Choose date column
    date_col = 'תאריך_חיוב' if (date_type == 'billing' and 'תאריך_חיוב' in expenses.columns) else 'תאריך'
    expenses['_month_period'] = expenses[date_col].dt.to_period('M')
    expenses = expenses.dropna(subset=['_month_period'])

    # Get top N categories by total spend, group the rest into "אחר"
    cat_totals = expenses.groupby('קטגוריה')['סכום_מוחלט'].sum().sort_values(ascending=False)
    top_cats = [str(c) for c in cat_totals.head(top_n).index]
    other_cats = [str(c) for c in cat_totals.iloc[top_n:].index] if len(cat_totals) > top_n else []

    # Build pivot: rows=months, cols=categories
    pivot = pd.pivot_table(
        expenses,
        values='סכום_מוחלט',
        index='_month_period',
        columns='קטגוריה',
        aggfunc='sum',
        fill_value=0,
    )
    pivot = pivot.sort_index()

    months = [period.strftime('%m/%Y') for period in pivot.index]

    series = []
    for cat in top_cats:
        if cat in pivot.columns:
            data = [round(_sanitize(float(v)), 2) for v in pivot[cat].values]
        else:
            data = [0.0] * len(months)
        series.append({"name": cat, "data": data})

    # Add "אחר" series for remaining categories so chart totals are complete
    if other_cats:
        other_data = [0.0] * len(months)
        for cat in other_cats:
            if cat in pivot.columns:
                for i, v in enumerate(pivot[cat].values):
                    other_data[i] += float(v)
        series.append({"name": "אחר", "data": [round(_sanitize(v), 2) for v in other_data]})

    return {"months": months, "series": series}


# ---------------------------------------------------------------------------
# Analytics endpoints
# ---------------------------------------------------------------------------

@router.get("/analytics/recurring")
async def get_recurring_transactions(sessionId: str = Query(...)):
    """Detect recurring/subscription transactions."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if df.empty:
        return {"recurring": []}

    expenses = df[df["סכום"] < 0].copy()
    if expenses.empty:
        return {"recurring": []}

    recurring = []

    # Group by description (merchant)
    for desc, group in expenses.groupby("תיאור"):
        if len(group) < 3:
            continue

        amounts = group["סכום"].abs()
        mean_amount = amounts.mean()
        std_amount = amounts.std()

        # Check amount consistency: std < 20% of mean
        if mean_amount > 0 and (std_amount / mean_amount) > 0.2:
            continue

        # Check date regularity
        dates = pd.to_datetime(group["תאריך"], dayfirst=True, errors="coerce").dropna().sort_values()
        if len(dates) < 3:
            continue

        deltas = dates.diff().dropna().dt.days
        if deltas.empty:
            continue

        mean_delta = deltas.mean()
        std_delta = deltas.std()

        # Classify frequency. If we can't bucket it confidently, skip the row
        # entirely — emitting "frequency: unknown" on a 'recurring' list is
        # contradictory.
        frequency = None
        if 5 <= mean_delta <= 10:
            frequency = "שבועי"
        elif 12 <= mean_delta <= 18:
            frequency = "דו-שבועי"
        elif 25 <= mean_delta <= 35:
            frequency = "חודשי"
        elif 55 <= mean_delta <= 70:
            frequency = "דו-חודשי"
        elif 80 <= mean_delta <= 100:
            frequency = "רבעוני"
        if frequency is None:
            continue

        # Estimate next expected date
        last_date = dates.iloc[-1]
        next_expected = (last_date + pd.Timedelta(days=int(mean_delta))).strftime("%Y-%m-%d")

        recurring.append({
            "merchant": str(desc),
            "average_amount": _round_money(mean_amount),
            "frequency": frequency,
            "count": int(len(group)),
            "next_expected": next_expected,
            "total": _round_money(amounts.sum()),
            "interval_days": _sanitize(round(mean_delta, 1)),
        })

    # Sort by total descending
    recurring.sort(key=lambda x: x["total"], reverse=True)

    return {"recurring": recurring[:20]}


@router.get("/analytics/forecast")
async def get_spending_forecast(sessionId: str = Query(...)):
    """Linear forecast of next month's spending."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    empty_result = {"forecast_amount": 0, "confidence": "low", "trend_direction": "stable", "monthly_data": [], "avg_monthly": 0}
    if df.empty:
        return empty_result

    # Spending only (excludes transfers/investments). Forecast is about
    # consumption, not money moved between accounts.
    expenses = _spending_only(df).copy()
    if expenses.empty:
        return empty_result

    expenses["date"] = pd.to_datetime(expenses["תאריך"], dayfirst=True, errors="coerce")
    expenses = expenses.dropna(subset=["date"])
    expenses["month_key"] = expenses["date"].dt.to_period("M")

    monthly_all = expenses.groupby("month_key")["סכום"].sum().abs().reset_index()
    monthly_all.columns = ["month", "amount"]
    monthly_all = monthly_all.sort_values("month").reset_index(drop=True)

    monthly_data = [
        {"month": str(row["month"]), "amount": _sanitize(round(row["amount"], 2))}
        for _, row in monthly_all.iterrows()
    ]

    # Drop the current (possibly incomplete) month from the baseline so a
    # mid-month query doesn't see a half-month total and predict a sharp drop.
    # Detect by comparing the last month to the latest date in the dataset: if
    # the latest date is strictly before the last day of that month, it's
    # incomplete.
    monthly = monthly_all.copy()
    if not monthly.empty:
        last_period = monthly.iloc[-1]["month"]
        if isinstance(last_period, pd.Period):
            month_end = last_period.to_timestamp(how="end").normalize()
            latest_date = expenses["date"].max().normalize()
            if latest_date < month_end:
                monthly = monthly.iloc[:-1].reset_index(drop=True)

    if monthly.empty:
        # Only an incomplete current month exists — can't forecast.
        return {
            "forecast_amount": 0,
            "confidence": "low",
            "trend_direction": "stable",
            "monthly_data": monthly_data,
            "avg_monthly": 0,
        }

    avg_monthly = _sanitize(round(monthly["amount"].mean(), 2))

    if len(monthly) < 2:
        # Single complete month: forecast = that month's spending, no trend.
        return {
            "forecast_amount": avg_monthly,
            "confidence": "low",
            "trend_direction": "stable",
            "monthly_data": monthly_data,
            "avg_monthly": avg_monthly,
        }

    # Linear regression over the last up-to-12 complete months
    recent = monthly.tail(12).reset_index(drop=True)
    x = np.arange(len(recent), dtype=float)
    y = recent["amount"].to_numpy(dtype=float)

    coeffs = np.polyfit(x, y, 1)
    slope, intercept = coeffs
    forecast = float(slope * len(recent) + intercept)
    forecast = max(forecast, 0)  # Can't be negative spending

    # Confidence based on R² and data points
    y_pred = np.polyval(coeffs, x)
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

    confidence = "low"
    if len(recent) >= 6 and r_squared > 0.7:
        confidence = "high"
    elif len(recent) >= 3 and r_squared > 0.4:
        confidence = "medium"

    trend_direction = "up" if slope > 50 else ("down" if slope < -50 else "stable")

    return {
        "forecast_amount": _sanitize(round(forecast, 2)),
        "confidence": confidence,
        "trend_direction": trend_direction,
        "monthly_data": monthly_data,
        "avg_monthly": avg_monthly,
    }


@router.get("/analytics/weekly-summary")
async def get_weekly_summary(
    sessionId: str = Query(...),
    month_from: Optional[str] = Query(default=None),
    month_to: Optional[str] = Query(default=None),
    date_type: str = Query(default="transaction"),
):
    """This week vs last week comparison, scoped to the selected month range."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    empty = {
        "this_week": {"total": 0, "count": 0, "top_category": ""},
        "last_week": {"total": 0, "count": 0, "top_category": ""},
        "change_pct": 0,
    }
    df = sessions[sessionId]
    if df.empty:
        return empty

    month_from = _validated_month_or_none(month_from, "month_from")
    month_to = _validated_month_or_none(month_to, "month_to")

    # Spending only (exclude transfers/investments)
    df_scoped = _spending_only(df)
    df_scoped = _apply_month_range(df_scoped, month_from, month_to, date_type)
    if df_scoped.empty:
        return empty

    df_copy = df_scoped.copy()
    df_copy["date"] = pd.to_datetime(df_copy["תאריך"], dayfirst=True, errors="coerce")
    df_copy = df_copy.dropna(subset=["date"])
    if df_copy.empty:
        return empty

    # Reference "today" is the last date within scope, so the cards align with
    # the month the user is viewing instead of the whole dataset.
    max_date = df_copy["date"].max()

    this_week_start = max_date - pd.Timedelta(days=6)
    last_week_start = this_week_start - pd.Timedelta(days=7)
    last_week_end = this_week_start - pd.Timedelta(days=1)

    this_week = df_copy[(df_copy["date"] >= this_week_start) & (df_copy["date"] <= max_date)]
    last_week = df_copy[(df_copy["date"] >= last_week_start) & (df_copy["date"] <= last_week_end)]

    def week_summary(week_df: pd.DataFrame) -> dict:
        if week_df.empty:
            return {"total": 0, "count": 0, "top_category": ""}
        total = abs(week_df["סכום"].sum())
        count = len(week_df)
        top_cat = ""
        if "קטגוריה" in week_df.columns:
            cats = week_df.groupby("קטגוריה")["סכום"].sum().abs()
            if not cats.empty:
                top_cat = str(cats.idxmax())
        return {
            "total": _sanitize(round(total, 2)),
            "count": int(count),
            "top_category": top_cat,
        }

    tw = week_summary(this_week)
    lw = week_summary(last_week)

    change_pct = 0
    if lw["total"] > 0:
        change_pct = round(((tw["total"] - lw["total"]) / lw["total"]) * 100, 1)

    return {
        "this_week": tw,
        "last_week": lw,
        "change_pct": _sanitize(change_pct),
    }


@router.get("/analytics/spending-velocity")
async def get_spending_velocity(sessionId: str = Query(...)):
    """Daily spending rate and rolling averages."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if df.empty:
        return {"daily_avg": 0, "rolling_7day": 0, "rolling_30day": 0, "daily_data": []}

    expenses = df[df["סכום"] < 0].copy()
    if expenses.empty:
        return {"daily_avg": 0, "rolling_7day": 0, "rolling_30day": 0, "daily_data": []}

    expenses["date"] = pd.to_datetime(expenses["תאריך"], dayfirst=True, errors="coerce")
    expenses = expenses.dropna(subset=["date"])

    daily = expenses.groupby(expenses["date"].dt.date)["סכום"].sum().abs()
    daily = daily.sort_index()

    if daily.empty:
        return {"daily_avg": 0, "rolling_7day": 0, "rolling_30day": 0, "daily_data": []}

    daily_avg = daily.mean()
    rolling_7 = daily.tail(7).mean() if len(daily) >= 7 else daily.mean()
    rolling_30 = daily.tail(30).mean() if len(daily) >= 30 else daily.mean()

    # Return last 30 daily data points for sparkline
    daily_data = [
        {"date": str(date), "amount": _sanitize(round(float(amt), 2))}
        for date, amt in daily.tail(30).items()
    ]

    return {
        "daily_avg": _sanitize(round(float(daily_avg), 2)),
        "rolling_7day": _sanitize(round(float(rolling_7), 2)),
        "rolling_30day": _sanitize(round(float(rolling_30), 2)),
        "daily_data": daily_data,
    }


@router.get("/analytics/anomalies")
async def get_anomalies(sessionId: str = Query(...)):
    """Find transactions beyond 2 standard deviations from category mean."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if df.empty:
        return {"anomalies": []}

    # Anomalies are about spending. Use _spending_only so transfers and
    # investment moves don't get flagged as "anomalous expenses".
    expenses = _spending_only(df).copy()
    if expenses.empty or "קטגוריה" not in expenses.columns:
        return {"anomalies": []}

    anomalies = []

    for cat, group in expenses.groupby("קטגוריה"):
        # Need a meaningful sample to derive a mean; otherwise the mean and
        # σ are noise and we'll produce false positives.
        if len(group) < 8:
            continue

        amounts = group["סכום"].abs()
        # Exclude the outlier itself from the baseline (winsorize-like): use
        # the median + MAD instead of mean ± σ, so a single huge transaction
        # doesn't inflate σ and prevent itself from being flagged.
        median_amt = float(amounts.median())
        mad = float((amounts - median_amt).abs().median())
        if mad == 0:
            continue
        # MAD-based z-score equivalent: 1.4826 * MAD ≈ σ for normal data
        sigma_est = 1.4826 * mad

        # Skip pathologically noisy categories (CV-like guard).
        if median_amt > 0 and sigma_est / median_amt > 2.0:
            continue

        for _, row in group.iterrows():
            amt = abs(float(row["סכום"]))
            deviation = (amt - median_amt) / sigma_est

            if deviation > 3:
                anomalies.append({
                    "description": str(row.get("תיאור", "")),
                    "amount": _round_money(amt),
                    "category": str(cat),
                    "date": str(row.get("תאריך", "")),
                    "deviation": _sanitize(round(deviation, 2)),
                    "category_mean": _round_money(median_amt),
                    "category_std": _round_money(sigma_est),
                })

    # Sort by deviation descending, limit to 15
    anomalies.sort(key=lambda x: x["deviation"], reverse=True)

    return {"anomalies": anomalies[:15]}


@router.get("/search")
async def search_transactions(
    sessionId: str = Query(...),
    q: str = Query(..., min_length=1),
    limit: int = Query(default=20, le=50),
):
    """Full-text search across transaction descriptions and categories."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if df.empty:
        return {"results": [], "total": 0}

    q_lower = q.lower()

    mask = df["תיאור"].astype(str).str.lower().str.contains(q_lower, na=False)

    if "קטגוריה" in df.columns:
        mask = mask | df["קטגוריה"].astype(str).str.lower().str.contains(q_lower, na=False)

    results_df = df[mask].head(limit)

    results = []
    for _, row in results_df.iterrows():
        results.append({
            "תאריך": str(row.get("תאריך", "")),
            "תיאור": str(row.get("תיאור", "")),
            "סכום": _sanitize(round(float(row.get("סכום", 0)), 2)),
            "קטגוריה": str(row.get("קטגוריה", "")) if "קטגוריה" in row.index else "",
        })

    return {"results": results, "total": int(mask.sum())}
