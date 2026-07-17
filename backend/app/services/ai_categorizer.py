"""
AI-powered transaction categorization using Claude API.

Categorizes transactions that remain in "שונות" (miscellaneous) after
keyword-based matching, in two phases:

  Phase 1 (no web search): Claude assigns a category ONLY to merchants it
      recognizes with certainty (known chains/brands, or descriptions that
      state the business type). Everything else must be marked unknown —
      guessing from the sound of a name is explicitly forbidden.

  Phase 2 (web search REQUIRED): the unknown merchants are sent in small
      batches where Claude must run a web search per business BEFORE
      classifying. If a response shows no evidence of searching, its answers
      are discarded and those rows stay שונות — an unverified guess is worse
      than no category.
"""
import os
import re
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Categories the AI can assign (must match CATEGORY_ICONS keys in constants.py)
VALID_CATEGORIES = [
    'טיסות ותיירות',
    'הוצאות שוטפות',
    'תרופות וטיפולים',
    'פארם',
    'בילויים',
    'אוכל',
    'קניות',
    'טיפוח',
    'חוגים וספורט',
    'אירועים ומתנות',
    'טכנולוגיה',
    'הוצאות משתנות',
    'סושי',
    'העברת כספים',
    'העברה להשקעות',
    'משיכת מזומן',
    'הוראות קבע',
    'שונות',
]

_CATEGORY_MENU = """הקטגוריות האפשריות:
- טיסות ותיירות — טיסות, מלונות, השכרת רכב, הוצאות בטיול בחו"ל
- הוצאות שוטפות — שכר דירה, ארנונה, חשמל, מים, גז, אינטרנט, סלולר, סטרימינג, דלק, ביטוח, מנויים קבועים
- תרופות וטיפולים — קופות חולים, רופאים, מרפאות, בתי מרקחת, טיפולים
- פארם — רשתות פארם (סופר-פארם, גוד פארם וכד')
- בילויים — מסעדות, בתי קפה, ברים, מזון מהיר, קולנוע, הופעות, אטרקציות
- אוכל — סופרמרקטים, מכולות, חנויות מזון, משלוחי אוכל (וולט וכד'), מאפיות
- קניות — ביגוד, הנעלה, אלקטרוניקה, ריהוט, דברים לבית, קניות אונליין
- טיפוח — מספרות, קוסמטיקה, בשמים, מניקור, ספא
- חוגים וספורט — חדרי כושר, חוגים, לימודים, קורסים, ספרים, צעצועים
- אירועים ומתנות — שוברי מתנה (BuyMe וכד'), מתנות, אירועים
- טכנולוגיה — תוכנה, אפליקציות, שירותי ענן, גיימינג, כלי AI (ChatGPT, Claude, Midjourney וכו')
- הוצאות משתנות — מוניות, תחבורה ציבורית, חניה, כבישי אגרה, מוסכים וטיפולי רכב
- סושי — חיית המחמד: וטרינר, מזון לחיות, חנויות חיות
- העברת כספים — העברות בנקאיות, PayPal, Bit
- משיכת מזומן — כספומט, מזומן
- הוראות קבע — הוראות קבע
- שונות — רק אם אי אפשר לקבוע קטגוריה אחרת"""

PHASE1_SYSTEM = f"""אתה מערכת לסיווג עסקאות בנקאיות ישראליות.

{_CATEGORY_MENU}

כללים מחייבים:
1. סווג עסק רק אם אתה מזהה אותו בוודאות — רשת/מותג מוכר, או שהתיאור עצמו אומר מה סוג העסק (למשל מכיל "מסעדת", "פיצה", "מוסך", "בית מרקחת").
2. אסור לנחש לפי צליל השם. אם אינך בטוח מהו העסק — החזר עבורו {{"index": N, "unknown": true}} ואל תסווג אותו.
3. עדיף לסמן unknown מאשר לסווג לא נכון. סימון unknown אינו כישלון — עסקים כאלה ייבדקו באינטרנט בשלב נפרד.
4. החזר תמיד JSON תקין בלבד (כבלוק הטקסט האחרון בתשובה), מערך עם רשומה לכל אינדקס:
   [{{"index": 0, "category": "שם קטגוריה"}}, {{"index": 1, "unknown": true}}, ...]"""

