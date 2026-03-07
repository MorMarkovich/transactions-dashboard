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
    'אופנה',
    'עיצוב הבית',
    'פנאי, בידור וספורט',
    'ביטוח',
    'שירותי תקשורת',
    'העברת כספים',
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
1. החזר תמיד JSON תקין בלבד
2. אם התיאור מכיל גם עברית וגם אנגלית, התייחס לשני החלקים
3. העדף קטגוריה ספציפית על פני "שונות"
4. שים לב לקיצורים נפוצים בעסקאות ישראליות"""

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

    # Format transactions for the prompt
    tx_lines = "\n".join(
        f"{i}. {desc}" for i, desc in enumerate(descriptions)
    )
    user_prompt = USER_PROMPT_TEMPLATE.format(transactions=tx_lines)

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        # Extract text from response
        text = response.content[0].text.strip()

        # Parse JSON - handle potential markdown wrapping
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        results = json.loads(text)

        # Build mapping, validating categories
        mapping: dict[int, str] = {}
        for item in results:
            idx = item.get("index")
            cat = item.get("category", "").strip()
            if idx is not None and cat in VALID_CATEGORIES and cat != 'שונות':
                mapping[int(idx)] = cat

        logger.info(f"AI categorized {len(mapping)}/{len(descriptions)} transactions")
        return mapping

    except json.JSONDecodeError as e:
        logger.warning(f"AI categorization JSON parse error: {e}")
        return None
    except Exception as e:
        logger.warning(f"AI categorization failed: {e}")
        return None
