import pandas as pd
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.api import routes

@pytest.mark.asyncio
async def test_subcategory_monthly_splits_selected_category():
    sid = 'subcategory-monthly-test'
    routes.sessions[sid] = pd.DataFrame([
        {'תאריך': pd.Timestamp('2026-07-01'), 'קטגוריה': 'מזון', 'קטגוריה_משנה': 'סופר קטן', 'סכום': -50, 'סכום_מוחלט': 50},
        {'תאריך': pd.Timestamp('2026-08-01'), 'קטגוריה': 'מזון', 'קטגוריה_משנה': 'סופר קטן', 'סכום': -70, 'סכום_מוחלט': 70},
        {'תאריך': pd.Timestamp('2026-08-02'), 'קטגוריה': 'מזון', 'קטגוריה_משנה': 'סופר גדול', 'סכום': -200, 'סכום_מוחלט': 200},
    ])
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            response = await client.get('/api/charts/v2/subcategory-monthly', params={'sessionId': sid, 'category': 'מזון'})
        assert response.status_code == 200
        assert response.json() == {'months': ['07/2026', '08/2026'], 'series': [
            {'name': 'סופר גדול', 'data': [0.0, 200.0]},
            {'name': 'סופר קטן', 'data': [50.0, 70.0]},
        ]}
    finally:
        routes.sessions.pop(sid, None)

@pytest.mark.asyncio
async def test_subcategory_monthly_single_subcategory_and_hebrew_label():
    sid = 'subcategory-monthly-single'
    routes.sessions[sid] = pd.DataFrame([
        {'תאריך': pd.Timestamp('2026-09-01'), 'קטגוריה': 'אוכל', 'קטגוריה_משנה': 'בתי קפה ומאפים', 'סכום': -75, 'סכום_מוחלט': 75},
    ])
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            response = await client.get('/api/charts/v2/subcategory-monthly', params={'sessionId': sid, 'category': 'אוכל'})
        assert response.status_code == 200
        assert response.json() == {'months': ['09/2026'], 'series': [
            {'name': 'בתי קפה ומאפים', 'data': [75.0]},
        ]}
    finally:
        routes.sessions.pop(sid, None)


@pytest.mark.asyncio
async def test_subcategory_monthly_empty_when_category_has_no_subcategories():
    sid = 'subcategory-monthly-empty'
    routes.sessions[sid] = pd.DataFrame([
        {'תאריך': pd.Timestamp('2026-09-01'), 'קטגוריה': 'אוכל', 'קטגוריה_משנה': '', 'סכום': -75, 'סכום_מוחלט': 75},
    ])
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            response = await client.get('/api/charts/v2/subcategory-monthly', params={'sessionId': sid, 'category': 'אוכל'})
        assert response.status_code == 200
        assert response.json() == {'months': [], 'series': []}
    finally:
        routes.sessions.pop(sid, None)