PHASE2_SYSTEM = f"""אתה מערכת לסיווג עסקאות בנקאיות ישראליות. העסקים ברשימה כבר זוהו כלא-מוכרים — אסור לסווג אותם מהשם בלבד.

{_CATEGORY_MENU}

כללים מחייבים:
1. עבור כל עסק ברשימה אתה חייב לבצע חיפוש אינטרנט לפני הסיווג (למשל: "<שם העסק> ישראל" או "מה זה <שם העסק>"). ללא חיפוש — אין סיווג.
2. סווג לפי מה שמצאת בחיפוש. אם יש אינדיקציה סבירה — בחר את הקטגוריה הקרובה ביותר; החזר "שונות" רק כשאין שום מידע.
3. עסק שנמצא בחו"ל (מלון, מסעדה, חנות או אטרקציה — שים לב לקיצורי ערים כמו BKK, SENTOSA, HAEUNDAE) הוא הוצאת טיול → "טיסות ותיירות", לא קטגוריית סוג העסק. שירותים מקוונים שמחויבים מחו"ל אינם תיירות — סווג לפי מהות השירות.
4. שים לב לקיצורים נפוצים בעסקאות ישראליות; אפשר לנקות קידומות טכניות מהשם לפני החיפוש.
5. החזר תמיד JSON תקין בלבד (כבלוק הטקסט האחרון בתשובה), בפורמט:
   [{{"index": 0, "category": "שם הקטגוריה"}}, ...]"""

PHASE1_USER_TEMPLATE = """סווג את העסקים הבאים. סווג רק את אלה שאתה מזהה בוודאות; את כל השאר סמן unknown. החזר מערך JSON בלבד.

העסקים:
{transactions}"""

PHASE2_USER_TEMPLATE = """סווג את העסקים הבאים. חובה לחפש כל אחד מהם באינטרנט לפני הסיווג. החזר מערך JSON בלבד.

העסקים:
{transactions}"""

# Installment suffix bank-sync appends to split charges ("X (תשלום 3/12)").
# Stripped before querying so all installments of a purchase resolve together
# and the cache/web-search budget isn't wasted on duplicates.
_INSTALLMENT_RE = re.compile(r'\s*\(תשלום \d+/\d+\)\s*$')


def _base_desc(desc: str) -> str:
    return _INSTALLMENT_RE.sub('', str(desc)).strip()


AUDIT_SYSTEM = f"""אתה מערכת לאימות סיווג עסקאות בנקאיות ישראליות. אתה מקבל בתי עסק עם הסיווג הנוכחי שלהם ובודק אם הוא נכון — בית עסק אחרי בית עסק.

{_CATEGORY_MENU}

כללים מחייבים:
1. עבור כל בית עסק אתה חייב לבצע חיפוש אינטרנט לפני שאתה קובע (למשל: "<שם העסק> ישראל"). אסור לאשר או לפסול סיווג לפי צליל השם בלבד.
2. קבע לפי מה שמצאת בחיפוש. אם גם אחרי חיפוש אינך בטוח — החזר את הסיווג הנוכחי עם confidence נמוך. אל תמציא קטגוריות חדשות.
3. הענף לפי חברת האשראי (אם צוין) הוא רמז, לא הכרעה.
4. החזר תמיד JSON תקין בלבד (כבלוק הטקסט האחרון בתשובה)."""

AUDIT_PROMPT_TEMPLATE = """בדוק את הסיווג הנוכחי של בתי העסק הבאים (סיכום לכל בית עסק: שם, הסיווג הנוכחי, הענף לפי חברת האשראי אם ידוע, מספר עסקאות וסכום כולל בש"ח).

לכל בית עסק: אם הסיווג הנוכחי נכון — החזר אותו כמו שהוא. אם הוא שגוי — החזר את הקטגוריה הנכונה מהרשימה. אל תמציא קטגוריות חדשות. אם אינך בטוח, החזר את הסיווג הנוכחי עם confidence נמוך.

החזר מערך JSON בלבד (כבלוק הטקסט האחרון), בפורמט:
[{{"index": 0, "category": "שם הקטגוריה", "confidence": 0.9, "reason": "הסבר קצר בעברית"}}, ...]

בתי העסק:
{merchants}"""


# (merchant, current category) → verdict dict. The automatic background audit
# re-runs on every restore; caching verdicts keeps warm-backend reloads free.
_AUDIT_CACHE: dict[tuple[str, str], dict] = {}


