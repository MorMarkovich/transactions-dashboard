"""Catalog-wins-when-it-knows on restore.

A stored category that contradicts a current keyword-catalog hit is stale
(old catalog version or an old AI guess baked into the snapshot) and must be
repaired for EXPENSE rows. Rows the catalog has no opinion on keep their
stored category, income rows are never second-guessed, and user rules still
win over the repair.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def _restore(rows, rules=None):
    body = {"transactions": rows}
    if rules:
        body["category_rules"] = rules
    resp = client.post("/api/restore-session", json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()["session_id"]


def _cats(sid):
    txns = client.get("/api/transactions", params={"sessionId": sid, "page_size": 100}).json()["transactions"]
    return {t["id"]: t for t in txns}


def test_stale_stored_category_repaired_by_catalog():
    # The real bug: a minimarket pinned to משיכת מזומן by an old AI guess.
    sid = _restore([
        {"id": 1, "תאריך": "2026-07-05", "תיאור": "סיטי מרקט רמת גן",
         "קטגוריה": "משיכת מזומן", "קטגוריה_משנה": "ישן", "סכום": -13.9},
    ])
    row = _cats(sid)[1]
    assert row["קטגוריה"] == "מזון וצריכה"
    # The stale subcategory belonged to the old category — re-derived/cleared.
    assert (row.get("קטגוריה_משנה") or "") != "ישן"


def test_catalog_unknown_keeps_stored_category():
    sid = _restore([
        {"id": 1, "תאריך": "2026-07-05", "תיאור": "ZZQWX SERVICES",
         "קטגוריה": "מנויים ושירותים", "סכום": -30.0},
    ])
    assert _cats(sid)[1]["קטגוריה"] == "מנויים ושירותים"


def test_income_rows_never_second_guessed():
    sid = _restore([
        {"id": 1, "תאריך": "2026-07-05", "תיאור": "סיטי מרקט רמת גן",
         "קטגוריה": "העברת כספים", "סכום": 100.0},
    ])
    assert _cats(sid)[1]["קטגוריה"] == "העברת כספים"


def test_user_rule_beats_catalog_repair():
    sid = _restore(
        [{"id": 1, "תאריך": "2026-07-05", "תיאור": "סיטי מרקט רמת גן",
          "קטגוריה": "משיכת מזומן", "סכום": -13.9}],
        rules=[{"merchant": "סיטי מרקט רמת גן", "category": "משיכת מזומן"}],
    )
    assert _cats(sid)[1]["קטגוריה"] == "משיכת מזומן"
