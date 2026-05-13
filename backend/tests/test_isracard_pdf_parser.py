"""
Tests for the Isracard PDF parser.

The user's real statements live outside the repo, so these tests verify
the parser's internal helpers and integration shape rather than the
full extraction (which depends on Isracard's exact PDF font/layout).
"""
import pandas as pd
import pytest

from app.services.isracard_pdf_parser import (
    _reverse_hebrew,
    _parse_subtotal,
    _is_section_change_to_domestic,
    _extract_tx,
)


def test_reverse_hebrew_pure_hebrew_reversed():
    """Pure Hebrew words from visual-order PDFs are returned in logical order."""
    assert _reverse_hebrew('תושיכר') == 'רכישות'
    assert _reverse_hebrew('ץראב') == 'בארץ'


def test_reverse_hebrew_mixed_left_alone():
    """Mixed Hebrew/Latin tokens are not reversed (would break the Latin parts)."""
    assert _reverse_hebrew('test') == 'test'
    assert _reverse_hebrew('GOOGLE') == 'GOOGLE'
    # A token containing both alphabets is preserved
    assert _reverse_hebrew('פיק.com') == 'פיק.com'


def test_parse_subtotal_extracts_billing_date():
    # Reversed Hebrew tokens as they appear in the PDF: 'סה"כ חיוב לתאריך 12/04/26 -2,268.17'
    tokens = ['כ"הס', 'בויח', 'ךיראתל', '12/04/26', '-2,268.17']
    assert _parse_subtotal(tokens) == '2026-04-12'


def test_parse_subtotal_returns_none_when_no_marker():
    assert _parse_subtotal(['some', 'random', 'words']) is None
    assert _parse_subtotal(['10/05/26', 'no', 'marker']) is None


def test_domestic_section_marker():
    # "עסקות שחויבו / זוכו - בארץ" reversed
    tokens = ['תוקסע', 'וביוחש', '/', 'וכוז', '-', 'ץראב']
    assert _is_section_change_to_domestic(tokens) is True


def test_extract_tx_foreign_row():
    # Foreign-currency row pattern: date | merchant | KRW | original | conv_date | rate | fee | ₪_charge
    tokens = ['א08/04/26', 'HELP.UB', '*TRIP', 'BER', 'U', 'KRW', '6.09', '07/04/26', '3.1420', '0.00', '19.13']
    rec = _extract_tx(tokens, in_domestic=False)
    assert rec is not None
    assert rec['תאריך עסקה'] == '2026-04-08'
    assert rec['סכום חיוב'] == 19.13
    assert rec['קטגוריה'] == 'שונות'   # default for non-domestic; categorizer will route later


def test_extract_tx_domestic_row_keeps_category():
    # Domestic row pattern: date | type | merchant ... | category | amount | amount
    # Reversed Hebrew tokens. Last Hebrew token is the Isracard category label.
    tokens = ['10/04/26', 'אל', 'גצוה', 'סוביס', 'יסקאלפ', 'הפק/תודעסמ', '45.00', '45.00']
    rec = _extract_tx(tokens, in_domestic=True)
    assert rec is not None
    assert rec['תאריך עסקה'] == '2026-04-10'
    assert rec['סכום חיוב'] == 45.00
    # Category is the reversed last Hebrew token
    assert rec['קטגוריה'] == 'מסעדות/קפה'


def test_extract_tx_returns_none_when_no_date():
    assert _extract_tx(['not', 'a', 'transaction'], in_domestic=False) is None


def test_extract_tx_returns_none_without_amount():
    assert _extract_tx(['10/04/26', 'merchant'], in_domestic=False) is None
