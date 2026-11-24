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


@pytest.mark.asyncio
async def test_export_includes_current_notes_and_all_matches_beyond_the_current_page(client):
    frame = _frame()
    frame['id'] = [1, 2, 3, 4]
    frame['קטגוריה_משנה'] = ['סופרים', 'סופרים', '', '']
    sessions['exp'] = frame
    note = 'קניות לשבוע\nהחזר חלקי'
    saved = await client.post('/api/transactions/note', json={
        'session_id': 'exp', 'transaction_id': 2, 'notes': note,
    })
    assert saved.status_code == 200

    params = {'sessionId': 'exp', 'search': 'סופר', 'page_size': 1}
    ledger = await client.get('/api/transactions', params=params)
    assert ledger.status_code == 200
    assert ledger.json()['total'] == 2
    assert len(ledger.json()['transactions']) == 1

    response = await client.get('/api/export', params=params)
    assert response.status_code == 200
    workbook = load_workbook(io.BytesIO(response.content))
    transactions = list(workbook['עסקאות'].values)
    headers = transactions[0]
    assert [row[headers.index('תיאור')] for row in transactions[1:]] == ['סופר קטן', 'סופר גדול']
    assert transactions[1][headers.index('קטגוריה_משנה')] == 'סופרים'
    assert transactions[1][headers.index('הערות')] == note
    assert list(workbook['פירוט לפי קטגוריה'].values)[1:] == [('מזון', 2, 1000, 0)]


@pytest.mark.asyncio
@pytest.mark.parametrize(('date_type', 'expected'), [
    ('transaction', ['חיוב שנדחה', 'משכורת מוקדמת']),
    ('billing', ['משכורת מוקדמת']),
])
async def test_dashboard_month_uses_same_attribution_in_ledger_and_workbook(client, date_type, expected):
    frame = pd.DataFrame([
        {'תאריך': pd.Timestamp('2026-04-30'), 'תיאור': 'משכורת מוקדמת', 'סכום': 3000, 'קטגוריה': 'הכנסה', 'חודש': '05/2026', 'חודש_חיוב': '05/2026'},
        {'תאריך': pd.Timestamp('2026-05-25'), 'תיאור': 'חיוב שנדחה', 'סכום': -60, 'קטגוריה': 'אוכל', 'חודש': '05/2026', 'חודש_חיוב': '06/2026'},
    ])
    frame['סכום_מוחלט'] = frame['סכום'].abs()
    sessions['exp'] = frame
    params = {'sessionId': 'exp', 'month': '05/2026', 'date_type': date_type}

    ledger = await client.get('/api/transactions', params=params)
    workbook = await client.get('/api/export', params=params)
    assert ledger.status_code == workbook.status_code == 200
    assert [row['תיאור'] for row in ledger.json()['transactions']] == expected
    assert _descriptions(workbook.content) == expected
