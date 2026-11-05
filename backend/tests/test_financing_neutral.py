"""Neutral financing-movement treatment: scoped identification + aggregation exclusion.

Rows stay visible in the ledger; income/expense sum endpoints exclude the
financing category so loan drawdown/repayments don't double-count the
original purchases.
"""
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.api import routes
from app.core.constants import FINANCING_CATEGORY
from app.services.data_processor import (
    financing_movement_mask, apply_financing_classification, drop_neutral_financing,
)


def _evidence_df():
    return pd.DataFrame([
        # The verified shell rows
        {'תיאור': 'העברות לקרדיט', 'סכום': -9200.00, 'תאריך_חיוב': pd.Timestamp('2026-10-02'), 'קטגוריה': 'שונות'},
        {'תיאור': 'העברות לקרדיט', 'סכום': 9200.00, 'תאריך_חיוב': pd.Timestamp('2026-10-02'), 'קטגוריה': 'שונות'},
        {'תיאור': 'העברות לקרדיט (תשלום 1/3)', 'סכום': -3105.34, 'תאריך_חיוב': pd.Timestamp('2026-11-02'), 'קטגוריה': 'שונות'},
        {'תיאור': 'העברות לקרדיט (תשלום 2/3)', 'סכום': -3105.34, 'תאריך_חיוב': pd.Timestamp('2026-12-02'), 'קטגוריה': 'שונות'},
        {'תיאור': 'העברות לקרדיט (תשלום 3/3)', 'סכום': -3105.34, 'תאריך_חיוב': pd.Timestamp('2027-01-02'), 'קטגוריה': 'שונות'},
        # Lookalikes that must NOT match
        {'תיאור': 'הפניקס רכב חובה (תשלום 3/3)', 'סכום': -477.00, 'תאריך_חיוב': pd.Timestamp('2026-12-02'), 'קטגוריה': 'הוצאות שוטפות'},
        {'תיאור': 'ותרינר הצפון (תשלום 3/3)', 'סכום': -333.00, 'תאריך_חיוב': pd.Timestamp('2026-11-02'), 'קטגוריה': 'סושי'},
        {'תיאור': 'העברות לקרדיט (תשלום 1/3)', 'סכום': -3105.34, 'תאריך_חיוב': pd.Timestamp('2026-11-03'), 'קטגוריה': 'שונות'},  # wrong billed date
        {'תיאור': 'העברות לקרדיט', 'סכום': -9200.01, 'תאריך_חיוב': pd.Timestamp('2026-10-02'), 'קטגוריה': 'שונות'},  # wrong amount
        {'תיאור': 'מכולת', 'סכום': -100.00, 'תאריך_חיוב': pd.Timestamp('2026-11-02'), 'קטגוריה': 'אוכל'},
    ])


def test_scoped_mask_matches_only_evidence_triples():
    mask = financing_movement_mask(_evidence_df())
    assert mask.tolist() == [True, True, True, True, True, False, False, False, False, False]


def test_scoped_mask_rejects_same_triple_on_other_account():
    df = _evidence_df()
    df['_provider'] = 'isracard'
    df['_owner'] = 'שלי'
    assert financing_movement_mask(df).sum() == 5
    other = df.copy()
    other['_owner'] = 'מור'  # identical triples, different account: no match
    assert financing_movement_mask(other).sum() == 0
    other2 = df.copy()
    other2['_provider'] = 'cal'  # different issuer: no match
    assert financing_movement_mask(other2).sum() == 0


def test_classification_sets_neutral_category_and_respects_lock():
    df = _evidence_df()
    df['_locked'] = False
    df.loc[2, '_locked'] = True  # user-pinned row keeps its own category
    out = apply_financing_classification(df.copy())
    cats = out['קטגוריה'].tolist()
    assert cats[0] == FINANCING_CATEGORY and cats[1] == FINANCING_CATEGORY
    assert cats[2] == 'שונות'  # locked
    assert cats[3] == FINANCING_CATEGORY and cats[4] == FINANCING_CATEGORY
    assert cats[5] == 'הוצאות שוטפות' and cats[6] == 'סושי' and cats[9] == 'אוכל'


def test_drop_neutral_keeps_everything_else():
    out = apply_financing_classification(_evidence_df().copy())
    kept = drop_neutral_financing(out)
    assert len(kept) == 5
    assert FINANCING_CATEGORY not in kept['קטגוריה'].unique()


def _session_df():
    return pd.DataFrame([
        {'תאריך': pd.Timestamp('2026-09-30'), 'תאריך_חיוב': pd.Timestamp('2026-10-02'), 'תיאור': 'העברות לקרדיט', 'קטגוריה': FINANCING_CATEGORY, 'קטגוריה_משנה': '', 'סכום': -9200.0, 'סכום_מוחלט': 9200.0, 'חודש_חיוב': '10/2026'},
        {'תאריך': pd.Timestamp('2026-09-30'), 'תאריך_חיוב': pd.Timestamp('2026-10-02'), 'תיאור': 'העברות לקרדיט', 'קטגוריה': FINANCING_CATEGORY, 'קטגוריה_משנה': '', 'סכום': 9200.0, 'סכום_מוחלט': 9200.0, 'חודש_חיוב': '10/2026'},
        {'תאריך': pd.Timestamp('2026-10-05'), 'תאריך_חיוב': pd.Timestamp('2026-11-02'), 'תיאור': 'מכולת', 'קטגוריה': 'אוכל', 'קטגוריה_משנה': '', 'סכום': -50.0, 'סכום_מוחלט': 50.0, 'חודש_חיוב': '11/2026'},
        {'תאריך': pd.Timestamp('2026-10-06'), 'תאריך_חיוב': pd.Timestamp('2026-11-02'), 'תיאור': 'משכורת', 'קטגוריה': 'שונות', 'קטגוריה_משנה': '', 'סכום': 1000.0, 'סכום_מוחלט': 1000.0, 'חודש_חיוב': '11/2026'},
    ])


def test_metrics_excludes_financing_from_sums():
    sid = 'financing-metrics-test'
    routes.sessions[sid] = _session_df()
    try:
        with TestClient(app) as client:
            r = client.get('/api/metrics', params={'sessionId': sid})
        assert r.status_code == 200
        body = r.json()
        assert body['total_expenses'] == 50.0
        assert body['total_income'] == 1000.0
    finally:
        routes.sessions.pop(sid, None)


def test_transactions_ledger_keeps_financing_rows_visible():
    sid = 'financing-ledger-test'
    routes.sessions[sid] = _session_df()
    try:
        with TestClient(app) as client:
            r = client.get('/api/transactions', params={'sessionId': sid, 'page_size': 50})
        assert r.status_code == 200
        body = r.json()
        rows = body['transactions'] if isinstance(body, dict) else body
        assert len(rows) == 4  # nothing hidden from the ledger
    finally:
        routes.sessions.pop(sid, None)


def test_category_drilldown_shows_financing_rows():
    sid = 'financing-drill-test'
    routes.sessions[sid] = _session_df()
    try:
        with TestClient(app) as client:
            r = client.get('/api/charts/v2/category-transactions', params={'sessionId': sid, 'category': FINANCING_CATEGORY})
        assert r.status_code == 200
        body = r.json()
        rows = body.get('transactions', body if isinstance(body, list) else [])
        # drill-down is expense-only by design; the negative shell row shows
        assert len(rows) == 1
        assert rows[0]['סכום'] == -9200.0
    finally:
        routes.sessions.pop(sid, None)
