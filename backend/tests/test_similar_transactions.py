import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.api import routes
from app.core import security
from app.main import app


@pytest.fixture
def merchant_history(monkeypatch):
    session_id = 'merchant-history-test'
    frame = pd.DataFrame([
        (0, '2026-09-01', '2026-11-01', 'חיותא (תשלום 3/3)', -120, 'שלי'),
        (1, '2026-09-01', '2026-10-01', 'PayPal * חיותא (תשלום 2/3)', -105, 'שלי'),
        (2, '2026-08-01', None, ' חיותא ', -95, 'שלי'),
        (3, '2026-09-15', None, 'חיותא', -88, 'מור'),
        (4, '2026-09-01', '2026-11-01', 'חיותא', -35, 'שלי'),
        (5, '2026-09-01', '2026-12-01', 'חיותא', -120, 'שלי'),
        (6, '2026-09-10', None, 'חיותא', 50, 'שלי'),
        (7, '2026-09-10', None, 'חיותא בדיקה', -40, 'שלי'),
    ], columns=['id', 'תאריך', 'תאריך_חיוב', 'תיאור', 'סכום', '_owner'])
    frame['תאריך'] = pd.to_datetime(frame['תאריך'])
    frame['תאריך_חיוב'] = pd.to_datetime(frame['תאריך_חיוב'])
    monkeypatch.setitem(routes.sessions, session_id, frame)
    return session_id


@pytest.mark.asyncio
async def test_similar_transactions_match_normalized_merchant_and_use_charge_date(merchant_history):
    result = await routes.get_similar_transactions(0, merchant_history, owner='שלי')
    assert result['transactions'] == [
        {'date': '2026-10-01', 'description': 'PayPal * חיותא (תשלום 2/3)', 'amount': -105},
        {'date': '2026-08-01', 'description': ' חיותא ', 'amount': -95},
    ]
    all_owners = await routes.get_similar_transactions(0, merchant_history)
    assert [row['amount'] for row in all_owners['transactions']] == [-105, -88, -95]


@pytest.mark.asyncio
async def test_similar_transactions_return_empty_for_a_new_merchant(merchant_history):
    assert await routes.get_similar_transactions(7, merchant_history) == {'transactions': []}


def test_similar_transactions_respect_session_ownership(merchant_history, monkeypatch):
    async def fake_authenticate(credentials):
        return credentials.credentials

    monkeypatch.setattr(security, 'AUTH_DISABLED', False)
    monkeypatch.setattr(security, '_authenticate', fake_authenticate)
    security.bind_session(merchant_history, 'alice')
    try:
        client = TestClient(app)
        params = {'sessionId': merchant_history, 'owner': 'שלי'}
        url = '/api/transactions/0/similar'
        response = client.get(url, params=params, headers={'Authorization': 'Bearer bob'})
        assert response.status_code == 404
        response = client.get(url, params=params, headers={'Authorization': 'Bearer alice'})
        assert response.status_code == 200
        assert len(response.json()['transactions']) == 2
    finally:
        security.unbind_session(merchant_history)
