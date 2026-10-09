"""R5: every supported upload format must load end to end, and failures must be clear Hebrew 4xx."""
import io
import re

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
HEBREW = re.compile(r"[\u0590-\u05FF]")

ROWS = [
    {"תאריך עסקה": f"{(i % 28) + 1:02d}/09/2026", "שם בית עסק": name, "סכום חיוב": 10.0 + i}
    for i, name in enumerate(["שופרסל", "רמי לוי", "סונול", "נטפליקס", "קפה גרג"] * 4)
]


def _upload(name: str, data: bytes):
    return client.post("/api/upload", files={"file": (name, io.BytesIO(data), "application/octet-stream")})


def _xlsx(df: pd.DataFrame, header=True) -> bytes:
    buf = io.BytesIO()
    df.to_excel(buf, index=False, header=header)
    return buf.getvalue()


def test_xlrd_available_for_legacy_xls():
    import xlrd  # noqa: F401


@pytest.mark.parametrize("name", ["card.xlsx", "CARD.XLSX", "Card.Xlsx"])
def test_xlsx_header_in_first_row_any_case(name):
    r = _upload(name, _xlsx(pd.DataFrame(ROWS)))
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == len(ROWS)


def test_xlsx_with_title_rows():
    body = [["פירוט עסקאות", "", ""], ["", "", ""], ["תאריך עסקה", "שם בית עסק", "סכום חיוב"]] + [
        [r["תאריך עסקה"], r["שם בית עסק"], r["סכום חיוב"]] for r in ROWS
    ]
    r = _upload("titled.xlsx", _xlsx(pd.DataFrame(body), header=False))
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == len(ROWS)


@pytest.mark.parametrize("name,encoding", [
    ("utf8.csv", "utf-8-sig"), ("cp1255.csv", "windows-1255"), ("UPPER.CSV", "utf-8"),
])
def test_csv_encodings_and_case(name, encoding):
    data = pd.DataFrame(ROWS).to_csv(index=False).encode(encoding)
    r = _upload(name, data)
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == len(ROWS)


def test_csv_semicolon_with_title_line():
    text = "דוח תנועות;;\n;;\nתאריך;תיאור;סכום\n01/09/2026;שופרסל;-120.5\n02/09/2026;משכורת;9000\n"
    r = _upload("semi.csv", text.encode("windows-1255"))
    assert r.status_code == 200, r.text
    assert r.json()["transaction_count"] == 2


@pytest.mark.parametrize("name,data", [
    ("empty.csv", b"x"),
    ("garbage.xlsx", b"not a zip"),
    ("garbage.pdf", b"%PDF-1.4 junk"),
    ("notes.txt", b"hello"),
])
def test_bad_files_get_clear_hebrew_client_error(name, data):
    r = _upload(name, data)
    assert 400 <= r.status_code < 500, r.text
    assert HEBREW.search(r.json()["detail"]), r.text
