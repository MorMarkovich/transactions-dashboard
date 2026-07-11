"""/ai-subcategorize — AI-created subcategories inside one parent category.

The suggestion call is mocked; these tests pin the endpoint contract:
  - only the requested category's rows WITHOUT a subcategory are sent
  - merchants are grouped by canonical key (installments collapse)
  - returned names are applied to all of a merchant's empty rows and come
    back as assignments for rule persistence
  - existing (manual) subcategories are never clobbered
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.api import routes  # noqa: E402

client = TestClient(app)


def _restore(rows):
    resp = client.post("/api/restore-session", json={"transactions": rows})
    assert resp.status_code == 200, resp.text
    return resp.json()["session_id"]


ROWS = [
    # Two installments of one merchant — must collapse to ONE canonical item.
    {"id": 1, "תאריך": "2026-06-05", "תיאור": "מעדניית הגליל (תשלום 1/2)", "קטגוריה": "מזון וצריכה", "סכום": -200.0},
    {"id": 2, "תאריך": "2026-07-05", "תיאור": "מעדניית הגליל (תשלום 2/2)", "קטגוריה": "מזון וצריכה", "סכום": -200.0},
    # Already keyword-subcategorized on restore (שופרסל → סופרים) — not sent.
    {"id": 3, "תאריך": "2026-06-07", "תיאור": "שופרסל דיל", "קטגוריה": "מזון וצריכה", "סכום": -120.0},
    # Manually subcategorized — not sent, never clobbered.
    {"id": 4, "תאריך": "2026-06-08", "תיאור": "חנות מיוחדת", "קטגוריה": "מזון וצריכה", "קטגוריה_משנה": "בחירה ידנית", "סכום": -80.0},
    # Different category — out of scope.
    {"id": 5, "תאריך": "2026-06-09", "תיאור": "מסעדת השף", "קטגוריה": "מסעדות, קפה וברים", "סכום": -300.0},
]


def test_ai_subcategorize_groups_applies_and_reports(monkeypatch):
    sid = _restore(ROWS)
    captured = {}

    def fake_suggest(category, items, existing):
        captured["category"] = category
        captured["merchants"] = [it["merchant"] for it in items]
        captured["existing"] = existing
        return [{"index": 0, "subcategory": "מעדניות"}]

    monkeypatch.setattr(routes, "suggest_subcategories", fake_suggest)
    resp = client.post("/api/ai-subcategorize", json={"session_id": sid, "category": "מזון וצריכה"})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Only the one unsubcategorized merchant was sent (installments collapsed).
    assert captured["category"] == "מזון וצריכה"
    assert len(captured["merchants"]) == 1
    assert captured["merchants"][0].startswith("מעדניית הגליל")
    # Existing names offered for reuse include the seeded catalog and in-use ones.
    assert "סופרים" in captured["existing"]
    assert "בחירה ידנית" in captured["existing"]

    assert len(data["assignments"]) == 1
    a = data["assignments"][0]
    assert a["subcategory"] == "מעדניות"
    assert a["count"] == 2  # both installments

    # Both installment rows got the subcategory; the manual one is untouched.
    txns = client.get("/api/transactions", params={"sessionId": sid, "page_size": 100}).json()["transactions"]
    by_id = {t["id"]: t for t in txns}
    assert by_id[1]["קטגוריה_משנה"] == "מעדניות"
    assert by_id[2]["קטגוריה_משנה"] == "מעדניות"
    assert by_id[4]["קטגוריה_משנה"] == "בחירה ידנית"
    assert by_id[3]["קטגוריה_משנה"] == "סופרים"


def test_ai_subcategorize_empty_suggestion_leaves_rows_alone(monkeypatch):
    sid = _restore(ROWS)
    monkeypatch.setattr(routes, "suggest_subcategories", lambda c, i, e: [{"index": 0, "subcategory": ""}])
    resp = client.post("/api/ai-subcategorize", json={"session_id": sid, "category": "מזון וצריכה"})
    assert resp.status_code == 200
    assert resp.json()["assignments"] == []
    txns = client.get("/api/transactions", params={"sessionId": sid, "page_size": 100}).json()["transactions"]
    by_id = {t["id"]: t for t in txns}
    assert (by_id[1].get("קטגוריה_משנה") or "") == ""


def test_ai_subcategorize_nothing_to_do():
    sid = _restore([
        {"id": 1, "תאריך": "2026-06-07", "תיאור": "שופרסל דיל", "קטגוריה": "מזון וצריכה", "סכום": -120.0},
    ])
    # שופרסל gets סופרים from the keyword catalog on restore → nothing left.
    resp = client.post("/api/ai-subcategorize", json={"session_id": sid, "category": "מזון וצריכה"})
    assert resp.status_code == 200
    assert resp.json() == {"success": True, "assignments": [], "remaining": 0}


def test_ai_subcategorize_all_sweeps_every_category(monkeypatch):
    sid = _restore(ROWS)
    calls = []

    def fake_suggest(category, items, existing):
        calls.append((category, [it["merchant"] for it in items]))
        return [{"index": 0, "subcategory": "תת אוטומטית"}]

    monkeypatch.setattr(routes, "suggest_subcategories", fake_suggest)
    resp = client.post("/api/ai-subcategorize-all", json={"session_id": sid})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Both categories with unsubcategorized rows are swept; שונות never is.
    swept = {c for c, _ in calls}
    assert swept == {"מזון וצריכה", "מסעדות, קפה וברים"}
    assert {a["category"] for a in data["assignments"]} == swept

    txns = client.get("/api/transactions", params={"sessionId": sid, "page_size": 100}).json()["transactions"]
    by_id = {t["id"]: t for t in txns}
    assert by_id[1]["קטגוריה_משנה"] == "תת אוטומטית"   # food merchant
    assert by_id[5]["קטגוריה_משנה"] == "תת אוטומטית"   # restaurant merchant
    assert by_id[4]["קטגוריה_משנה"] == "בחירה ידנית"    # manual pick untouched
