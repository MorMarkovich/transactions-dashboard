"""Weekly amounts must be JSON-safe even when pandas chooses int64."""
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.api import routes


@pytest.mark.parametrize('amounts', [[-10, -20], [-10.25, -20.5]])
def test_weekly_summary_serializes_whole_and_decimal_amounts(amounts):
    sid = 'weekly-serialization'
    today = pd.Timestamp.now().normalize()
    routes.sessions[sid] = pd.DataFrame([
        {'תאריך': today - pd.Timedelta(days=1), 'סכום': amounts[0], 'קטגוריה': 'אוכל'},
        {'תאריך': today, 'סכום': amounts[1], 'קטגוריה': 'אוכל'},
    ])
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get('/api/analytics/weekly-summary', params={'sessionId': sid})
        assert response.status_code == 200
        assert response.json()['this_week'] == {
            'total': abs(sum(amounts)), 'count': 2, 'top_category': 'אוכל',
        }
        assert response.json()['last_week']['total'] == 0
    finally:
        routes.sessions.pop(sid, None)


def test_weekly_summary_serializes_both_weeks_and_percentage():
    sid = 'weekly-both'
    today = pd.Timestamp.now().normalize()
    routes.sessions[sid] = pd.DataFrame([
        {'תאריך': today, 'סכום': -30, 'קטגוריה': 'אוכל'},
        {'תאריך': today - pd.Timedelta(days=8), 'סכום': -20, 'קטגוריה': 'קניות'},
        {'תאריך': today, 'סכום': 100, 'קטגוריה': 'שונות'},
    ])
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get('/api/analytics/weekly-summary', params={'sessionId': sid})
        assert response.status_code == 200
        data = response.json()
        assert data['this_week']['total'] == 30
        assert data['last_week']['total'] == 20
        assert data['change_pct'] == 50
        assert data['this_week']['count'] == 1
    finally:
        routes.sessions.pop(sid, None)


def test_weekly_summary_empty_session_is_json_safe():
    sid = 'weekly-empty'
    routes.sessions[sid] = pd.DataFrame()
    try:
        with TestClient(app) as client:
            response = client.get('/api/analytics/weekly-summary', params={'sessionId': sid})
        assert response.status_code == 200
        assert response.json()['this_week']['total'] == 0
    finally:
        routes.sessions.pop(sid, None)