def audit_merchants(items: list[dict], on_progress=None) -> Optional[list[dict]]:
    """Web-verified audit of already-categorized merchants, one by one.

    Same discipline as the categorizer's phase 2: small batches, a web search
    per merchant is MANDATORY, and a response with no search activity is
    discarded (those merchants get no verdict and will be retried later, so
    an unverified opinion never lands). Verdicts are cached per
    (merchant, current category) — the sweep converges to zero cost.

    Args:
        items: [{merchant, current, issuer, count, total}, ...]
        on_progress: optional callback(done, total) — merchants processed.

    Returns:
        [{index, category, confidence, reason}, ...] or None if AI unavailable.
    """
    if not items:
        return []

    cached_out: list[dict] = []
    fresh: list[tuple[int, dict]] = []  # (original index, item)
    for i, it in enumerate(items):
        v = _AUDIT_CACHE.get((it['merchant'], it['current']))
        if v is not None:
            cached_out.append({**v, "index": i})
        else:
            fresh.append((i, it))
    if not fresh:
        if on_progress:
            on_progress(len(items), len(items))
        return cached_out

    client = _get_client()
    if client is None:
        logger.info("AI audit skipped: ANTHROPIC_API_KEY not set")
        return None

    model = os.environ.get('AI_MODEL', 'claude-haiku-4-5-20251001')
    use_search = os.environ.get('AI_WEB_SEARCH', '1') != '0'
    if not use_search:
        # No search — no verdicts. An audit that can't verify must not guess.
        logger.info("AI audit skipped: web search disabled")
        return cached_out

    batch_size = max(1, int(os.environ.get('AI_SEARCH_BATCH', '5')))
    per_merchant = max(1, int(os.environ.get('AI_WEB_SEARCH_MAX', '2')))
    out: list[dict] = []
    done = len(cached_out)
    total = len(items)
    if on_progress:
        on_progress(done, total)

    for b_start in range(0, len(fresh), batch_size):
        batch = fresh[b_start:b_start + batch_size]
        lines = []
        for j, (_, it) in enumerate(batch):
            issuer = f", ענף לפי חברת האשראי: {it['issuer']}" if it.get('issuer') else ""
            lines.append(
                f"{j}. \"{it['merchant']}\" — סיווג נוכחי: {it['current']}{issuer}, "
                f"{it.get('count', 1)} עסקאות, {round(float(it.get('total', 0)))} ₪"
            )
        user_prompt = AUDIT_PROMPT_TEMPLATE.format(merchants="\n".join(lines))
        try:
            response = client.messages.create(
                model=model,
                max_tokens=4096,
                system=AUDIT_SYSTEM,
                messages=[{"role": "user", "content": user_prompt}],
                tools=[{
                    "type": "web_search_20250305",
                    "name": "web_search",
                    "max_uses": per_merchant * len(batch) + 1,
                }],
            )
        except Exception as e:
            # No searchless fallback — an unverified verdict is worse than none.
            logger.warning(f"AI audit batch failed, skipping: {e}")
            done += len(batch)
            if on_progress:
                on_progress(done, total)
            continue

        if not _response_searched(response):
            logger.warning("AI audit answered without searching; discarding %d verdicts", len(batch))
            done += len(batch)
            if on_progress:
                on_progress(done, total)
            continue

        try:
            results = _parse_json_array(_response_text(response))
        except Exception as e:
            logger.warning(f"AI audit JSON parse error: {e}")
            done += len(batch)
            if on_progress:
                on_progress(done, total)
            continue

        for item in results:
            idx = item.get("index")
            cat = str(item.get("category", "")).strip()
            if idx is None or cat not in VALID_CATEGORIES:
                continue
            idx = int(idx)
            if not (0 <= idx < len(batch)):
                continue
            try:
                conf = min(1.0, max(0.0, float(item.get("confidence", 0.5))))
            except (TypeError, ValueError):
                conf = 0.5
            orig_i, it = batch[idx]
            verdict = {
                "category": cat,
                "confidence": conf,
                "reason": str(item.get("reason", "")).strip(),
            }
            _AUDIT_CACHE[(it['merchant'], it['current'])] = verdict
            out.append({**verdict, "index": orig_i})
        done += len(batch)
        if on_progress:
            on_progress(done, total)

    logger.info(f"AI audit: {len(out)} fresh web-verified verdicts (+{len(cached_out)} cached)")
    return cached_out + out


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


