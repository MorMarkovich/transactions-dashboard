"""Generate bank-sync/src/categorize.js from backend/app/core/constants.py.

The bank-sync tool must categorize exactly like the backend (CLAUDE.md:
"generated to match it — keep them identical"). Historically the JS mirror was
maintained by hand; this script makes regeneration mechanical:

    cd backend && python scripts/generate_bank_sync_categorize.py

Data blocks (keywords, subcategories, issuer map, migration maps, valid
categories) come straight from constants.py; the function bodies are a static
template mirroring data_processor.py / routes.py restore ordering.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.constants import (  # noqa: E402
    CHECK_WITHDRAWAL_KEYWORDS, STANDING_ORDER_KEYWORDS,
    _CATEGORY_KEYWORDS, _EXACT_WORD_KEYWORDS,
    AI_CATEGORY, AI_SUBCATEGORY, AI_OVERRIDE_KEYWORDS,
    FOREIGN_EXEMPT_KEYWORDS, ISSUER_CATEGORY_RULES,
    CATEGORY_ICONS, SUBCATEGORY_KEYWORDS,
    CATEGORY_MIGRATION, CATEGORY_PAIR_MIGRATION,
)

OUT = Path(__file__).resolve().parents[2] / 'bank-sync' / 'src' / 'categorize.js'


def js(value, indent=0):
    """JSON is valid JS for our data shapes; ensure_ascii=False keeps Hebrew."""
    return json.dumps(value, ensure_ascii=False, indent=indent or None)


def js_obj_of_lists(d):
    lines = ['{']
    for key, val in d.items():
        lines.append(f'  {js(key)}: {js(list(val))},')
    lines.append('}')
    return '\n'.join(lines)


def js_obj_of_objs(d):
    lines = ['{']
    for parent, subs in d.items():
        lines.append(f'  {js(parent)}: {{')
        for sub, kws in subs.items():
            lines.append(f'    {js(sub)}: {js(list(kws))},')
        lines.append('  },')
    lines.append('}')
    return '\n'.join(lines)


pair_migration = {f'{c}|{s}': list(v) for (c, s), v in CATEGORY_PAIR_MIGRATION.items()}
plain_migration = {c: [v[0], v[1]] for c, v in CATEGORY_MIGRATION.items()}

content = f"""// GENERATED FILE — do not edit by hand.
// Faithful JS port of the backend keyword categorizer
// (backend/app/core/constants.py + the ordering in data_processor.py /
// routes.py restore_session). Regenerate after any constants.py change:
//     cd backend && python scripts/generate_bank_sync_categorize.py
// No AI here — the dashboard's /restore-session still runs the AI fallback +
// user category rules on top, so anything left as 'שונות' is resolved
// server-side exactly as for an uploaded file.

const CHECK_WITHDRAWAL_KEYWORDS = {js(CHECK_WITHDRAWAL_KEYWORDS)}

const STANDING_ORDER_KEYWORDS = {js(STANDING_ORDER_KEYWORDS)}

// keyword → category, in priority order. Mirrors _CATEGORY_KEYWORDS.
const CATEGORY_KEYWORDS = {js_obj_of_lists(_CATEGORY_KEYWORDS)}

// Short/ambiguous keywords needing word-boundary matching (mirrors _EXACT_WORD_KEYWORDS).
const EXACT_WORD_KEYWORDS = {js_obj_of_lists(_EXACT_WORD_KEYWORDS)}

// ── AI tools → טכנולוגיה / AI (mirrors constants.AI_OVERRIDE_KEYWORDS) ──
// Applied as an UNCONDITIONAL override so it wins over the foreign-card and
// keyword passes, matching the backend (where the AI override runs last).
export const AI_CATEGORY = {js(AI_CATEGORY)}
export const AI_SUBCATEGORY = {js(AI_SUBCATEGORY)}
const AI_OVERRIDE_KEYWORDS = {js(AI_OVERRIDE_KEYWORDS)}

