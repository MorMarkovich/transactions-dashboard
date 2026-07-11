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


def test_stale_rule_cannot_fight_the_catalog():
    # The old AI persisted its wrong guess as a RULE too — the catalog now
    # wins over conflicting rules, so the merchant still heals.
    sid = _restore(
        [{"id": 1, "תאריך": "2026-07-05", "תיאור": "סיטי מרקט רמת גן",
          "קטגוריה": "משיכת מזומן", "סכום": -13.9}],
        rules=[{"merchant": "סיטי מרקט רמת גן", "category": "משיכת מזומן"}],
    )
    assert _cats(sid)[1]["קטגוריה"] == "מזון וצריכה"


def test_rule_still_decides_catalog_unknown_merchant():
    sid = _restore(
        [{"id": 1, "תאריך": "2026-07-05", "תיאור": "ZZQWX UNKNOWN CO",
          "קטגוריה": "שונות", "סכום": -50.0}],
        rules=[{"merchant": "ZZQWX UNKNOWN CO", "category": "מתנות"}],
    )
    assert _cats(sid)[1]["קטגוריה"] == "מתנות"


def test_rule_subcategory_applies_where_subcategory_seeds_are_silent():
    # Only the CATEGORY part of a conflicting rule is ignored — a manual
    # subcategory refinement sticks as long as no seeded subcategory keyword
    # claims the merchant (seeded subcategories, like the category catalog,
    # win when they have an opinion).
    sid = _restore(
        [{"id": 1, "תאריך": "2026-07-05", "תיאור": "מעדניית הגליל",
          "קטגוריה": "מזון וצריכה", "סכום": -120.0}],
        rules=[{"merchant": "מעדניית הגליל", "category": "מזון וצריכה", "subcategory": "קניות שבת"}],
    )
    row = _cats(sid)[1]
    assert row["קטגוריה"] == "מזון וצריכה"
    assert row["קטגוריה_משנה"] == "קניות שבת"


def test_seeded_subcategory_beats_rule_subcategory():
    sid = _restore(
        [{"id": 1, "תאריך": "2026-07-05", "תיאור": "שופרסל דיל",
          "קטגוריה": "מזון וצריכה", "סכום": -120.0}],
        rules=[{"merchant": "שופרסל דיל", "category": "מזון וצריכה", "subcategory": "קניות שבת"}],
    )
    row = _cats(sid)[1]
    assert row["קטגוריה"] == "מזון וצריכה"
    assert row["קטגוריה_משנה"] == "סופרים"


def test_delivery_descriptors_are_food_not_transport():
    # 'משלוח' used to sit in תחבורה ורכבים and dragged food deliveries there.
    sid = _restore([
        {"id": 1, "תאריך": "2026-07-01", "תיאור": "מפגש גרונר משלוחים",
         "קטגוריה": "תחבורה ורכבים", "סכום": -59.0},
        {"id": 2, "תאריך": "2026-06-29", "תיאור": "משלוחה הזמנת אוכל או",
         "קטגוריה": "תחבורה ורכבים", "סכום": -91.43},
        {"id": 3, "תאריך": "2026-06-21", "תיאור": "כביש 6", "קטגוריה": "שונות", "סכום": -37.35},
    ])
    cats = _cats(sid)
    assert cats[1]["קטגוריה"] == "מסעדות, קפה וברים"
    assert cats[2]["קטגוריה"] == "מסעדות, קפה וברים"
    assert cats[3]["קטגוריה"] == "תחבורה ורכבים"


def test_rule_subcategory_is_scoped_to_its_parent_category():
    # The rule was saved when the merchant sat in מזון וצריכה; after the
    # catalog moves it to מסעדות, the food-voucher subcategory must NOT leak.
    sid = _restore(
        [{"id": 1, "תאריך": "2026-07-01", "תיאור": "מפגש גרונר משלוחים",
          "קטגוריה": "שונות", "סכום": -59.0}],
        rules=[{"merchant": "מפגש גרונר משלוחים", "category": "מזון וצריכה", "subcategory": "שוברי מזון"}],
    )
    row = _cats(sid)[1]
    assert row["קטגוריה"] == "מסעדות, קפה וברים"
    assert (row.get("קטגוריה_משנה") or "") != "שוברי מזון"


def test_stock_stores_are_consumption_not_fashion():
    # BOOOM / סטוק סנטר are discount variety stores ("הכל בזול"), not fashion —
    # the old keyword list pinned them to אופנה next to אאוטלט.
    sid = _restore([
        {"id": 1, "תאריך": "2026-06-11", "תיאור": "BOOOM", "קטגוריה": "אופנה", "סכום": -134.4},
        {"id": 2, "תאריך": "2026-06-17", "תיאור": 'ב"ב BOOOM', "קטגוריה": "אופנה", "סכום": -15.9},
        {"id": 3, "תאריך": "2026-06-29", "תיאור": "סטוק סנטר איריס בע\"מ", "קטגוריה": "אופנה", "סכום": -15.9},
        # A real fashion chain stays fashion.
        {"id": 4, "תאריך": "2026-06-24", "תיאור": "גולף קניון רמת גן-גמ", "קטגוריה": "אופנה", "סכום": -15.12},
    ])
    cats = _cats(sid)
    for i in (1, 2, 3):
        assert cats[i]["קטגוריה"] == "מזון וצריכה"
        assert cats[i]["קטגוריה_משנה"] == "חנויות סטוק"
    assert cats[4]["קטגוריה"] == "אופנה"
    assert cats[4]["קטגוריה_משנה"] == "רשתות אופנה"
