"""AI category audit (review queue) + per-merchant bulk reclassification.

/ai-audit groups expense rows by canonical merchant, asks Claude for a second
opinion (mocked here) and returns only disagreements — it never applies
anything. /merchants/category applies one decision to every row of a merchant.
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
    {"id": 1, "תאריך": "2026-06-01", "תיאור": "WRITEO TOOLS CO", "קטגוריה": "שונות", "סכום": -178.0},
    {"id": 2, "תאריך": "2026-06-05", "תיאור": "עצמל סטודיו (תשלום 1/3)", "קטגוריה": "שונות", "סכום": -300.0},
    {"id": 3, "תאריך": "2026-07-05", "תיאור": "עצמל סטודיו (תשלום 2/3)", "קטגוריה": "שונות", "סכום": -300.0},
    {"id": 4, "תאריך": "2026-06-07", "תיאור": "שופרסל דיל", "קטגוריה": "שונות", "סכום": -120.0},
    # Income row — must not be audited.
    {"id": 5, "תאריך": "2026-06-28", "תיאור": "בנק פועלים משכורת", "קטגוריה": "הכנסות", "סכום": 10000.0},
]


def test_ai_audit_returns_only_disagreements(monkeypatch):
    sid = _restore(ROWS)

    captured = {}

    def fake_audit(items, on_progress=None):
        captured["items"] = items
        # Agree with everything except WRITEO (index unknown → find it).
        out = []
        for i, it in enumerate(items):
            if "WRITEO" in it["merchant"]:
                out.append({"index": i, "category": "חשמל ומחשבים",
                            "confidence": 0.9, "reason": "כלי כתיבה מקוון"})
            else:
                out.append({"index": i, "category": it["current"],
                            "confidence": 0.8, "reason": ""})
        return out

    monkeypatch.setattr(routes, "audit_merchants", fake_audit)
    resp = client.post("/api/ai-audit", json={"session_id": sid})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Installments were grouped to one canonical merchant; income excluded.
    merchants = [it["merchant"] for it in captured["items"]]
    assert not any("משכורת" in m for m in merchants)
    assert sum(1 for m in merchants if "עצמל סטודיו" in m) == 1
    grouped = next(it for it in captured["items"] if "עצמל סטודיו" in it["merchant"])
    assert grouped["count"] == 2 and grouped["total"] == 600.0

    # Only the disagreement comes back as a proposal.
    assert len(data["proposals"]) == 1
    p = data["proposals"][0]
    assert p["merchant"] == "WRITEO TOOLS CO"
    assert p["proposed_category"] == "חשמל ומחשבים"
    assert p["confidence"] == 0.9

    # Sweep support: the batch reports what it covered and what remains, so
    # the client can advance to the next slice instead of re-auditing forever.
    assert set(data["audited_merchants"]) == set(merchants)
    assert data["remaining"] == 0


def test_ai_audit_503_when_ai_unavailable(monkeypatch):
    sid = _restore(ROWS)
    monkeypatch.setattr(routes, "audit_merchants", lambda items, on_progress=None: None)
    resp = client.post("/api/ai-audit", json={"session_id": sid})
    assert resp.status_code == 503


def test_merchant_category_applies_to_all_variants():
    sid = _restore(ROWS)
    resp = client.post("/api/merchants/category", json={
        "session_id": sid,
        "merchant": "עצמל סטודיו (תשלום 1/3)",
        "category": "קניות",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["affected_count"] == 2

    tx = client.get("/api/transactions", params={"sessionId": sid, "page_size": 100}).json()["transactions"]
    cats = {t["תיאור"]: t["קטגוריה"] for t in tx}
    assert cats["עצמל סטודיו (תשלום 1/3)"] == "קניות"
    assert cats["עצמל סטודיו (תשלום 2/3)"] == "קניות"


def test_merchant_category_rejects_junk_category():
    sid = _restore(ROWS)
    resp = client.post("/api/merchants/category", json={
        "session_id": sid, "merchant": "שופרסל דיל", "category": "אחר",
    })
    assert resp.status_code == 400