# Per-process cache: base description → resolved category (or 'שונות' for a
# miss). The dashboard re-runs restore-session on every cold-start recovery,
# always over the same leftover "שונות" rows. Caching means a warm backend asks
# Claude about each distinct merchant at most once, instead of on every load.
_CACHE: dict[str, str] = {}


def _parse_json_array(text: str) -> list:
    """Parse the model's JSON array, tolerating markdown fences and prose."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # With web search the model may wrap the array in prose; pull out the
        # outermost [ ... ] and parse that.
        start, end = text.find('['), text.rfind(']')
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(text[start:end + 1])


def _response_text(response) -> str:
    return "".join(
        getattr(b, "text", "") for b in response.content
        if getattr(b, "type", "") == "text"
    ).strip()


def _response_searched(response) -> bool:
    """Did the model actually use web search in this response?"""
    return any(
        getattr(b, "type", "") in ("server_tool_use", "web_search_tool_result")
        for b in response.content
    )


def _merchant_line(i: int, m: dict) -> str:
    """One numbered prompt line: merchant name + issuer-sector hint if known."""
    hint = f" (ענף לפי חברת האשראי: {m['issuer']})" if m.get('issuer') else ""
    return f"{i}. {m['base']}{hint}"


def _classify_known(client, model: str, merchants: list[dict], progress=None) -> tuple[dict[str, str], list[dict]]:
    """Phase 1: no web search. Returns (resolved base→category, unknown bases).

    Merchants the model cannot identify with certainty come back as unknown —
    the prompt forbids guessing from the name.
    """
    resolved: dict[str, str] = {}
    unknown: list[str] = []
    chunk_size = 100
    for start in range(0, len(merchants), chunk_size):
        chunk = merchants[start:start + chunk_size]
        tx_lines = "\n".join(_merchant_line(i, m) for i, m in enumerate(chunk))
        try:
            response = client.messages.create(
                model=model,
                max_tokens=4096,
                system=PHASE1_SYSTEM,
                messages=[{"role": "user", "content": PHASE1_USER_TEMPLATE.format(transactions=tx_lines)}],
            )
            results = _parse_json_array(_response_text(response))
        except Exception as e:
            logger.warning(f"AI phase-1 (known merchants) failed: {e}")
            unknown.extend(chunk)
            continue

        answered: dict[int, str] = {}
        for item in results:
            idx = item.get("index")
            if idx is None or item.get("unknown"):
                continue
            cat = str(item.get("category", "")).strip()
            if cat in VALID_CATEGORIES and cat != 'שונות':
                answered[int(idx)] = cat
        for i, m in enumerate(chunk):
            if i in answered:
                resolved[m["base"]] = answered[i]
            else:
                unknown.append(m)
        if progress:
            progress(len(resolved))
    return resolved, unknown


def _classify_via_search(client, model: str, merchants: list[dict], progress=None) -> dict[str, str]:
    """Phase 2: web search is mandatory. Returns resolved base→category.

    Small batches so every merchant gets search budget. A response with no
    search activity is discarded — those merchants stay unresolved rather than
    receiving a name-based guess.
    """
    resolved: dict[str, str] = {}
    batch_size = max(1, int(os.environ.get('AI_SEARCH_BATCH', '5')))
    per_merchant = max(1, int(os.environ.get('AI_WEB_SEARCH_MAX', '2')))
    for start in range(0, len(merchants), batch_size):
        batch = merchants[start:start + batch_size]
        tx_lines = "\n".join(_merchant_line(i, m) for i, m in enumerate(batch))
        try:
            response = client.messages.create(
                model=model,
                max_tokens=4096,
                system=PHASE2_SYSTEM,
                messages=[{"role": "user", "content": PHASE2_USER_TEMPLATE.format(transactions=tx_lines)}],
                tools=[{
                    "type": "web_search_20250305",
                    "name": "web_search",
                    "max_uses": per_merchant * len(batch) + 1,
                }],
            )
        except Exception as e:
            # Web search unavailable (account/model restriction) or API error.
            # Do NOT fall back to searchless guessing — these merchants were
            # already established as unknown; a guess would be fabricated.
            logger.warning(f"AI phase-2 (web search) failed, leaving batch uncategorized: {e}")
            if progress:
                progress(len(batch))
            continue

        if not _response_searched(response):
            logger.warning(
                "AI phase-2 answered without searching; discarding %d answers", len(batch)
            )
            if progress:
                progress(len(batch))
            continue

        try:
            results = _parse_json_array(_response_text(response))
        except Exception as e:
            logger.warning(f"AI phase-2 JSON parse error: {e}")
            if progress:
                progress(len(batch))
            continue

        for item in results:
            idx = item.get("index")
            cat = str(item.get("category", "")).strip()
            if idx is None:
                continue
            idx = int(idx)
            if 0 <= idx < len(batch) and cat in VALID_CATEGORIES and cat != 'שונות':
                resolved[batch[idx]["base"]] = cat
        if progress:
            progress(len(batch))
    return resolved


def categorize_transactions(descriptions: list[str], issuers: Optional[list] = None, on_progress=None) -> Optional[dict[int, str]]:
    """
    Categorize transaction descriptions using Claude AI.

    Merchants Claude recognizes with certainty are classified directly; the
    rest are looked up online before being classified (never guessed). When
    `issuers` is given (parallel to `descriptions`), each merchant's
    card-company sector (ענף_מקור) is passed to Claude as a hint. Returns a
    dict mapping index → category name, or None if AI is unavailable.
    """
    if not descriptions:
        return {}

    client = _get_client()
    if client is None:
        logger.info("AI categorization skipped: ANTHROPIC_API_KEY not set")
        return None

    # Collapse to unique base merchants (installment suffix stripped), serving
    # cached resolutions first.
    bases = [_base_desc(d) for d in descriptions]
    to_query: list[dict] = []
    seen: set[str] = set()
    for i, b in enumerate(bases):
        if b and b not in _CACHE and b not in seen:
            seen.add(b)
            issuer = None
            if issuers and i < len(issuers) and issuers[i]:
                issuer = str(issuers[i]).strip() or None
            to_query.append({"base": b, "issuer": issuer})

    model = os.environ.get('AI_MODEL', 'claude-haiku-4-5-20251001')
    use_search = os.environ.get('AI_WEB_SEARCH', '1') != '0'

    if to_query:
        total = len(to_query)
        finalized = {"n": 0}

        def _emit(done_n):
            if on_progress:
                on_progress(min(done_n, total), total)

        _emit(0)
        resolved, unknown = _classify_known(
            client, model, to_query,
            progress=lambda resolved_n: _emit(resolved_n),
        )
        finalized["n"] = len(resolved)
        if unknown:
            if use_search:
                def _batch_done(batch_n):
                    finalized["n"] += batch_n
                    _emit(finalized["n"])
                resolved.update(_classify_via_search(client, model, unknown, progress=_batch_done))
            else:
                logger.info(
                    "AI web search disabled; %d unrecognized merchants stay שונות", len(unknown)
                )
        _emit(total)
        # Remember hits AND misses so we never re-query the same merchant.
        for m in to_query:
            _CACHE[m["base"]] = resolved.get(m["base"], 'שונות')
        via_search = sum(1 for m in unknown if m["base"] in resolved)
        logger.info(
            "AI categorized %d/%d unique merchants (%d known directly, %d via web search)",
            len(resolved), len(to_query), len(resolved) - via_search, via_search,
        )

    mapping: dict[int, str] = {}
    for i, b in enumerate(bases):
        cat = _CACHE.get(b)
        if cat and cat != 'שונות':
            mapping[i] = cat
    return mapping


# ── AI subcategory creation ─────────────────────────────────────────────
#
# Same two-phase discipline as categorization: merchants Claude recognizes
# with certainty are grouped directly; the rest MUST be web-searched before
# getting a subcategory, and answers produced without searching are discarded.
# Runs automatically after every restore (/ai-subcategorize-all), so results
# are cached per (category, merchant) — including "resolved empty" — to keep a
# warm backend from re-querying the same merchants on every page load.

SUBCAT_RULES_COMMON = """1. שם תת-קטגוריה: עברית, קצר (עד 3 מילים), בלשון רבים כשמתאים (למשל "סופרים", "מאפיות"), מתאר סוג עסק — לא עסק בודד ולא מותג.
2. עקביות מוחלטת: אותו שם בדיוק לכל בתי העסק מאותו סוג. אל תיצור שמות נרדפים (לא גם "סופרים" וגם "סופרמרקטים"), ואם קיימת תת-קטגוריה מתאימה ברשימה — השתמש בה ואל תמציא חדשה.
3. אל תיצור תת-קטגוריה חדשה סביב בית עסק בודד, אלא אם סוג העסק מובהק מהשם (למשל "מספרה")."""

SUBCAT_KNOWN_SYSTEM = f"""אתה מערכת לפילוח בתי עסק לתתי-קטגוריות בדשבורד פיננסי ישראלי. אתה מקבל קטגוריית-אב, רשימת תתי-קטגוריות קיימות ורשימת בתי עסק ששייכים לקטגוריית-האב אך ללא תת-קטגוריה.

