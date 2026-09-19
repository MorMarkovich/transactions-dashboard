import pandas as pd
from fastapi.testclient import TestClient
from app.main import app
from app.api import routes


def test_scope_session_accepts_multiple_subcategories():
    sid = 'multi-subcategory-scope-test'
    routes.sessions[sid] = pd.DataFrame([
        {'קטגוריה': 'אוכל', 'קטגוריה_משנה': 'סופר קטן', 'סכום': -50, 'סכום_מוחלט': 50},
        {'קטגוריה': 'אוכל', 'קטגוריה_משנה': 'סופר גדול', 'סכום': -200, 'סכום_מוחלט': 200},
        {'קטגוריה': 'אוכל', 'קטגוריה_משנה': 'מסעדות', 'סכום': -90, 'סכום_מוחלט': 90},
        {'קטגוריה': 'תחבורה', 'קטגוריה_משנה': 'דלק', 'סכום': -120, 'סכום_מוחלט': 120},
    ])
    try:
        with TestClient(app) as client:
            response = client.post('/api/session/scope', json={
                'session_id': sid,
                'category': 'אוכל',
                'subcategories': ['סופר קטן', 'סופר גדול'],
            })
            assert response.status_code == 200
            scoped = routes.sessions[response.json()['session_id']]
        assert scoped['קטגוריה_משנה'].tolist() == ['סופר קטן', 'סופר גדול']
        assert scoped['סכום_מוחלט'].sum() == 250
    finally:
        for key in list(routes.sessions):
            if key == sid or key.startswith(f'{sid}::'):
                routes.sessions.pop(key, None)


def test_scope_filter_changes_keep_base_session_and_only_latest_scoped_view():
    sid = 'multi-subcategory-churn-test'
    routes.sessions[sid] = pd.DataFrame([
        {'קטגוריה': 'הוצאות שוטפות', 'קטגוריה_משנה': 'חשמל', 'סכום': -50, 'סכום_מוחלט': 50},
        {'קטגוריה': 'הוצאות שוטפות', 'קטגוריה_משנה': 'ארנונה', 'סכום': -200, 'סכום_מוחלט': 200},
        {'קטגוריה': 'הוצאות שוטפות', 'קטגוריה_משנה': 'אינטרנט', 'סכום': -90, 'סכום_מוחלט': 90},
    ])
    try:
        with TestClient(app) as client:
            for selected, expected in [(['חשמל'], 50), (['ארנונה'], 200), (['חשמל', 'אינטרנט'], 140)]:
                response = client.post('/api/session/scope', json={
                    'session_id': sid,
                    'category': 'הוצאות שוטפות',
                    'subcategories': selected,
                })
                assert response.status_code == 200
                assert routes.sessions[response.json()['session_id']]['סכום_מוחלט'].sum() == expected
        assert sid in routes.sessions
        assert len([key for key in routes.sessions if key.startswith(f'{sid}::')]) == 1
    finally:
        for key in list(routes.sessions):
            if key == sid or key.startswith(f'{sid}::'):
                routes.sessions.pop(key, None)
