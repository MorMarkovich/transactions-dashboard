"""Single-transaction overrides ("אל תשנה סיווג של עסקאות דומות").

An override pins EXACTLY ONE row — matched by its stable fingerprint
(date|amount|description) — to a category/subcategory, with the highest
precedence in the pipeline: it beats the keyword catalog, merchant rules and
the AI, and the resulting _locked flag keeps merchant-wide edits and every
AI pass off the row. This is what lets each ביט transfer carry a different
category.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.services.data_processor import txn_fingerprint  # noqa: E402

client = TestClient(app)


def _restore(rows, rules=None, overrides=None):
    body = {"transactions": rows}
    if rules:
        body["category_rules"] = rules
    if overrides:
        body["transaction_overrides"] = overrides
    resp = client.post("/api/restore-session", json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()["session_id"]


def _rows(sid):
    txns = client.get(
        "/api/transactions", params={"sessionId": sid, "page_size": 100}
    ).json()["transactions"]
    return {t["id"]: t for t in txns}


def test_fingerprint_is_stable_and_normalized():
    key = txn_fingerprint("2026-07-05", -13.9, "  העברה  בביט ")
    assert key == txn_fingerprint("2026-07-05T00:00:00", -13.90, "העברה בביט")
    assert key != txn_fingerprint("2026-07-06", -13.9, "העברה בביט")


def test_override_beats_catalog_and_rules():
    desc = "סיטי מרקט רמת גן"  # catalog-known → מזון וצריכה
    key = txn_fingerprint("2026-07-05", -13.9, desc)
    sid = _restore(
        [{"id": 1, "תאריך": "2026-07-05", "תיאור": desc,
          "קטגוריה": "שונות", "סכום": -13.9}],
        rules=[{"merchant": desc, "category": "אירועים ומתנות"}],
        overrides=[{"txn_key": key, "category": "חוגים וספורט"}],
    )
    row = _rows(sid)[1]
    assert row["קטגוריה"] == "חוגים וספורט"
    assert row["_locked"] is True


def test_override_pins_one_bit_transfer_not_the_others():
    key = txn_fingerprint("2026-07-05", -100.0, "העברה בביט")
    sid = _restore([
        {"id": 1, "תאריך": "2026-07-05", "תיאור": "העברה בביט",
         "קטגוריה": "שונות", "סכום": -100.0},
        {"id": 2, "תאריך": "2026-07-08", "תיאור": "העברה בביט",
         "קטגוריה": "שונות", "סכום": -250.0},
    ], overrides=[{"txn_key": key, "category": "אירועים ומתנות"}])
    rows = _rows(sid)
    assert rows[1]["קטגוריה"] == "אירועים ומתנות"
    assert rows[1]["_locked"] is True
    assert rows[2]["קטגוריה"] != "אירועים ומתנות"
    assert rows[2]["_locked"] is False


def test_merchant_wide_update_skips_locked_rows():
    key = txn_fingerprint("2026-07-05", -100.0, "העברה בביט")
    sid = _restore([
        {"id": 1, "תאריך": "2026-07-05", "תיאור": "העברה בביט",
         "קטגוריה": "שונות", "סכום": -100.0},
        {"id": 2, "תאריך": "2026-07-08", "תיאור": "העברה בביט",
         "קטגוריה": "שונות", "סכום": -250.0},
    ], overrides=[{"txn_key": key, "category": "אירועים ומתנות"}])

    resp = client.post("/api/merchants/category", json={
        "session_id": sid, "merchant": "העברה בביט", "category": "העברת כספים",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["affected_count"] == 1

    rows = _rows(sid)
    assert rows[1]["קטגוריה"] == "אירועים ומתנות"  # pinned row untouched
    assert rows[2]["קטגוריה"] == "העברת כספים"


def test_only_this_endpoint_pins_and_normal_edit_unpins():
    sid = _restore([
        {"id": 1, "תאריך": "2026-07-05", "תיאור": "העברה בביט",
         "קטגוריה": "שונות", "סכום": -100.0},
    ])
    expected_key = txn_fingerprint("2026-07-05", -100.0, "העברה בביט")

    resp = client.post("/api/transactions/category", json={
        "session_id": sid, "transaction_id": 1,
        "category": "אירועים ומתנות", "only_this": True,
    }).json()
    assert resp["txn_key"] == expected_key
    assert resp["locked"] is True
    assert _rows(sid)[1]["_locked"] is True

    # A merchant-wide edit now has nothing to touch.
    resp = client.post("/api/merchants/category", json={
        "session_id": sid, "merchant": "העברה בביט", "category": "העברת כספים",
    }).json()
    assert resp["affected_count"] == 0
    assert _rows(sid)[1]["קטגוריה"] == "אירועים ומתנות"

    # A normal (rule-mode) edit explicitly unpins.
    resp = client.post("/api/transactions/category", json={
        "session_id": sid, "transaction_id": 1, "category": "העברת כספים",
    }).json()
    assert resp["locked"] is False
    assert _rows(sid)[1]["_locked"] is False


def test_override_subcategory_survives_seeded_derivation():
    # Seeded keywords normally WIN over stored subcategories — but never on a
    # pinned row.
    desc = "סופר פארם דיזנגוף"  # seeded → מזון וצריכה / פארם וטיפוח
    key = txn_fingerprint("2026-07-05", -80.0, desc)
    sid = _restore([
        {"id": 1, "תאריך": "2026-07-05", "תיאור": desc,
         "קטגוריה": "שונות", "סכום": -80.0},
        {"id": 2, "תאריך": "2026-07-06", "תיאור": "חנות כלשהי בע\"מ",
         "קטגוריה": "שונות", "סכום": -50.0},
    ], overrides=[{"txn_key": key, "category": "מזון וצריכה",
                   "subcategory": "תרופות"}])
    row = _rows(sid)[1]
    assert row["קטגוריה_משנה"] == "תרופות"

    # A merchant-wide edit elsewhere re-runs derive_subcategory on the whole
    # session — the pinned subcategory must survive it.
    client.post("/api/merchants/category", json={
        "session_id": sid, "merchant": "חנות כלשהי בע\"מ", "category": "אירועים ומתנות",
    })
    assert _rows(sid)[1]["קטגוריה_משנה"] == "תרופות"


def test_invalid_override_category_ignored():
    desc = "סיטי מרקט רמת גן"
    key = txn_fingerprint("2026-07-05", -13.9, desc)
    sid = _restore(
        [{"id": 1, "תאריך": "2026-07-05", "תיאור": desc,
          "קטגוריה": "שונות", "סכום": -13.9}],
        overrides=[{"txn_key": key, "category": "אחר"}],
    )
    row = _rows(sid)[1]
    assert row["קטגוריה"] == "אוכל"  # catalog still governs
    assert row["_locked"] is False
