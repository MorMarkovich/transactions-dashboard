"""Shelly's edit-flow feedback (2026-07).

- An UNCHECKED category/subcategory edit is a merchant rule and must apply to
  every similar transaction IMMEDIATELY (not only on the next restore),
  skipping pinned rows.
- Per-transaction notes round-trip: /transactions/note returns the fingerprint
  and /restore-session re-applies notes passed back in.
- /categories/catalog?sessionId=... surfaces every subcategory in use, so a
  name created once stays pickable.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.services.data_processor import txn_fingerprint  # noqa: E402

client = TestClient(app)


def _restore(rows, **extra):
    resp = client.post("/api/restore-session", json={"transactions": rows, **extra})
    assert resp.status_code == 200, resp.text
    return resp.json()["session_id"]


def _rows(sid):
    txns = client.get(
        "/api/transactions", params={"sessionId": sid, "page_size": 100}
    ).json()["transactions"]
    return {t["id"]: t for t in txns}


BIT_ROWS = [
    {"id": 1, "תאריך": "2026-07-05", "תיאור": "מרצדס בנץ", "קטגוריה": "שונות", "סכום": -100.0},
    {"id": 2, "תאריך": "2026-07-08", "תיאור": "מרצדס בנץ (תשלום 2/3)", "קטגוריה": "שונות", "סכום": -100.0},
    {"id": 3, "תאריך": "2026-07-09", "תיאור": "עסק אחר לגמרי", "קטגוריה": "שונות", "סכום": -50.0},
]


def test_unchecked_edit_applies_to_all_similar_now():
    sid = _restore(BIT_ROWS)
    resp = client.post("/api/transactions/category", json={
        "session_id": sid, "transaction_id": 1, "category": "הוצאות משתנות",
    }).json()
    assert resp["affected_count"] == 2  # both installR rows, other merchant untouched
    rows = _rows(sid)
    assert rows[1]["קטגוריה"] == "הוצאות משתנות"
    assert rows[2]["קטגוריה"] == "הוצאות משתנות"  # the installment variant too
    assert rows[3]["קטגוריה"] == "שונות"


def test_unchecked_edit_never_touches_pinned_rows():
    key = txn_fingerprint("2026-07-08", -100.0, "מרצדס בנץ (תשלום 2/3)")
    sid = _restore(BIT_ROWS, transaction_overrides=[
        {"txn_key": key, "category": "אירועים ומתנות"},
    ])
    client.post("/api/transactions/category", json={
        "session_id": sid, "transaction_id": 1, "category": "הוצאות משתנות",
    })
    rows = _rows(sid)
    assert rows[1]["קטגוריה"] == "הוצאות משתנות"
    assert rows[2]["קטגוריה"] == "אירועים ומתנות"  # pinned — untouched


def test_unchecked_subcategory_edit_applies_merchant_wide():
    sid = _restore(BIT_ROWS)
    client.post("/api/transactions/category", json={
        "session_id": sid, "transaction_id": 1, "category": "הוצאות משתנות",
    })
    client.post("/api/transactions/subcategory", json={
        "session_id": sid, "transaction_id": 1, "subcategory": "רכב חדש",
    })
    rows = _rows(sid)
    assert rows[1]["קטגוריה_משנה"] == "רכב חדש"
    assert rows[2]["קטגוריה_משנה"] == "רכב חדש"
    assert (rows[3].get("קטגוריה_משנה") or "") == ""


def test_note_roundtrip_via_fingerprint():
    sid = _restore(BIT_ROWS)
    resp = client.post("/api/transactions/note", json={
        "session_id": sid, "transaction_id": 1, "notes": "מתנה ליום הולדת של אמא",
    }).json()
    key = resp["txn_key"]
    assert key == txn_fingerprint("2026-07-05", -100.0, "מרצדס בנץ")

    # A fresh restore (cold start) with the persisted notes re-applies them.
    sid2 = _restore(BIT_ROWS, transaction_notes=[
        {"txn_key": key, "note": "מתנה ליום הולדת של אמא"},
    ])
    assert _rows(sid2)[1]["הערות"] == "מתנה ליום הולדת של אמא"
    assert not (_rows(sid2)[2].get("הערות") or "")


def test_catalog_includes_in_use_subcategories():
    sid = _restore([
        {"id": 1, "תאריך": "2026-07-05", "תיאור": "חנות מסתורית",
         "קטגוריה": "קניות", "קטגוריה_משנה": "ציוד קמפינג", "סכום": -300.0},
    ])
    cat = client.get("/api/categories/catalog", params={"sessionId": sid}).json()
    names = [s["name"] for s in cat["subcategories"]["קניות"]]
    assert "ציוד קמפינג" in names   # user-created, surfaced for future picking
    assert "אופנה" in names          # seeded names still there