{SUBCAT_RULES_COMMON}
4. שייך בית עסק רק אם אתה מזהה אותו בוודאות — רשת/מותג מוכר, או שהתיאור עצמו אומר מה סוג העסק. אסור לשייך לפי צליל השם: אם אינך בטוח מהו העסק — החזר {{"index": N, "unknown": true}} והוא ייבדק באינטרנט בשלב נפרד.
5. החזר תמיד JSON תקין בלבד (כבלוק הטקסט האחרון בתשובה):
   [{{"index": 0, "subcategory": "שם"}}, {{"index": 1, "unknown": true}}, ...]"""

SUBCAT_SEARCH_SYSTEM = f"""אתה מערכת לפילוח בתי עסק לתתי-קטגוריות בדשבורד פיננסי ישראלי. בתי העסק ברשימה כבר זוהו כלא-מוכרים — אסור לשייך אותם מהשם בלבד.

{SUBCAT_RULES_COMMON}
4. עבור כל בית עסק אתה חייב לבצע חיפוש אינטרנט לפני השיוך (למשל: "<שם העסק> ישראל"). שייך לפי מה שמצאת: אם יש אינדיקציה סבירה — בחר את תת-הקטגוריה הקרובה ביותר (או צור מתאימה); החזר "" (ריק) רק כשאין שום מידע.
5. החזר תמיד JSON תקין בלבד (כבלוק הטקסט האחרון בתשובה):
   [{{"index": 0, "subcategory": "שם או ריק"}}, ...]"""

SUBCAT_USER_TEMPLATE = """קטגוריית-האב: {category}

