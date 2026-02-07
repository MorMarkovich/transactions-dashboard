"""
API routes for transactions dashboard
"""
import uuid
import os
import math
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
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
        desc_col = find_column(df_clean, ['שם בית העסק', 'תיאור', 'description', 'merchant'])
        cat_col = find_column(df_clean, ['קטגוריה', 'category', 'Category'])
        
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
        df = process_data(df_clean, date_col, amount_col, desc_col, cat_col)
        
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
    
    # Pagination
    total = len(df)
    start = (page - 1) * page_size
    end = start + page_size
    df_page = df.iloc[start:end]
    
    # Convert to dict
    transactions = df_page.to_dict('records')
    
    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/metrics")
async def get_metrics(sessionId: str = Query(...)):
    """Get metrics data"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]
    
    total_transactions = len(df)
    expenses = df[df['סכום'] < 0]
    income = df[df['סכום'] > 0]
    
    total_expenses = abs(expenses['סכום'].sum()) if len(expenses) > 0 else 0
    total_income = income['סכום'].sum() if len(income) > 0 else 0
    average_transaction = df['סכום_מוחלט'].mean() if not df.empty else 0
    
    # Calculate trend
    trend = None
    if len(df) > 10:
        mid = len(df) // 2
        first_half_avg = df.iloc[:mid]['סכום_מוחלט'].mean()
        second_half_avg = df.iloc[mid:]['סכום_מוחלט'].mean()
        if first_half_avg > 0:
            trend_pct = ((second_half_avg - first_half_avg) / first_half_avg) * 100
            trend = 'up' if trend_pct > 0 else 'down'
    
    return {
        "total_transactions": total_transactions,
        "total_expenses": total_expenses,
        "total_income": total_income,
        "average_transaction": average_transaction,
        "trend": trend
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


@router.get("/charts/v2/donut")
async def get_donut_v2(sessionId: str = Query(...)):
    """Return raw category breakdown (top 6 + 'אחר')."""
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

    top6 = cat_totals.head(6)
    other = cat_totals.iloc[6:].sum() if len(cat_totals) > 6 else 0

    categories = [
        {"name": str(name), "value": round(_sanitize(val), 2)}
        for name, val in top6.items()
    ]
    if other > 0:
        categories.append({"name": "אחר", "value": round(float(other), 2)})

    total = round(_sanitize(cat_totals.sum()), 2)
    return {"categories": categories, "total": total}


@router.get("/charts/v2/monthly")
async def get_monthly_v2(sessionId: str = Query(...)):
    """Return raw monthly expense totals."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"months": []}

    monthly = (
        expenses
        .groupby('חודש')['סכום_מוחלט']
        .sum()
    )

    months = [
        {"month": str(m), "amount": round(_sanitize(v), 2)}
        for m, v in monthly.items()
    ]
    return {"months": months}


@router.get("/charts/v2/weekday")
async def get_weekday_v2(sessionId: str = Query(...)):
    """Return raw weekday expense totals with Hebrew day names."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    day_names = {
        0: 'ראשון',
        1: 'שני',
        2: 'שלישי',
        3: 'רביעי',
        4: 'חמישי',
        5: 'שישי',
        6: 'שבת',
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
        0: 'ראשון', 1: 'שני', 2: 'שלישי', 3: 'רביעי',
        4: 'חמישי', 5: 'שישי', 6: 'שבת',
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
            "description": str(row['תיאור']),
            "amount": round(_sanitize(row['סכום_מוחלט']), 2),
            "date": row['תאריך'].strftime('%Y-%m-%d') if hasattr(row['תאריך'], 'strftime') else str(row['תאריך']),
            "category": str(row['קטגוריה']),
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

    # Monthly totals with month-over-month change
    monthly_totals = (
        expenses
        .groupby('חודש')['סכום_מוחלט']
        .sum()
    )

    monthly_list = []
    prev_amount = None
    for month, amount in monthly_totals.items():
        amt = round(_sanitize(amount), 2)
        change_pct = None
        if prev_amount is not None and prev_amount != 0:
            change_pct = round(((amt - prev_amount) / prev_amount) * 100, 2)
        monthly_list.append({
            "month": str(month),
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

    pivot = pd.pivot_table(
        expenses,
        values='סכום_מוחלט',
        index='קטגוריה',
        columns='חודש',
        aggfunc='sum',
        fill_value=0,
    )

    categories = [str(c) for c in pivot.index.tolist()]
    months = [str(m) for m in pivot.columns.tolist()]
    data = [
        [round(_sanitize(val), 2) for val in row]
        for row in pivot.values.tolist()
    ]

    return {"categories": categories, "months": months, "data": data}
