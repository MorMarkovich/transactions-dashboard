"""Top-merchants endpoint aggregates on the canonical merchant key.

/api/merchants drives the בתי עסק page. It must group descriptor variants of
the same merchant (installment suffixes, processor prefixes, case/whitespace)
exactly like rules and the AI audit do (normalize_merchant), while keeping
genuinely distinct merchants separate and preserving sum/count/mean semantics
(count = transaction rows, average = mean per row). Display name is the
group's most frequent raw descriptor.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def _restore(rows):
    resp = client.post("/api/restore-session", json={"transactions": rows})
    assert resp.status_code == 200, resp.text
    return resp.json()["session_id"]


def _merchants(sid, n=10):
    resp = client.get("/api/merchants", params={"sessionId": sid, "n": n})
    assert resp.status_code == 200, resp.text
    return resp.json()["merchants"]


def test_installment_variants_merge_into_one_merchant():
    sid = _restore([
        {"תאריך": "2026-08-02", "תיאור": "רהיטים (תשלום 1/12)", "סכום": -300},
        {"תאריך": "2026-09-02", "תיאור": "רהיטים (תשלום 2/12)", "סכום": -300},
        {"תאריך": "2026-10-02", "תיאור": "רהיטים (תשלום 3/12)", "סכום": -300},
        {"תאריך": "2026-10-05", "תיאור": "שופרסל", "סכום": -350},
    ])
    merchants = _merchants(sid)
    # The real top merchant is the 900₪ installment purchase, not the 350₪ one-off.
    assert merchants[0]["total"] == 900.0
    assert merchants[0]["count"] == 3
    assert merchants[0]["average"] == 300.0
    assert "רהיטים" in merchants[0]["name"]
    assert merchants[1] == {"name": "שופרסל", "total": 350.0, "count": 1, "average": 350.0}
    # No installment fragment survives as its own merchant.
    assert all("תשלום" not in m["name"] or m is merchants[0] for m in merchants)
    assert len(merchants) == 2


def test_processor_prefix_and_case_variants_merge():
    sid = _restore([
        {"תאריך": "2026-09-01", "תיאור": "PAYPAL *SPOTIFY", "סכום": -40},
        {"תאריך": "2026-10-01", "תיאור": "paypal *spotify", "סכום": -40},
        {"תאריך": "2026-10-03", "תיאור": "  ZARA   TLV  ", "סכום": -200},
        {"תאריך": "2026-10-04", "תיאור": "zara tlv", "סכום": -100},
    ])
    merchants = _merchants(sid)
    assert len(merchants) == 2
    assert merchants[0]["total"] == 300.0 and merchants[0]["count"] == 2
    assert merchants[1]["total"] == 80.0 and merchants[1]["count"] == 2
    assert merchants[1]["average"] == 40.0


def test_genuinely_distinct_merchants_stay_separate():
    sid = _restore([
        {"תאריך": "2026-10-01", "תיאור": "שופרסל דיל", "סכום": -100},
        {"תאריך": "2026-10-02", "תיאור": "שופרסל אונליין", "סכום": -150},
        {"תאריך": "2026-10-03", "תיאור": "רמי לוי", "סכום": -200},
    ])
    merchants = _merchants(sid)
    assert [m["name"] for m in merchants] == ["רמי לוי", "שופרסל אונליין", "שופרסל דיל"]
    assert [m["total"] for m in merchants] == [200.0, 150.0, 100.0]
