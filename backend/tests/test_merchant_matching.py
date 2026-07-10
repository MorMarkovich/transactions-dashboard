"""Merchant-key normalization + longest-keyword-first matching.

Rules are matched on a canonical merchant key (normalize_merchant), so a rule
saved from one descriptor variant (installment suffix, PAYPAL * prefix, case,
whitespace) hits all of them. The keyword catalog is sorted longest-first, so
the most specific keyword wins across categories. Both are mirrored in
bank-sync categorize.js — keep behavior identical.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.services.data_processor import normalize_merchant  # noqa: E402

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


def test_normalize_merchant_canonicalizes_variants():
    assert normalize_merchant("רהיטי עצמל (תשלום 4/12)") == "רהיטי עצמל"
    assert normalize_merchant("PAYPAL *SPOTIFY") == "spotify"
    assert normalize_merchant("  ZARA   TLV  ") == "zara tlv"
    assert normalize_merchant("GOOGLE *YouTubePremium") == "youtubepremium"
    assert normalize_merchant(None) == ""


def test_rule_saved_from_one_installment_hits_all_installments():
    rows = [
        {"תאריך": "2026-05-02", "תיאור": "רהיטי עצמל (תשלום 4/12)", "קטגוריה": "שונות", "סכום": -300},
        {"תאריך": "2026-06-02", "תיאור": "רהיטי עצמל (תשלום 5/12)", "קטגוריה": "שונות", "סכום": -300},
        {"תאריך": "2026-04-02", "תיאור": "רהיטי עצמל", "קטגוריה": "שונות", "סכום": -300},
    ]
    rules = [{"merchant": "רהיטי עצמל (תשלום 4/12)", "category": "עיצוב הבית"}]
    by_desc = _restore(rows, rules)
    assert by_desc["רהיטי עצמל (תשלום 4/12)"]["קטגוריה"] == "עיצוב הבית"
    assert by_desc["רהיטי עצמל (תשלום 5/12)"]["קטגוריה"] == "עיצוב הבית"
    assert by_desc["רהיטי עצמל"]["קטגוריה"] == "עיצוב הבית"


def test_rule_matches_across_processor_prefix_and_case():
    rows = [
        {"תאריך": "2026-06-01", "תיאור": "PAYPAL *NINTENDO", "קטגוריה": "שונות", "סכום": -50},
    ]
    rules = [{"merchant": "nintendo", "category": "חשמל ומחשבים"}]
    by_desc = _restore(rows, rules)
    assert by_desc["PAYPAL *NINTENDO"]["קטגוריה"] == "חשמל ומחשבים"


def test_longest_keyword_wins_across_categories():
    rows = [
        # 'רמי לוי תקשורת' (telecom) must beat the shorter 'רמי לוי' (groceries).
        {"תאריך": "2026-06-01", "תיאור": "רמי לוי תקשורת בעמ", "קטגוריה": "שונות", "סכום": -49},
        {"תאריך": "2026-06-02", "תיאור": "רמי לוי שיווק השקמה", "קטגוריה": "שונות", "סכום": -320},
    ]
    by_desc = _restore(rows)
    assert by_desc["רמי לוי תקשורת בעמ"]["קטגוריה"] == "שירותי תקשורת"
    assert by_desc["רמי לוי שיווק השקמה"]["קטגוריה"] == "מזון וצריכה"
