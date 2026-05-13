"""
Parser for Isracard PDF statements (ישראכרט).

Isracard exports monthly statements as PDF, not Excel. The layout is RTL
Hebrew with several quirks:

- Each transaction occupies 1–3 lines in the PDF; the per-row layout is
  position-based (no column delimiters in the byte stream).
- Hebrew text is stored in visual order, so pdfplumber returns Hebrew
  words character-reversed (e.g. "תושיכר" instead of "רכישות"). We
  reverse them back so the downstream categorizer can match keywords.
- The ₪ charge column is the leftmost visual column. After sorting
  words right-to-left within each row, that value lands at the end of
  the row's token list.
- The PDF groups transactions into batches that end with a subtotal
  line "סה"כ חיוב לתאריך DD/MM/YY <amount>". Every transaction in a
  batch is billed on that date; the line appears *after* its
  transactions, so we accumulate and back-fill once we see it.

The parser returns a DataFrame whose schema matches what `process_data`
expects from a MAX-style file (תאריך עסקה / תאריך חיוב / סכום חיוב /
שם בית העסק / קטגוריה), so the rest of the upload pipeline is unchanged.
"""
from __future__ import annotations

import re
import logging
from typing import Optional
import pandas as pd

logger = logging.getLogger(__name__)

# Match a DD/MM/YY date, optionally prefixed with a Hebrew day-of-week
# marker ('א'=Sun, 'ל'=?, etc.) that Isracard embeds before the date.
_DATE_RE = re.compile(r'^[א-ת]?(\d{2})/(\d{2})/(\d{2})$')
_BARE_DATE_RE = re.compile(r'^(\d{2})/(\d{2})/(\d{2})$')
_NUM_RE = re.compile(r'^-?[\d,]+\.\d{1,4}$')
_HEB_RE = re.compile(r'[א-ת]')

_SUBTOTAL_MARKER = 'ךיראתל'   # "לתאריך" reversed
_DOMESTIC_MARKER = 'ץראב'      # "בארץ" reversed
_BILLING_HEADER_MARKER = 'ךיתולועפ'  # "פעולותיך" reversed — appears in the page-1 statement-date line


def _reverse_hebrew(token: str) -> str:
    """Reverse the chars of a token if it's pure Hebrew (no Latin/digits).

    PDFs that embed Hebrew in visual order produce reversed strings under
    text extraction; reversing restores the logical reading order so the
    downstream keyword categorizer matches.
    """
    if not _HEB_RE.search(token):
        return token
    if any(c.isascii() and (c.isalnum() or c == '.') for c in token):
        # Mixed Hebrew/Latin: leave as-is to avoid breaking Latin words
        return token
    return token[::-1]


def _normalize_text(tokens: list[str]) -> str:
    return ' '.join(_reverse_hebrew(t) for t in tokens).strip()


def _group_into_rows(words: list[dict], y_tolerance: float = 3.0) -> list[list[dict]]:
    """Group pdfplumber words into rows by similar top-coordinate.

    Within each row, words are sorted right-to-left (descending x0), which
    matches the PDF's visual order for RTL Hebrew.
    """
    if not words:
        return []
    sorted_words = sorted(words, key=lambda w: (round(w['top']), -w['x0']))
    rows: list[list[dict]] = []
    current: list[dict] = []
    prev_top: Optional[float] = None
    for w in sorted_words:
        t = round(w['top'])
        if prev_top is None or abs(t - prev_top) <= y_tolerance:
            current.append(w)
        else:
            rows.append(current)
            current = [w]
        prev_top = t
    if current:
        rows.append(current)
    return rows


def _parse_subtotal(tokens: list[str]) -> Optional[str]:
    """If this row is a 'סה"כ חיוב לתאריך DD/MM/YY' subtotal, return YYYY-MM-DD."""
    if not any(_SUBTOTAL_MARKER in t for t in tokens):
        return None
    for t in tokens:
        m = _BARE_DATE_RE.match(t)
        if m:
            d, mo, y = m.groups()
            return f"20{y}-{mo}-{d}"
    return None


def _is_section_change_to_domestic(tokens: list[str]) -> bool:
    return any(_DOMESTIC_MARKER in t for t in tokens) and any('תוקסע' in t for t in tokens)


