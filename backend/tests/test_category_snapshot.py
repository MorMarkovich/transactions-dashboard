"""
Negative tests for the /api/charts/v2/category-snapshot endpoint.

Tests cover: invalid inputs, empty data, edge cases, boundary conditions,
and malformed parameters.
"""
import pandas as pd
import numpy as np
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.api.routes import sessions


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_expense_df(rows: list[dict]) -> pd.DataFrame:
    """Build a minimal DataFrame that mirrors the real processed data."""
    df = pd.DataFrame(rows)
    if 'סכום' not in df.columns:
        df['סכום'] = -100.0
    if 'סכום_מוחלט' not in df.columns:
        df['סכום_מוחלט'] = df['סכום'].abs()
    if 'קטגוריה' not in df.columns:
        df['קטגוריה'] = 'שונות'
    if 'תיאור' not in df.columns:
        df['תיאור'] = 'test merchant'
    if 'חודש' not in df.columns:
        df['חודש'] = '01/2026'
    if 'תאריך' not in df.columns:
        df['תאריך'] = pd.Timestamp('2026-01-15')
    return df


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture(autouse=True)
def cleanup_sessions():
    """Ensure sessions dict is clean before/after each test."""
    sessions.clear()
    yield
    sessions.clear()


# ---------------------------------------------------------------------------
# 1. Invalid / missing session ID
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_missing_session_id_returns_422(client):
    """No sessionId query param → 422 Unprocessable Entity."""
    resp = await client.get("/api/charts/v2/category-snapshot")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_nonexistent_session_returns_404(client):
    """Random session ID that doesn't exist → 404."""
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "does-not-exist"})
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_empty_string_session_returns_404(client):
    """Empty string session ID → 404 (not in sessions dict)."""
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": ""})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 2. Empty / no-expense datasets
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_empty_dataframe_returns_empty_categories(client):
    """Session exists but DataFrame is completely empty."""
    sessions["empty"] = pd.DataFrame(columns=['סכום', 'סכום_מוחלט', 'קטגוריה', 'תיאור', 'חודש', 'תאריך'])
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "empty"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["categories"] == []
    assert data["total"] == 0
    assert data["total_count"] == 0


