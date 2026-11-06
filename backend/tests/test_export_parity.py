"""Export parity: /api/export must apply the same search/amount filters as
GET /api/transactions so the downloaded file matches the list on screen."""
import io

import pandas as pd
import pytest
from httpx import AsyncClient, ASGITransport
from openpyxl import load_workbook

from app.main import app
from app.api.routes import sessions


def _frame():
    rows = [
        {'תיאור': 'סופר גדול', 'סכום': -100.0, 'קטגוריה': 'מזון', 'תאריך': pd.Timestamp('2026-01-05')},
        {'תיאור': 'סופר קטן', 'סכום': -900.0, 'קטגוריה': 'מזון', 'תאריך': pd.Timestamp('2026-01-10')},
        {'תיאור': 'משכורת', 'סכום': 12000.0, 'קטגוריה': 'הכנסה', 'תאריך': pd.Timestamp('2026-01-01')},
        {'תיאור': 'קפה', 'סכום': -18.0, 'קטגוריה': 'מזון', 'תאריך': pd.Timestamp('2026-01-20')},
    ]
    df = pd.DataFrame(rows)
    df['סכום_מוחלט'] = df['סכום'].abs()
    df['חודש'] = '01/2026'
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


def _descriptions(xlsx_bytes: bytes):
    wb = load_workbook(io.BytesIO(xlsx_bytes))
    ws = wb['עסקאות']
    return [row[1] for row in ws.iter_rows(min_row=2, values_only=True)]


@pytest.mark.asyncio
async def test_export_applies_search(client):
    sessions['exp'] = _frame()
    resp = await client.get('/api/export', params={'sessionId': 'exp', 'search': 'סופר'})
    assert resp.status_code == 200
    assert sorted(_descriptions(resp.content)) == ['סופר גדול', 'סופר קטן']


@pytest.mark.asyncio
async def test_export_applies_amount_range_with_absolute_semantics(client):
    sessions['exp'] = _frame()
    resp = await client.get('/api/export', params={'sessionId': 'exp', 'min_amount': 50, 'max_amount': 1000})
    assert resp.status_code == 200
    assert sorted(_descriptions(resp.content)) == ['סופר גדול', 'סופר קטן']


@pytest.mark.asyncio
async def test_export_combines_search_amount_and_dates(client):
    sessions['exp'] = _frame()
    resp = await client.get('/api/export', params={
        'sessionId': 'exp', 'search': 'סופר', 'min_amount': 200,
        'start_date': '2026-01-01', 'end_date': '2026-01-15',
    })
    assert resp.status_code == 200
    assert _descriptions(resp.content) == ['סופר קטן']
