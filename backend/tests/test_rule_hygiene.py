"""Rule hygiene + foreign-billing exemptions.

Reproduces the July-2026 bug: early AI runs persisted junk rules
(category 'אחר', which isn't in the catalog) and snapshots stored rows
with that category. Rules win over the categorizer, so CLAUDE.AI charges
escaped בינה מלאכותית and the therapist's business escaped רפואה.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

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


def test_junk_rules_and_stored_junk_categories_are_repaired():
    rows = [
        {"תאריך": "2026-06-18", "תיאור": "L.B.Y GROUP", "קטגוריה": "אחר", "סכום": -2500},
        {"תאריך": "2026-05-30", "תיאור": "CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM US", "קטגוריה": "אחר", "סכום": -289.74},
        {"תאריך": "2026-05-06", "תיאור": "NETFLIX.COM AMSTERDAM NL", "קטגוריה": "אחר", "סכום": -54.9},
        {"תאריך": "2026-03-17", "תיאור": "PAYPAL *SPOTIFY*P40762 35314369001 GB", "קטגוריה": "אחר", "סכום": -23.9},
    ]
    junk_rules = [
        {"merchant": "L.B.Y GROUP", "category": "אחר"},
        {"merchant": "CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM US", "category": "אחר"},
    ]
    by_desc = _restore(rows, junk_rules)

    assert by_desc["L.B.Y GROUP"]["קטגוריה"] == "רפואה ובתי מרקחת"
    assert by_desc["L.B.Y GROUP"].get("קטגוריה_משנה") == "טיפול זוגי"
    assert by_desc["CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM US"]["קטגוריה"] == "בינה מלאכותית"
    # Online services billed from abroad are NOT trip spend
    assert by_desc["NETFLIX.COM AMSTERDAM NL"]["קטגוריה"] == "חשמל ומחשבים"
    assert by_desc["PAYPAL *SPOTIFY*P40762 35314369001 GB"]["קטגוריה"] == "חשמל ומחשבים"


def test_real_foreign_spend_still_goes_to_travel():
    rows = [
        {"תאריך": "2026-04-01", "תיאור": "SHINSEGAE DEPARTMENT S SEOUL         KR", "קטגוריה": "שונות", "סכום": -320},
    ]
    by_desc = _restore(rows)
    assert by_desc["SHINSEGAE DEPARTMENT S SEOUL         KR"]["קטגוריה"] == "טיסות ותיירות"


def test_valid_rules_still_win_but_not_over_ai_tools():
    rows = [
        {"תאריך": "2026-06-01", "תיאור": "שופרסל דיל", "קטגוריה": "שונות", "סכום": -100},
        {"תאריך": "2026-06-02", "תיאור": "OPENAI *CHATGPT", "קטגוריה": "שונות", "סכום": -80},
    ]
    rules = [
        {"merchant": "שופרסל דיל", "category": "מתנות"},          # valid manual override
        {"merchant": "OPENAI *CHATGPT", "category": "חשמל ומחשבים"},  # stale pre-AI-category rule
    ]
    by_desc = _restore(rows, rules)
    assert by_desc["שופרסל דיל"]["קטגוריה"] == "מתנות"
    assert by_desc["OPENAI *CHATGPT"]["קטגוריה"] == "בינה מלאכותית"


def test_stale_exempt_travel_rows_are_repaired():
    """Rows tagged travel by the PRE-exemption foreign rule must migrate out:
    only שונות rows are re-categorized downstream, so without the explicit
    repair they'd stay in טיסות ותיירות forever."""
    rows = [
        {"תאריך": "2026-06-06", "תיאור": "NETFLIX.COM 408-724-9160 NL", "קטגוריה": "טיסות ותיירות", "סכום": -54.9},
        {"תאריך": "2026-06-05", "תיאור": "RENDER.COM RENDER.COM US", "קטגוריה": "טיסות ותיירות", "סכום": -20.96},
        {"תאריך": "2026-06-01", "תיאור": "PAYPAL *DIGITALOCEA 4029357733 US", "קטגוריה": "טיסות ותיירות", "סכום": -20.25},
        {"תאריך": "2026-06-04", "תיאור": "ALLDEBRID MONTROUGE FR", "קטגוריה": "טיסות ותיירות", "סכום": -31.3},
        # A genuine foreign purchase stays travel.
        {"תאריך": "2026-06-02", "תיאור": "SHINSEGAE DEPARTMENT S SEOUL         KR", "קטגוריה": "טיסות ותיירות", "סכום": -320},
        # A Hebrew merchant the user might have put in travel stays put.
        {"תאריך": "2026-06-03", "תיאור": "איסתא נסיעות", "קטגוריה": "טיסות ותיירות", "סכום": -1500},
    ]
    by_desc = _restore(rows)
    assert by_desc["NETFLIX.COM 408-724-9160 NL"]["קטגוריה"] == "חשמל ומחשבים"
    assert by_desc["RENDER.COM RENDER.COM US"]["קטגוריה"] == "חשמל ומחשבים"
    assert by_desc["PAYPAL *DIGITALOCEA 4029357733 US"]["קטגוריה"] == "חשמל ומחשבים"
    assert by_desc["ALLDEBRID MONTROUGE FR"]["קטגוריה"] == "חשמל ומחשבים"
    assert by_desc["SHINSEGAE DEPARTMENT S SEOUL         KR"]["קטגוריה"] == "טיסות ותיירות"
    assert by_desc["איסתא נסיעות"]["קטגוריה"] == "טיסות ותיירות"