// ── Old taxonomy → new taxonomy (mirrors constants.CATEGORY_MIGRATION) ──
// Stored snapshots / rules may still carry pre-2026-07 names.
const CATEGORY_PAIR_MIGRATION = {js(pair_migration, indent=2)}
const CATEGORY_MIGRATION = {js(plain_migration, indent=2)}

/**
 * Translate an old-taxonomy (category, subcategory) to the new tree.
 * Returns [newCategory, newSubcategory] where newSubcategory === null means
 * "keep the row's existing subcategory". Current names pass through.
 */
export function migrateCategory(category, subcategory = '') {{
  const cat = String(category || '').trim()
  const sub = String(subcategory || '').trim()
  const pair = CATEGORY_PAIR_MIGRATION[`${{cat}}|${{sub}}`]
  if (pair) return pair
  const plain = CATEGORY_MIGRATION[cat]
  if (plain) return plain
  return [cat, null]
}}

// ── Issuer category (ענף_מקור) → catalog category ───────────────────
// Mirrors constants.ISSUER_CATEGORY_RULES — keep identical. The card company's
// own sector name for the merchant (MAX sends it with every transaction,
// Isracard exposes it via the extra-info fetch). Weak signal: used only when
// the keyword catalog leaves שונות; user rules still override it.
// Substring match, first rule wins — specific before generic.
const ISSUER_CATEGORY_RULES = {js([list(r) for r in ISSUER_CATEGORY_RULES], indent=2)}

/**
 * Catalog category for an issuer sector name (ענף_מקור), or null.
 * Mirrors backend map_issuer_category. Substring match, first rule wins.
 */
export function categoryFromIssuer(issuerName) {{
  const s = String(issuerName || '').trim()
  if (!s || ['nan', 'none', 'null'].includes(s.toLowerCase())) return null
  for (const [needle, category] of ISSUER_CATEGORY_RULES) {{
    if (s.includes(needle)) return category
  }}
  return null
}}

// ── Valid categories (mirrors backend CATEGORY_ICONS keys) ──────────
// Rules pointing anywhere else (e.g. 'אחר' persisted by early AI runs) are
// junk and must not override the categorizer. NOTE: user-created custom
// categories (Supabase user_categories) are additionally valid — callers that
// have them should pass them via buildRuleMap's second argument.
export const VALID_CATEGORIES = new Set({js(list(CATEGORY_ICONS.keys()))})

// ── Subcategories (parent category → {{subcategory → [keywords]}}) ─────
// Mirrors constants.SUBCATEGORY_KEYWORDS. Scoped to the parent category; first
// subcategory (in insertion order) wins on a keyword hit.
const SUBCATEGORY_KEYWORDS = {js_obj_of_objs(SUBCATEGORY_KEYWORDS)}

// Flatten in insertion order, mirroring the Python dict build (first position
// kept, value overwritten on duplicate key — Map.set behaves identically).
function buildFlat(map) {{
  const flat = new Map()
  for (const [cat, kws] of Object.entries(map)) {{
    for (const kw of kws) flat.set(kw.toLowerCase().trim(), cat)
  }}
  return [...flat.entries()]
}}

// Longest keyword wins (stable sort keeps catalog order for equal lengths) —
// a more specific keyword must beat a shorter generic one regardless of which
// category was declared first, e.g. 'רמי לוי תקשורת' (telecom) over 'רמי לוי'
// (groceries). Mirrors the backend's sorted KEYWORD_TO_CATEGORY.
const KEYWORD_ENTRIES = buildFlat(CATEGORY_KEYWORDS).sort((a, b) => b[0].length - a[0].length)
const EXACT_ENTRIES = buildFlat(EXACT_WORD_KEYWORDS).sort((a, b) => b[0].length - a[0].length)

function escapeRegExp(s) {{
  return s.replace(/[.*+?^${{}}()|[\\]\\\\]/g, '\\\\$&')
}}

