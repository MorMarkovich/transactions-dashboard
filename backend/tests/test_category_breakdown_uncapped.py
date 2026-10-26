"""
Regression tests for /api/transactions category_breakdown completeness.

The breakdown used to be capped at the top 10 categories (head(10)), which
silently hid lower-spend categories from the chart and made the frontend
aggregate them into a synthetic "יתר הקטגוריות" bucket. It must now return
ALL expense categories in the filtered scope, sorted by total desc, with
count/percent semantics unchanged (percent of the filtered expense total).
"""
import pandas as pd
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.api.routes import sessions


def _rows_for_categories(names):
    rows = []
    for i, name in enumerate(names):
        rows.append({
            'תיאור': f'merchant {name}',
            'סכום': -(100.0 * (len(names) - i)),  # strictly descending totals
            'קטגוריה': name,
            'חודש': '01/2026',
            'תאריך': pd.Timestamp('2026-01-15'),
        })
    df = pd.DataFrame(rows)
    df['סכום_מוחלט'] = df['סכום'].abs()
    return df


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture(autouse=True)
def cleanup_sessions():
    sessions.clear()
    yield
    sessions.clear()


@pytest.mark.asyncio
async def test_category_breakdown_returns_all_categories_beyond_old_cap(client):
    """12 distinct categories must all appear; the old cap returned only 10."""
    names = [f'קטגוריה {i:02d}' for i in range(12)]
    sessions['uncapped'] = _rows_for_categories(names)

    resp = await client.get("/api/transactions", params={"sessionId": "uncapped"})
    assert resp.status_code == 200
    breakdown = resp.json()["category_breakdown"]

    assert len(breakdown) == 12
    assert {c['name'] for c in breakdown} == set(names)

    # sorted by total desc
    totals = [c['total'] for c in breakdown]
    assert totals == sorted(totals, reverse=True)

    # count semantics: one transaction per category here
    assert all(c['count'] == 1 for c in breakdown)

    # percent semantics: share of the filtered expense total, ~100 overall
    total_pct = sum(c['percent'] for c in breakdown)
    assert 99.5 <= total_pct <= 100.5
    assert breakdown[0]['total'] == 1200.0  # 100 * 12
    assert breakdown[-1]['total'] == 100.0


@pytest.mark.asyncio
async def test_category_breakdown_few_categories_unchanged(client):
    """Below the old cap the behavior is identical to before."""
    names = ['אוכל', 'דלק', 'שונות']
    sessions['few'] = _rows_for_categories(names)

    resp = await client.get("/api/transactions", params={"sessionId": "few"})
    assert resp.status_code == 200
    breakdown = resp.json()["category_breakdown"]

    assert [c['name'] for c in breakdown] == ['אוכל', 'דלק', 'שונות']
    assert len(breakdown) == 3
