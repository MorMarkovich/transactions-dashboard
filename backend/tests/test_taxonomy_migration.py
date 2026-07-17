"""Old taxonomy → Shelly's 2026-07 tree.

Stored Supabase snapshots, rules and pins still carry the pre-2026-07
category names. Restore must translate them in place — nothing may be reset
to שונות or deleted — and rules/pins written under old names must keep
working via the same maps.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.core.constants import (  # noqa: E402
    CATEGORY_ICONS, CATEGORY_MIGRATION, CATEGORY_PAIR_MIGRATION, migrate_category,
)

client = TestClient(app)


def _restore(rows, **extra):
    body = {"transactions": rows, **extra}
    resp = client.post("/api/restore-session", json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()["session_id"]


def _rows(sid):
    txns = client.get(
        "/api/transactions", params={"sessionId": sid, "page_size": 100}
    ).json()["transactions"]
    return {t["id"]: t for t in txns}


def test_every_migration_target_is_a_current_category():
    for cat, (new_cat, _) in CATEGORY_MIGRATION.items():
        assert cat not in CATEGORY_ICONS, f"old name {cat} still in CATEGORY_ICONS"
        assert new_cat in CATEGORY_ICONS, f"target {new_cat} not in CATEGORY_ICONS"
    for (cat, _), (new_cat, _) in CATEGORY_PAIR_MIGRATION.items():
        assert new_cat in CATEGORY_ICONS, f"pair target {new_cat} not in CATEGORY_ICONS"


def test_migrate_category_pairs_and_plain():
    assert migrate_category('מזון וצריכה', 'פארם וטיפוח') == ('פארם', '')
    assert migrate_category('מזון וצריכה', 'מאפיות') == ('אוכל', None)  # subcat kept
    assert migrate_category('בינה מלאכותית', '') == ('טכנולוגיה', 'AI')
    assert migrate_category('אוכל', 'מאפיות') == ('אוכל', None)  # current passes through
    assert migrate_category('שכר דירה') == ('הוצאות שוטפות', 'שכר דירה')


def test_restore_migrates_old_snapshot_rows_without_data_loss():
    sid = _restore([
        # Plain rename keeps the row's subcategory name under the new parent.
        {"id": 1, "תאריך": "2026-06-01", "תיאור": "מאפיית לחם ארז",
         "קטגוריה": "מזון וצריכה", "קטגוריה_משנה": "מאפיות", "סכום": -40.0},
        # Pair migration re-parents the row entirely.
        {"id": 2, "תאריך": "2026-06-02", "תיאור": "סופר פארם דיזנגוף",
         "קטגוריה": "מזון וצריכה", "קטגוריה_משנה": "פארם וטיפוח", "סכום": -120.0},
        # Old top-level AI category becomes a subcategory of טכנולוגיה.
        {"id": 3, "תאריך": "2026-06-03", "תיאור": "CLAUDE.AI SUBSCRIPTION",
         "קטגוריה": "בינה מלאכותית", "סכום": -75.0},
        # Catalog-unknown merchant under an old name — migrated, NOT nuked to שונות.
        {"id": 4, "תאריך": "2026-06-04", "תיאור": "ZZQWX SERVICES",
         "קטגוריה": "מנויים ושירותים", "סכום": -30.0},
        # Old rent category → subcategory of הוצאות שוטפות.
        {"id": 5, "תאריך": "2026-06-05", "תיאור": "תשלום שיק",
         "קטגוריה": "שכר דירה", "סכום": -3800.0},
    ])
    rows = _rows(sid)
    assert rows[1]["קטגוריה"] == "אוכל"
    assert rows[1]["קטגוריה_משנה"] == "מאפיות"
    assert rows[2]["קטגוריה"] == "פארם"
    assert rows[3]["קטגוריה"] == "טכנולוגיה"
    assert rows[3]["קטגוריה_משנה"] == "AI"
    assert rows[4]["קטגוריה"] == "הוצאות שוטפות"
    assert rows[4]["קטגוריה_משנה"] == "מנויים ושירותים"
    assert rows[5]["קטגוריה"] == "הוצאות שוטפות"
    assert rows[5]["קטגוריה_משנה"] == "שכר דירה"


def test_rules_and_pins_saved_under_old_names_still_work():
    from app.services.data_processor import txn_fingerprint
    key = txn_fingerprint("2026-06-02", -50.0, "ZZOTHER SHOP")
    sid = _restore(
        [
            {"id": 1, "תאריך": "2026-06-01", "תיאור": "ZZQWX SERVICES",
             "קטגוריה": "שונות", "סכום": -30.0},
            {"id": 2, "תאריך": "2026-06-02", "תיאור": "ZZOTHER SHOP",
             "קטגוריה": "שונות", "סכום": -50.0},
        ],
        category_rules=[{"merchant": "ZZQWX SERVICES", "category": "חינוך ולימודים"}],
        transaction_overrides=[{"txn_key": key, "category": "חיות מחמד"}],
    )
    rows = _rows(sid)
    assert rows[1]["קטגוריה"] == "חוגים וספורט"   # old rule name migrated
    assert rows[2]["קטגוריה"] == "סושי"            # old pin name migrated
    assert rows[2]["_locked"] is True


def test_custom_categories_survive_restore():
    sid = _restore(
        [{"id": 1, "תאריך": "2026-06-01", "תיאור": "ZZWEIRD SHOP",
          "קטגוריה": "החתונה שלנו", "סכום": -500.0}],
        custom_categories=["החתונה שלנו"],
    )
    assert _rows(sid)[1]["קטגוריה"] == "החתונה שלנו"

    # Without declaring it, the unknown name is junk → reset to שונות.
    sid2 = _restore(
        [{"id": 1, "תאריך": "2026-06-01", "תיאור": "ZZWEIRD SHOP",
          "קטגוריה": "החתונה שלנו", "סכום": -500.0}],
    )
    assert _rows(sid2)[1]["קטגוריה"] == "שונות"
