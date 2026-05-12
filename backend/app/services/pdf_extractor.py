"""
PDF transaction extraction using Claude.

Israeli credit-card and bank PDFs use a wide variety of layouts (Isracard,
MAX, CAL, American Express, Hapoalim, Leumi, …). Hebrew text in many of
these PDFs is extracted with reversed glyph order, multi-row entries are
common, and pdfplumber's table detector rarely finds the table grid.

Rather than write a brittle regex per issuer, this service extracts the raw
text via pdfplumber and asks Claude (the same model already used for
categorisation) to return a structured JSON list of transactions. The output
shape matches what `process_data` expects after `clean_dataframe` —
specifically: a date column, a description, and a signed amount in NIS.

If the ANTHROPIC_API_KEY is not configured, this falls back to a basic
regex extractor that handles the common "DD/MM/YY ... amount" line shape.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)


# Permissive date pattern — handles DD/MM/YY, DD/MM/YYYY, DD-MM-YY, DD.MM.YY.
_PDF_DATE_RE = re.compile(r'(?<!\d)(\d{1,2})[/\.\-](\d{1,2})[/\.\-](\d{2,4})(?!\d)')
# Permissive amount pattern — matches 12.34 / 1,234.56 / 1234 / -1,234.56.
# We require either a decimal point or a comma separator so we don't trip
# on plain integers (page numbers, etc.).
_PDF_AMOUNT_RE = re.compile(r'-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|-?\d+\.\d{2}')


SYSTEM_PROMPT = """You extract transactions from Israeli bank or credit-card PDF statements.

The user will paste the raw text extracted from a PDF. The text may have Hebrew letters in reversed visual order (left-to-right per line). You must:

1. Identify rows that represent individual transactions (a date + amount + merchant).
2. Skip totals, headers, footers, page numbers, fee breakdowns, currency conversion rate lines, and section titles.
3. For each transaction, output an object with:
   - "date": YYYY-MM-DD (interpret 2-digit years as 20YY for 00-79, 19YY for 80-99)
   - "description": merchant / description as a normal Hebrew string (reverse the glyph order if the source line is reversed)
   - "amount": signed number in NIS. NEGATIVE for expenses/charges, POSITIVE for credits/refunds/incoming transfers. Convert foreign-currency rows to the NIS bill amount when both are present.
   - "category": one of the allowed Hebrew categories below, best guess from the merchant, else "שונות"

Allowed categories:
מזון וצריכה, מסעדות קפה וברים, תחבורה ורכבים, דלק חשמל וגז, רפואה ובתי מרקחת,
עירייה וממשלה, חשמל ומחשבים, אופנה, עיצוב הבית, פנאי בידור וספורט, ביטוח,
שירותי תקשורת, העברת כספים, העברה להשקעות, חיות מחמד, משיכת מזומן, שכר דירה,
הוראות קבע, טיסות ותיירות, חינוך ולימודים, מנויים ושירותים, משכורת והכנסות,
החזרים וזיכויים, שונות

Return ONLY a JSON object {"transactions": [...]}. No prose, no markdown fences. If no transactions are found, return {"transactions": []}."""


USER_PROMPT_TEMPLATE = """Extract transactions from this statement.

Filename: {filename}

