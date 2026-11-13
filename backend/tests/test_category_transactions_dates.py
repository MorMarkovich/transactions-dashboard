from fastapi.testclient import TestClient

from app.api import routes
from app.main import app


def test_category_drilldown_restores_mixed_snapshot_date_formats():
    category = 'הוצאות שוטפות'
    transactions = [
        {'תאריך': '2026-11-01T00:00:00', 'תאריך_חיוב': '2026-11-03T00:00:00',
         'חודש': '11/2026', 'תיאור': 'ספק בדיקה א', 'קטגוריה': category, 'סכום': -10},
        {'תאריך': '2026-11-02', 'תאריך_חיוב': '2026-11-04',
         'חודש': '11/2026', 'תיאור': 'ספק בדיקה ב', 'קטגוריה': category, 'סכום': -20},
    ]
    with TestClient(app, raise_server_exceptions=False) as client:
        restored = client.post('/api/restore-session', json={'transactions': transactions})
        assert restored.status_code == 200
        session_id = restored.json()['session_id']
        try:
            response = client.get('/api/charts/v2/category-transactions', params={
                'sessionId': session_id, 'category': category, 'date_type': 'billing',
                'month_from': '11/2026', 'month_to': '11/2026',
            })
            assert response.status_code == 200
            assert response.json()['total'] == 30
            assert [row['תאריך'] for row in response.json()['transactions']] == ['2026-11-01', '2026-11-02']
            assert [row['תאריך_חיוב'][:10] for row in response.json()['transactions']] == ['2026-11-03', '2026-11-04']
        finally:
            routes.sessions.pop(session_id, None)