תתי-קטגוריות קיימות (העדף אותן כשמתאים): {existing}

בתי העסק (שם — מספר עסקאות, סכום כולל בש"ח):
{merchants}"""

# (category, base merchant) → subcategory ('' = resolved to "leave empty").
_SUBCAT_CACHE: dict[tuple[str, str], str] = {}


def _valid_subcategory(sub: str, category: str) -> str:
    """Sanitize a model-proposed subcategory name; '' when unusable."""
    sub = str(sub or '').strip()
    if sub in ('אחר', category) or len(sub) > 40:
        return ''
    return sub


def _subcat_lines(items: list[dict]) -> str:
    return "\n".join(
        f"{i}. \"{it['merchant']}\" — {it.get('count', 1)} עסקאות, {round(float(it.get('total', 0)))} ₪"
        for i, it in enumerate(items)
    )


def suggest_subcategories(category: str, items: list[dict], existing: list[str]) -> Optional[list[dict]]:
    """Group a category's unsubcategorized merchants into subcategories.

    Claude may reuse an existing subcategory or CREATE a new one (a short
    Hebrew type-of-business name like "סופרים"). Two phases, same no-guessing
    policy as categorization: phase 1 groups only merchants recognized with
    certainty; the rest go to phase 2 where a web search per merchant is
    mandatory and unsearched answers are discarded. Merchants that stay
    unclear come back empty and remain unsubcategorized.

    Args:
        category: the parent category (all merchants already belong to it).
        items: [{merchant, count, total}, ...]
        existing: subcategory names already available for this parent.

    Returns:
        [{index, subcategory}, ...] (subcategory may be ''), or None if AI is
        unavailable.
    """
    if not items:
        return []
    client = _get_client()
    if client is None:
        logger.info("AI subcategorization skipped: ANTHROPIC_API_KEY not set")
        return None

    model = os.environ.get('AI_MODEL', 'claude-haiku-4-5-20251001')
    use_search = os.environ.get('AI_WEB_SEARCH', '1') != '0'

    resolved: dict[int, str] = {}      # item index → subcategory
    to_query: list[int] = []
    for i, it in enumerate(items):
        cached = _SUBCAT_CACHE.get((category, it['merchant']))
        if cached is None:
            to_query.append(i)
        else:
            resolved[i] = cached

    # Names created in earlier batches are offered to later ones, so one run
    # can't mint synonyms for the same type of business.
    known_names: list[str] = list(dict.fromkeys(existing))

    def _existing_str() -> str:
        return ", ".join(known_names) if known_names else "(אין עדיין)"

    # ── Phase 1: no web search, certain merchants only ──
    unknown: list[int] = []
    chunk_size = 100
    for start in range(0, len(to_query), chunk_size):
        chunk = to_query[start:start + chunk_size]
        chunk_items = [items[i] for i in chunk]
        try:
            response = client.messages.create(
                model=model,
                max_tokens=8192,
                system=SUBCAT_KNOWN_SYSTEM,
                messages=[{"role": "user", "content": SUBCAT_USER_TEMPLATE.format(
                    category=category, existing=_existing_str(), merchants=_subcat_lines(chunk_items))}],
            )
            results = _parse_json_array(_response_text(response))
        except Exception as e:
            logger.warning(f"AI subcategory phase-1 failed: {e}")
            unknown.extend(chunk)
            continue

        answered: dict[int, str] = {}
        for item in results:
            idx = item.get("index")
            if idx is None or item.get("unknown"):
                continue
            sub = _valid_subcategory(item.get("subcategory", ""), category)
            if sub:
                answered[int(idx)] = sub
        for local_i, orig_i in enumerate(chunk):
            if local_i in answered:
                resolved[orig_i] = answered[local_i]
                if answered[local_i] not in known_names:
                    known_names.append(answered[local_i])
            else:
                unknown.append(orig_i)

    # ── Phase 2: web search mandatory for the unrecognized merchants ──
    if unknown and use_search:
        batch_size = max(1, int(os.environ.get('AI_SEARCH_BATCH', '5')))
        per_merchant = max(1, int(os.environ.get('AI_WEB_SEARCH_MAX', '2')))
        for start in range(0, len(unknown), batch_size):
            batch = unknown[start:start + batch_size]
            batch_items = [items[i] for i in batch]
            try:
                response = client.messages.create(
                    model=model,
                    max_tokens=4096,
                    system=SUBCAT_SEARCH_SYSTEM,
                    messages=[{"role": "user", "content": SUBCAT_USER_TEMPLATE.format(
                        category=category, existing=_existing_str(), merchants=_subcat_lines(batch_items))}],
                    tools=[{
                        "type": "web_search_20250305",
                        "name": "web_search",
                        "max_uses": per_merchant * len(batch) + 1,
                    }],
                )
            except Exception as e:
                # No searchless fallback — these merchants were already
                # established as unknown; a guess would be fabricated.
                logger.warning(f"AI subcategory phase-2 failed, leaving batch unassigned: {e}")
                continue
            if not _response_searched(response):
                logger.warning("AI subcategory phase-2 answered without searching; discarding %d answers", len(batch))
                continue
            try:
                results = _parse_json_array(_response_text(response))
            except Exception as e:
                logger.warning(f"AI subcategory phase-2 JSON parse error: {e}")
                continue
            for item in results:
                idx = item.get("index")
                if idx is None:
                    continue
                idx = int(idx)
                if not (0 <= idx < len(batch)):
                    continue
                sub = _valid_subcategory(item.get("subcategory", ""), category)
                if sub:
                    resolved[batch[idx]] = sub
                    if sub not in known_names:
                        known_names.append(sub)
    elif unknown:
        logger.info("AI web search disabled; %d unrecognized merchants stay unsubcategorized", len(unknown))

    # Remember hits AND misses (queried merchants only) so a warm backend
    # never re-queries the same merchant for the same category.
    for i in to_query:
        _SUBCAT_CACHE[(category, items[i]['merchant'])] = resolved.get(i, '')

    out = [{"index": i, "subcategory": resolved.get(i, '')} for i in range(len(items))]
    logger.info(
        f"AI subcategorized {sum(1 for o in out if o['subcategory'])}/{len(items)} merchants in {category}"
    )
    return out