// Word-boundary match using the same delimiters as the backend:
// (?:^|[\\s\\-/])kw(?:$|[\\s\\-/])
function boundaryMatch(text, kw) {{
  const re = new RegExp(`(?:^|[\\\\s\\\\-/])${{escapeRegExp(kw)}}(?:$|[\\\\s\\\\-/])`)
  return re.test(text)
}}

// Foreign card transactions carry a trailing 2-letter country code after the
// city, e.g. "SHINSEGAE DEPARTMENT S SEOUL   KR". Per the user's preference,
// all overseas spend is bucketed as travel — even a merchant we'd otherwise
// recognise (a 7-Eleven abroad is trip spend). Israel's own code (IL) is
// excluded, and anything containing Hebrew is treated as domestic. Online
// services (NETFLIX.COM, AMAZON …) have no city/country trailer, so they keep
// their keyword category.
const FOREIGN_DESC = /(?:^|\\s)(?!IL(?:\\s|$))[A-Z]{{2}}\\s*$/
// Online services bill from abroad year-round ("NETFLIX.COM AMSTERDAM NL",
// "PAYPAL *SPOTIFY ... GB") — not trip spend. Mirrors FOREIGN_EXEMPT_KEYWORDS.
const FOREIGN_EXEMPT_KEYWORDS = {js(FOREIGN_EXEMPT_KEYWORDS)}

// True when the descriptor matches an exempt online service (used by retag to
// repair rows the PRE-exemption foreign rule wrongly tagged as travel).
export function isForeignExempt(description) {{
  const d = String(description || '').toLowerCase()
  return FOREIGN_EXEMPT_KEYWORDS.some((kw) => d.includes(kw))
}}
export function isForeignDescriptor(description) {{
  const s = String(description || '').trim()
  if (!s || /[\\u0590-\\u05FF]/.test(s)) return false // contains Hebrew → domestic
  const d = s.toLowerCase()
  if (FOREIGN_EXEMPT_KEYWORDS.some((kw) => d.includes(kw))) return false
  return /[A-Za-z]/.test(s) && FOREIGN_DESC.test(s)
}}

function isAiTool(description) {{
  const d = String(description || '').toLowerCase()
  return AI_OVERRIDE_KEYWORDS.some((kw) => d.includes(kw))
}}

/**
 * Categorize a single transaction description, mirroring the backend order:
 *  0. AI-tool keywords → טכנולוגיה (override, wins over foreign-card too)
 *  1. foreign card descriptor → טיסות ותיירות (override)
 *  2. Psagot → investment transfer (override)
 *  3. check-withdrawal keywords → הוצאות שוטפות (rent; subcategory שכר דירה)
 *  4. standing-order keywords → הוראות קבע (override)
 *  5. substring keyword map (only if still שונות)
 *  6. word-boundary keyword map (only if still שונות)
 *  7. else שונות
 */
export function categorize(description) {{
  const d = String(description || '').toLowerCase()
  // AI-tool override runs first so it wins over the foreign-card early-return,
  // matching the backend where the AI override is applied last (highest prio).
  if (isAiTool(d)) return AI_CATEGORY
  if (isForeignDescriptor(description)) return 'טיסות ותיירות'
  let cat = 'שונות'

  if (d.includes('פסגות') || d.includes('psagot')) cat = 'העברה להשקעות'

  for (const kw of CHECK_WITHDRAWAL_KEYWORDS) {{
    const k = kw.toLowerCase()
    const hit = k.length <= 3 ? boundaryMatch(d, k) : d.includes(k)
    if (hit) cat = 'הוצאות שוטפות'
  }}

  for (const kw of STANDING_ORDER_KEYWORDS) {{
    if (d.includes(kw.toLowerCase())) cat = 'הוראות קבע'
  }}

  if (cat === 'שונות') {{
    for (const [kw, c] of KEYWORD_ENTRIES) {{
      if (d.includes(kw)) {{ cat = c; break }}
    }}
  }}
  if (cat === 'שונות') {{
    for (const [kw, c] of EXACT_ENTRIES) {{
      if (boundaryMatch(d, kw)) {{ cat = c; break }}
    }}
  }}
  return cat
}}

