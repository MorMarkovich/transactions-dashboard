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
    """Single Claude call returning a list of transaction dicts (or None on
    error / no key). Sized to one chunk — the orchestrator below splits a PDF
    into page-chunks and calls this concurrently."""
    client = _get_client()
    if client is None:
        return None
    try:
        # Hard cap per chunk — keep the prompt small so the call returns fast.
        if len(text) > 18_000:
            text = text[:18_000]
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            # 12k output is plenty for a 2–3 page chunk. Smaller cap = faster
            # response than the previous 32k single-shot.
            max_tokens=12000,
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
                "PDF extractor: chunk hit max_tokens (will salvage partial)."
            )
        logger.info(
            "PDF extractor: Claude chunk response (%d chars, stop=%s)",
            len(raw), stop_reason,
        )
        return _parse_ai_response(raw)
    except Exception as e:
        logger.warning("PDF extractor: AI call failed: %s", e)
        return None


def _chunk_pages(pages: List[str], target_chars: int = 8_000) -> List[str]:
    """Group consecutive pages into chunks under `target_chars` of text so
    each Claude call is fast and finishes well below max_tokens. Always at
    least one chunk per non-empty page sequence."""
    chunks: List[str] = []
    buf: List[str] = []
    size = 0
    for p in pages:
        if not p.strip():
            continue
        if size and size + len(p) > target_chars:
            chunks.append("\n\n".join(buf))
            buf = [p]
            size = len(p)
        else:
            buf.append(p)
            size += len(p)
    if buf:
        chunks.append("\n\n".join(buf))
    return chunks


def _call_claude_parallel(filename: str, pages: List[str]) -> Optional[List[dict]]:
    """Run one Claude extraction per page-chunk in parallel and merge results.

    Latency win: a 7-page statement that took ~45s in one shot returns in
    closer to the slowest single-chunk's latency (~8-12s) because the calls
    overlap. Total tokens billed are about the same.
    """
    if _get_client() is None:
        return None

    chunks = _chunk_pages(pages)
    if not chunks:
        return []

    # Single-chunk PDFs don't benefit from threading; just call inline.
    if len(chunks) == 1:
        return _call_claude(filename, chunks[0])

    logger.info("PDF extractor: dispatching %d parallel Claude chunks", len(chunks))
    from concurrent.futures import ThreadPoolExecutor, as_completed

    txns: List[dict] = []
    any_response = False
    # Cap workers so a 30-page PDF doesn't fire 30 concurrent Anthropic calls.
    with ThreadPoolExecutor(max_workers=min(6, len(chunks))) as pool:
        futures = {pool.submit(_call_claude, filename, c): i for i, c in enumerate(chunks)}
        for fut in as_completed(futures):
            try:
                result = fut.result()
            except Exception as e:
                logger.warning("PDF extractor: chunk failed: %s", e)
                continue
            if result is None:
                continue
            any_response = True
            txns.extend(result)

    if not any_response:
        return None  # Treat as no-AI so the fallback path runs.

    # Dedupe — chunk boundaries can overlap if the model rephrases the same row.
    # Use (date, description, amount) as the identity key.
    seen: set = set()
    deduped: List[dict] = []
    for t in txns:
        if not isinstance(t, dict):
            continue
        key = (
            str(t.get('date', '')),
            str(t.get('description', '')).strip(),
            round(float(t.get('amount', 0) or 0), 2),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(t)

    logger.info(
        "PDF extractor: %d transactions across %d chunks (deduped from %d)",
        len(deduped), len(chunks), len(txns),
    )
    return deduped


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
    ai_txns = _call_claude_parallel(filename, pages)

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
