import pandas as pd
from fastapi.testclient import TestClient
from app.main import app
from app.api import routes

def test_metrics_serializes_numpy_aggregates_after_scoping():
    sid = 'metrics-serialization-test'
    routes.sessions[sid] = pd.DataFrame([
        {'תאריך': pd.Timestamp('2026-08-01'), 'קטגוריה': 'אוכל', 'קטגוריה_משנה': 'סופר קטן', 'סכום': -50, 'סכום_מוחלט': 50},
        {'תאריך': pd.Timestamp('2026-08-02'), 'קטגוריה': 'אוכל', 'קטגוריה_משנה': 'סופר גדול', 'סכום': -200, 'סכום_מוחלט': 200},
    ])
    try:
        with TestClient(app) as client:
            scoped = client.post('/api/session/scope', json={'session_id': sid, 'category': 'אוכל', 'subcategory': 'סופר קטן'}).json()['session_id']
            response = client.get('/api/metrics', params={'sessionId': scoped})
        assert response.status_code == 200
        assert response.json()['total_transactions'] == 1
        assert response.json()['total_expenses'] == 50.0
    finally:
        routes.sessions.pop(sid, None)
