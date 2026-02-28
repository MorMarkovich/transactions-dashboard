"""
API routes for transactions dashboard
"""
import uuid
import os
import math
from typing import Optional, Any
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
import json as _json
import datetime as _dt
from pydantic import BaseModel, field_validator
from fastapi.responses import FileResponse, StreamingResponse
import pandas as pd
import numpy as np
from io import BytesIO

from ..services.data_loader import load_transaction_file
from ..services.data_processor import process_data, clean_dataframe
from ..services.chart_generator import (
    create_donut_chart,
    create_monthly_bars,
    create_weekday_chart,
    create_trend_chart
)
from ..services.export_service import export_to_excel
from ..utils.validators import detect_amount_column, find_column

router = APIRouter()

@router.get("/test")
async def test():
    return {"status": "ok"}

# In-memory storage for sessions (in production, use Redis or database)
sessions: dict[str, pd.DataFrame] = {}

# Directory for uploaded files
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload and process transaction file"""
    file_path = None
    try:
        # Save file temporarily
        file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Load and process file (ensure file is closed before processing)
        df_raw = load_transaction_file(file_path)
        df_clean = clean_dataframe(df_raw)
        
        # Detect columns
        date_col = find_column(df_clean, ['תאריך עסקה', 'תאריך', 'date', 'Date'])
        amount_col = detect_amount_column(df_clean)
        desc_col = find_column(df_clean, ['שם בית העסק', 'שם בית עסק', 'תיאור', 'תיאור התנועה', 'description', 'merchant'])
        cat_col = find_column(df_clean, ['קטגוריה', 'category', 'Category'])
        billing_date_col = find_column(df_clean, ['תאריך חיוב', 'תאריך_חיוב', 'Billing Date', 'billing date', 'תאריך חיוב:'])

        if not date_col or not amount_col or not desc_col:
            # Clean up before raising error
            if file_path and os.path.exists(file_path):
                try:
                    import time
                    time.sleep(0.1)  # Small delay to ensure file is closed
                    os.remove(file_path)
                except:
                    pass
            raise HTTPException(
                status_code=400,
                detail=f"Required columns not found. Found columns: {list(df_clean.columns)}"
            )

        # Process data
        df = process_data(df_clean, date_col, amount_col, desc_col, cat_col, billing_date_col)
        
        if df.empty:
            # Clean up before raising error
            if file_path and os.path.exists(file_path):
                try:
                    import time
                    time.sleep(0.1)
                    os.remove(file_path)
                except:
                    pass
            raise HTTPException(status_code=400, detail="No valid transactions found")
        
        # Create session
        session_id = str(uuid.uuid4())
        sessions[session_id] = df
        
        # Clean up temp file (with delay to ensure pandas closed it)
        if file_path and os.path.exists(file_path):
            try:
                import time
                time.sleep(0.2)  # Wait for pandas to fully close the file
                os.remove(file_path)
            except PermissionError:
                # If still locked, try again after a longer delay
                import time
                time.sleep(0.5)
                try:
                    os.remove(file_path)
                except:
                    pass  # Ignore if still can't delete
        
        return {
            "success": True,
            "message": f"Loaded {len(df)} transactions",
            "session_id": session_id,
            "transaction_count": len(df)
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        import time
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        if file_path and os.path.exists(file_path):
            try:
                time.sleep(0.2)  # Wait before trying to delete
                os.remove(file_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=error_detail)


class RestoreSessionRequest(BaseModel):
    transactions: list[Any]

    @field_validator('transactions', mode='before')
    @classmethod
    def parse_if_string(cls, v: Any) -> Any:
        if isinstance(v, str):
            return _json.loads(v)
        return v


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

        session_id = str(uuid.uuid4())
        sessions[session_id] = df

        return {
            "success": True,
            "session_id": session_id,
            "transaction_count": len(df),
            "message": f"Restored {len(df)} transactions",
        }
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"{str(e)}\n{traceback.format_exc()}")


@router.get("/transactions")
async def get_transactions(
    sessionId: str = Query(...),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
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
    
    # Sort
    if sort_by:
        ascending = sort_order == "asc"
        df = df.sort_values(by=sort_by, ascending=ascending)
    else:
        df = df.sort_values(by='תאריך', ascending=False)
    
    # Aggregate stats (computed on the full filtered dataset, before pagination)
    total = len(df)
    total_amount = round(_sanitize(float(df['סכום_מוחלט'].sum())), 2) if 'סכום_מוחלט' in df.columns and total > 0 else 0
    expense_count = int((df['סכום'] < 0).sum()) if 'סכום' in df.columns else 0
    income_count = total - expense_count
    avg_transaction = round(_sanitize(total_amount / total), 2) if total > 0 else 0

    # Pagination
    start = (page - 1) * page_size
    end = start + page_size
    df_page = df.iloc[start:end]

    # Convert to dict with full JSON safety (NaT, Timestamp, numpy scalars, NaN/Inf)
    transactions = [
        {k: _to_json_safe(v) for k, v in record.items()}
        for record in df_page.to_dict('records')
    ]

    return {
        "transactions": transactions,
        "total": total,
        "total_amount": total_amount,
        "avg_transaction": avg_transaction,
        "expense_count": expense_count,
        "income_count": income_count,
        "page": page,
        "page_size": page_size
    }


@router.get("/metrics")
async def get_metrics(sessionId: str = Query(...)):
    """Get metrics data"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]

    expenses = df[df['סכום'] < 0]
    income = df[df['סכום'] > 0]

    total_transactions = len(expenses)
    total_expenses = abs(expenses['סכום'].sum()) if len(expenses) > 0 else 0
    total_income = income['סכום'].sum() if len(income) > 0 else 0
    average_transaction = expenses['סכום_מוחלט'].mean() if not expenses.empty else 0

    # Calculate trend (based on expenses only)
    trend = None
    if len(expenses) > 10:
        mid = len(expenses) // 2
        first_half_avg = expenses.iloc[:mid]['סכום_מוחלט'].mean()
        second_half_avg = expenses.iloc[mid:]['סכום_מוחלט'].mean()
        if first_half_avg > 0:
            trend_pct = ((second_half_avg - first_half_avg) / first_half_avg) * 100
            trend = 'up' if trend_pct > 0 else 'down'

    has_billing_date = 'תאריך_חיוב' in df.columns and df['תאריך_חיוב'].notna().any()

    return {
        "total_transactions": total_transactions,
        "total_expenses": total_expenses,
        "total_income": total_income,
        "average_transaction": average_transaction,
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
):
    """Return ALL categories with enriched analytical data. Optional month range filter (MM/YYYY)."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    # Optional month range filtering
    if (month_from or month_to) and not expenses.empty:
        def _month_key(m: str) -> tuple:
            parts = m.split('/')
            return (int(parts[1]), int(parts[0]))
        if month_from:
            from_key = _month_key(month_from)
            expenses = expenses[expenses['חודש'].apply(lambda m: _month_key(m) >= from_key)]
        if month_to:
            to_key = _month_key(month_to)
            expenses = expenses[expenses['חודש'].apply(lambda m: _month_key(m) <= to_key)]

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
        expenses['חודש'].unique(),
        key=lambda m: (int(m.split('/')[1]), int(m.split('/')[0])),
    )
    month_count = len(all_months)

    cat_month = (
        expenses
        .groupby(['קטגוריה', 'חודש'])
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
        lm = cat_month[cat_month['חודש'] == last_month].set_index('קטגוריה')
        last_month_totals = lm['month_total'].to_dict()
    if prev_month:
        pm = cat_month[cat_month['חודש'] == prev_month].set_index('קטגוריה')
        prev_month_totals = pm['month_total'].to_dict()

    # -- Months active per category --
    months_active = cat_month.groupby('קטגוריה')['חודש'].nunique().to_dict()

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
        cat_monthly_data = cat_month[cat_month['קטגוריה'] == cat_name].set_index('חודש')
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
        filtered = filtered.copy()
        filtered['_month'] = filtered[date_col].dt.strftime('%m/%Y')
        # Parse MM/YYYY into sortable YYYY-MM for comparison
        def month_sort_key(m: str) -> str:
            parts = m.split('/')
            return f"{parts[1]}-{parts[0]}" if len(parts) == 2 else m
        if month_from:
            from_key = month_sort_key(month_from)
            filtered = filtered[filtered['_month'].apply(month_sort_key) >= from_key]
        if month_to:
            to_key = month_sort_key(month_to)
            filtered = filtered[filtered['_month'].apply(month_sort_key) <= to_key]

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
async def get_insights(sessionId: str = Query(...)):
    """Return smart insights derived from transaction data."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {
            "biggest_expense": None,
            "top_merchant": None,
            "expensive_day": None,
            "avg_transaction": 0,
            "large_transactions": [],
        }

    # Biggest single expense
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
    n: int = Query(default=8, ge=1),
):
    """Return top merchants by total spend."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"merchants": []}

    merchant_agg = (
        expenses
        .groupby('תיאור')
        .agg(
            total=('סכום_מוחלט', 'sum'),
            count=('סכום_מוחלט', 'size'),
            average=('סכום_מוחלט', 'mean'),
        )
        .sort_values('total', ascending=False)
        .head(n)
    )

    merchants = [
        {
            "name": str(name),
            "total": round(_sanitize(row['total']), 2),
            "count": int(row['count']),
            "average": round(_sanitize(row['average']), 2),
        }
        for name, row in merchant_agg.iterrows()
    ]
    return {"merchants": merchants}


@router.get("/trend-stats")
async def get_trend_stats(sessionId: str = Query(...)):
    """Return trend statistics and month-over-month changes."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

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
    if df.empty:
        return {"month": month, "categories": [], "total_expenses": 0, "total_income": 0, "transaction_count": 0}

    # Choose date column
    date_col = 'תאריך_חיוב' if (date_type == 'billing' and 'תאריך_חיוב' in df.columns) else 'תאריך'
    df['_month'] = df[date_col].dt.strftime('%m/%Y')
    month_df = df[df['_month'] == month].copy()

    if month_df.empty:
        return {"month": month, "categories": [], "total_expenses": 0, "total_income": 0, "transaction_count": 0}

    expenses = month_df[month_df['סכום'] < 0]
    income = month_df[month_df['סכום'] > 0]

    exp_by_cat = expenses.groupby('קטגוריה')['סכום_מוחלט'].sum()
    inc_by_cat = income.groupby('קטגוריה')['סכום'].sum()

    all_cats = set(exp_by_cat.index) | set(inc_by_cat.index)
    categories = []
    for cat in sorted(all_cats):
        exp_val = float(exp_by_cat.get(cat, 0))
        inc_val = float(inc_by_cat.get(cat, 0))
        categories.append({
            "name": str(cat),
            "expenses": round(_sanitize(exp_val), 2),
            "income": round(_sanitize(inc_val), 2),
        })

    # Sort by expenses descending
    categories.sort(key=lambda x: x["expenses"], reverse=True)

    total_expenses = round(_sanitize(float(expenses['סכום_מוחלט'].sum())), 2) if not expenses.empty else 0
    total_income = round(_sanitize(float(income['סכום'].sum())), 2) if not income.empty else 0

    return {
        "month": month,
        "categories": categories,
        "total_expenses": total_expenses,
        "total_income": total_income,
        "transaction_count": int(len(month_df)),
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

        # Classify frequency
        frequency = "לא ידוע"
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
        else:
            # Skip if interval is too irregular (std > 7 days)
            if std_delta > 7:
                continue

        # Estimate next expected date
        last_date = dates.iloc[-1]
        next_expected = (last_date + pd.Timedelta(days=int(mean_delta))).strftime("%Y-%m-%d")

        recurring.append({
            "merchant": str(desc),
            "average_amount": _sanitize(round(mean_amount, 2)),
            "frequency": frequency,
            "count": int(len(group)),
            "next_expected": next_expected,
            "total": _sanitize(round(amounts.sum(), 2)),
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
    if df.empty:
        return {"forecast_amount": 0, "confidence": "low", "trend_direction": "stable", "monthly_data": [], "avg_monthly": 0}

    expenses = df[df["סכום"] < 0].copy()
    if expenses.empty:
        return {"forecast_amount": 0, "confidence": "low", "trend_direction": "stable", "monthly_data": [], "avg_monthly": 0}

    expenses["date"] = pd.to_datetime(expenses["תאריך"], dayfirst=True, errors="coerce")
    expenses = expenses.dropna(subset=["date"])
    expenses["month_key"] = expenses["date"].dt.to_period("M")

    monthly = expenses.groupby("month_key")["סכום"].sum().abs().reset_index()
    monthly.columns = ["month", "amount"]
    monthly = monthly.sort_values("month")

    monthly_data = [
        {"month": str(row["month"]), "amount": _sanitize(round(row["amount"], 2))}
        for _, row in monthly.iterrows()
    ]

    avg_monthly = _sanitize(round(monthly["amount"].mean(), 2))

    if len(monthly) < 2:
        return {
            "forecast_amount": avg_monthly,
            "confidence": "low",
            "trend_direction": "stable",
            "monthly_data": monthly_data,
            "avg_monthly": avg_monthly,
        }

    # Linear regression
    x = np.arange(len(monthly), dtype=float)
    y = monthly["amount"].values.astype(float)

    coeffs = np.polyfit(x, y, 1)
    slope, intercept = coeffs
    forecast = float(slope * len(monthly) + intercept)
    forecast = max(forecast, 0)  # Can't be negative spending

    # Confidence based on R² and data points
    y_pred = np.polyval(coeffs, x)
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

    confidence = "low"
    if len(monthly) >= 6 and r_squared > 0.7:
        confidence = "high"
    elif len(monthly) >= 3 and r_squared > 0.4:
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
async def get_weekly_summary(sessionId: str = Query(...)):
    """This week vs last week comparison."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if df.empty:
        return {
            "this_week": {"total": 0, "count": 0, "top_category": ""},
            "last_week": {"total": 0, "count": 0, "top_category": ""},
            "change_pct": 0,
        }

    df_copy = df.copy()
    df_copy["date"] = pd.to_datetime(df_copy["תאריך"], dayfirst=True, errors="coerce")
    df_copy = df_copy.dropna(subset=["date"])

    if df_copy.empty:
        return {
            "this_week": {"total": 0, "count": 0, "top_category": ""},
            "last_week": {"total": 0, "count": 0, "top_category": ""},
            "change_pct": 0,
        }

    # Use the last date in data as "today" reference
    max_date = df_copy["date"].max()

    # This week: last 7 days from max_date
    this_week_start = max_date - pd.Timedelta(days=6)
    last_week_start = this_week_start - pd.Timedelta(days=7)
    last_week_end = this_week_start - pd.Timedelta(days=1)

    this_week = df_copy[(df_copy["date"] >= this_week_start) & (df_copy["date"] <= max_date) & (df_copy["סכום"] < 0)]
    last_week = df_copy[(df_copy["date"] >= last_week_start) & (df_copy["date"] <= last_week_end) & (df_copy["סכום"] < 0)]

    def week_summary(week_df):
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

    expenses = df[df["סכום"] < 0].copy()
    if expenses.empty or "קטגוריה" not in expenses.columns:
        return {"anomalies": []}

    anomalies = []

    for cat, group in expenses.groupby("קטגוריה"):
        if len(group) < 5:
            continue

        amounts = group["סכום"].abs()
        mean_amt = amounts.mean()
        std_amt = amounts.std()

        if std_amt == 0:
            continue

        for _, row in group.iterrows():
            amt = abs(row["סכום"])
            deviation = (amt - mean_amt) / std_amt

            if deviation > 2:
                anomalies.append({
                    "description": str(row.get("תיאור", "")),
                    "amount": _sanitize(round(amt, 2)),
                    "category": str(cat),
                    "date": str(row.get("תאריך", "")),
                    "deviation": _sanitize(round(deviation, 2)),
                    "category_mean": _sanitize(round(mean_amt, 2)),
                    "category_std": _sanitize(round(std_amt, 2)),
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