@pytest.mark.asyncio
async def test_only_income_returns_empty_categories(client):
    """All transactions are income (positive amounts) — no expenses to show."""
    sessions["income-only"] = _make_expense_df([
        {"סכום": 500.0, "סכום_מוחלט": 500.0, "קטגוריה": "הכנסה", "חודש": "01/2026"},
        {"סכום": 300.0, "סכום_מוחלט": 300.0, "קטגוריה": "הכנסה", "חודש": "01/2026"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "income-only"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["categories"] == []
    assert data["total"] == 0


# ---------------------------------------------------------------------------
# 3. Single-row edge cases
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_single_expense_returns_100_percent(client):
    """One expense → one category at 100%."""
    sessions["single"] = _make_expense_df([
        {"סכום": -250.0, "סכום_מוחלט": 250.0, "קטגוריה": "מסעדות", "חודש": "01/2026"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "single"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["categories"]) == 1
    cat = data["categories"][0]
    assert cat["name"] == "מסעדות"
    assert cat["percent"] == 100.0
    assert cat["count"] == 1
    assert cat["avg_transaction"] == 250.0
    assert cat["month_change"] == 0.0  # only 1 month → no change possible


@pytest.mark.asyncio
async def test_single_category_single_month_sparkline(client):
    """Single month → sparkline should be a single-element list."""
    sessions["one-month"] = _make_expense_df([
        {"סכום": -100, "סכום_מוחלט": 100, "קטגוריה": "מזון", "חודש": "03/2026"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "one-month"})
    data = resp.json()
    assert data["month_count"] == 1
    assert data["categories"][0]["sparkline"] == [100.0]


# ---------------------------------------------------------------------------
# 4. Month range filtering — negative / boundary cases
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_month_range_no_overlap_returns_empty(client):
    """month_from/month_to outside data range → empty results."""
    sessions["ranged"] = _make_expense_df([
        {"סכום": -100, "סכום_מוחלט": 100, "קטגוריה": "מזון", "חודש": "01/2026"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={
        "sessionId": "ranged",
        "month_from": "06/2026",
        "month_to": "12/2026",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["categories"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_inverted_month_range_returns_empty(client):
    """month_from > month_to (inverted range) → no data matches."""
    sessions["inv"] = _make_expense_df([
        {"סכום": -100, "סכום_מוחלט": 100, "קטגוריה": "מזון", "חודש": "06/2025"},
        {"סכום": -200, "סכום_מוחלט": 200, "קטגוריה": "מזון", "חודש": "09/2025"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={
        "sessionId": "inv",
        "month_from": "12/2025",
        "month_to": "01/2025",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["categories"] == []


@pytest.mark.asyncio
async def test_month_from_only_filters_correctly(client):
    """Only month_from set — should include that month and later."""
    sessions["from-only"] = _make_expense_df([
        {"סכום": -100, "סכום_מוחלט": 100, "קטגוריה": "A", "חודש": "09/2025"},
        {"סכום": -200, "סכום_מוחלט": 200, "קטגוריה": "A", "חודש": "11/2025"},
        {"סכום": -300, "סכום_מוחלט": 300, "קטגוריה": "A", "חודש": "01/2026"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={
        "sessionId": "from-only",
        "month_from": "11/2025",
    })
    data = resp.json()
    # Should include 11/2025 and 01/2026 (total 500), not 09/2025
    assert data["total"] == 500.0
    assert data["categories"][0]["count"] == 2


@pytest.mark.asyncio
async def test_month_to_only_filters_correctly(client):
    """Only month_to set — should include that month and earlier."""
    sessions["to-only"] = _make_expense_df([
        {"סכום": -100, "סכום_מוחלט": 100, "קטגוריה": "A", "חודש": "09/2025"},
        {"סכום": -200, "סכום_מוחלט": 200, "קטגוריה": "A", "חודש": "11/2025"},
        {"סכום": -300, "סכום_מוחלט": 300, "קטגוריה": "A", "חודש": "01/2026"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={
        "sessionId": "to-only",
        "month_to": "11/2025",
    })
    data = resp.json()
    # Should include 09/2025 and 11/2025 (total 300), not 01/2026
    assert data["total"] == 300.0


# ---------------------------------------------------------------------------
# 5. Data integrity checks
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_percentages_sum_to_approximately_100(client):
    """All category percentages should sum to ~100%."""
    sessions["pct"] = _make_expense_df([
        {"סכום": -100, "סכום_מוחלט": 100, "קטגוריה": "A", "חודש": "01/2026"},
        {"סכום": -200, "סכום_מוחלט": 200, "קטגוריה": "B", "חודש": "01/2026"},
        {"סכום": -300, "סכום_מוחלט": 300, "קטגוריה": "C", "חודש": "01/2026"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "pct"})
    data = resp.json()
    total_pct = sum(c["percent"] for c in data["categories"])
    assert 99.5 <= total_pct <= 100.5  # allow rounding tolerance


@pytest.mark.asyncio
async def test_category_totals_sum_to_grand_total(client):
    """Sum of category totals must equal the returned grand total."""
    sessions["sum"] = _make_expense_df([
        {"סכום": -150.55, "סכום_מוחלט": 150.55, "קטגוריה": "A", "חודש": "01/2026"},
        {"סכום": -249.45, "סכום_מוחלט": 249.45, "קטגוריה": "B", "חודש": "02/2026"},
        {"סכום": -100.00, "סכום_מוחלט": 100.00, "קטגוריה": "A", "חודש": "02/2026"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "sum"})
    data = resp.json()
    cat_sum = sum(c["total"] for c in data["categories"])
    assert abs(cat_sum - data["total"]) < 0.02


@pytest.mark.asyncio
async def test_avg_transaction_is_total_divided_by_count(client):
    """avg_transaction = total / count for every category."""
    sessions["avg"] = _make_expense_df([
        {"סכום": -100, "סכום_מוחלט": 100, "קטגוריה": "X", "חודש": "01/2026"},
        {"סכום": -300, "סכום_מוחלט": 300, "קטגוריה": "X", "חודש": "01/2026"},
        {"סכום": -50, "סכום_מוחלט": 50, "קטגוריה": "Y", "חודש": "01/2026"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "avg"})
    data = resp.json()
    for cat in data["categories"]:
        expected = round(cat["total"] / cat["count"], 2)
        assert cat["avg_transaction"] == expected, f"{cat['name']}: {cat['avg_transaction']} != {expected}"


@pytest.mark.asyncio
async def test_month_change_with_two_months(client):
    """Verify month-over-month change calculation with known values."""
    sessions["trend"] = _make_expense_df([
        {"סכום": -100, "סכום_מוחלט": 100, "קטגוריה": "A", "חודש": "01/2026"},
        {"סכום": -150, "סכום_מוחלט": 150, "קטגוריה": "A", "חודש": "02/2026"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "trend"})
    data = resp.json()
    cat = data["categories"][0]
    # (150 - 100) / 100 * 100 = 50%
    assert cat["month_change"] == 50.0


@pytest.mark.asyncio
async def test_sparkline_chronological_order(client):
    """Sparkline months must be in chronological order, not lexicographic."""
    sessions["spark"] = _make_expense_df([
        {"סכום": -10, "סכום_מוחלט": 10, "קטגוריה": "A", "חודש": "09/2025"},
        {"סכום": -20, "סכום_מוחלט": 20, "קטגוריה": "A", "חודש": "01/2026"},
        {"סכום": -30, "סכום_מוחלט": 30, "קטגוריה": "A", "חודש": "12/2025"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "spark"})
    data = resp.json()
    sparkline = data["categories"][0]["sparkline"]
    # Chronological: 09/2025 (10) → 12/2025 (30) → 01/2026 (20)
    assert sparkline == [10.0, 30.0, 20.0]


# ---------------------------------------------------------------------------
# 6. NaN / Infinity handling
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_nan_amounts_are_sanitized(client):
    """NaN in סכום_מוחלט should not crash or produce NaN in JSON."""
    df = _make_expense_df([
        {"סכום": -100, "סכום_מוחלט": 100, "קטגוריה": "A", "חודש": "01/2026"},
        {"סכום": -float('nan'), "סכום_מוחלט": float('nan'), "קטגוריה": "A", "חודש": "01/2026"},
    ])
    sessions["nan"] = df
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "nan"})
    # Should not return 500
    assert resp.status_code == 200
    body = resp.text
    assert "NaN" not in body
    assert "Infinity" not in body


# ---------------------------------------------------------------------------
# 7. Response schema validation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_response_schema_has_all_required_fields(client):
    """Every category must have all expected fields."""
    sessions["schema"] = _make_expense_df([
        {"סכום": -500, "סכום_מוחלט": 500, "קטגוריה": "Test", "חודש": "01/2026", "תיאור": "merchant"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "schema"})
    data = resp.json()
    required_top = {"categories", "total", "total_count", "month_count", "last_month", "prev_month"}
    assert required_top.issubset(data.keys())

    required_cat = {
        "name", "total", "count", "percent",
        "avg_transaction", "monthly_avg", "months_active",
        "month_change", "top_merchant", "top_merchant_total", "sparkline",
    }
    for cat in data["categories"]:
        assert required_cat.issubset(cat.keys()), f"Missing keys: {required_cat - cat.keys()}"


@pytest.mark.asyncio
async def test_categories_sorted_descending_by_total(client):
    """Default response must have categories sorted by total descending."""
    sessions["sort"] = _make_expense_df([
        {"סכום": -50, "סכום_מוחלט": 50, "קטגוריה": "Small", "חודש": "01/2026"},
        {"סכום": -500, "סכום_מוחלט": 500, "קטגוריה": "Large", "חודש": "01/2026"},
        {"סכום": -200, "סכום_מוחלט": 200, "קטגוריה": "Medium", "חודש": "01/2026"},
    ])
    resp = await client.get("/api/charts/v2/category-snapshot", params={"sessionId": "sort"})
    data = resp.json()
    totals = [c["total"] for c in data["categories"]]
    assert totals == sorted(totals, reverse=True)
