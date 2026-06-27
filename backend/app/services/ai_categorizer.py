"""
AI-powered transaction categorization using Claude API.

Uses Claude Haiku to categorize transactions that remain in "שונות" (miscellaneous)
after keyword-based matching. Sends batches of descriptions for efficient processing.
"""
import os
import json
import logging
from typing import Optional

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
    'בינה מלאכותית',
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
    'שונות',
]

SYSTEM_PROMPT = """אתה מערכת לסיווג עסקאות בנקאיות ישראליות. תפקידך לסווג כל עסקה לקטגוריה המתאימה ביותר.

הקטגוריות האפשריות:
- מזון וצריכה — סופרמרקטים, מכולות, חנויות מזון, בתי מרקחת
- מסעדות, קפה וברים — מסעדות, בתי קפה, ברים, משלוחי אוכל
- תחבורה ורכבים — תחבורה ציבורית, מוניות, חניה, דלק, רכב
- דלק, חשמל וגז — תחנות דלק, חברת חשמל, גז
- רפואה ובתי מרקחת — קופות חולים, רופאים, מרפאות, בתי מרקחת
- עירייה וממשלה — ארנונה, מסים, קנסות, שירותים ממשלתיים
- חשמל ומחשבים — אלקטרוניקה, מחשבים, סטרימינג, אפליקציות
- בינה מלאכותית — כלי AI: ChatGPT, OpenAI, Claude, Anthropic, Midjourney, Perplexity, Copilot וכו'
- אופנה — ביגוד, הנעלה, אופנה, קוסמטיקה
- עיצוב הבית — ריהוט, כלי בית, שיפוצים
- פנאי, בידור וספורט — קולנוע, הופעות, ספורט, חוגים
- ביטוח — ביטוח רכב, בריאות, חיים, דירה
- שירותי תקשורת — סלולר, אינטרנט, טלוויזיה
- העברת כספים — העברות בנקאיות, PayPal, Bit
- חיות מחמד — וטרינר, מזון לחיות, חנויות חיות
- משיכת מזומן — כספומט, מזומן
- שכר דירה — שכירות, צ'קים לשכ"ד
- הוראות קבע — הוראות קבע
- טיסות ותיירות — טיסות, מלונות, השכרת רכב, תיירות
- חינוך ולימודים — בתי ספר, אוניברסיטה, קורסים, ספרים
- מנויים ושירותים — מנויים, דמי ניהול, עמלות
- שונות — רק אם אי אפשר לקבוע קטגוריה אחרת

כללים חשובים:
1. החזר תמיד JSON תקין בלבד (כבלוק הטקסט האחרון בתשובה)
2. אם התיאור מכיל גם עברית וגם אנגלית, התייחס לשני החלקים
3. העדף קטגוריה ספציפית על פני "שונות"
4. שים לב לקיצורים נפוצים בעסקאות ישראליות
5. אם אינך מזהה את בית העסק מתוך השם, השתמש בכלי חיפוש האינטרנט כדי לברר מהו ובאיזו קטגוריה הוא — חפש את שם העסק (למשל "מה זה <שם העסק> ישראל"). השתמש בחיפוש רק עבור עסקים שאינך מכיר."""

USER_PROMPT_TEMPLATE = """סווג את העסקאות הבאות לקטגוריות. החזר מערך JSON בלבד, בפורמט:
[{{"index": 0, "category": "שם הקטגוריה"}}, ...]

העסקאות:
{transactions}"""


def _get_client():
    """Get Anthropic client, returns None if API key not configured."""
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except Exception as e:
        logger.warning(f"Failed to create Anthropic client: {e}")
        return None


# Per-process cache: description → resolved category (or 'שונות' for a miss).
# The dashboard re-runs restore-session on every cold-start recovery, always over
# the same leftover "שונות" rows. Caching means a warm backend asks Claude about
# each distinct description at most once, instead of on every page load.
_CACHE: dict[str, str] = {}