def _extract_tx(tokens: list[str], in_domestic: bool) -> Optional[dict]:
    """Pull a transaction record from a row's token list, if it is one."""
    if not tokens:
        return None
    # Date can appear as token[0] or token[1] (sometimes a single-char
    # weekday marker is split off as its own token).
    first = tokens[0]
    m = _DATE_RE.match(first)
    rest = tokens[1:]
    if not m:
        if len(tokens) > 1:
            m2 = _DATE_RE.match(tokens[1])
            if m2:
                m = m2
                rest = tokens[2:]
    if not m:
        return None
    d, mo, y = m.groups()
    tx_date = f"20{y}-{mo}-{d}"

    nums = [t for t in rest if _NUM_RE.match(t)]
    if not nums:
        return None

    # The ₪ charge is the leftmost-on-PDF (= last in our RTL-sorted row).
    try:
        charge = float(nums[-1].replace(',', ''))
    except ValueError:
        return None

    # Merchant = tokens between the date and the first numeric / currency-marker.
    merchant_tokens: list[str] = []
    for t in rest:
        if _NUM_RE.match(t) or t in ('₪', '$'):
            break
        merchant_tokens.append(t)
    merchant = _normalize_text(merchant_tokens) if merchant_tokens else '(unknown)'

    # In the domestic section, Isracard prints a category as the last few
    # Hebrew tokens before the numeric values. We currently fold that into
    # `merchant`; the downstream auto-categorizer will route on keywords.
    # For everything else, default to 'שונות' (= miscellaneous) so the
    # row joins the keyword-based categorizer rather than being NaN and
    # silently dropped by the dashboard's category groupby.
    category: str = 'שונות'
    if in_domestic and len(merchant_tokens) >= 2:
        candidate = _reverse_hebrew(merchant_tokens[-1])
        if _HEB_RE.search(candidate):
            category = candidate

    return {
        'תאריך עסקה': tx_date,
        'תאריך חיוב': None,            # filled later from the batch subtotal
        'סכום חיוב': charge,
        'שם בית העסק': merchant,
        'קטגוריה': category,
    }


def parse_isracard_pdf(path: str) -> pd.DataFrame:
    """Parse an Isracard PDF statement into a DataFrame matching the MAX schema."""
    try:
        import pdfplumber
    except ImportError as e:
        raise ImportError(
            "pdfplumber is required to parse Isracard PDF statements. "
            "Install it with `pip install pdfplumber`."
        ) from e

    with pdfplumber.open(path) as pdf:
        # 1) Walk pages once collecting every row's tokens + page index
        all_rows: list[list[str]] = []
        for page in pdf.pages:
            words = page.extract_words(keep_blank_chars=False)
            for row in _group_into_rows(words):
                all_rows.append([w['text'] for w in row])

    # 2) Statement-level billing date from the "פרוט פעולותיך לתאריך" line
    statement_billing: Optional[str] = None
    for tokens in all_rows:
        if any(_BILLING_HEADER_MARKER in t for t in tokens):
            for t in tokens:
                m = _BARE_DATE_RE.match(t)
                if m:
                    d, mo, y = m.groups()
                    statement_billing = f"20{y}-{mo}-{d}"
                    break
            if statement_billing:
                break

    # 3) Walk rows: accumulate transactions per batch, flushing when a
    # subtotal line provides the actual billing date for that batch.
    records: list[dict] = []
    pending: list[dict] = []   # transactions awaiting a subtotal
    in_domestic = False

    def _flush(batch_billing: Optional[str]) -> None:
        if not pending:
            return
        bd = batch_billing or statement_billing
        for r in pending:
            r['תאריך חיוב'] = bd
        records.extend(pending)
        pending.clear()

    for tokens in all_rows:
        if not tokens:
            continue
        if _is_section_change_to_domestic(tokens):
            _flush(None)
            in_domestic = True
            continue
        sub = _parse_subtotal(tokens)
        if sub is not None:
            _flush(sub)
            continue
        tx = _extract_tx(tokens, in_domestic)
        if tx is not None:
            pending.append(tx)

    # Any leftover transactions without a trailing subtotal get the statement date
    _flush(None)

    if not records:
        logger.warning("isracard_pdf_parser: no transactions extracted from %s", path)
        return pd.DataFrame(columns=['תאריך עסקה', 'תאריך חיוב', 'סכום חיוב', 'שם בית העסק', 'קטגוריה'])

    df = pd.DataFrame.from_records(records)
    logger.info(
        "isracard_pdf_parser: extracted %d rows from %s (statement billing %s)",
        len(df), path, statement_billing,
    )
    return df
