"""Domain-25 regression: category rename must survive a restore intact.

Simulates the FIXED frontend persistence flow:
- rules re-pointed in place (category update only — subcategory preserved),
- pins migrated old -> new category,
- a brand-new name registered as a custom category.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.services.data_processor import txn_fingerprint  # noqa: E402

client = TestClient(app)

M = "אאאא סינתטי בדיקה סופר"
ROWS = [
    {"id": 1, "תאריך": "2026-10-05", "תיאור": M, "קטגוריה": "אוכל", "סכום": -100.0},
    {"id": 2, "תאריך": "2026-10-06", "תיאור": M, "קטגוריה": "אוכל", "סכום": -60.0},
]


def _restore(rows, **extra):
    resp = client.post("/api/restore-session", json={"transactions": rows, **extra})
    assert resp.status_code == 200, resp.text
    return resp.json()["session_id"]


def _rows(sid):
    txns = client.get("/api/transactions", params={"sessionId": sid, "page_size": 100}).json()["transactions"]
    return {t["id"]: t for t in txns}


def test_rename_to_new_name_survives_restore():
    """Rename אוכל -> brand-new name. Fixed flow registers the name as a custom
    category and re-points the merchant rules; restore must keep the new name."""
    sid = _restore(ROWS)
    r = client.post("/api/categories/rename", json={
        "session_id": sid, "old_category": "אוכל", "new_category": "מזון_בדיקה_סינתטי"})
    assert r.status_code == 200, r.text
    assert all(t["קטגוריה"] == "מזון_בדיקה_סינתטי" for t in _rows(sid).values())

    rules = [{"merchant": M, "category": "מזון_בדיקה_סינתטי", "subcategory": None, "source": "manual"}]
    sid2 = _restore(ROWS, category_rules=rules, custom_categories=["מזון_בדיקה_סינתטי"])
    cats = {t["id"]: t["קטגוריה"] for t in _rows(sid2).values()}
    assert cats == {1: "מזון_בדיקה_סינתטי", 2: "מזון_בדיקה_סינתטי"}, cats


def test_rename_preserves_manual_subrule():
    """Merchant has manual subrule {אוכל, סופר בדיקה ייחודי}. Rename אוכל -> בילויים
    with the fixed in-place rule update (subcategory column untouched): the
    subcategory must still apply after restore."""
    sid = _restore(ROWS, category_rules=[{
        "merchant": M, "category": "אוכל", "subcategory": "סופר בדיקה ייחודי", "source": "manual"}])
    assert _rows(sid)[1]["קטגוריה_משנה"] == "סופר בדיקה ייחודי"

    r = client.post("/api/categories/rename", json={
        "session_id": sid, "old_category": "אוכל", "new_category": "בילויים"})
    assert r.status_code == 200, r.text

    # Fixed persistence: UPDATE category only — subcategory survives.
    rules = [{"merchant": M, "category": "בילויים", "subcategory": "סופר בדיקה ייחודי", "source": "manual"}]
    sid2 = _restore(ROWS, category_rules=rules)
    rows2 = _rows(sid2)
    assert rows2[1]["קטגוריה"] == "בילויים"
    assert rows2[1]["קטגוריה_משנה"] == "סופר בדיקה ייחודי", rows2[1]
    assert rows2[2]["קטגוריה_משנה"] == "סופר בדיקה ייחודי"


def test_rename_migrates_pins():
    """Pinned row: rename moves the pin to the new category; restore must NOT
    resurrect the old category and the row must stay locked."""
    key = txn_fingerprint("2026-10-05", -100.0, M)
    sid = _restore(ROWS, transaction_overrides=[{"txn_key": key, "category": "אוכל", "subcategory": None}])
    assert _rows(sid)[1]["_locked"] in (True, 1)

    client.post("/api/categories/rename", json={
        "session_id": sid, "old_category": "אוכל", "new_category": "בילויים"})
    assert _rows(sid)[1]["קטגוריה"] == "בילויים"

    # Fixed flow: transaction_overrides.category updated אוכל -> בילויים.
    sid2 = _restore(
        ROWS,
        transaction_overrides=[{"txn_key": key, "category": "בילויים", "subcategory": None}],
        category_rules=[{"merchant": M, "category": "בילויים", "subcategory": None, "source": "manual"}],
    )
    rows2 = _rows(sid2)
    assert rows2[1]["קטגוריה"] == "בילויים", rows2[1]
    assert rows2[1]["_locked"] in (True, 1)
    assert rows2[2]["קטגוריה"] == "בילויים"


def test_reserved_acher_rejected_everywhere():
    """'אחר' is a chart-legend bucket (frontend constants.ts documents it as
    non-assignable). Free-text paths must not accept it as an edit target."""
    sid = _restore(ROWS)
    r = client.post("/api/transactions/category", json={
        "session_id": sid, "transaction_id": 1, "category": "אחר"})
    assert r.status_code == 400, r.text
    r = client.post("/api/transactions/category-bulk", json={
        "session_id": sid, "transaction_ids": [1, 2], "category": "אחר"})
    assert r.status_code == 400, r.text
    r = client.post("/api/categories/rename", json={
        "session_id": sid, "old_category": "אוכל", "new_category": "אחר"})
    assert r.status_code == 400, r.text
    # Rows untouched:
    assert all(t["קטגוריה"] == "אוכל" for t in _rows(sid).values())
    # Positive control: a normal custom name is still accepted.
    r = client.post("/api/transactions/category", json={
        "session_id": sid, "transaction_id": 1, "category": "קטגוריה חופשית סינתטית"})
    assert r.status_code == 200, r.text


def test_rename_retry_after_mid_persist_failure_completes():
    """Partial-failure/retry contract: rename succeeds in-session, the frontend
    persistence chain fails midway, the user retries the SAME rename. The
    backend must not 404 — it returns the new category's merchants so the
    retry can finish persisting, and a restore then shows the rename intact."""
    sid = _restore(ROWS, transaction_overrides=[{
        "txn_key": txn_fingerprint("2026-10-05", -100.0, M),
        "category": "אוכל", "subcategory": None}])
    r1 = client.post("/api/categories/rename", json={
        "session_id": sid, "old_category": "אוכל", "new_category": "בילויים"})
    assert r1.status_code == 200
    assert r1.json()["affected_count"] == 2

    # --- simulated persistence failure between steps; user retries ---
    r2 = client.post("/api/categories/rename", json={
        "session_id": sid, "old_category": "אוכל", "new_category": "בילויים"})
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body.get("already_renamed") is True
    assert body["affected_count"] == 0
    assert body["merchants"] == [M]  # retry gets the merchants to persist

    # Retry completes persistence: rules re-pointed, pins migrated.
    sid2 = _restore(
        ROWS,
        transaction_overrides=[{"txn_key": txn_fingerprint("2026-10-05", -100.0, M),
                                "category": "בילויים", "subcategory": None}],
        category_rules=[{"merchant": m, "category": "בילויים", "subcategory": None,
                         "source": "manual"} for m in body["merchants"]],
    )
    rows2 = _rows(sid2)
    assert all(t["קטגוריה"] == "בילויים" for t in rows2.values())
    assert rows2[1]["_locked"] in (True, 1)

    # A retry with a name that was NEVER renamed still 404s:
    r3 = client.post("/api/categories/rename", json={
        "session_id": sid, "old_category": "אוכל", "new_category": "קניות"})
    assert r3.status_code == 404
