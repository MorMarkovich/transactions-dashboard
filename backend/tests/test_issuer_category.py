"""Issuer category (ענף_מקור) — the card company's own classification.

bank-sync stores the issuer's sector name per transaction (MAX sends it with
every transaction; Isracard via the opt-in extra-info fetch). It is a WEAK
signal: it fills only rows the keyword catalog left in שונות, and user rules
override it. Mirrored in bank-sync categorize.js (categoryFromIssuer).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.core.constants import map_issuer_category  # noqa: E402
from app.services.data_processor import apply_issuer_category  # noqa: E402

client = TestClient(app)


def _restore(rows, rules=None):
    resp = client.post(
        "/api/restore-session",
        json={"transactions": rows, "category_rules": rules or []},
    )
    assert resp.status_code == 200, resp.text
    sid = resp.json()["session_id"]
    tx = client.get(
        "/api/transactions", params={"sessionId": sid, "page": 1, "pageSize": 100}
    ).json()["transactions"]
    return {t["תיאור"]: t for t in tx}


def test_map_issuer_category_specific_before_generic():
    assert map_issuer_category("מסעדות ובתי קפה") == "מסעדות, קפה וברים"
    assert map_issuer_category("מזון מהיר") == "מסעדות, קפה וברים"  # not מזון וצריכה
    assert map_issuer_category("רשתות שיווק מזון") == "מזון וצריכה"
    assert map_issuer_category("חשמל ואלקטרוניקה") == "חשמל ומחשבים"  # not דלק/חשמל
    assert map_issuer_category("תיירות ותעופה") == "טיסות ותיירות"
    assert map_issuer_category("") is None
    assert map_issuer_category(None) is None
    assert map_issuer_category(float("nan")) is None
    assert map_issuer_category("ענף עלום") is None


def test_apply_issuer_category_fills_only_misc_rows():
    df = pd.DataFrame([
        {"תיאור": "העסק של יוסי", "קטגוריה": "שונות", "ענף_מקור": "מוסכים ורכב"},
        {"תיאור": "עסק עלום", "קטגוריה": "שונות", "ענף_מקור": "ענף עלום"},
        {"תיאור": "עסק מסווג", "קטגוריה": "ביטוח", "ענף_מקור": "מסעדות"},
        {"תיאור": "בלי ענף", "קטגוריה": "שונות", "ענף_מקור": None},
    ])
    filled = apply_issuer_category(df)
    assert filled == 1
    assert df.loc[0, "קטגוריה"] == "תחבורה ורכבים"
    assert df.loc[1, "קטגוריה"] == "שונות"
    assert df.loc[2, "קטגוריה"] == "ביטוח"  # existing category untouched
    assert df.loc[3, "קטגוריה"] == "שונות"


def test_apply_issuer_category_without_column_is_noop():
    df = pd.DataFrame([{"תיאור": "עסק", "קטגוריה": "שונות"}])
    assert apply_issuer_category(df) == 0


def test_restore_uses_issuer_category_for_misc_rows():
    rows = [
        # Unknown merchant + issuer sector → issuer classification fills it.
        {"תאריך": "2026-06-01", "תיאור": "העסק של יוסי", "קטגוריה": "שונות",
         "סכום": -100, "ענף_מקור": "מסעדות"},
        # Keyword catalog hit → issuer sector is ignored.
        {"תאריך": "2026-06-02", "תיאור": "שופרסל דיל", "קטגוריה": "שונות",
         "סכום": -200, "ענף_מקור": "מסעדות"},
    ]
    by_desc = _restore(rows)
    assert by_desc["העסק של יוסי"]["קטגוריה"] == "מסעדות, קפה וברים"
    assert by_desc["שופרסל דיל"]["קטגוריה"] == "מזון וצריכה"


def test_user_rule_beats_issuer_category():
    rows = [
        {"תאריך": "2026-06-01", "תיאור": "העסק של יוסי", "קטגוריה": "שונות",
         "סכום": -100, "ענף_מקור": "מסעדות"},
    ]
    rules = [{"merchant": "העסק של יוסי", "category": "חינוך ולימודים"}]
    by_desc = _restore(rows, rules)
    assert by_desc["העסק של יוסי"]["קטגוריה"] == "חינוך ולימודים"
