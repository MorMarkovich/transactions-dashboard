"""Domain27: import-parsing integrity — fail-before/pass-after tests for the
silent-corruption fixtures found in the 2026-11-06 audit.

Covers:
- date/identifier columns must never be picked as the amount column
- explicit debit/credit (חובה/זכות) column pairs combine to signed amounts
- accounting parenthesized negatives parse as negative
- multi-sheet xlsx aligns sheets by header name, not position
- summary-keyword filter must not drop real transactions mentioning 'יתרה'
- CSV delimiter sniffing with CRLF + trailing blank lines
- UTF-16 CSV decoding
- sign contract: Isracard card files stay positive->expense; ambiguous mixed
  signs without a format marker are rejected, never silently guessed
- dropped-row reporting distinguishes summary/zero/invalid
"""
import io
import re

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
HEBREW = re.compile(r"[\u0590-\u05FF]")


def _upload(name: str, data: bytes):
    return client.post("/api/upload", files={"file": (name, io.BytesIO(data), "application/octet-stream")})


def _xlsx(sheets, header=True):
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        for sheet_name, df in sheets:
            df.to_excel(w, sheet_name=sheet_name, index=False, header=header)
    return buf.getvalue()


def _amounts(session_id):
    t = client.get("/api/transactions", params={"sessionId": session_id, "page": 1, "page_size": 100}).json()
    return {tx["תיאור"]: tx["סכום"] for tx in t["transactions"]}


BANK_TWO_COL_ROWS = [
    ["05/09/2026", "משכורת", "12345", None, 9500.00, 15000.00],
    ["06/09/2026", "שכירות", "12346", 5500.00, None, 9500.00],
    ["07/09/2026", "חשמל דירה", "12347", 320.75, None, 9179.25],
]
BANK_TWO_COL_HEADER = ["תאריך", "תיאור", "אסמכתא", "חובה", "זכות", "יתרה"]


@pytest.mark.parametrize("ext", ["csv", "xlsx"])
def test_bank_debit_credit_pair_columns(ext):
    """Bank exports with separate חובה/זכות columns must import signed amounts,
    never the date/reference column as amounts."""
    df = pd.DataFrame(BANK_TWO_COL_ROWS, columns=BANK_TWO_COL_HEADER)
    if ext == "xlsx":
        data = _xlsx([("Sheet1", df)])
        name = "bank.xlsx"
    else:
        data = df.to_csv(index=False).encode("utf-8-sig")
        name = "bank.csv"
    r = _upload(name, data)
    assert r.status_code == 200, r.text
    amounts = _amounts(r.json()["session_id"])
    assert amounts["משכורת"] == pytest.approx(9500.00)
    assert amounts["שכירות"] == pytest.approx(-5500.00)
    assert amounts["חשמל דירה"] == pytest.approx(-320.75)
    for v in amounts.values():
        assert abs(v) < 1_000_000, f"date/identifier column leaked into amounts: {amounts}"


def test_all_zero_charge_column_is_rejected_not_guessed():
    """An export whose סכום חיוב column is entirely zero (e.g. pending
    transactions) must be rejected clearly, never fall back to reading the
    date or card-number column as amounts."""
    text = "תאריך עסקה,שם בית עסק,סכום חיוב,מספר כרטיס\n05/09/2026,שופרסל,0,4580123456781234\n06/09/2026,רמי לוי,0,4580123456781234\n"
    r = _upload("pending.csv", text.encode("utf-8-sig"))
    assert r.status_code == 400, r.text
    assert HEBREW.search(r.json()["detail"])


def test_zero_charge_with_original_amount_still_works():
    """Positive regression: סכום חיוב all-zero but סכום עסקה מקורי populated
    must keep working via the existing fallback."""
    rows = [["05/09/2026", "שופרסל", 120.5, 0], ["06/09/2026", "רמי לוי", 88.0, 0]]
    df = pd.DataFrame(rows, columns=["תאריך עסקה", "שם בית עסק", "סכום עסקה מקורי", "סכום חיוב"])
    r = _upload("orig_amount.xlsx", _xlsx([("Sheet1", df)]))
    assert r.status_code == 200, r.text
    amounts = _amounts(r.json()["session_id"])
    assert amounts["שופרסל"] == pytest.approx(-120.5)
    assert amounts["רמי לוי"] == pytest.approx(-88.0)


def test_parenthesized_negatives_parse_negative():
    text = "תאריך;תיאור;סכום\n05/09/2026;משכורת;9,000.00\n06/09/2026;שכירות;(5,500.00)\n07/09/2026;חשמל דירה;(320.75)\n08/09/2026;ביטוח לאומי;1,234.56\n"
    r = _upload("paren.csv", text.encode("cp1255"))
    assert r.status_code == 200, r.text
    amounts = _amounts(r.json()["session_id"])
    assert amounts["שכירות"] == pytest.approx(-5500.00)
    assert amounts["חשמל דירה"] == pytest.approx(-320.75)
    assert amounts["משכורת"] == pytest.approx(9000.00)


