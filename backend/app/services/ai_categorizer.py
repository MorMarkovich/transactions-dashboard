"""
AI-powered transaction classification using Claude Sonnet 4.6.

For each transaction we send the description (and amount/category-so-far) to
the model and get back:

  - category: one of the canonical Hebrew categories
  - merchant_canonical: a normalised display name so "BKG*BOOKING.COM HO",
    "BOOKING.COM HOTEL AMSTERDAM" and "HOTEL AT BOOKING.C" all collapse to
    "Booking.com". Used downstream by the merchants / recurring / anomaly
    endpoints to group spend correctly.

If ANTHROPIC_API_KEY is unset, every function returns None and the caller
falls back to the keyword-based classifier (no merchant normalisation).
"""
import os
import json
import logging
from typing import Optional, List

logger = logging.getLogger(__name__)

# Categories the AI can assign (must match CATEGORY_ICONS keys in constants.py)
VALID_CATEGORIES = [
    'מזון וצריכה',
    'מסעדות, קפה וברים',
    'תחבורה ורכבים',
    'דלק, חשמל וגז',
    'רפואה ובתי מרקחת',
    'עירייה וממשלה',
    'חשמל ומחשבים',
    'אופנה',
    'עיצוב הבית',
    'פנאי, בידור וספורט',
    'ביטוח',
    'שירותי תקשורת',
    'העברת כספים',
    'העברה להשקעות',
    'חיות מחמד',
    'משיכת מזומן',
    'שכר דירה',
    'הוראות קבע',
    'טיסות ותיירות',
    'חינוך ולימודים',
    'מנויים ושירותים',
    'משכורת והכנסות',
    'החזרים וזיכויים',
    'שונות',
]

SYSTEM_PROMPT = """You classify Israeli bank/credit-card transactions for a personal finance dashboard.

For each transaction the user sends, return:
  1. A "category" from the fixed Hebrew list below.
  2. A "merchant_canonical" — a short, normalised display name so multiple
     variants of the same merchant collapse to one bucket (e.g. "BKG*BOOKING.COM HO",
     "BOOKING.COM HOTEL AMSTERDAM" and "HOTEL AT BOOKING.C" all → "Booking.com").

Allowed categories (use these exact Hebrew strings, do not invent new ones):
- מזון וצריכה — supermarkets, groceries, food shops, pharmacies-as-grocery
- מסעדות, קפה וברים — restaurants, cafés, bars, food delivery (Wolt/10bis)
- תחבורה ורכבים — public transit, taxis, parking, car services, ride-share
- דלק, חשמל וגז — petrol stations, electricity, gas
- רפואה ובתי מרקחת — clinics, doctors, pharmacies (SuperPharm, Be), Maccabi/Clalit
- עירייה וממשלה — municipal tax (ארנונה), fines, government services
- חשמל ומחשבים — electronics, computers, software, streaming, app subscriptions
- אופנה — clothing, footwear, cosmetics, accessories
- עיצוב הבית — furniture, homewares, renovation, IKEA, ACE
- פנאי, בידור וספורט — cinema, shows, sports, gyms, leisure
- ביטוח — car / health / life / home insurance
- שירותי תקשורת — cellular, internet, TV (Hot, Yes, Bezeq, Cellcom, Partner)
- העברת כספים — bank-to-bank or person-to-person transfers, BIT, PayPal
- העברה להשקעות — investment account moves (Psagot, IBI, Migdal, etc.)
- חיות מחמד — vet, pet food, pet shops
- משיכת מזומן — ATM withdrawals, cash
- שכר דירה — rent payments, cheque draws marked as rent
- הוראות קבע — generic standing orders without a clear category
- טיסות ותיירות — flights, hotels, Airbnb, Booking, travel agencies
- חינוך ולימודים — schools, university, courses, books
- מנויים ושירותים — subscriptions and recurring service fees not in the above
- משכורת והכנסות — salary, pension, social-security stipend, refunds for work
- החזרים וזיכויים — refunds, credits, BIT incoming, cashback, returned charges
- שונות — only if you genuinely cannot place it elsewhere

Hard rules:
1. Positive-amount rows that mention "משכורת", "שכר", "salary", "pension", "פנסיה",
   "קצבה" → "משכורת והכנסות".
2. Positive-amount rows that mention "החזר", "refund", "זיכוי", "credit",
   "ביט" or are BIT incoming → "החזרים וזיכויים".
3. Investment-account transfers ("פסגות", "psagot", "IBI", "migdal", "ניירות
   ערך") → "העברה להשקעות".
4. Between-account transfers and money to people (BIT outgoing, "העברה ל...",
   "transfer to") → "העברת כספים".
5. Never use "שונות" if any of the specific categories fits even loosely.

For merchant_canonical:
- Strip processor prefixes/suffixes ("BKG*", "*", "GOOGLE*", "PYPL*", "SQ *", ...)
- Drop trailing city/country labels (e.g. "AMSTERDAM NL", "MOUNTAIN VIEW US",
  "תל אביב", "רמת גן")
- Normalise capitalisation to Title Case for English, keep Hebrew as-is
- Examples:
    "GOOGLE*GOOGLE ONE 650-2530000 US" → "Google One"
    "BKG*BOOKING.COM HO" → "Booking.com"
    "HOTEL AT BOOKING.C AMSTERDAM" → "Booking.com"
    "NETFLIX.COM AMSTERDAM NL" → "Netflix"
    "סופר פארם דיזנגוף סנטר" → "סופר פארם"
    "אל על נתיבי אויר לישראל" → "אל על"
- Same merchant under different language variants should produce the same
  canonical (Hebrew or English — be consistent within an upload).

Return ONLY a JSON object {"items": [{"index": 0, "category": "...", "merchant_canonical": "..."}, ...]}. No prose, no markdown fences."""