def categorize_transactions(descriptions: list[str]) -> Optional[dict[int, str]]:
    """
    Categorize a list of transaction descriptions using Claude AI.

    Args:
        descriptions: List of transaction description strings.

    Returns:
        Dict mapping index → category name, or None if AI is unavailable.
    """
    if not descriptions:
        return {}

    client = _get_client()
    if client is None:
        logger.info("AI categorization skipped: ANTHROPIC_API_KEY not set")
        return None

    # Serve from cache first; only query Claude for descriptions we've never seen.
    mapping: dict[int, str] = {}
    to_query: list[tuple[int, str]] = []  # (original index, description)
    for i, desc in enumerate(descriptions):
        cached = _CACHE.get(desc)
        if cached is None:
            to_query.append((i, desc))
        elif cached != 'שונות':
            mapping[i] = cached

    if not to_query:
        return mapping

    # Format only the uncached transactions for the prompt
    tx_lines = "\n".join(f"{i}. {desc}" for i, (_, desc) in enumerate(to_query))
    user_prompt = USER_PROMPT_TEMPLATE.format(transactions=tx_lines)

    # Web search lets Claude look up merchants it doesn't recognise from the name
    # alone (small local shops etc.). On by default; AI_WEB_SEARCH=0 disables it,
    # AI_MODEL overrides the model. If the account/model can't use the tool we
    # retry once without it so categorization still works from Claude's knowledge.
    model = os.environ.get('AI_MODEL', 'claude-haiku-4-5-20251001')
    use_search = os.environ.get('AI_WEB_SEARCH', '1') != '0'
    create_kwargs = {
        'model': model,
        'max_tokens': 4096,
        'system': SYSTEM_PROMPT,
        'messages': [{"role": "user", "content": user_prompt}],
    }
    if use_search:
        create_kwargs['tools'] = [{
            "type": "web_search_20250305",
            "name": "web_search",
            "max_uses": int(os.environ.get('AI_WEB_SEARCH_MAX', '8')),
        }]

    try:
        try:
            response = client.messages.create(**create_kwargs)
        except Exception as tool_err:
            if 'tools' not in create_kwargs:
                raise
            logger.warning(f"Web search unavailable ({tool_err}); retrying without it")
            create_kwargs.pop('tools', None)
            response = client.messages.create(**create_kwargs)

        # The reply can contain web-search tool blocks; the JSON answer is the
        # model's final text. Concatenate all text blocks and parse that.
        text = "".join(
            getattr(b, "text", "") for b in response.content
            if getattr(b, "type", "") == "text"
        ).strip()

        # Parse JSON - handle potential markdown wrapping
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        try:
            results = json.loads(text)
        except json.JSONDecodeError:
            # With web search the model may wrap the array in prose; pull out the
            # outermost [ ... ] and parse that.
            start, end = text.find('['), text.rfind(']')
            if start == -1 or end == -1 or end <= start:
                raise
            results = json.loads(text[start:end + 1])

        # Local index (into to_query) → validated category
        queried: dict[int, str] = {}
        for item in results:
            idx = item.get("index")
            cat = item.get("category", "").strip()
            if idx is not None and cat in VALID_CATEGORIES and cat != 'שונות':
                queried[int(idx)] = cat

        # Apply to the original indices and remember every result (hits AND
        # misses) so we never re-query the same description.
        for local_idx, (orig_idx, desc) in enumerate(to_query):
            cat = queried.get(local_idx)
            if cat:
                mapping[orig_idx] = cat
                _CACHE[desc] = cat
            else:
                _CACHE[desc] = 'שונות'

        logger.info(
            f"AI categorized {len(mapping)}/{len(descriptions)} "
            f"({len(to_query)} queried, {len(descriptions) - len(to_query)} from cache)"
        )
        return mapping

    except json.JSONDecodeError as e:
        logger.warning(f"AI categorization JSON parse error: {e}")
        return mapping or None
    except Exception as e:
        logger.warning(f"AI categorization failed: {e}")
        return mapping or None