def test_multisheet_different_column_order_aligns_by_name():
    s1 = pd.DataFrame([["05/09/2026", "שופרסל", 120.5], ["06/09/2026", "רמי לוי", 88.0]],
                      columns=["תאריך עסקה", "שם בית עסק", "סכום חיוב"])
    s2 = pd.DataFrame([["סונול", "07/09/2026", 300.0], ["פז", "08/09/2026", 250.0]],
                      columns=["שם בית עסק", "תאריך עסקה", "סכום חיוב"])
    r = _upload("multi.xlsx", _xlsx([("גיליון1", s1), ("גיליון2", s2)]))
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == 4
    amounts = _amounts(r.json()["session_id"])
    assert amounts["סונול"] == pytest.approx(-300.0)
    assert amounts["פז"] == pytest.approx(-250.0)


def test_multisheet_same_layout_regression():
    s1 = pd.DataFrame([["05/09/2026", "שופרסל", 120.5], ["06/09/2026", "רמי לוי", 88.0]],
                      columns=["תאריך עסקה", "שם בית עסק", "סכום חיוב"])
    s2 = pd.DataFrame([["07/09/2026", "סונול", 300.0], ["08/09/2026", "פז", 250.0]],
                      columns=["תאריך עסקה", "שם בית עסק", "סכום חיוב"])
    r = _upload("multi_same.xlsx", _xlsx([("גיליון1", s1), ("גיליון2", s2)]))
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == 4


def test_summary_filter_keeps_real_transaction_mentioning_yetera():
    text = "תאריך;תיאור;סכום\n05/09/2026;שופרסל;-120.5\n06/09/2026;תשלום יתרה לכרטיס;-1000\n07/09/2026;משכורת;9000\n"
    r = _upload("yetra.csv", text.encode("cp1255"))
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == 3


def test_true_summary_rows_still_dropped_and_reported():
    text = "תאריך;תיאור;סכום\n05/09/2026;שופרסל;-120.5\nסה\"כ חיוב;120.5\n"
    r = _upload("summary.csv", text.encode("cp1255"))
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == 1
    dropped = r.json().get("dropped_rows", {})
    assert dropped.get("summary", 0) >= 1


def test_semicolon_crlf_trailing_blank_lines():
    text = "תאריך;תיאור;סכום\r\n05/09/2026;שופרסל;-120.5\r\n06/09/2026;רמי לוי;-88\r\n\r\n\r\n"
    r = _upload("semi_crlf.csv", text.encode("cp1255"))
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == 2


def test_utf16_csv_decodes():
    text = "תאריך עסקה,שם בית העסק,סכום חיוב\n05/09/2026,שופרסל,120.5\n06/09/2026,רמי לוי,88.0\n"
    r = _upload("utf16.csv", text.encode("utf-16"))
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == 2


def test_isracard_positive_amounts_contract_regression():
    """Known-format regression: card file with billing-date column keeps the
    positive-amounts-become-expenses contract; a refund stays positive."""
    rows = [
        [f"{(i % 27) + 1:02d}/09/2026", f"שופרסל דיל {i}", 100.0 + i, "ש\"ח", "01/10/2026", 100.0 + i, "מזון וצריכה", ""]
        for i in range(9)
    ]
    rows.append(["07/09/2026", "החזר מס הכנסה", -50.00, "ש\"ח", "01/10/2026", -50.00, "שונות", ""])
    df = pd.DataFrame(rows, columns=["תאריך עסקה", "שם בית העסק", "סכום עסקה מקורי", "מטבע עסקה מקורי",
                                     "תאריך חיוב", "סכום חיוב", "קטגוריה", "הערות"])
    r = _upload("isracard.xlsx", _xlsx([("עסקאות", df)]))
    assert r.status_code == 200, r.text
    amounts = _amounts(r.json()["session_id"])
    assert amounts["שופרסל דיל 0"] == pytest.approx(-100.0)
    assert amounts["שופרסל דיל 5"] == pytest.approx(-105.0)
    assert amounts["החזר מס הכנסה"] == pytest.approx(50.00)


def test_signed_bank_column_contract_regression():
    """Known-format regression: single signed ₪ זכות/חובה column keeps signs."""
    text = "תאריך,תיאור תנועה,₪ זכות/חובה\n05/09/2026,משכורת,9500.00\n06/09/2026,שכירות,-5500.00\n"
    r = _upload("bank_signed.csv", text.encode("cp1255"))
    assert r.status_code == 200, r.text
    amounts = _amounts(r.json()["session_id"])
    assert amounts["משכורת"] == pytest.approx(9500.00)
    assert amounts["שכירות"] == pytest.approx(-5500.00)