USER_PROMPT_TEMPLATE = """Classify these transactions. Each line is `<index> | <amount>₪ | <description>`.

Transactions:
{transactions}"""


def _get_client():
    """Return Anthropic client, or None if ANTHROPIC_API_KEY isn't configured."""
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except Exception as e:
        logger.warning("Failed to create Anthropic client: %s", e)
        return None


def _parse_items(text: str) -> List[dict]:
    """Tolerantly parse the model's JSON response."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    if text and text[0] not in '{[':
        # Carve out the first {...}/[...] block if the model added prose.
        for opener, closer in (('{', '}'), ('[', ']')):
            start = text.find(opener)
            end = text.rfind(closer)
            if 0 <= start < end:
                text = text[start:end + 1]
                break
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Truncated response — recover what we can.
        try:
            arr_start = text.find('[')
            cut = text.rfind('}', 0, len(text))
            if 0 <= arr_start < cut:
                data = json.loads(text[arr_start:cut + 1] + ']')
            else:
                return []
        except json.JSONDecodeError:
            logger.warning("AI categorizer: could not parse response (first 200): %r", text[:200])
            return []
    if isinstance(data, dict):
        data = data.get('items') or data.get('transactions') or []
    return data if isinstance(data, list) else []


def classify_transactions(
    descriptions: list[str],
    amounts: Optional[list[float]] = None,
) -> Optional[list[dict]]:
    """
    Run the AI classifier on every transaction.

    Args:
        descriptions: Raw transaction descriptions (Hebrew or English).
        amounts: Optional list of signed amounts (negative=expense, positive=
                 credit) — gives the model context for income vs refund vs
                 expense disambiguation.

    Returns:
        List of dicts {"index", "category", "merchant_canonical"} aligned to
        descriptions, OR None if the AI is unavailable.
    """
    if not descriptions:
        return []

    client = _get_client()
    if client is None:
        logger.info("AI classification skipped: ANTHROPIC_API_KEY not set")
        return None

    # Chunk to keep each call bounded.
    BATCH_SIZE = 100
    results: list[dict] = []
    for batch_start in range(0, len(descriptions), BATCH_SIZE):
        batch = descriptions[batch_start:batch_start + BATCH_SIZE]
        if amounts is not None:
            batch_amts = amounts[batch_start:batch_start + BATCH_SIZE]
            tx_lines = "\n".join(
                f"{i} | {batch_amts[i - batch_start]:.2f} | {batch[i - batch_start]}"
                for i in range(batch_start, batch_start + len(batch))
            )
        else:
            tx_lines = "\n".join(
                f"{i} | {batch[i - batch_start]}"
                for i in range(batch_start, batch_start + len(batch))
            )

        try:
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=16_000,
                system=SYSTEM_PROMPT,
                messages=[{
                    "role": "user",
                    "content": USER_PROMPT_TEMPLATE.format(transactions=tx_lines),
                }],
            )
            text = response.content[0].text
            stop_reason = getattr(response, "stop_reason", None)
            if stop_reason == "max_tokens":
                logger.warning("AI classifier: hit max_tokens; will salvage partial JSON")
            items = _parse_items(text)
            # Validate each item.
            for item in items:
                if not isinstance(item, dict):
                    continue
                idx = item.get("index")
                cat = (item.get("category") or "").strip()
                merchant = (item.get("merchant_canonical") or "").strip()
                if idx is None:
                    continue
                if cat not in VALID_CATEGORIES:
                    cat = "שונות"
                results.append({
                    "index": int(idx),
                    "category": cat,
                    "merchant_canonical": merchant or None,
                })
        except Exception as e:
            logger.warning("AI classifier: batch %d failed: %s", batch_start, e)
            # Don't abort the whole pipeline — return whatever we got.
            continue

    logger.info("AI classified %d/%d transactions", len(results), len(descriptions))
    return results


# ── Backwards-compat shim ──────────────────────────────────────────────
# Older callers expect `categorize_transactions(list) -> dict[int, str]`. The
# new pipeline calls classify_transactions() directly to also get merchant
# canonicalisation. Keep the shim so restore-session and any other legacy
# call sites continue to work without changes.
def categorize_transactions(descriptions: list[str]) -> Optional[dict[int, str]]:
    """Legacy wrapper that only returns categories (no merchant info)."""
    if not descriptions:
        return {}
    classified = classify_transactions(descriptions)
    if classified is None:
        return None
    mapping: dict[int, str] = {}
    for item in classified:
        cat = item.get("category")
        if cat and cat != "שונות":
            mapping[item["index"]] = cat
    return mapping