Raw extracted text:
---
{text}
---"""


def _get_client():
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except Exception as e:
        logger.warning("Failed to create Anthropic client: %s", e)
        return None


def _extract_text_pages(file_path: str) -> List[str]:
    """Return the extracted text of each page (empty string for failed pages)."""
    try:
        import pdfplumber
    except ImportError as e:
        raise ValueError(
            "PDF support not installed. Run `pip install pdfplumber>=0.11.0` "
            "in the backend venv and restart the server."
        ) from e

    pages: List[str] = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            try:
                pages.append(page.extract_text() or "")
            except Exception as e:
                logger.warning("Failed to extract page text: %s", e)
                pages.append("")
    return pages


def _parse_ai_response(text: str) -> List[dict]:
    text = text.strip()
    # Strip ``` fences if model wrapped output despite the instruction.
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    # The model sometimes prefixes a sentence before the JSON. Carve out the
    # first {...} or [...] block.
    if text and text[0] not in '{[':
        for opener, closer in (('{', '}'), ('[', ']')):
            start = text.find(opener)
            end = text.rfind(closer)
            if 0 <= start < end:
                text = text[start:end + 1]
                break

    def _try_load(candidate: str) -> Optional[list]:
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            return None
        txns = data.get("transactions") if isinstance(data, dict) else data
        return txns if isinstance(txns, list) else None

    parsed = _try_load(text)
    if parsed is not None:
        return parsed

    # Recover from a truncated response (max_tokens cutoff). Walk back to the
    # last `}` that ends a complete transaction object and re-close the array
    # / wrapper. We can rescue most of the rows that finished before the cut.
    salvaged: List[dict] = []
    try:
        # Locate the transactions array opening.
        arr_start = text.find('[')
        if arr_start < 0:
            return []
        # Trim back to the last full `}` so the partial last object is dropped.
        cut = text.rfind('}', 0, len(text))
        if cut < 0 or cut < arr_start:
            return []
        salvageable = text[arr_start:cut + 1] + ']'
        # If we trimmed inside a wrapper object, parse just the array.
        decoded = json.loads(salvageable)
        if isinstance(decoded, list):
            salvaged = decoded
    except json.JSONDecodeError as e:
        logger.warning("PDF extractor: salvage attempt failed: %s", e)

    if salvaged:
        logger.warning(
            "PDF extractor: recovered %d transactions from truncated AI response",
            len(salvaged),
        )
        return salvaged

    logger.warning("PDF extractor: AI returned non-JSON (first 200 chars): %r", text[:200])
    return []


def _call_claude(filename: str, text: str) -> Optional[List[dict]]:
    client = _get_client()
    if client is None:
        return None
    try:
        # Cap input size — Claude can handle a lot, but PDFs sometimes have
        # giant marketing pages. Trim to the most useful slice.
        if len(text) > 60_000:
            text = text[:60_000]
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            # Long statements produce >8 k JSON output. Bump well above the
            # previous 8192 cap so we don't truncate mid-array. Haiku 4.5
            # supports up to 64 k output tokens.
            max_tokens=32000,
            system=SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": USER_PROMPT_TEMPLATE.format(filename=filename, text=text),
            }],
        )
        raw = response.content[0].text
        stop_reason = getattr(response, "stop_reason", None)
        if stop_reason == "max_tokens":
            logger.warning(
                "PDF extractor: response hit max_tokens (likely truncated). "
                "Will attempt salvage of the partial JSON."
            )
        logger.info(
            "PDF extractor: Claude response (%d chars, stop=%s). First 300: %r",
            len(raw), stop_reason, raw[:300],
        )
        return _parse_ai_response(raw)
    except Exception as e:
        logger.warning("PDF extractor: AI call failed: %s", e)
        return None


def _regex_fallback(pages: List[str]) -> List[dict]:
    """Best-effort line-level extraction used when no AI key is configured.

    This is intentionally simple — it picks up lines that contain a date
    and an amount and stores them as-is for the existing pipeline. It will
    misorder Hebrew text in many credit-card PDFs; we recommend setting
    ANTHROPIC_API_KEY for clean results.
    """
    txns: List[dict] = []
    for text in pages:
        for line in text.splitlines():
            date_m = _PDF_DATE_RE.search(line)
            amts = _PDF_AMOUNT_RE.findall(line)
            if not date_m or not amts:
                continue
            d, m, y = date_m.groups()
            year = int(y)
            if year < 100:
                year += 2000 if year < 80 else 1900
            try:
                iso_date = f"{year:04d}-{int(m):02d}-{int(d):02d}"
            except ValueError:
                continue
            # Pick the largest absolute amount on the line — usually the
            # bill total in NIS for credit-card rows.
            best = max(amts, key=lambda a: abs(float(a.replace(",", ""))))
            try:
                amount = -abs(float(best.replace(",", "")))
            except ValueError:
                continue
            # Description = everything that isn't the date or amounts.
            desc = line
            for token in [date_m.group(0), *amts]:
                desc = desc.replace(token, " ")
            desc = re.sub(r'\s+', ' ', desc).strip()
            if not desc:
                desc = "לא ידוע"
            txns.append({
                "date": iso_date,
                "description": desc,
                "amount": amount,
                "category": "שונות",
            })
    return txns


def extract_pdf_transactions(file_path: str) -> pd.DataFrame:
    """Return a DataFrame with columns the clean_dataframe pipeline expects.

    The pipeline downstream is header-less by default (`detect_header_row`
    expects raw rows), so we emit a 4-column frame: date / description /
    amount / category, and put a synthetic header on row 0 so the existing
    column detectors latch onto it.
    """
    pages = _extract_text_pages(file_path)
    has_text = any(p.strip() for p in pages)
    if not has_text:
        raise ValueError(
            "PDF appears to be a scanned image (no extractable text). "
            "Export the statement as Excel/CSV from your bank or card "
            "issuer's site instead, or run OCR on the file first."
        )

    filename = os.path.basename(file_path)
    full_text = "\n\n".join(pages)
    ai_txns = _call_claude(filename, full_text)

    # Track what each path found for the diagnostic error message.
    ai_count = len(ai_txns) if ai_txns is not None else None
    regex_count = None

    txns: List[dict] = ai_txns or []
    if not txns:
        # Either no AI key, AI failed, or AI returned 0 rows. Try the regex
        # fallback so the user still gets *something* out of the PDF.
        logger.info(
            "PDF extractor: AI returned %s — running regex fallback",
            "no result" if ai_txns is None else f"{len(ai_txns)} rows",
        )
        regex_txns = _regex_fallback(pages)
        regex_count = len(regex_txns)
        if regex_txns:
            txns = regex_txns

    if not txns:
        # Surface what we tried so the user can decide how to proceed.
        detail = []
        if ai_count is None:
            detail.append("AI parser was not used (no ANTHROPIC_API_KEY)")
        else:
            detail.append(f"AI parser returned {ai_count} rows")
        detail.append(f"regex fallback returned {regex_count if regex_count is not None else 'n/a'} rows")
        raise ValueError(
            "Could not identify transactions in the PDF (" + "; ".join(detail) +
            "). The layout may not be supported yet — please share a sample so "
            "we can add a specific parser."
        )

    # Return a DataFrame with proper Hebrew column names. The upload route
    # uses this shape directly — bypassing clean_dataframe — because
    # clean_dataframe's header autodetection only fires when the header is
    # at row index > 0, and our extractor already names the columns.
    records: List[dict] = []
    for t in txns:
        if not isinstance(t, dict):
            continue
        records.append({
            'תאריך': t.get('date'),
            'תיאור': t.get('description', '') or '',
            'סכום': t.get('amount', 0),
            'קטגוריה': t.get('category', 'שונות') or 'שונות',
        })
    if not records:
        raise ValueError("PDF extractor produced no usable records")
    return pd.DataFrame(records)