def test_ambiguous_signs_rejected_not_guessed():
    """A majority-positive file with a real negative minority and NO format
    marker (no billing date, no זכות/חובה column, no income keywords) is
    ambiguous: reject clearly instead of silently picking a convention."""
    rows = [{"תאריך עסקה": f"{(i % 27) + 1:02d}/09/2026", "שם בית עסק": f"סונול תחנה {i}", "סכום": 100 + i}
            for i in range(30)]
    rows.append({"תאריך עסקה": "10/09/2026", "שם בית עסק": "סונול החזר", "סכום": -50})
    text = "תאריך עסקה,שם בית עסק,סכום\n" + "".join(
        f"{r['תאריך עסקה']},{r['שם בית עסק']},{r['סכום']}\n" for r in rows)
    r = _upload("ambiguous.csv", text.encode("utf-8-sig"))
    assert r.status_code == 400, r.text
    assert HEBREW.search(r.json()["detail"])
    assert "סימני" in r.json()["detail"] or "חיוב" in r.json()["detail"]


def test_dropped_rows_reported_by_rule():
    """Rows dropped during processing are counted by rule so the UI can warn:
    unparseable date vs zero amount vs missing/unreadable amount vs summary."""
    text = ("תאריך עסקה,שם בית עסק,סכום חיוב\n"
            "05/09/2026,שופרסל,120.5\n"
            "לא תאריך,רמי לוי,88\n"
            "06/09/2026,סונול,0\n"
            "07/09/2026,פז,\n"
            )
    r = _upload("dropped.csv", text.encode("utf-8-sig"))
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == 1
    dropped = r.json().get("dropped_rows", {})
    assert dropped.get("invalid_date", 0) == 1
    assert dropped.get("zero_amount", 0) == 1
    assert dropped.get("invalid_amount", 0) == 1


def test_ambiguous_amount_patterns_dropped_as_invalid_never_10x():
    """Financial integrity: ",5", "1,5", "1.2.3" must never emit 5/15/anything
    guessed — the rows drop and are counted invalid_amount; the valid row is intact."""
    text = ("תאריך עסקה,שם בית עסק,סכום חיוב\n"
            "05/09/2026,שופרסל,120.5\n"
            "06/09/2026,רמי לוי,\",5\"\n"
            "07/09/2026,סונול,\"1,5\"\n"
            "08/09/2026,פז,1.2.3\n")
    r = _upload("ambiguous_amounts.csv", text.encode("utf-8-sig"))
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == 1
    dropped = r.json().get("dropped_rows", {})
    assert dropped.get("invalid_amount", 0) == 3
    assert dropped.get("zero_amount", 0) == 0
    amounts = _amounts(r.json()["session_id"])
    assert amounts == {"שופרסל": pytest.approx(-120.5)}
    # no guessed 10x/100x value anywhere
    assert not any(abs(v) in (5.0, 15.0, 50.0, 150.0) for v in amounts.values())


def test_all_ambiguous_amounts_hard_400():
    """A file whose amounts are ALL ambiguous gets the clear Hebrew 400, not a
    silent empty import."""
    text = ("תאריך עסקה,שם בית עסק,סכום חיוב\n"
            "06/09/2026,רמי לוי,\"1,5\"\n"
            "07/09/2026,סונול,1.2.3\n")
    r = _upload("all_ambiguous.csv", text.encode("utf-8-sig"))
    assert r.status_code == 400, r.text
    assert HEBREW.search(r.json()["detail"])
    # שתי צורות דחייה תקינות: עמודת הסכום כולה לא-תקינה (לא זוהתה) או שהקובץ
    # נקרא ולא נשארו עסקאות תקינות — העיקר: דחייה מפורשת, לא ייבוא שקט.
    detail = r.json()["detail"]
    assert ("לא זיהינו בקובץ עמודות" in detail) or ("לא נמצאו בו עסקאות תקינות" in detail)


def test_verified_amount_conventions_unchanged():
    """Positive regression: the verified Israeli conventions must not move —
    thousands (3-digit groups), 2-digit decimal comma, both-separator formats."""
    # CSV מופרד-פסיקים: ערכים עם פסיק חייבים מירכאות. (בדיקה מקבילה עם
    # מופרד ; מכסה את הצורה הלא-מצוטטת.)
    text = ("תאריך עסקה,שם בית עסק,סכום חיוב\n"
            "05/09/2026,שופרסל,\"1,234\"\n"        # -> 1234.0
            "06/09/2026,רמי לוי,\"12,34\"\n"       # -> 12.34
            "07/09/2026,סונול,\"1234,56\"\n"      # -> 1234.56
            "08/09/2026,פז,\"1,234.56\"\n"        # -> 1234.56
            "09/09/2026,קפה גרג,\"1.234,56\"\n"  # -> 1234.56
            "10/09/2026,נטפליקס,\"1,234,567\"\n"  # -> 1234567.0
            )
    r = _upload("conventions.csv", text.encode("utf-8-sig"))
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == 6
    amounts = _amounts(r.json()["session_id"])
    assert amounts["שופרסל"] == pytest.approx(-1234.0)
    assert amounts["רמי לוי"] == pytest.approx(-12.34)
    assert amounts["סונול"] == pytest.approx(-1234.56)
    assert amounts["פז"] == pytest.approx(-1234.56)
    assert amounts["קפה גרג"] == pytest.approx(-1234.56)
    assert amounts["נטפליקס"] == pytest.approx(-1234567.0)
    assert "dropped_rows" not in r.json()