/**
 * Derive the subcategory (קטגוריה_משנה) for a finalized category + description,
 * mirroring the backend `derive_subcategory` (+ the AI-tool override, which in
 * the backend also pins the subcategory). Returns '' when no seeded
 * subcategory keyword matches (or the category has no subcategories).
 */
export function subcategorize(category, description) {{
  if (category === AI_CATEGORY && isAiTool(description)) return AI_SUBCATEGORY
  const submap = SUBCATEGORY_KEYWORDS[category]
  if (!submap) return ''
  const d = String(description || '').toLowerCase()
  for (const [subName, keywords] of Object.entries(submap)) {{
    for (const kw of keywords) {{
      if (d.includes(kw.toLowerCase())) return subName
    }}
  }}
  return ''
}}

const INSTALLMENT_SUFFIX = /\\s*\\(תשלום \\d+\\/\\d+\\)\\s*$/
const PROCESSOR_PREFIX = /^(?:PAYPAL|PP|GOOGLE|FACEBK|FB)\\s*\\*\\s*/i

/**
 * Canonical merchant key for rule matching — mirrors the backend's
 * normalize_merchant, keep identical. The same purchase shows up under several
 * descriptor variants (installment suffixes, "PAYPAL *" prefixes, ragged
 * whitespace, case); a rule saved from one variant must hit all of them.
 */
export function normalizeMerchant(desc) {{
  let s = String(desc || '').trim()
  s = s.replace(INSTALLMENT_SUFFIX, '')
  s = s.replace(PROCESSOR_PREFIX, '')
  s = s.replace(/\\s+/g, ' ')
  return s.toLowerCase().trim()
}}

/**
 * Build the rule lookup keyed by canonical merchant. Later rules win on a
 * key collision (two stored variants of the same merchant). Rule categories
 * saved under the OLD taxonomy are migrated on the way in. `customCategories`
 * (names from Supabase user_categories) extend the valid set.
 */
export function buildRuleMap(rules, customCategories = []) {{
  const custom = new Set(customCategories || [])
  const map = new Map()
  for (const r of rules || []) {{
    const [cat] = migrateCategory(r.category, r.subcategory)
    map.set(normalizeMerchant(r.merchant), {{ category: cat, custom }})
  }}
  return map
}}

/**
 * Apply user-defined merchant→category overrides (canonical-merchant match),
 * mirroring restore_session. `ruleMap` must be built with buildRuleMap.
 */
export function applyRules(category, description, ruleMap) {{
  if (!ruleMap) return category
  const key = normalizeMerchant(description)
  if (!ruleMap.has(key)) return category
  // AI-tool spend is unconditional — a stale rule (junk 'אחר' or a category
  // from before the AI override existed) must not pull it out. Mirrors the
  // backend, where apply_ai_tool_override re-runs AFTER rules. Matched by
  // DESCRIPTION (not category — טכנולוגיה also holds non-AI merchants).
  if (isAiTool(description)) return category
  const entry = ruleMap.get(key)
  const ruled = typeof entry === 'string' ? entry : entry.category
  const custom = typeof entry === 'string' ? new Set() : entry.custom
  // Rule hygiene: only catalog/custom categories may be assigned (no 'אחר').
  if (!VALID_CATEGORIES.has(ruled) && !custom.has(ruled)) return category
  // The keyword catalog is the source of truth: when it has an opinion
  // (category !== שונות), a conflicting rule is stale (an old AI guess
  // persisted as a rule) and is ignored. Rules decide only merchants the
  // catalog doesn't know. Mirrors the backend restore.
  if (category !== 'שונות' && category !== ruled) return category
  return ruled
}}
"""

OUT.write_text(content, encoding='utf-8')
print(f"wrote {OUT} ({len(content.splitlines())} lines)")
