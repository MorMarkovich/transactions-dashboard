"""
API routes for transactions dashboard
"""
import uuid
import os
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
import pandas as pd
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
