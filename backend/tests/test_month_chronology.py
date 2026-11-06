"""Cross-year month ordering: MM/YYYY labels must sort chronologically."""
import pandas as pd
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.api.routes import sessions

# Months chosen so lexical string order differs from chronological order:
# lexically '01/2025' < '01/2026' < '11/2024' < '12/2024'.
MONTHS = ['11/2024', '12/2024', '01/2025', '01/2026']


def _df():
    rows = []
    for m in MONTHS:
        mm, yy = m.split('/')
        rows.append({'תאריך': pd.Timestamp(f'{yy}-{mm}-15'), 'סכום': -100.0,
                     'סכום_מוחלט': 100.0, 'קטגוריה': 'שונות', 'תיאור': 'בית קפה', 'חודש': m})
        rows.append({'תאריך': pd.Timestamp(f'{yy}-{mm}-09'), 'סכום': 5000.0,
                     'סכום_מוחלט': 5000.0, 'קטגוריה': 'הכנסות', 'תיאור': 'הפקדת שכר', 'חודש': m})
    return pd.DataFrame(rows)


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture(autouse=True)
def cleanup_sessions():
    yield
    sessions.pop('chrono', None)


@pytest.mark.asyncio
async def test_session_info_months_chronological_across_years(client):
    sessions['chrono'] = _df()
    r = await client.get('/api/session-info', params={'sessionId': 'chrono'})
    assert r.status_code == 200
    assert r.json()['months'] == MONTHS


@pytest.mark.asyncio
async def test_income_analysis_months_chronological_across_years(client):
    sessions['chrono'] = _df()
    r = await client.get('/api/income-analysis', params={'sessionId': 'chrono'})
    assert r.status_code == 200
    assert [m['name'] for m in r.json()['months']] == MONTHS
