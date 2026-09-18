import pandas as pd
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api import routes


@pytest.mark.asyncio
async def test_transactions_can_filter_by_subcategory():
    session_id = "subcategory-filter-test"
    routes.sessions[session_id] = pd.DataFrame([
        {"id": 1, "תאריך": pd.Timestamp("2026-08-01"), "תיאור": "מכולת", "קטגוריה": "מזון", "קטגוריה_משנה": "סופר קטן", "סכום": -40.0, "סכום_מוחלט": 40.0},
        {"id": 2, "תאריך": pd.Timestamp("2026-08-02"), "תיאור": "רשת", "קטגוריה": "מזון", "קטגוריה_משנה": "סופר גדול", "סכום": -200.0, "סכום_מוחלט": 200.0},
    ])
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/transactions", params={"sessionId": session_id, "category": "מזון", "subcategory": "סופר קטן"})
        assert response.status_code == 200
        payload = response.json()
        assert payload["total"] == 1
        assert payload["transactions"][0]["קטגוריה_משנה"] == "סופר קטן"
    finally:
        routes.sessions.pop(session_id, None)
