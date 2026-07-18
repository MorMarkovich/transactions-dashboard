"""
API routes for transactions dashboard
"""
import uuid
import os
import math
from typing import Optional, Any
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
import json as _json
import datetime as _dt
from pydantic import BaseModel, field_validator
from fastapi.responses import FileResponse, StreamingResponse
import pandas as pd
import numpy as np
from io import BytesIO

from ..services.data_loader import load_transaction_file
from ..services.data_processor import (
    process_data, clean_dataframe,
    apply_unconditional_overrides, apply_ai_tool_override, derive_subcategory,
    apply_issuer_category, normalize_merchant, apply_trip_window_heuristic,
    compute_txn_keys, txn_fingerprint, locked_mask, apply_category_migration,
)
from ..core.constants import (
    CREDIT_CARD_PAYMENT_KEYWORDS, KEYWORD_TO_CATEGORY, EXACT_WORD_KEYWORDS,
    CATEGORY_ICONS, SUBCATEGORY_ICONS, get_subcategory_catalog,
    AI_CATEGORY, AI_SUBCATEGORY, AI_SUBCATEGORIZE_SKIP, migrate_category,
)
from ..services.ai_categorizer import categorize_transactions, audit_merchants, suggest_subcategories
from ..services.chart_generator import (
    create_donut_chart,
    create_monthly_bars,
    create_weekday_chart,
    create_trend_chart
)
from ..services.export_service import export_to_excel
from ..utils.validators import detect_amount_column, find_column

router = APIRouter()

# Background-AI progress per session, read by GET /ai-progress so the UI can
# show a live "categorizing… n/m" meter. In-memory like `sessions` (wiped on
# cold start — the meter simply restarts with the next background run).
AI_PROGRESS: dict[str, dict] = {}

# User-created categories per session (the dynamic part of the taxonomy).
# Passed into /restore-session by the frontend (from Supabase user_categories)
# and honored everywhere a category is validated. In-memory like `sessions`.
SESSION_CUSTOM_CATS: dict[str, set] = {}


def _valid_categories(session_id: Optional[str] = None) -> set:
    """Catalog categories ∪ the session's user-created categories."""
    valid = set(CATEGORY_ICONS)
    if session_id:
        valid |= SESSION_CUSTOM_CATS.get(session_id, set())
    return valid


@router.get("/ai-progress")
async def get_ai_progress(sessionId: str = Query(...)):
    """Live progress of the background AI chain (categorize → subcategorize).

    Stages: idle | categorizing | categorized | subcategorizing | done.
    done/total count merchants (categorize) or categories (subcategorize)."""
    return AI_PROGRESS.get(sessionId) or {"stage": "idle", "done": 0, "total": 0, "detail": ""}


@router.get("/test")
async def test():
    return {"status": "ok"}

# In-memory storage for sessions (in production, use Redis or database)
sessions: dict[str, pd.DataFrame] = {}

# Directory for uploaded files
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload and process transaction file"""
    file_path = None
    try:
        # Save file temporarily
        file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Load and process file (ensure file is closed before processing)
        df_raw = load_transaction_file(file_path)
        df_clean = clean_dataframe(df_raw)
        
        # Detect columns
        date_col = find_column(df_clean, ['תאריך עסקה', 'תאריך', 'date', 'Date'])
        amount_col = detect_amount_column(df_clean)
        desc_col = find_column(df_clean, ['שם בית העסק', 'שם בית עסק', 'תיאור', 'תיאור התנועה', 'description', 'merchant'])
        cat_col = find_column(df_clean, ['קטגוריה', 'category', 'Category'])
        billing_date_col = find_column(df_clean, ['תאריך חיוב', 'תאריך_חיוב', 'Billing Date', 'billing date', 'תאריך חיוב:', 'יום ערך'])

        if not date_col or not amount_col or not desc_col:
            # Clean up before raising error
            if file_path and os.path.exists(file_path):
                try:
                    import time
                    time.sleep(0.1)  # Small delay to ensure file is closed
                    os.remove(file_path)
                except:
                    pass
            raise HTTPException(
                status_code=400,
                detail=f"Required columns not found. Found columns: {list(df_clean.columns)}"
            )

        # Process data
        df = process_data(df_clean, date_col, amount_col, desc_col, cat_col, billing_date_col)
        
        if df.empty:
            # Clean up before raising error
            if file_path and os.path.exists(file_path):
                try:
                    import time
                    time.sleep(0.1)
                    os.remove(file_path)
                except:
                    pass
            raise HTTPException(status_code=400, detail="No valid transactions found")
        
        # Create session
        session_id = str(uuid.uuid4())
        sessions[session_id] = df
        
        # Clean up temp file (with delay to ensure pandas closed it)
        if file_path and os.path.exists(file_path):
            try:
                import time
                time.sleep(0.2)  # Wait for pandas to fully close the file
                os.remove(file_path)
            except PermissionError:
                # If still locked, try again after a longer delay
                import time
                time.sleep(0.5)
                try:
                    os.remove(file_path)
                except:
                    pass  # Ignore if still can't delete
        
        return {
            "success": True,
            "message": f"Loaded {len(df)} transactions",
            "session_id": session_id,
            "transaction_count": len(df)
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        import time
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        if file_path and os.path.exists(file_path):
            try:
                time.sleep(0.2)  # Wait before trying to delete
                os.remove(file_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=error_detail)


class CategoryRule(BaseModel):
    """User-defined override: any transaction whose merchant matches this
    rule should be classified under `category` (and optionally `subcategory`)
    regardless of what the keyword/AI categorizer produced."""
    merchant: str
    category: str
    subcategory: Optional[str] = None


class TransactionOverride(BaseModel):
    """Single-transaction pin ("אל תשנה עסקאות דומות"): applies to exactly one
    row, matched by its stable fingerprint, and outranks everything —
    unconditional overrides, the keyword catalog, merchant rules and the AI."""
    txn_key: str
    category: str
    subcategory: Optional[str] = None


class TransactionNote(BaseModel):
    """User note on one transaction, matched by its stable fingerprint."""
    txn_key: str
    note: str


class RestoreSessionRequest(BaseModel):
    transactions: list[Any]
    # Optional user-defined merchant→category overrides. Applied AFTER
    # the keyword/AI categorizer runs so they always win.
    category_rules: list[CategoryRule] = []
    # Optional single-transaction overrides, applied last (they beat rules).
    transaction_overrides: list[TransactionOverride] = []
    # Per-transaction user notes (Supabase transaction_notes), matched by
    # fingerprint and written into הערות.
    transaction_notes: list[TransactionNote] = []
    # User-created categories (Supabase user_categories) — the dynamic part
    # of the taxonomy. Treated as valid alongside CATEGORY_ICONS everywhere.
    custom_categories: list[str] = []

    @field_validator('transactions', mode='before')
    @classmethod
    def parse_if_string(cls, v: Any) -> Any:
        if isinstance(v, str):
            return _json.loads(v)
        return v

    @field_validator('category_rules', mode='before')
    @classmethod
    def parse_rules_if_string(cls, v: Any) -> Any:
        if isinstance(v, str):
            return _json.loads(v)
        return v or []

    @field_validator('transaction_overrides', mode='before')
    @classmethod
    def parse_overrides_if_string(cls, v: Any) -> Any:
        if isinstance(v, str):
            return _json.loads(v)
        return v or []

    @field_validator('custom_categories', mode='before')
    @classmethod
    def parse_custom_if_string(cls, v: Any) -> Any:
        if isinstance(v, str):
            return _json.loads(v)
        return v or []

    @field_validator('transaction_notes', mode='before')
    @classmethod
    def parse_notes_if_string(cls, v: Any) -> Any:
        if isinstance(v, str):
            return _json.loads(v)
        return v or []


class UpdateTransactionNoteRequest(BaseModel):
    session_id: str
    transaction_id: int
    notes: Optional[str] = None


class UpdateTransactionCategoryRequest(BaseModel):
    session_id: str
    transaction_id: int
    category: str
    # "אל תשנה סיווג של עסקאות דומות": apply to this row only and pin it, so
    # no merchant rule / catalog pass / AI can retag it — now or on restore.
    only_this: bool = False


class UpdateTransactionSubcategoryRequest(BaseModel):
    session_id: str
    transaction_id: int
    subcategory: str
    only_this: bool = False


class BulkUpdateCategoryRequest(BaseModel):
    """Move several selected transactions to one category at once."""
    session_id: str
    transaction_ids: list[int]
    category: str
    subcategory: Optional[str] = None
    only_this: bool = False


class RenameCategoryRequest(BaseModel):
    session_id: str
    old_category: str
    new_category: str


@router.post("/restore-session")
async def restore_session(body: RestoreSessionRequest):
    """Restore a backend session from saved transaction JSON data."""
    if not body.transactions:
        raise HTTPException(status_code=400, detail="No transactions provided")

    try:
        df = pd.DataFrame(body.transactions)

        # Parse date column
        if 'תאריך' in df.columns:
            df['תאריך'] = pd.to_datetime(df['תאריך'], errors='coerce')

        # Parse billing date column if present
        if 'תאריך_חיוב' in df.columns:
            df['תאריך_חיוב'] = pd.to_datetime(df['תאריך_חיוב'], errors='coerce')

        # Ensure numeric columns
        if 'סכום' in df.columns:
            df['סכום'] = pd.to_numeric(df['סכום'], errors='coerce')

        # Compute derived columns if missing
        if 'סכום_מוחלט' not in df.columns and 'סכום' in df.columns:
            df['סכום_מוחלט'] = df['סכום'].abs()
        elif 'סכום_מוחלט' in df.columns:
            df['סכום_מוחלט'] = pd.to_numeric(df['סכום_מוחלט'], errors='coerce')

        if 'יום_בשבוע' not in df.columns and 'תאריך' in df.columns:
            df['יום_בשבוע'] = df['תאריך'].dt.dayofweek

        if 'חודש_חיוב' not in df.columns and 'תאריך_חיוב' in df.columns:
            df['חודש_חיוב'] = df['תאריך_חיוב'].dt.strftime('%m/%Y')

        # ── Deduplicate transactions ────────────────────────────────────
        # Only remove rows that match on ALL three fields (date + amount +
        # description).  Requiring the description prevents dropping
        # legitimate different transactions that happen to share the same
        # date and amount.
        original_count = len(df)
        dedup_cols = ['תאריך', 'סכום', 'תיאור']

        if all(c in df.columns for c in dedup_cols):
            df = df.drop_duplicates(subset=dedup_cols, keep='first').reset_index(drop=True)

        duplicates_removed = original_count - len(df)

        # ── Auto-categorize "שונות" by description keywords ──────────
        ai_categorized: list[dict] = []  # merchant→category the AI resolved (returned for persistence)
        custom_cats = {
            str(c).strip() for c in (body.custom_categories or []) if str(c).strip()
        }
        valid_cats = set(CATEGORY_ICONS) | custom_cats
        if 'קטגוריה' in df.columns and 'תיאור' in df.columns:
            # Old-taxonomy snapshots (pre-2026-07 category names) are migrated
            # in place FIRST — otherwise the hygiene pass below would wipe them
            # all to שונות.
            apply_category_migration(df)

            # Snapshot hygiene: stored categories that aren't in the catalog
            # or the user's own custom list (e.g. 'אחר' persisted by early AI
            # runs) are reset to שונות so the keyword pass below
            # re-categorizes them from scratch.
            invalid_cat = ~df['קטגוריה'].astype(str).isin(valid_cats)
            if invalid_cat.any():
                df.loc[invalid_cat, 'קטגוריה'] = 'שונות'

            # Unconditional overrides (Psagot, foreign-card, AI tools) run on ALL
            # rows. Shared helper so this path matches the upload pipeline — and
            # so AI-tool charges that arrived already tagged 'חשמל ומחשבים'
            # migrate to 'בינה מלאכותית' here without a bank-sync re-pull.
            apply_unconditional_overrides(df)
            desc_lower = df['תיאור'].str.lower()
            misc_mask = df['קטגוריה'] == 'שונות'
            # The catalog is the source of truth for EXPENSE rows, not just
            # שונות: a stored category that contradicts a current keyword hit
            # is stale (an old catalog version or an old AI guess baked into
            # the snapshot — mergeSnapshots never overwrites stored fields, so
            # e.g. "סיטי מרקט" pinned to משיכת מזומן would stay wrong forever).
            # Rows the catalog has no opinion on keep their stored category,
            # income rows are never touched, and user rules — applied below —
            # still win over everything.
            expense_mask = (
                df['סכום'] < 0 if 'סכום' in df.columns
                else pd.Series(False, index=df.index)
            )
            eligible = misc_mask | expense_mask
            catalog_known_mask = pd.Series(False, index=df.index)
            if eligible.any():
                # Shrinking scan: each row stops at its first (= longest,
                # KEYWORD_TO_CATEGORY is sorted longest-first) keyword hit.
                remaining = desc_lower[eligible]
                for kw, cat in KEYWORD_TO_CATEGORY.items():
                    if remaining.empty:
                        break
                    hit = remaining.str.contains(kw, na=False, regex=False)
                    if hit.any():
                        hit_idx = remaining.index[hit]
                        changed_idx = hit_idx[df.loc[hit_idx, 'קטגוריה'] != cat]
                        df.loc[changed_idx, 'קטגוריה'] = cat
                        # A stale subcategory belonged to the old category.
                        if 'קטגוריה_משנה' in df.columns and len(changed_idx):
                            df.loc[changed_idx, 'קטגוריה_משנה'] = ''
                        remaining = remaining[~hit]
                for kw, cat in EXACT_WORD_KEYWORDS.items():
                    if remaining.empty:
                        break
                    pattern = r'(?:^|[\s\-/])' + kw + r'(?:$|[\s\-/])'
                    hit = remaining.str.contains(pattern, na=False, regex=True)
                    if hit.any():
                        hit_idx = remaining.index[hit]
                        changed_idx = hit_idx[df.loc[hit_idx, 'קטגוריה'] != cat]
                        df.loc[changed_idx, 'קטגוריה'] = cat
                        if 'קטגוריה_משנה' in df.columns and len(changed_idx):
                            df.loc[changed_idx, 'קטגוריה_משנה'] = ''
                        remaining = remaining[~hit]
                # Rows the scan resolved: the catalog KNOWS these merchants.
                catalog_known_mask = eligible & ~df.index.isin(remaining.index)

            # Issuer classification (ענף_מקור, stored by bank-sync): the card
            # company's own sector fills whatever the keyword catalog left in
            # שונות. Weaker than user rules (applied below, they overwrite) and
            # cheaper than the AI fallback (fewer Claude queries).
            apply_issuer_category(df)

            # Trip-window sweep: latin-only שונות rows within ±3 days of
            # confirmed overseas spend are the same trip (truncated country
            # suffix). Before rules (they can override) and before the AI.
            apply_trip_window_heuristic(df)

            # Apply user-defined merchant→category rules BEFORE the AI step, so
            # rule-covered merchants — including ones the AI resolved on an
            # earlier load and we persisted as rules — are no longer "שונות" and
            # the AI skips them. The CATEGORY part of a rule applies only where
            # the keyword catalog is silent: a rule contradicting a catalog hit
            # is stale (an old AI guess persisted as a rule — e.g. a minimarket
            # pinned to משיכת מזומן) and must not resurrect the wrong category.
            # The SUBCATEGORY part always applies (manual refinements).
            if body.category_rules:
                # Match rules on the canonical merchant key, not the raw
                # descriptor: a rule saved from "רהיטים (תשלום 3/12)" must hit
                # every installment, and "PAYPAL *SPOTIFY" must hit the bare
                # variant too.
                desc_norm = df['תיאור'].astype(str).map(normalize_merchant)
                for r in body.category_rules:
                    if not r.merchant:
                        continue
                    # Rules saved under the OLD taxonomy are translated on the
                    # fly (the frontend also migrates them in Supabase, this is
                    # the safety net for un-migrated callers).
                    rule_cat, migrated_sub = migrate_category(
                        r.category, getattr(r, 'subcategory', None))
                    rule_sub = getattr(r, 'subcategory', None)
                    if migrated_sub is not None:
                        rule_sub = migrated_sub or None
                    # Rule hygiene: only catalog/custom categories may be
                    # assigned. Early AI runs persisted junk like 'אחר';
                    # honoring those would permanently override the real
                    # categorizer.
                    if rule_cat and rule_cat not in valid_cats:
                        continue
                    rmask = desc_norm == normalize_merchant(r.merchant)
                    if not rmask.any():
                        continue
                    if rule_cat:
                        df.loc[rmask & ~catalog_known_mask, 'קטגוריה'] = rule_cat
                    # Manual subcategory override (preserved over keyword
                    # derivation below). Scoped to the rule's parent category:
                    # if the row ended up in a DIFFERENT category (catalog
                    # repair, override), the old subcategory no longer belongs
                    # ("שוברי מזון" must not appear under הוצאות משתנות).
                    if rule_sub:
                        if 'קטגוריה_משנה' not in df.columns:
                            df['קטגוריה_משנה'] = ''
                        sub_mask = rmask
                        if rule_cat:
                            sub_mask = rmask & (df['קטגוריה'].astype(str) == rule_cat)
                        df.loc[sub_mask, 'קטגוריה_משנה'] = rule_sub

            # AI-tool spend is unconditional — re-assert it AFTER rules so a
            # stale rule (e.g. Claude → 'חשמל ומחשבים' from before the category
            # existed) can never pull those charges out of בינה מלאכותית.
            apply_ai_tool_override(df)

            # AI categorization for remaining "שונות" rows is NOT run here —
            # it blocks the first paint for many seconds (Claude + web search).
            # The frontend calls POST /ai-categorize right after this restore
            # returns; results are applied to the live session and persisted
            # as rules client-side, so each merchant is resolved only once.

            # Derive subcategories from the finalized category (after overrides,
            # keyword pass, user rules and AI). Rule/manual subcategories set
            # above are preserved (derive only fills empty ones).
            derive_subcategory(df)

        # (User-defined category rules are applied above, before the AI step,
        # so rule-covered merchants skip the web search — see that block.)

        # ── Remove credit-card bill payments from bank statement rows ──
        # When the user uploads both a bank file and a credit-card file,
        # the bank file contains a lump-sum payment to the card company
        # (e.g. "ישראכרט חיוב ₪5,376") while the card file already lists
        # all the individual charges.  Keeping both would double-count.
        cc_payments_removed = 0
        has_billing_date = 'תאריך_חיוב' in df.columns
        has_desc = 'תיאור' in df.columns
        if has_billing_date and has_desc:
            # Identify bank-statement rows. Newer uploads carry an explicit
            # _is_bank_row marker that survives concat + Supabase round-trip.
            # Older uploads (saved before that marker was added) fall back
            # to the legacy heuristic: bank rows had NaT for תאריך_חיוב.
            if '_is_bank_row' in df.columns:
                is_bank_row = df['_is_bank_row'].fillna(False).astype(bool)
            else:
                is_bank_row = df['תאריך_חיוב'].isna()

            has_cc_rows = (~is_bank_row).any()
            has_bank_rows = is_bank_row.any()

            if has_cc_rows and has_bank_rows:
                # Among bank-statement rows, drop outbound card-company
                # payments only. Positive rows can be legitimate income or
                # refunds (for example salary paid via Isracard) and must stay.
                desc_lower = df['תיאור'].str.lower()
                is_cc_payment = desc_lower.str.contains(
                    '|'.join(CREDIT_CARD_PAYMENT_KEYWORDS),
                    na=False,
                )
                is_outbound_payment = (
                    df['סכום'] < 0
                    if 'סכום' in df.columns
                    else pd.Series(False, index=df.index)
                )
                cc_payment_mask = is_bank_row & is_outbound_payment & is_cc_payment
                cc_payments_removed = int(cc_payment_mask.sum())
                if cc_payments_removed > 0:
                    df = df[~cc_payment_mask].reset_index(drop=True)

        # ── Backfill billing date for legacy bank rows ──
        # Pre-value-date-fix bank uploads still have תאריך_חיוב = NaT.
        # Coalesce them with תאריך so all rows show up consistently in
        # billing-date views. Must run AFTER the cc-payment dedup above
        # (which can no longer rely on isna() but still uses the explicit
        # marker for new uploads).
        if 'תאריך_חיוב' in df.columns and 'תאריך' in df.columns:
            df['תאריך_חיוב'] = df['תאריך_חיוב'].fillna(df['תאריך'])
            df['חודש_חיוב'] = df['תאריך_חיוב'].dt.strftime('%m/%Y')

        # Ensure notes column exists
        if 'הערות' not in df.columns:
            df['הערות'] = None

        # Ensure stable id column exists and is integer-typed
        if 'id' not in df.columns:
            df['id'] = pd.Series(range(len(df)), dtype='int64')
        else:
            df['id'] = pd.to_numeric(df['id'], errors='coerce')
            if df['id'].isna().any():
                missing_mask = df['id'].isna()
                df.loc[missing_mask, 'id'] = df.index[missing_mask]
            df['id'] = df['id'].astype('int64')

        # ── Single-transaction overrides (highest precedence) ──────────
        # "אל תשנה סיווג של עסקאות דומות": pins saved per fingerprint in
        # Supabase (transaction_overrides) and passed in by the frontend.
        # Applied dead last so they beat unconditional overrides, the
        # catalog, merchant rules AND the AI — and the _locked flag keeps
        # every later pass (rules, audit, subcategorizer) off these rows.
        # A snapshot may carry a stale baked _locked column; reset it —
        # the overrides list is the only source of truth.
        df['_locked'] = False
        if body.transaction_overrides:
            if 'קטגוריה_משנה' not in df.columns:
                df['קטגוריה_משנה'] = ''
            overrides_by_key = {}
            for o in body.transaction_overrides:
                if not (o.txn_key and o.category):
                    continue
                # Pins saved under the old taxonomy are translated too.
                pin_cat, migrated_sub = migrate_category(o.category, o.subcategory)
                pin_sub = o.subcategory
                if migrated_sub is not None:
                    pin_sub = migrated_sub or None
                if pin_cat not in valid_cats:
                    continue
                overrides_by_key[o.txn_key] = (pin_cat, pin_sub)
            if overrides_by_key:
                keys = compute_txn_keys(df)
                for idx in df.index[keys.isin(overrides_by_key)]:
                    pin_cat, pin_sub = overrides_by_key[keys.at[idx]]
                    df.at[idx, 'קטגוריה'] = pin_cat
                    # The pipeline-derived subcategory belonged to the
                    # pipeline's category; keep only the pinned one.
                    df.at[idx, 'קטגוריה_משנה'] = pin_sub or ''
                    df.at[idx, '_locked'] = True

        # ── Per-transaction notes (Supabase transaction_notes) ──────────
        # Matched by the same fingerprint as pins; notes never affect
        # categorization, they just repopulate הערות after a cold start.
        if body.transaction_notes:
            notes_by_key = {
                n.txn_key: n.note.strip() for n in body.transaction_notes
                if n.txn_key and n.note and n.note.strip()
            }
            if notes_by_key:
                keys = compute_txn_keys(df)
                for idx in df.index[keys.isin(notes_by_key)]:
                    df.at[idx, 'הערות'] = notes_by_key[keys.at[idx]]

        session_id = str(uuid.uuid4())
        sessions[session_id] = df
        if custom_cats:
            SESSION_CUSTOM_CATS[session_id] = custom_cats

        msg = f"Restored {len(df)} transactions"
        removed_parts = []
        if duplicates_removed > 0:
            removed_parts.append(f"{duplicates_removed} כפילויות")
        if cc_payments_removed > 0:
            removed_parts.append(f"{cc_payments_removed} חיובי כרטיס אשראי כפולים")
        if removed_parts:
            msg += f" (הוסרו: {', '.join(removed_parts)})"

        return {
            "success": True,
            "session_id": session_id,
            "transaction_count": len(df),
            "duplicates_removed": duplicates_removed,
            "cc_payments_removed": cc_payments_removed,
            "ai_categorized": ai_categorized,
            "message": msg,
        }
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"{str(e)}\n{traceback.format_exc()}")


@router.post("/transactions/note")
async def update_transaction_note(body: UpdateTransactionNoteRequest):
    """Update the manual notes (הערות) field for a single transaction."""
    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[body.session_id]

    if 'id' not in df.columns:
        raise HTTPException(status_code=400, detail="Session does not support transaction updates")

    mask = df['id'] == body.transaction_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Normalize empty/whitespace-only strings to None
    value = body.notes.strip() if body.notes is not None else None
    if value == "":
        value = None

    if 'הערות' not in df.columns:
        df['הערות'] = None

    df.loc[mask, 'הערות'] = value
    sessions[body.session_id] = df

    # The fingerprint lets the frontend persist the note in Supabase
    # (transaction_notes) so it survives restores and cold starts.
    row = df.loc[mask].iloc[0]
    txn_key = txn_fingerprint(row.get('תאריך'), row.get('סכום'), row.get('תיאור'))
    return {"success": True, "txn_key": txn_key, "notes": value}


@router.post("/transactions/category")
async def update_transaction_category(body: UpdateTransactionCategoryRequest):
    """Reclassify a single transaction's category. Used by the dashboard's
    'edit category' UI; the merchant→category mapping is persisted to
    Supabase separately by the frontend so future uploads pick it up via
    the category_rules field on /restore-session."""
    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[body.session_id]
    if 'id' not in df.columns:
        raise HTTPException(status_code=400, detail="Session does not support transaction updates")

    new_category = (body.category or '').strip()
    if not new_category:
        raise HTTPException(status_code=400, detail="Category cannot be empty")
    # A name outside the catalog is a user-created category (the dynamic
    # taxonomy): remember it for this session so rules/merchant edits and the
    # next hygiene pass treat it as valid. The frontend persists it to
    # Supabase user_categories so it survives restores.
    if new_category not in CATEGORY_ICONS:
        SESSION_CUSTOM_CATS.setdefault(body.session_id, set()).add(new_category)

    mask = df['id'] == body.transaction_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Transaction not found")

    if '_locked' not in df.columns:
        df['_locked'] = False
    if 'קטגוריה_משנה' not in df.columns:
        df['קטגוריה_משנה'] = ''

    row = df.loc[mask].iloc[0]
    merchant = str(row['תיאור']) if 'תיאור' in df.columns else None
    txn_key = txn_fingerprint(row.get('תאריך'), row.get('סכום'), row.get('תיאור'))

    if body.only_this:
        # "אל תשנה עסקאות דומות": this row only, pinned. The old subcategory
        # belonged to the old category (restore clears it the same way).
        df.loc[mask, 'קטגוריה'] = new_category
        df.loc[mask, '_locked'] = True
        df.loc[mask, 'קטגוריה_משנה'] = ''
        affected = int(mask.sum())
    else:
        # Normal edit = a merchant rule: apply it to EVERY transaction of the
        # same canonical merchant RIGHT NOW (not just on the next restore),
        # skipping pinned rows. The clicked row is explicitly unpinned first
        # (the user reverted it to merchant-rule behavior).
        df.loc[mask, '_locked'] = False
        key = normalize_merchant(merchant)
        merchant_mask = df['תיאור'].astype(str).map(normalize_merchant) == key
        apply_mask = (merchant_mask | mask) & ~locked_mask(df)
        changed = apply_mask & (df['קטגוריה'].astype(str) != new_category)
        df.loc[apply_mask, 'קטגוריה'] = new_category
        # Old subcategories belonged to the old category — re-derive.
        df.loc[changed, 'קטגוריה_משנה'] = ''
        derive_subcategory(df)
        affected = int(apply_mask.sum())

    sessions[body.session_id] = df

    # Tell the caller what the row's description is, so the frontend can
    # save a merchant→category rule without a separate round-trip — and the
    # row's stable fingerprint for persisting a single-transaction override.
    return {"success": True, "merchant": merchant, "category": new_category,
            "txn_key": txn_key, "locked": bool(body.only_this),
            "affected_count": affected}


@router.post("/transactions/category-bulk")
async def bulk_update_category(body: BulkUpdateCategoryRequest):
    """Move a SELECTION of transactions to one category (+ optional
    subcategory) in a single action.

    Same semantics as the single-row editor, applied to every selected row:
    - only_this=True: each selected row is pinned individually — nothing else
      moves, now or ever.
    - only_this=False: a merchant rule per unique merchant in the selection —
      applied immediately to ALL of each merchant's transactions (pinned rows
      skipped), exactly like a normal single edit.
    Returns per-row {id, merchant, txn_key} so the frontend can persist the
    pins/rules in Supabase.
    """
    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    df = sessions[body.session_id]
    if 'id' not in df.columns:
        raise HTTPException(status_code=400, detail="Session does not support transaction updates")

    new_category = (body.category or '').strip()
    if not new_category:
        raise HTTPException(status_code=400, detail="Category cannot be empty")
    if new_category not in CATEGORY_ICONS:
        SESSION_CUSTOM_CATS.setdefault(body.session_id, set()).add(new_category)
    new_sub = (body.subcategory or '').strip()

    ids = [int(i) for i in (body.transaction_ids or [])]
    sel_mask = df['id'].isin(ids)
    if not sel_mask.any():
        raise HTTPException(status_code=404, detail="Transactions not found")

    if '_locked' not in df.columns:
        df['_locked'] = False
    if 'קטגוריה_משנה' not in df.columns:
        df['קטגוריה_משנה'] = ''

    # Per-row info for Supabase persistence, computed BEFORE mutation.
    items = [
        {
            "id": int(row['id']),
            "merchant": str(row.get('תיאור', '')),
            "txn_key": txn_fingerprint(row.get('תאריך'), row.get('סכום'), row.get('תיאור')),
        }
        for _, row in df.loc[sel_mask].iterrows()
    ]

    if body.only_this:
        df.loc[sel_mask, 'קטגוריה'] = new_category
        df.loc[sel_mask, 'קטגוריה_משנה'] = new_sub
        df.loc[sel_mask, '_locked'] = True
        affected = int(sel_mask.sum())
    else:
        df.loc[sel_mask, '_locked'] = False
        keys = {normalize_merchant(it["merchant"]) for it in items if it["merchant"]}
        merchant_mask = df['תיאור'].astype(str).map(normalize_merchant).isin(keys)
        apply_mask = (merchant_mask | sel_mask) & ~locked_mask(df)
        changed = apply_mask & (df['קטגוריה'].astype(str) != new_category)
        df.loc[apply_mask, 'קטגוריה'] = new_category
        df.loc[changed, 'קטגוריה_משנה'] = ''
        derive_subcategory(df)
        # The explicit bulk subcategory is the user's word — applied AFTER the
        # seeded derivation, like the single-row subcategory editor.
        if new_sub:
            df.loc[apply_mask, 'קטגוריה_משנה'] = new_sub
        affected = int(apply_mask.sum())

    sessions[body.session_id] = df
    return {"success": True, "category": new_category, "subcategory": new_sub,
            "items": items, "affected_count": affected}


@router.post("/transactions/subcategory")
async def update_transaction_subcategory(body: UpdateTransactionSubcategoryRequest):
    """Set a single transaction's subcategory (קטגוריה_משנה) in the session.

    Returns the row's merchant AND current category so the frontend can persist
    a single merchant→{category, subcategory} rule (the rules table's `category`
    column is NOT NULL, so we always send the category alongside)."""
    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[body.session_id]
    if 'id' not in df.columns:
        raise HTTPException(status_code=400, detail="Session does not support transaction updates")

    mask = df['id'] == body.transaction_id
    if not mask.any():
        raise HTTPException(status_code=404, detail="Transaction not found")

    new_subcategory = (body.subcategory or '').strip()
    if 'קטגוריה_משנה' not in df.columns:
        df['קטגוריה_משנה'] = ''
    if '_locked' not in df.columns:
        df['_locked'] = False

    row = df.loc[mask].iloc[0]
    merchant = str(row['תיאור']) if 'תיאור' in df.columns else None
    category = str(row['קטגוריה']) if 'קטגוריה' in df.columns else None
    txn_key = txn_fingerprint(row.get('תאריך'), row.get('סכום'), row.get('תיאור'))

    if body.only_this:
        df.loc[mask, 'קטגוריה_משנה'] = new_subcategory
        df.loc[mask, '_locked'] = True
    else:
        # Normal edit = a merchant subrule: apply it NOW to every unpinned
        # transaction of the same merchant within the same category (the same
        # scoping the rule gets on restore).
        key = normalize_merchant(merchant)
        merchant_mask = df['תיאור'].astype(str).map(normalize_merchant) == key
        scope = merchant_mask & (df['קטגוריה'].astype(str) == (category or ''))
        df.loc[(scope | mask) & ~locked_mask(df), 'קטגוריה_משנה'] = new_subcategory

    sessions[body.session_id] = df

    return {
        "success": True,
        "merchant": merchant,
        "category": category,
        "subcategory": new_subcategory,
        "txn_key": txn_key,
        "locked": bool(body.only_this or (locked_mask(df).loc[mask]).any()),
    }


@router.get("/categories/catalog")
async def get_category_catalog(sessionId: Optional[str] = Query(None)):
    """Return the seeded category + subcategory catalog so the UI's category
    manager and subcategory selectors stay in sync with the backend without
    hardcoding the Hebrew names in the frontend.

    When a sessionId is given, every subcategory name actually IN USE in that
    session (assigned manually, by a rule, a pin or the AI) is merged in per
    parent — so a name created once stays pickable everywhere, forever (rules
    and pins re-apply it on every restore, which re-surfaces it here)."""
    sub_catalog = get_subcategory_catalog()
    subcategories = {
        parent: [{"name": name, "icon": SUBCATEGORY_ICONS.get(name, "")} for name in names]
        for parent, names in sub_catalog.items()
    }
    df = sessions.get(sessionId) if sessionId else None
    if df is not None and 'קטגוריה' in df.columns and 'קטגוריה_משנה' in df.columns:
        in_use = (
            df[['קטגוריה', 'קטגוריה_משנה']]
            .astype(str)
            .apply(lambda s: s.str.strip())
        )
        in_use = in_use[(in_use['קטגוריה_משנה'] != '') & (in_use['קטגוריה_משנה'].str.lower() != 'nan')]
        for parent, subs in in_use.groupby('קטגוריה')['קטגוריה_משנה']:
            entries = subcategories.setdefault(parent, [])
            known = {e["name"] for e in entries}
            for name in sorted(set(subs)):
                if name not in known:
                    entries.append({"name": name, "icon": SUBCATEGORY_ICONS.get(name, "")})
    return {
        "categories": [{"name": name, "icon": icon} for name, icon in CATEGORY_ICONS.items()],
        "subcategories": subcategories,
    }


@router.post("/categories/rename")
async def rename_category(body: RenameCategoryRequest):
    """Rename a category across the current in-memory session.

    The frontend persists returned merchant descriptions as category rules so
    the rename survives session restore and future uploads.
    """
    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    old_category = (body.old_category or '').strip()
    new_category = (body.new_category or '').strip()
    if not old_category or not new_category:
        raise HTTPException(status_code=400, detail="Category names cannot be empty")

    df = sessions[body.session_id]
    if 'קטגוריה' not in df.columns:
        raise HTTPException(status_code=400, detail="Session does not have categories")

    mask = df['קטגוריה'].astype(str) == old_category
    if not mask.any():
        raise HTTPException(status_code=404, detail="Category not found")

    merchants: list[str] = []
    if 'תיאור' in df.columns:
        merchants = sorted({str(v) for v in df.loc[mask, 'תיאור'].dropna().tolist() if str(v).strip()})

    df.loc[mask, 'קטגוריה'] = new_category
    sessions[body.session_id] = df

    return {
        "success": True,
        "old_category": old_category,
        "new_category": new_category,
        "affected_count": int(mask.sum()),
        "merchants": merchants,
    }


@router.get("/transactions")
async def get_transactions(
    sessionId: str = Query(...),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc",
    page: int = 1,
    page_size: int = 100
):
    """Get transactions with filters"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId].copy()

    # Apply filters
    if start_date:
        df = df[df['תאריך'] >= pd.to_datetime(start_date)]
    if end_date:
        df = df[df['תאריך'] <= pd.to_datetime(end_date)]
    if category:
        df = df[df['קטגוריה'] == category]
    if search:
        df = df[df['תיאור'].str.contains(search, case=False, na=False)]
    if (min_amount is not None or max_amount is not None) and 'סכום_מוחלט' in df.columns:
        if min_amount is not None:
            df = df[df['סכום_מוחלט'] >= min_amount]
        if max_amount is not None:
            df = df[df['סכום_מוחלט'] <= max_amount]
    
    # Sort
    if sort_by:
        ascending = sort_order == "asc"
        df = df.sort_values(by=sort_by, ascending=ascending)
    else:
        df = df.sort_values(by='תאריך', ascending=False)
    
    # Aggregate stats (computed on the full filtered dataset, before pagination)
    total = len(df)
    total_amount = round(_sanitize(float(df['סכום_מוחלט'].sum())), 2) if 'סכום_מוחלט' in df.columns and total > 0 else 0
    expense_count = int((df['סכום'] < 0).sum()) if 'סכום' in df.columns else 0
    income_count = total - expense_count
    avg_transaction = round(_sanitize(total_amount / total), 2) if total > 0 else 0

    # Enhanced stats
    expenses_df = df[df['סכום'] < 0] if 'סכום' in df.columns else pd.DataFrame()
    income_df = df[df['סכום'] > 0] if 'סכום' in df.columns else pd.DataFrame()
    total_expenses = round(_sanitize(float(expenses_df['סכום_מוחלט'].sum())), 2) if not expenses_df.empty and 'סכום_מוחלט' in expenses_df.columns else 0
    total_income = round(_sanitize(float(income_df['סכום'].sum())), 2) if not income_df.empty else 0
    median_transaction = round(_sanitize(float(df['סכום_מוחלט'].median())), 2) if 'סכום_מוחלט' in df.columns and total > 0 else 0

    # Max/min transactions
    max_transaction = None
    min_transaction = None
    if not expenses_df.empty and 'סכום_מוחלט' in expenses_df.columns:
        max_idx = expenses_df['סכום_מוחלט'].idxmax()
        min_idx = expenses_df['סכום_מוחלט'].idxmin()
        max_row = expenses_df.loc[max_idx]
        min_row = expenses_df.loc[min_idx]
        max_transaction = {"description": str(max_row.get('תיאור', '')), "amount": round(_sanitize(float(max_row['סכום_מוחלט'])), 2)}
        min_transaction = {"description": str(min_row.get('תיאור', '')), "amount": round(_sanitize(float(min_row['סכום_מוחלט'])), 2)}

    # Category breakdown (top 10)
    category_breakdown = []
    if 'קטגוריה' in df.columns and 'סכום_מוחלט' in df.columns and not expenses_df.empty:
        cat_group = expenses_df.groupby('קטגוריה')['סכום_מוחלט'].agg(['sum', 'count']).reset_index()
        cat_group = cat_group.sort_values('sum', ascending=False).head(10)
        cat_total = cat_group['sum'].sum()
        for _, row in cat_group.iterrows():
            category_breakdown.append({
                "name": str(row['קטגוריה']),
                "total": round(_sanitize(float(row['sum'])), 2),
                "count": int(row['count']),
                "percent": round(_sanitize(float(row['sum'] / cat_total * 100)), 1) if cat_total > 0 else 0,
            })

    # Date range
    date_from = None
    date_to = None
    if 'תאריך' in df.columns and total > 0:
        valid_dates = df['תאריך'].dropna()
        if len(valid_dates) > 0:
            date_from = _to_json_safe(valid_dates.min())
            date_to = _to_json_safe(valid_dates.max())

    # Pagination
    start = (page - 1) * page_size
    end = start + page_size
    df_page = df.iloc[start:end]

    # Convert to dict with full JSON safety (NaT, Timestamp, numpy scalars, NaN/Inf)
    transactions = [
        {k: _to_json_safe(v) for k, v in record.items()}
        for record in df_page.to_dict('records')
    ]

    return {
        "transactions": transactions,
        "total": total,
        "total_amount": total_amount,
        "avg_transaction": avg_transaction,
        "expense_count": expense_count,
        "income_count": income_count,
        "total_expenses": total_expenses,
        "total_income": total_income,
        "median_transaction": median_transaction,
        "max_transaction": max_transaction,
        "min_transaction": min_transaction,
        "category_breakdown": category_breakdown,
        "date_from": date_from,
        "date_to": date_to,
        "page": page,
        "page_size": page_size
    }


@router.get("/session-files")
async def get_session_files(sessionId: str = Query(...)):
    """List source files in the current session with per-file stats."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if '_source_file' not in df.columns:
        return {"files": []}

    files = []
    for name, group in df.groupby('_source_file'):
        expenses = group[group['סכום'] < 0] if 'סכום' in group.columns else pd.DataFrame()
        income = group[group['סכום'] > 0] if 'סכום' in group.columns else pd.DataFrame()
        date_from = None
        date_to = None
        if 'תאריך' in group.columns:
            valid_dates = group['תאריך'].dropna()
            if not valid_dates.empty:
                date_from = str(valid_dates.min().date())
                date_to = str(valid_dates.max().date())
        files.append({
            "name": str(name),
            "transaction_count": len(group),
            "expense_count": len(expenses),
            "income_count": len(income),
            "total_expenses": round(_sanitize(float(expenses['סכום_מוחלט'].sum())), 2) if not expenses.empty and 'סכום_מוחלט' in expenses.columns else 0,
            "total_income": round(_sanitize(float(income['סכום'].sum())), 2) if not income.empty else 0,
            "date_from": date_from,
            "date_to": date_to,
        })

    return {"files": files}


@router.delete("/session-files")
async def delete_session_file(sessionId: str = Query(...), file_name: str = Query(...)):
    """Remove all transactions from a specific source file."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if '_source_file' not in df.columns:
        raise HTTPException(status_code=400, detail="No source file tracking in this session")

    before = len(df)
    df = df[df['_source_file'] != file_name].reset_index(drop=True)
    removed = before - len(df)

    if removed == 0:
        raise HTTPException(status_code=404, detail=f"File '{file_name}' not found in session")

    sessions[sessionId] = df
    return {
        "success": True,
        "removed": removed,
        "remaining": len(df),
        "message": f"הוסרו {removed} עסקאות מקובץ {file_name}",
    }


@router.delete("/session")
async def delete_session(sessionId: str = Query(...)):
    """Delete an entire session and all its in-memory data."""
    if sessionId in sessions:
        del sessions[sessionId]
    return {"success": True, "message": "Session cleared"}


@router.get("/session-info")
async def get_session_info(sessionId: str = Query(...)):
    """Get detailed metadata about the current session data."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    total = len(df)

    # Columns available
    columns = list(df.columns)

    # Date range
    date_from = None
    date_to = None
    if 'תאריך' in df.columns:
        valid = df['תאריך'].dropna()
        if len(valid) > 0:
            date_from = _to_json_safe(valid.min())
            date_to = _to_json_safe(valid.max())

    # Billing date range
    billing_date_from = None
    billing_date_to = None
    if 'תאריך_חיוב' in df.columns:
        valid_b = df['תאריך_חיוב'].dropna()
        if len(valid_b) > 0:
            billing_date_from = _to_json_safe(valid_b.min())
            billing_date_to = _to_json_safe(valid_b.max())

    # Expense / income split
    expenses = df[df['סכום'] < 0] if 'סכום' in df.columns else pd.DataFrame()
    income = df[df['סכום'] > 0] if 'סכום' in df.columns else pd.DataFrame()
    total_expenses = round(_sanitize(float(expenses['סכום_מוחלט'].sum())), 2) if not expenses.empty and 'סכום_מוחלט' in expenses.columns else 0
    total_income = round(_sanitize(float(income['סכום'].sum())), 2) if not income.empty else 0

    # Categories with counts
    categories = []
    if 'קטגוריה' in df.columns and 'סכום_מוחלט' in df.columns:
        cat_group = df.groupby('קטגוריה').agg(
            count=('סכום', 'size'),
            expense_total=('סכום_מוחלט', lambda x: round(float(x[df.loc[x.index, 'סכום'] < 0].sum()), 2) if (df.loc[x.index, 'סכום'] < 0).any() else 0),
            income_total=('סכום', lambda x: round(float(x[x > 0].sum()), 2) if (x > 0).any() else 0),
        ).reset_index()
        cat_group = cat_group.sort_values('expense_total', ascending=False)
        for _, row in cat_group.iterrows():
            categories.append({
                "name": str(row['קטגוריה']),
                "count": int(row['count']),
                "expense_total": _sanitize(row['expense_total']),
                "income_total": _sanitize(row['income_total']),
            })

    # Months in data
    months = []
    if 'חודש' in df.columns:
        months = sorted(df['חודש'].dropna().unique().tolist())

    return {
        "total_rows": total,
        "columns": columns,
        "date_from": date_from,
        "date_to": date_to,
        "billing_date_from": billing_date_from,
        "billing_date_to": billing_date_to,
        "expense_count": int(len(expenses)),
        "income_count": int(len(income)),
        "total_expenses": total_expenses,
        "total_income": total_income,
        "categories": categories,
        "months": months,
        "has_billing_date": bool('תאריך_חיוב' in df.columns and df['תאריך_חיוב'].notna().any()),
    }


@router.get("/owners")
async def get_owners(sessionId: str = Query(...)):
    """Distinct owners present in the session, for the per-person filter."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    df = sessions[sessionId]
    if '_owner' not in df.columns:
        return []
    vals = [str(o).strip() for o in df['_owner'].dropna().unique().tolist()]
    return sorted(v for v in vals if v and v.lower() != 'nan')


class ScopeSessionRequest(BaseModel):
    session_id: str
    owner: Optional[str] = None


@router.post("/session/scope")
async def scope_session(body: ScopeSessionRequest):
    """Return a session id whose data is filtered to a single owner (_owner).

    The dashboard's per-person filter calls this and then passes the returned id
    to every existing read endpoint, so all charts/metrics reflect the chosen
    person without per-endpoint changes. An empty owner (or 'all'/'הכל') returns
    the base session. The filtered session is rebuilt from the base on every
    call, so it always reflects the latest edits."""
    base = body.session_id
    if base not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    owner = (body.owner or '').strip()
    if not owner or owner.lower() == 'all' or owner == 'הכל':
        return {"session_id": base}
    df = sessions[base]
    if '_owner' not in df.columns:
        return {"session_id": base}
    scoped_id = f"{base}::owner={owner}"
    sessions[scoped_id] = df[df['_owner'] == owner].reset_index(drop=True)
    # The scoped view keeps the base session's custom categories valid.
    if base in SESSION_CUSTOM_CATS:
        SESSION_CUSTOM_CATS[scoped_id] = SESSION_CUSTOM_CATS[base]
    return {"session_id": scoped_id}


class AICategorizeRequest(BaseModel):
    session_id: str


@router.post("/ai-categorize")
def ai_categorize(body: AICategorizeRequest):
    """Run the AI fallback (Claude + web search) on the session's remaining
    "שונות" rows and apply the results to the live session.

    Split out of /restore-session so the dashboard renders immediately and the
    slow AI pass happens in the background. Sync (non-async) on purpose: the
    Anthropic call blocks, so FastAPI runs this in its threadpool instead of
    stalling the event loop. Returns the merchant→category assignments so the
    client can persist them as user rules (resolved once, never re-searched).
    """
    df = sessions.get(body.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")

    ai_categorized: list[dict] = []
    if 'קטגוריה' in df.columns and 'תיאור' in df.columns:
        # Pinned rows ("אל תשנה עסקאות דומות") are never sent to the AI.
        misc_mask = (df['קטגוריה'] == 'שונות') & ~locked_mask(df)
        if misc_mask.any():
            misc_descs = df.loc[misc_mask, 'תיאור'].tolist()
            # Card-company sector (ענף_מקור) is a useful hint for the AI —
            # pass it alongside each description when the column exists.
            misc_issuers = None
            if 'ענף_מקור' in df.columns:
                misc_issuers = [
                    None if (v is None or str(v).strip() == '' or str(v).lower() in ('nan', 'none'))
                    else str(v).strip()
                    for v in df.loc[misc_mask, 'ענף_מקור'].tolist()
                ]
            sid = body.session_id

            def _progress(done, total):
                AI_PROGRESS[sid] = {"stage": "categorizing", "done": done, "total": total, "detail": ""}

            AI_PROGRESS[sid] = {"stage": "categorizing", "done": 0, "total": 0, "detail": ""}
            ai_map = categorize_transactions(misc_descs, misc_issuers, on_progress=_progress) or {}
            misc_idx = df.index[misc_mask].tolist()
            for local_i, cat in ai_map.items():
                if 0 <= local_i < len(misc_idx):
                    df.at[misc_idx[local_i], 'קטגוריה'] = cat
                    ai_categorized.append({
                        "merchant": str(df.at[misc_idx[local_i], 'תיאור']),
                        "category": cat,
                    })
            if ai_categorized:
                derive_subcategory(df)

    AI_PROGRESS[body.session_id] = {"stage": "categorized", "done": 0, "total": 0, "detail": ""}
    return {"success": True, "ai_categorized": ai_categorized}


class AIAuditRequest(BaseModel):
    session_id: str
    limit: int = 60
    exclude_merchants: list[str] = []


@router.post("/ai-audit")
def ai_audit(body: AIAuditRequest):
    """Second-opinion audit of ALL expense merchants (not just שונות).

    Groups the session's expense rows by canonical merchant, sends each
    merchant's current category + issuer sector (ענף_מקור) + volume to Claude,
    and returns only the DISAGREEMENTS as proposals — nothing is applied.
    The user reviews them in the dashboard; an accepted proposal becomes a
    merchant rule via /merchants/category + the client-side rule upsert.
    Sync (non-async) on purpose, like /ai-categorize: the Anthropic call
    blocks, so FastAPI runs it in its threadpool.
    """
    df = sessions.get(body.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if 'קטגוריה' not in df.columns or 'תיאור' not in df.columns:
        return {"success": True, "proposals": [], "audited_count": 0,
                "audited_merchants": [], "remaining": 0}

    expenses = df[df['סכום'] < 0] if 'סכום' in df.columns else df
    # Pinned rows ("אל תשנה עסקאות דומות") are the user's explicit word —
    # auditing them would only produce proposals that can't be applied.
    expenses = expenses[~locked_mask(expenses)]
    if expenses.empty:
        return {"success": True, "proposals": [], "audited_count": 0,
                "audited_merchants": [], "remaining": 0}

    excluded = {normalize_merchant(m) for m in (body.exclude_merchants or [])}

    # Group by canonical merchant: representative raw name (most frequent),
    # current category (most frequent), volume, issuer sector when present.
    merchants: dict[str, dict] = {}
    has_issuer = 'ענף_מקור' in expenses.columns
    for _, row in expenses.iterrows():
        raw = str(row.get('תיאור', '')).strip()
        key = normalize_merchant(raw)
        if not key or key in excluded:
            continue
        cat = str(row.get('קטגוריה', 'שונות'))
        # Unconditional overrides can't be changed by a rule — auditing them
        # would only produce dead proposals. AI tools are pinned to
        # טכנולוגיה/AI by apply_ai_tool_override, so skip AI-subcategory rows.
        if cat == AI_CATEGORY and str(row.get('קטגוריה_משנה', '')).strip() == AI_SUBCATEGORY:
            continue
        # The keyword catalog governs these merchants on every restore; a rule
        # can't move them, so verifying them would waste web searches.
        if any(kw in raw.lower() for kw in KEYWORD_TO_CATEGORY):
            continue
        m = merchants.setdefault(key, {
            "merchant": raw, "current": cat, "count": 0, "total": 0.0,
            "issuer": None, "_names": {}, "_cats": {},
        })
        m["count"] += 1
        try:
            m["total"] += abs(float(row.get('סכום', 0) or 0))
        except (TypeError, ValueError):
            pass
        m["_names"][raw] = m["_names"].get(raw, 0) + 1
        m["_cats"][cat] = m["_cats"].get(cat, 0) + 1
        if has_issuer and not m["issuer"]:
            issuer = row.get('ענף_מקור')
            if issuer is not None and str(issuer).strip() and str(issuer).lower() not in ('nan', 'none'):
                m["issuer"] = str(issuer).strip()

    items = []
    for m in merchants.values():
        m["merchant"] = max(m["_names"], key=m["_names"].get)
        m["current"] = max(m["_cats"], key=m["_cats"].get)
        del m["_names"], m["_cats"]
        items.append(m)

    # Biggest spend first — the merchants where a wrong category distorts the
    # charts most. `limit` caps the Claude batch; run again for the next slice.
    items.sort(key=lambda m: m["total"], reverse=True)
    total_eligible = len(items)
    items = items[: max(1, min(int(body.limit or 60), 200))]

    sid = body.session_id

    def _audit_progress(done, total):
        AI_PROGRESS[sid] = {"stage": "auditing", "done": done, "total": total, "detail": ""}

    verdicts = audit_merchants(items, on_progress=_audit_progress)
    if verdicts is None:
        raise HTTPException(status_code=503, detail="AI is not configured (ANTHROPIC_API_KEY)")

    proposals = []
    # Merchants whose current category the web check CONFIRMED — the client
    # pins these as rules so each merchant is verified once, ever.
    verified = []
    for v in verdicts:
        i = v["index"]
        if not (0 <= i < len(items)):
            continue
        it = items[i]
        if v["category"] == it["current"] or v["category"] == 'שונות':
            if v["category"] == it["current"] and it["current"] != 'שונות':
                verified.append({"merchant": it["merchant"], "category": it["current"]})
            continue
        merchant_lower = str(it["merchant"]).lower()
        catalog_hit = any(kw in merchant_lower for kw in KEYWORD_TO_CATEGORY)
        proposals.append({
            "merchant": it["merchant"],
            "current_category": it["current"],
            "proposed_category": v["category"],
            "confidence": v["confidence"],
            "reason": v["reason"],
            "count": it["count"],
            "total": round(_sanitize(float(it["total"])), 2),
            "issuer_category": it["issuer"],
            # True when the keyword catalog has an opinion on this merchant —
            # the catalog governs those on every restore, so the automatic
            # background audit must not fight it.
            "catalog_hit": catalog_hit,
        })
    proposals.sort(key=lambda p: (p["confidence"], p["total"]), reverse=True)
    return {
        "success": True,
        "proposals": proposals,
        "verified": verified,
        "audited_count": len(items),
        # Everything this batch covered — the client feeds these back as
        # exclude_merchants to advance to the NEXT slice (without this,
        # repeated runs re-audit the same top-spend merchants forever).
        "audited_merchants": [it["merchant"] for it in items],
        # How many eligible merchants remain un-audited after this batch.
        "remaining": max(0, total_eligible - len(items)),
    }


class UpdateMerchantCategoryRequest(BaseModel):
    session_id: str
    merchant: str
    category: str


@router.post("/merchants/category")
async def update_merchant_category(body: UpdateMerchantCategoryRequest):
    """Reclassify EVERY transaction of a merchant (canonical-key match) in the
    live session — one decision per merchant, applied everywhere. The frontend
    persists the same mapping as a user_category_rules row so it survives
    restores and reaches bank-sync."""
    if body.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    new_category = (body.category or '').strip()
    if not new_category:
        raise HTTPException(status_code=400, detail="Category cannot be empty")
    if new_category not in _valid_categories(body.session_id):
        raise HTTPException(status_code=400, detail="Unknown category")

    df = sessions[body.session_id]
    if 'תיאור' not in df.columns:
        raise HTTPException(status_code=400, detail="Session has no descriptions")

    key = normalize_merchant(body.merchant)
    mask = df['תיאור'].astype(str).map(normalize_merchant) == key
    if not mask.any():
        raise HTTPException(status_code=404, detail="Merchant not found")

    # A merchant-wide edit never touches rows pinned by "אל תשנה עסקאות
    # דומות" — that's the entire point of the pin (e.g. ביט transfers,
    # each classified differently).
    mask = mask & ~locked_mask(df)
    if not mask.any():
        return {"success": True, "merchant": body.merchant,
                "category": new_category, "affected_count": 0}

    df.loc[mask, 'קטגוריה'] = new_category
    # The old subcategory belonged to the old category; re-derive from scratch.
    if 'קטגוריה_משנה' in df.columns:
        df.loc[mask, 'קטגוריה_משנה'] = ''
        derive_subcategory(df)
    sessions[body.session_id] = df

    return {
        "success": True,
        "merchant": body.merchant,
        "category": new_category,
        "affected_count": int(mask.sum()),
    }


class AISubcategorizeRequest(BaseModel):
    session_id: str
    category: str
    limit: int = 80


class AISubcategorizeAllRequest(BaseModel):
    session_id: str
    limit_per_category: int = 80


def _ai_subcategorize_category(df, category: str, limit: int) -> tuple[list[dict], int]:
    """AI subcategory split for one category, applied to df in place.

    Groups the category's rows that still have no קטגוריה_משנה by canonical
    merchant, asks the AI (existing names reused, new ones created, unknown
    merchants web-searched — never guessed), fills ONLY empty subcategories so
    manual assignments survive. Returns (assignments, remaining_merchants).
    Raises HTTPException(503) when AI isn't configured.
    """
    sub_series = df['קטגוריה_משנה'].fillna('').astype(str).str.strip()
    cat_mask = df['קטגוריה'].astype(str) == category
    # Pinned rows ("אל תשנה עסקאות דומות") keep whatever the user chose,
    # including an intentionally empty subcategory.
    target = cat_mask & (sub_series == '') & ~locked_mask(df)
    if not target.any():
        return [], 0

    # Group by canonical merchant: representative raw name (most frequent) + volume.
    merchants: dict[str, dict] = {}
    for _, row in df[target].iterrows():
        raw = str(row.get('תיאור', '')).strip()
        key = normalize_merchant(raw)
        if not key:
            continue
        m = merchants.setdefault(key, {"merchant": raw, "count": 0, "total": 0.0, "_names": {}})
        m["count"] += 1
        try:
            m["total"] += abs(float(row.get('סכום', 0) or 0))
        except (TypeError, ValueError):
            pass
        m["_names"][raw] = m["_names"].get(raw, 0) + 1

    items = []
    for key, m in merchants.items():
        m["merchant"] = max(m["_names"], key=m["_names"].get)
        del m["_names"]
        m["_key"] = key
        items.append(m)
    items.sort(key=lambda m: m["total"], reverse=True)
    total_eligible = len(items)
    items = items[: max(1, min(int(limit or 80), 200))]

    # Existing names for consistency: the seeded catalog for this parent plus
    # whatever is already in use on the category's rows.
    existing = list(dict.fromkeys(
        get_subcategory_catalog().get(category, [])
        + sorted({s for s in sub_series[cat_mask] if s})
    ))

    suggestions = suggest_subcategories(category, items, existing)
    if suggestions is None:
        raise HTTPException(status_code=503, detail="AI is not configured (ANTHROPIC_API_KEY)")

    desc_norm = df['תיאור'].astype(str).map(normalize_merchant)
    assignments = []
    for s in suggestions:
        i = s["index"]
        sub = s["subcategory"]
        if not sub or not (0 <= i < len(items)):
            continue
        it = items[i]
        # Fill only rows still empty, so a manual assignment made while the AI
        # call was in flight survives.
        apply_mask = target & (desc_norm == it["_key"])
        df.loc[apply_mask, 'קטגוריה_משנה'] = sub
        assignments.append({
            "merchant": it["merchant"],
            "category": category,
            "subcategory": sub,
            "count": it["count"],
            "total": round(_sanitize(float(it["total"])), 2),
        })
    return assignments, max(0, total_eligible - len(items))


@router.post("/ai-subcategorize")
def ai_subcategorize(body: AISubcategorizeRequest):
    """AI subcategory split for ONE category (the drawer's re-run button).

    Sync (non-async) on purpose, like /ai-categorize: the Anthropic call
    blocks, so FastAPI uses its threadpool.
    """
    df = sessions.get(body.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    category = (body.category or '').strip()
    if not category:
        raise HTTPException(status_code=400, detail="Category cannot be empty")
    if 'קטגוריה' not in df.columns or 'תיאור' not in df.columns:
        return {"success": True, "assignments": [], "remaining": 0}
    if 'קטגוריה_משנה' not in df.columns:
        df['קטגוריה_משנה'] = ''

    assignments, remaining = _ai_subcategorize_category(df, category, body.limit)
    sessions[body.session_id] = df
    return {"success": True, "assignments": assignments, "remaining": remaining}


@router.post("/ai-subcategorize-all")
def ai_subcategorize_all(body: AISubcategorizeAllRequest):
    """Fully automatic subcategory pass: sweep EVERY category that still has
    unsubcategorized rows (except שונות — no parent to refine). Fired by the
    frontend in the background after restore (chained after /ai-categorize),
    so subcategories appear without the user pressing anything; results are
    persisted client-side as merchant rules, and per-merchant caching keeps
    repeat loads cheap. Sync (non-async) on purpose — threadpool."""
    df = sessions.get(body.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if 'קטגוריה' not in df.columns or 'תיאור' not in df.columns:
        return {"success": True, "assignments": [], "remaining": 0}
    if 'קטגוריה_משנה' not in df.columns:
        df['קטגוריה_משנה'] = ''

    sub_series = df['קטגוריה_משנה'].fillna('').astype(str).str.strip()
    pending = df.loc[sub_series == '', 'קטגוריה'].astype(str)
    # שונות has no parent to refine; פארם is split per-transaction (the
    # תרופות/טיפוח distinction depends on the basket, not the merchant).
    categories = sorted({c for c in pending if c and c not in AI_SUBCATEGORIZE_SKIP})

    all_assignments: list[dict] = []
    remaining_total = 0
    for i, category in enumerate(categories):
        AI_PROGRESS[body.session_id] = {
            "stage": "subcategorizing", "done": i, "total": len(categories), "detail": category,
        }
        assignments, remaining = _ai_subcategorize_category(df, category, body.limit_per_category)
        all_assignments.extend(assignments)
        remaining_total += remaining

    sessions[body.session_id] = df
    AI_PROGRESS[body.session_id] = {
        "stage": "done", "done": len(categories), "total": len(categories), "detail": "",
    }
    return {"success": True, "assignments": all_assignments, "remaining": remaining_total}


@router.get("/metrics")
async def get_metrics(sessionId: str = Query(...)):
    """Get metrics data"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]

    expenses = df[df['סכום'] < 0]
    income = df[df['סכום'] > 0]

    total_transactions = len(expenses)
    total_expenses = abs(expenses['סכום'].sum()) if len(expenses) > 0 else 0
    total_income = income['סכום'].sum() if len(income) > 0 else 0
    average_transaction = expenses['סכום_מוחלט'].mean() if not expenses.empty else 0

    # Calculate trend (based on expenses only)
    trend = None
    if len(expenses) > 10:
        mid = len(expenses) // 2
        first_half_avg = expenses.iloc[:mid]['סכום_מוחלט'].mean()
        second_half_avg = expenses.iloc[mid:]['סכום_מוחלט'].mean()
        if first_half_avg > 0:
            trend_pct = ((second_half_avg - first_half_avg) / first_half_avg) * 100
            trend = 'up' if trend_pct > 0 else 'down'

    has_billing_date = 'תאריך_חיוב' in df.columns and df['תאריך_חיוב'].notna().any()

    return {
        "total_transactions": total_transactions,
        "total_expenses": total_expenses,
        "total_income": total_income,
        "average_transaction": average_transaction,
        "trend": trend,
        "has_billing_date": bool(has_billing_date),
    }


@router.get("/categories")
async def get_categories(sessionId: str = Query(...)):
    """Get list of unique categories"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]
    categories = df['קטגוריה'].unique().tolist()
    # Filter out None/NaN and sort
    categories = sorted([c for c in categories if c and str(c).lower() != 'nan'])
    
    return categories


@router.get("/charts/donut")
async def get_donut_chart(sessionId: str = Query(...)):
    """Get donut chart data"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]
    chart_data = create_donut_chart(df)
    return chart_data


@router.get("/charts/monthly")
async def get_monthly_chart(sessionId: str = Query(...)):
    """Get monthly chart data"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]
    chart_data = create_monthly_bars(df)
    return chart_data


@router.get("/charts/weekday")
async def get_weekday_chart(sessionId: str = Query(...)):
    """Get weekday chart data"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]
    chart_data = create_weekday_chart(df)
    return chart_data


@router.get("/charts/trend")
async def get_trend_chart(sessionId: str = Query(...)):
    """Get trend chart data"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId]
    chart_data = create_trend_chart(df)
    return chart_data


@router.get("/export")
async def export_transactions(
    sessionId: str = Query(...),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None
):
    """Export transactions to Excel"""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    df = sessions[sessionId].copy()
    
    # Apply filters
    if start_date:
        df = df[df['תאריך'] >= pd.to_datetime(start_date)]
    if end_date:
        df = df[df['תאריך'] <= pd.to_datetime(end_date)]
    if category:
        df = df[df['קטגוריה'] == category]
    
    # Export
    excel_buffer = export_to_excel(df)
    
    return StreamingResponse(
        BytesIO(excel_buffer.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=transactions.xlsx"}
    )


# ---------------------------------------------------------------------------
# V2 API endpoints – raw JSON data for frontend charting
# ---------------------------------------------------------------------------

def _sanitize(val):
    """Replace NaN/Infinity with None for JSON serialization."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return 0
    return val


def _month_series(df: pd.DataFrame, date_type: str) -> pd.Series:
    """The MM/YYYY each row belongs to, for grouping/filtering by month.

    Honors the income-month attribution that bank-sync baked into the
    pre-computed חודש / חודש_חיוב columns (e.g. an end-of-month salary moved to
    the following month). ALL month views must use this so they agree with each
    other; deriving the month ad-hoc from the raw date silently throws the shift
    away. Falls back to the raw date only for legacy rows missing those columns.
    """
    if date_type == 'billing':
        if 'חודש_חיוב' in df.columns:
            s = df['חודש_חיוב'].astype('object')
            if 'תאריך_חיוב' in df.columns:
                s = s.where(s.notna() & (s != ''), df['תאריך_חיוב'].dt.strftime('%m/%Y'))
            return s
        if 'תאריך_חיוב' in df.columns:
            return df['תאריך_חיוב'].dt.strftime('%m/%Y')
    if 'חודש' in df.columns:
        s = df['חודש'].astype('object')
        if 'תאריך' in df.columns:
            s = s.where(s.notna() & (s != ''), df['תאריך'].dt.strftime('%m/%Y'))
        return s
    return df['תאריך'].dt.strftime('%m/%Y')


def _month_key(m) -> tuple:
    """Sort key for an MM/YYYY label (year, month)."""
    try:
        mm, yy = str(m).split('/')
        return (int(yy), int(mm))
    except Exception:
        return (0, 0)


def _to_json_safe(val):
    """Convert any pandas/numpy value to a JSON-serializable Python type.

    Handles: pd.NaT, pd.Timestamp, np.int64/float64, NaN, Inf.
    """
    try:
        if pd.isnull(val):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(val, (_dt.datetime, _dt.date)):
        return val.isoformat()
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if hasattr(val, 'item'):   # numpy int64, float64, bool_, etc.
        v = val.item()
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return v
    return val


@router.get("/charts/v2/donut")
async def get_donut_v2(sessionId: str = Query(...)):
    """Return raw category breakdown (top 10 + 'אחר')."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"categories": [], "total": 0}

    cat_totals = (
        expenses
        .groupby('קטגוריה')['סכום_מוחלט']
        .sum()
        .sort_values(ascending=False)
    )

    top = cat_totals.head(10)
    other = cat_totals.iloc[10:].sum() if len(cat_totals) > 10 else 0

    categories = [
        {"name": str(name), "value": round(_sanitize(val), 2)}
        for name, val in top.items()
    ]
    if other > 0:
        categories.append({"name": "אחר", "value": round(float(other), 2)})

    total = round(_sanitize(float(cat_totals.sum())), 2)
    return {"categories": categories, "total": total}


@router.get("/charts/v2/income-sources")
async def get_income_sources(sessionId: str = Query(...)):
    """Income (positive amounts) grouped by source — i.e. where it came from
    (the payer/description), top 10 + 'אחר'. Respects the scoped session, so the
    per-person filter applies automatically."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    income = df[df['סכום'] > 0].copy()
    if income.empty:
        return {"sources": [], "total": 0}

    grouped = (
        income
        .groupby('תיאור')
        .agg(value=('סכום', 'sum'), count=('סכום', 'size'))
        .sort_values('value', ascending=False)
    )

    top = grouped.head(10)
    other_val = float(grouped['value'].iloc[10:].sum()) if len(grouped) > 10 else 0.0
    other_cnt = int(grouped['count'].iloc[10:].sum()) if len(grouped) > 10 else 0

    sources = [
        {"name": str(name), "value": round(_sanitize(float(row['value'])), 2), "count": int(row['count'])}
        for name, row in top.iterrows()
    ]
    if other_val > 0:
        sources.append({"name": "אחר", "value": round(other_val, 2), "count": other_cnt})

    total = round(_sanitize(float(grouped['value'].sum())), 2)
    return {"sources": sources, "total": total}


@router.get("/charts/v2/category-snapshot")
async def get_category_snapshot(
    sessionId: str = Query(...),
    month_from: str = Query(default=None),
    month_to: str = Query(default=None),
    date_type: str = Query(default="transaction"),
):
    """Return ALL categories with enriched analytical data. Optional month range filter (MM/YYYY)."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    # Determine which month column to use based on date_type
    month_col = 'חודש'
    if date_type == 'billing' and 'חודש_חיוב' in expenses.columns:
        month_col = 'חודש_חיוב'

    # Optional month range filtering
    if (month_from or month_to) and not expenses.empty:
        def _month_key(m: str) -> tuple:
            parts = m.split('/')
            return (int(parts[1]), int(parts[0]))
        if month_from:
            from_key = _month_key(month_from)
            expenses = expenses[expenses[month_col].apply(lambda m: _month_key(m) >= from_key)]
        if month_to:
            to_key = _month_key(month_to)
            expenses = expenses[expenses[month_col].apply(lambda m: _month_key(m) <= to_key)]

    if expenses.empty:
        return {"categories": [], "total": 0, "total_count": 0, "month_count": 0}

    # -- Overall aggregation --
    cat_agg = (
        expenses
        .groupby('קטגוריה')
        .agg(
            total=('סכום_מוחלט', 'sum'),
            count=('סכום_מוחלט', 'size'),
        )
        .sort_values('total', ascending=False)
    )

    grand_total = float(cat_agg['total'].sum())
    total = round(_sanitize(grand_total), 2)
    total_count = int(cat_agg['count'].sum())

    # -- Per-category monthly breakdown for trends --
    # Sort months chronologically (MM/YYYY string sort is wrong: 01/2026 < 09/2025)
    all_months = sorted(
        expenses[month_col].unique(),
        key=lambda m: (int(m.split('/')[1]), int(m.split('/')[0])),
    )
    month_count = len(all_months)

    cat_month = (
        expenses
        .groupby(['קטגוריה', month_col])
        .agg(month_total=('סכום_מוחלט', 'sum'))
        .reset_index()
    )

    # -- Top merchant per category --
    cat_merchant = (
        expenses
        .groupby(['קטגוריה', 'תיאור'])
        .agg(merchant_total=('סכום_מוחלט', 'sum'))
        .reset_index()
    )
    top_merchants = (
        cat_merchant
        .sort_values('merchant_total', ascending=False)
        .drop_duplicates(subset='קטגוריה', keep='first')
        .set_index('קטגוריה')
    )

    # -- Last two months for trend calculation --
    last_month = all_months[-1] if all_months else None
    prev_month = all_months[-2] if len(all_months) >= 2 else None

    last_month_totals = {}
    prev_month_totals = {}
    if last_month:
        lm = cat_month[cat_month[month_col] == last_month].set_index('קטגוריה')
        last_month_totals = lm['month_total'].to_dict()
    if prev_month:
        pm = cat_month[cat_month[month_col] == prev_month].set_index('קטגוריה')
        prev_month_totals = pm['month_total'].to_dict()

    # -- Months active per category --
    months_active = cat_month.groupby('קטגוריה')[month_col].nunique().to_dict()

    # -- Build enriched response --
    categories = []
    for name, row in cat_agg.iterrows():
        cat_name = str(name)
        cat_total = round(_sanitize(float(row['total'])), 2)
        cat_count = int(row['count'])
        cat_avg = round(_sanitize(cat_total / cat_count), 2) if cat_count > 0 else 0
        cat_percent = round(cat_total / grand_total * 100, 1) if grand_total > 0 else 0
        cat_months_active = months_active.get(cat_name, 1)
        cat_monthly_avg = round(_sanitize(cat_total / cat_months_active), 2) if cat_months_active > 0 else 0

        # Month-over-month trend
        lm_val = last_month_totals.get(cat_name, 0)
        pm_val = prev_month_totals.get(cat_name, 0)
        if pm_val > 0:
            month_change = round((lm_val - pm_val) / pm_val * 100, 1)
        elif lm_val > 0 and prev_month is not None:
            month_change = 100.0  # new category this month (wasn't in prev month)
        else:
            month_change = 0.0

        # Top merchant
        merchant_name = None
        merchant_total_val = 0
        if cat_name in top_merchants.index:
            merchant_name = str(top_merchants.loc[cat_name, 'תיאור'])
            merchant_total_val = round(_sanitize(float(top_merchants.loc[cat_name, 'merchant_total'])), 2)

        # Monthly sparkline (last 6 months)
        cat_monthly_data = cat_month[cat_month['קטגוריה'] == cat_name].set_index(month_col)
        sparkline = [
            round(_sanitize(float(cat_monthly_data.loc[m, 'month_total'])), 2) if m in cat_monthly_data.index else 0
            for m in all_months[-6:]
        ]

        categories.append({
            "name": cat_name,
            "total": cat_total,
            "count": cat_count,
            "percent": cat_percent,
            "avg_transaction": cat_avg,
            "monthly_avg": cat_monthly_avg,
            "months_active": cat_months_active,
            "month_change": month_change,
            "top_merchant": merchant_name,
            "top_merchant_total": merchant_total_val,
            "sparkline": sparkline,
        })

    return {
        "categories": categories,
        "total": total,
        "total_count": total_count,
        "month_count": month_count,
        "last_month": last_month,
        "prev_month": prev_month,
    }


@router.get("/charts/v2/category-transactions")
async def get_category_transactions(
    sessionId: str = Query(...),
    month: str = Query(""),
    month_from: str = Query(""),
    month_to: str = Query(""),
    category: str = Query(...),
    date_type: str = Query("transaction"),
    sort_order: str = Query("asc"),
):
    """Return all transactions for a given category, optionally filtered by month or date range."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId].copy()
    if df.empty:
        return {"transactions": [], "total": 0, "count": 0}

    # Filter by category + expenses
    filtered = df[(df['קטגוריה'] == category) & (df['סכום'] < 0)]

    # Filter by single month or date range (shift-aware month).
    if month:
        filtered = filtered.copy()
        filtered['_month'] = _month_series(filtered, date_type)
        filtered = filtered[filtered['_month'] == month]
    elif month_from or month_to:
        filtered = filtered.copy()
        filtered['_month'] = _month_series(filtered, date_type)
        # Parse MM/YYYY into sortable YYYY-MM for comparison
        def month_sort_key(m: str) -> str:
            parts = m.split('/')
            return f"{parts[1]}-{parts[0]}" if len(parts) == 2 else m
        if month_from:
            from_key = month_sort_key(month_from)
            filtered = filtered[filtered['_month'].apply(month_sort_key) >= from_key]
        if month_to:
            to_key = month_sort_key(month_to)
            filtered = filtered[filtered['_month'].apply(month_sort_key) <= to_key]

    if filtered.empty:
        return {"transactions": [], "total": 0, "count": 0}

    ascending = sort_order == 'asc'
    filtered = filtered.sort_values('סכום_מוחלט', ascending=ascending)

    transactions = [
        {
            "id": int(row['id']) if 'id' in filtered.columns and pd.notna(row.get('id')) else None,
            "תאריך": row['תאריך'].strftime('%Y-%m-%d') if hasattr(row['תאריך'], 'strftime') else str(row['תאריך']),
            "תיאור": str(row['תיאור']),
            "סכום": _sanitize(round(float(row['סכום']), 2)),
            "סכום_מוחלט": _sanitize(round(float(row['סכום_מוחלט']), 2)),
            "קטגוריה": str(row['קטגוריה']),
            "קטגוריה_משנה": (
                str(row['קטגוריה_משנה'])
                if 'קטגוריה_משנה' in filtered.columns and pd.notna(row.get('קטגוריה_משנה'))
                else ""
            ),
            "הערות": (
                str(row['הערות'])
                if 'הערות' in filtered.columns and pd.notna(row.get('הערות')) and str(row.get('הערות')).strip()
                else None
            ),
            "_locked": bool(row.get('_locked')) if '_locked' in filtered.columns and pd.notna(row.get('_locked')) else False,
        }
        for _, row in filtered.iterrows()
    ]

    total = _sanitize(round(float(filtered['סכום_מוחלט'].sum()), 2))
    return {"transactions": transactions, "total": total, "count": len(transactions)}


@router.get("/charts/v2/category-merchants")
async def get_category_merchants(
    sessionId: str = Query(...),
    month: str = Query(...),
    category: str = Query(...),
    date_type: str = Query("transaction"),
):
    """Return merchant breakdown within a category for a specific month."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId].copy()
    if df.empty:
        return {"merchants": [], "total": 0}

    df['_month'] = _month_series(df, date_type)
    filtered = df[(df['_month'] == month) & (df['קטגוריה'] == category) & (df['סכום'] < 0)]

    if filtered.empty:
        return {"merchants": [], "total": 0}

    merchant_agg = (
        filtered
        .groupby('תיאור')
        .agg(
            total=('סכום_מוחלט', 'sum'),
            count=('סכום_מוחלט', 'size'),
        )
        .sort_values('total', ascending=False)
    )

    merchants = [
        {
            "name": str(name),
            "total": _sanitize(round(float(row['total']), 2)),
            "count": int(row['count']),
        }
        for name, row in merchant_agg.iterrows()
    ]

    total = _sanitize(round(float(merchant_agg['total'].sum()), 2))
    return {"merchants": merchants, "total": total}


@router.get("/charts/v2/merchant-transactions")
async def get_merchant_transactions(
    sessionId: str = Query(...),
    month: str = Query(...),
    category: str = Query(...),
    merchant: str = Query(...),
    date_type: str = Query("transaction"),
):
    """Return individual transactions for a specific merchant within a category/month."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId].copy()
    if df.empty:
        return {"transactions": [], "total": 0}

    date_col = 'תאריך_חיוב' if (date_type == 'billing' and 'תאריך_חיוב' in df.columns) else 'תאריך'
    df['_month'] = df[date_col].dt.strftime('%m/%Y')
    filtered = df[
        (df['_month'] == month) &
        (df['קטגוריה'] == category) &
        (df['תיאור'] == merchant) &
        (df['סכום'] < 0)
    ]

    if filtered.empty:
        return {"transactions": [], "total": 0}

    filtered = filtered.sort_values('סכום_מוחלט', ascending=True)

    transactions = [
        {
            "תאריך": row['תאריך'].strftime('%Y-%m-%d') if hasattr(row['תאריך'], 'strftime') else str(row['תאריך']),
            "תיאור": str(row['תיאור']),
            "סכום": _sanitize(round(float(row['סכום']), 2)),
            "סכום_מוחלט": _sanitize(round(float(row['סכום_מוחלט']), 2)),
            "קטגוריה": str(row['קטגוריה']),
        }
        for _, row in filtered.iterrows()
    ]

    total = _sanitize(round(float(filtered['סכום_מוחלט'].sum()), 2))
    return {"transactions": transactions, "total": total}


@router.get("/charts/v2/monthly")
async def get_monthly_v2(sessionId: str = Query(...), date_type: str = Query("transaction")):
    """Return raw monthly expense totals."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"months": []}

    # Group by the shift-aware month so the month buttons match the other views.
    expenses['_month'] = _month_series(expenses, date_type)
    expenses = expenses[expenses['_month'].notna() & (expenses['_month'] != '')]
    monthly = expenses.groupby('_month')['סכום_מוחלט'].sum()

    months = [
        {"month": str(m), "amount": round(_sanitize(float(monthly[m])), 2)}
        for m in sorted(monthly.index, key=_month_key)
    ]
    return {"months": months}


@router.get("/charts/v2/weekday")
async def get_weekday_v2(sessionId: str = Query(...)):
    """Return raw weekday expense totals with Hebrew day names."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    day_names = {
        0: 'שני',
        1: 'שלישי',
        2: 'רביעי',
        3: 'חמישי',
        4: 'שישי',
        5: 'שבת',
        6: 'ראשון',
    }

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"days": []}

    weekday_totals = (
        expenses
        .groupby('יום_בשבוע')['סכום_מוחלט']
        .sum()
    )

    days = [
        {
            "day": day_names.get(int(d), str(d)),
            "amount": round(_sanitize(v), 2),
        }
        for d, v in weekday_totals.sort_index().items()
    ]
    return {"days": days}


@router.get("/charts/v2/trend")
async def get_trend_v2(sessionId: str = Query(...)):
    """Return cumulative balance over time."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId].copy()

    if df.empty:
        return {"points": []}

    df = df.sort_values('תאריך')
    df['cumulative'] = df['סכום'].cumsum()

    points = [
        {
            "date": row['תאריך'].strftime('%Y-%m-%d') if hasattr(row['תאריך'], 'strftime') else str(row['תאריך']),
            "balance": round(_sanitize(row['cumulative']), 2),
        }
        for _, row in df.iterrows()
    ]
    return {"points": points}


@router.get("/insights")
async def get_insights(sessionId: str = Query(...)):
    """Return smart insights derived from transaction data."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {
            "biggest_expense": None,
            "top_merchant": None,
            "expensive_day": None,
            "avg_transaction": 0,
            "large_transactions": [],
        }

    # Biggest single expense
    idx_max = expenses['סכום_מוחלט'].idxmax()
    biggest = expenses.loc[idx_max]
    biggest_expense = {
        "description": str(biggest['תיאור']),
        "amount": round(_sanitize(biggest['סכום_מוחלט']), 2),
        "date": biggest['תאריך'].strftime('%Y-%m-%d') if hasattr(biggest['תאריך'], 'strftime') else str(biggest['תאריך']),
        "category": str(biggest['קטגוריה']),
    }

    # Top merchant by count
    merchant_stats = expenses.groupby('תיאור').agg(
        count=('סכום_מוחלט', 'size'),
        total=('סכום_מוחלט', 'sum'),
    )
    top_merch = merchant_stats.sort_values('count', ascending=False).iloc[0]
    top_merchant = {
        "name": str(top_merch.name),
        "count": int(top_merch['count']),
        "total": round(_sanitize(top_merch['total']), 2),
    }

    # Most expensive day of week (by average daily spend)
    day_names = {
        0: 'שני', 1: 'שלישי', 2: 'רביעי', 3: 'חמישי',
        4: 'שישי', 5: 'שבת', 6: 'ראשון',
    }
    day_avg = expenses.groupby('יום_בשבוע')['סכום_מוחלט'].mean()
    exp_day_num = day_avg.idxmax()
    expensive_day = {
        "day": day_names.get(int(exp_day_num), str(exp_day_num)),
        "average": round(_sanitize(day_avg.loc[exp_day_num]), 2),
    }

    # Average transaction amount
    avg_transaction = round(_sanitize(expenses['סכום_מוחלט'].mean()), 2)

    # Large transactions (above 90th percentile, max 10)
    p90 = expenses['סכום_מוחלט'].quantile(0.9)
    large = expenses[expenses['סכום_מוחלט'] >= p90].nlargest(10, 'סכום_מוחלט')
    large_transactions = [
        {
            "תאריך": row['תאריך'].strftime('%Y-%m-%d') if hasattr(row['תאריך'], 'strftime') else str(row['תאריך']),
            "תיאור": str(row['תיאור']),
            "קטגוריה": str(row['קטגוריה']),
            "סכום": round(_sanitize(float(row['סכום'])), 2),
            "סכום_מוחלט": round(_sanitize(float(row['סכום_מוחלט'])), 2),
        }
        for _, row in large.iterrows()
    ]

    return {
        "biggest_expense": biggest_expense,
        "top_merchant": top_merchant,
        "expensive_day": expensive_day,
        "avg_transaction": avg_transaction,
        "large_transactions": large_transactions,
    }


@router.get("/merchants")
async def get_merchants(
    sessionId: str = Query(...),
    n: int = Query(default=8, ge=1),
):
    """Return top merchants by total spend."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"merchants": []}

    merchant_agg = (
        expenses
        .groupby('תיאור')
        .agg(
            total=('סכום_מוחלט', 'sum'),
            count=('סכום_מוחלט', 'size'),
            average=('סכום_מוחלט', 'mean'),
        )
        .sort_values('total', ascending=False)
        .head(n)
    )

    merchants = [
        {
            "name": str(name),
            "total": round(_sanitize(row['total']), 2),
            "count": int(row['count']),
            "average": round(_sanitize(row['average']), 2),
        }
        for name, row in merchant_agg.iterrows()
    ]
    return {"merchants": merchants}


@router.get("/trend-stats")
async def get_trend_stats(sessionId: str = Query(...)):
    """Return trend statistics and month-over-month changes."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {
            "max_expense": 0,
            "daily_avg": 0,
            "median": 0,
            "transaction_count": 0,
            "monthly": [],
        }

    max_expense = round(_sanitize(expenses['סכום_מוחלט'].max()), 2)
    median = round(_sanitize(expenses['סכום_מוחלט'].median()), 2)
    transaction_count = int(len(expenses))

    # Daily average: total spend / number of unique days with transactions
    unique_days = expenses['תאריך'].dt.date.nunique()
    daily_avg = round(_sanitize(expenses['סכום_מוחלט'].sum() / max(unique_days, 1)), 2)

    # Monthly totals with month-over-month change (sorted chronologically)
    expenses['month_period'] = expenses['תאריך'].dt.to_period('M')
    monthly_totals = (
        expenses
        .groupby('month_period')['סכום_מוחלט']
        .sum()
        .sort_index()
    )

    monthly_list = []
    prev_amount = None
    for month_period, amount in monthly_totals.items():
        amt = round(_sanitize(amount), 2)
        change_pct = None
        if prev_amount is not None and prev_amount != 0:
            change_pct = round(((amt - prev_amount) / prev_amount) * 100, 2)
        monthly_list.append({
            "month": month_period.strftime('%m/%Y'),
            "amount": amt,
            "change_pct": _sanitize(change_pct),
        })
        prev_amount = amt

    return {
        "max_expense": max_expense,
        "daily_avg": daily_avg,
        "median": median,
        "transaction_count": transaction_count,
        "monthly": monthly_list,
    }


@router.get("/charts/v2/heatmap")
async def get_heatmap_v2(sessionId: str = Query(...)):
    """Return category x month matrix for heatmap visualization."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"categories": [], "months": [], "data": []}

    expenses['month_period'] = expenses['תאריך'].dt.to_period('M')
    pivot = pd.pivot_table(
        expenses,
        values='סכום_מוחלט',
        index='קטגוריה',
        columns='month_period',
        aggfunc='sum',
        fill_value=0,
    )

    categories = [str(c) for c in pivot.index.tolist()]
    months = [period.strftime('%m/%Y') for period in pivot.columns.tolist()]
    data = [
        [round(_sanitize(val), 2) for val in row]
        for row in pivot.values.tolist()
    ]

    return {"categories": categories, "months": months, "data": data}


@router.get("/charts/v2/month-overview")
async def get_month_overview(
    sessionId: str = Query(...),
    month: str = Query(...),
    date_type: str = Query("transaction"),
):
    """Return income vs expenses breakdown by category for a specific month (MM/YYYY)."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId].copy()
    if df.empty:
        return {"month": month, "categories": [], "total_expenses": 0, "total_income": 0, "transaction_count": 0}

    # Group by the shift-aware month (so salaries land in their attributed month).
    df['_month'] = _month_series(df, date_type)
    month_df = df[df['_month'] == month].copy()

    if month_df.empty:
        return {"month": month, "categories": [], "total_expenses": 0, "total_income": 0, "transaction_count": 0}

    expenses = month_df[month_df['סכום'] < 0]
    income = month_df[month_df['סכום'] > 0]

    exp_by_cat = expenses.groupby('קטגוריה')['סכום_מוחלט'].sum()
    inc_by_cat = income.groupby('קטגוריה')['סכום'].sum()

    all_cats = set(exp_by_cat.index) | set(inc_by_cat.index)
    categories = []
    for cat in sorted(all_cats):
        exp_val = float(exp_by_cat.get(cat, 0))
        inc_val = float(inc_by_cat.get(cat, 0))
        categories.append({
            "name": str(cat),
            "expenses": round(_sanitize(exp_val), 2),
            "income": round(_sanitize(inc_val), 2),
        })

    # Sort by expenses descending
    categories.sort(key=lambda x: x["expenses"], reverse=True)

    total_expenses = round(_sanitize(float(expenses['סכום_מוחלט'].sum())), 2) if not expenses.empty else 0
    total_income = round(_sanitize(float(income['סכום'].sum())), 2) if not income.empty else 0

    return {
        "month": month,
        "categories": categories,
        "total_expenses": total_expenses,
        "total_income": total_income,
        "transaction_count": int(len(expenses)),
    }


@router.get("/charts/v2/industry-monthly")
async def get_industry_monthly(
    sessionId: str = Query(...),
    date_type: str = Query("transaction"),
    top_n: int = Query(default=8, ge=1, le=20),
):
    """Return expenses per category per month for stacked bar chart comparison."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()

    if expenses.empty:
        return {"months": [], "series": []}

    # Choose date column
    date_col = 'תאריך_חיוב' if (date_type == 'billing' and 'תאריך_חיוב' in expenses.columns) else 'תאריך'
    expenses['_month_period'] = expenses[date_col].dt.to_period('M')
    expenses = expenses.dropna(subset=['_month_period'])

    # Get top N categories by total spend, group the rest into "אחר"
    cat_totals = expenses.groupby('קטגוריה')['סכום_מוחלט'].sum().sort_values(ascending=False)
    top_cats = [str(c) for c in cat_totals.head(top_n).index]
    other_cats = [str(c) for c in cat_totals.iloc[top_n:].index] if len(cat_totals) > top_n else []

    # Build pivot: rows=months, cols=categories
    pivot = pd.pivot_table(
        expenses,
        values='סכום_מוחלט',
        index='_month_period',
        columns='קטגוריה',
        aggfunc='sum',
        fill_value=0,
    )
    pivot = pivot.sort_index()

    months = [period.strftime('%m/%Y') for period in pivot.index]

    series = []
    for cat in top_cats:
        if cat in pivot.columns:
            data = [round(_sanitize(float(v)), 2) for v in pivot[cat].values]
        else:
            data = [0.0] * len(months)
        series.append({"name": cat, "data": data})

    # Add "אחר" series for remaining categories so chart totals are complete
    if other_cats:
        other_data = [0.0] * len(months)
        for cat in other_cats:
            if cat in pivot.columns:
                for i, v in enumerate(pivot[cat].values):
                    other_data[i] += float(v)
        series.append({"name": "אחר", "data": [round(_sanitize(v), 2) for v in other_data]})

    return {"months": months, "series": series}


@router.get("/charts/v2/category-monthly-comparison")
async def get_category_monthly_comparison(
    sessionId: str = Query(...),
    date_type: str = Query("transaction"),
):
    """Month-by-month comparison of expenses per category.

    For every (category, month) cell returns the amount, that cell's **share of
    the month's total expenses** (pct_of_month), and the month-over-month delta
    (₪ and %). Uses the shift-aware `_month_series` so the months agree with the
    month-overview and other dashboard views. Driven by `date_type`
    (transaction|billing) so the caller can compare on either basis.
    """
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    expenses = df[df['סכום'] < 0].copy()
    empty = {"months": [], "categories": [], "month_totals": {}, "grand_total": 0}
    if expenses.empty:
        return empty

    expenses['_month'] = _month_series(expenses, date_type)
    expenses = expenses[expenses['_month'].notna() & (expenses['_month'].astype(str) != '')]
    if expenses.empty:
        return empty

    expenses['_month'] = expenses['_month'].astype(str)
    months = sorted(expenses['_month'].unique(), key=_month_key)

    # (category, month) → total, and month → total
    cat_month = expenses.groupby(['קטגוריה', '_month'])['סכום_מוחלט'].sum().to_dict()
    month_totals_series = expenses.groupby('_month')['סכום_מוחלט'].sum()
    month_totals = {
        m: round(_sanitize(float(month_totals_series.get(m, 0.0))), 2) for m in months
    }
    grand_total = round(_sanitize(float(expenses['סכום_מוחלט'].sum())), 2)

    # Categories sorted by total spend (desc)
    cat_totals = expenses.groupby('קטגוריה')['סכום_מוחלט'].sum().sort_values(ascending=False)

    categories = []
    for cat_name, cat_total_val in cat_totals.items():
        cat_total = round(_sanitize(float(cat_total_val)), 2)
        months_map = {}
        prev_amount = None
        for m in months:
            amount = float(cat_month.get((cat_name, m), 0.0))
            mt = float(month_totals_series.get(m, 0.0))
            pct = round(amount / mt * 100, 1) if mt > 0 else 0.0
            if prev_amount is None:
                delta_abs = 0.0
                delta_pct = 0.0
            else:
                delta_abs = amount - prev_amount
                if prev_amount > 0:
                    delta_pct = round((amount - prev_amount) / prev_amount * 100, 1)
                elif amount > 0:
                    delta_pct = 100.0
                else:
                    delta_pct = 0.0
            months_map[m] = {
                "amount": round(_sanitize(amount), 2),
                "pct_of_month": pct,
                "delta_abs": round(_sanitize(delta_abs), 2),
                "delta_pct": delta_pct,
            }
            prev_amount = amount
        pct_of_grand = round(cat_total / grand_total * 100, 1) if grand_total > 0 else 0.0
        categories.append({
            "name": str(cat_name),
            "total": cat_total,
            "pct_of_grand": pct_of_grand,
            "months": months_map,
        })

    return {
        "months": months,
        "categories": categories,
        "month_totals": month_totals,
        "grand_total": grand_total,
    }


# ---------------------------------------------------------------------------
# Analytics endpoints
# ---------------------------------------------------------------------------

@router.get("/analytics/recurring")
async def get_recurring_transactions(sessionId: str = Query(...)):
    """Detect recurring/subscription transactions."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if df.empty:
        return {"recurring": []}

    expenses = df[df["סכום"] < 0].copy()
    if expenses.empty:
        return {"recurring": []}

    recurring = []

    # Group by description (merchant)
    for desc, group in expenses.groupby("תיאור"):
        if len(group) < 3:
            continue

        amounts = group["סכום"].abs()
        mean_amount = amounts.mean()
        std_amount = amounts.std()

        # Check amount consistency: std < 20% of mean
        if mean_amount > 0 and (std_amount / mean_amount) > 0.2:
            continue

        # Check date regularity
        dates = pd.to_datetime(group["תאריך"], dayfirst=True, errors="coerce").dropna().sort_values()
        if len(dates) < 3:
            continue

        deltas = dates.diff().dropna().dt.days
        if deltas.empty:
            continue

        mean_delta = deltas.mean()
        std_delta = deltas.std()

        # Classify frequency
        frequency = "לא ידוע"
        if 5 <= mean_delta <= 10:
            frequency = "שבועי"
        elif 12 <= mean_delta <= 18:
            frequency = "דו-שבועי"
        elif 25 <= mean_delta <= 35:
            frequency = "חודשי"
        elif 55 <= mean_delta <= 70:
            frequency = "דו-חודשי"
        elif 80 <= mean_delta <= 100:
            frequency = "רבעוני"
        else:
            # Skip if interval is too irregular (std > 7 days)
            if std_delta > 7:
                continue

        # Estimate next expected date
        last_date = dates.iloc[-1]
        next_expected = (last_date + pd.Timedelta(days=int(mean_delta))).strftime("%Y-%m-%d")

        recurring.append({
            "merchant": str(desc),
            "average_amount": _sanitize(round(mean_amount, 2)),
            "frequency": frequency,
            "count": int(len(group)),
            "next_expected": next_expected,
            "total": _sanitize(round(amounts.sum(), 2)),
            "interval_days": _sanitize(round(mean_delta, 1)),
        })

    # Sort by total descending
    recurring.sort(key=lambda x: x["total"], reverse=True)

    return {"recurring": recurring[:20]}


@router.get("/analytics/forecast")
async def get_spending_forecast(sessionId: str = Query(...)):
    """Linear forecast of next month's spending."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if df.empty:
        return {"forecast_amount": 0, "confidence": "low", "trend_direction": "stable", "monthly_data": [], "avg_monthly": 0}

    expenses = df[df["סכום"] < 0].copy()
    if expenses.empty:
        return {"forecast_amount": 0, "confidence": "low", "trend_direction": "stable", "monthly_data": [], "avg_monthly": 0}

    expenses["date"] = pd.to_datetime(expenses["תאריך"], dayfirst=True, errors="coerce")
    expenses = expenses.dropna(subset=["date"])
    expenses["month_key"] = expenses["date"].dt.to_period("M")

    monthly = expenses.groupby("month_key")["סכום"].sum().abs().reset_index()
    monthly.columns = ["month", "amount"]
    monthly = monthly.sort_values("month")

    monthly_data = [
        {"month": str(row["month"]), "amount": _sanitize(round(row["amount"], 2))}
        for _, row in monthly.iterrows()
    ]

    avg_monthly = _sanitize(round(monthly["amount"].mean(), 2))

    if len(monthly) < 2:
        return {
            "forecast_amount": avg_monthly,
            "confidence": "low",
            "trend_direction": "stable",
            "monthly_data": monthly_data,
            "avg_monthly": avg_monthly,
        }

    # Linear regression
    x = np.arange(len(monthly), dtype=float)
    y = monthly["amount"].values.astype(float)

    coeffs = np.polyfit(x, y, 1)
    slope, intercept = coeffs
    forecast = float(slope * len(monthly) + intercept)
    forecast = max(forecast, 0)  # Can't be negative spending

    # Confidence based on R² and data points
    y_pred = np.polyval(coeffs, x)
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

    confidence = "low"
    if len(monthly) >= 6 and r_squared > 0.7:
        confidence = "high"
    elif len(monthly) >= 3 and r_squared > 0.4:
        confidence = "medium"

    trend_direction = "up" if slope > 50 else ("down" if slope < -50 else "stable")

    return {
        "forecast_amount": _sanitize(round(forecast, 2)),
        "confidence": confidence,
        "trend_direction": trend_direction,
        "monthly_data": monthly_data,
        "avg_monthly": avg_monthly,
    }


@router.get("/analytics/weekly-summary")
async def get_weekly_summary(sessionId: str = Query(...)):
    """This week vs last week comparison."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if df.empty:
        return {
            "this_week": {"total": 0, "count": 0, "top_category": ""},
            "last_week": {"total": 0, "count": 0, "top_category": ""},
            "change_pct": 0,
        }

    df_copy = df.copy()
    df_copy["date"] = pd.to_datetime(df_copy["תאריך"], dayfirst=True, errors="coerce")
    df_copy = df_copy.dropna(subset=["date"])

    if df_copy.empty:
        return {
            "this_week": {"total": 0, "count": 0, "top_category": ""},
            "last_week": {"total": 0, "count": 0, "top_category": ""},
            "change_pct": 0,
        }

    # Use the last date in data as "today" reference
    max_date = df_copy["date"].max()

    # This week: last 7 days from max_date
    this_week_start = max_date - pd.Timedelta(days=6)
    last_week_start = this_week_start - pd.Timedelta(days=7)
    last_week_end = this_week_start - pd.Timedelta(days=1)

    this_week = df_copy[(df_copy["date"] >= this_week_start) & (df_copy["date"] <= max_date) & (df_copy["סכום"] < 0)]
    last_week = df_copy[(df_copy["date"] >= last_week_start) & (df_copy["date"] <= last_week_end) & (df_copy["סכום"] < 0)]

    def week_summary(week_df):
        if week_df.empty:
            return {"total": 0, "count": 0, "top_category": ""}
        total = abs(week_df["סכום"].sum())
        count = len(week_df)
        top_cat = ""
        if "קטגוריה" in week_df.columns:
            cats = week_df.groupby("קטגוריה")["סכום"].sum().abs()
            if not cats.empty:
                top_cat = str(cats.idxmax())
        return {
            "total": _sanitize(round(total, 2)),
            "count": int(count),
            "top_category": top_cat,
        }

    tw = week_summary(this_week)
    lw = week_summary(last_week)

    change_pct = 0
    if lw["total"] > 0:
        change_pct = round(((tw["total"] - lw["total"]) / lw["total"]) * 100, 1)

    return {
        "this_week": tw,
        "last_week": lw,
        "change_pct": _sanitize(change_pct),
    }


@router.get("/analytics/spending-velocity")
async def get_spending_velocity(sessionId: str = Query(...)):
    """Daily spending rate and rolling averages."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if df.empty:
        return {"daily_avg": 0, "rolling_7day": 0, "rolling_30day": 0, "daily_data": []}

    expenses = df[df["סכום"] < 0].copy()
    if expenses.empty:
        return {"daily_avg": 0, "rolling_7day": 0, "rolling_30day": 0, "daily_data": []}

    expenses["date"] = pd.to_datetime(expenses["תאריך"], dayfirst=True, errors="coerce")
    expenses = expenses.dropna(subset=["date"])

    daily = expenses.groupby(expenses["date"].dt.date)["סכום"].sum().abs()
    daily = daily.sort_index()

    if daily.empty:
        return {"daily_avg": 0, "rolling_7day": 0, "rolling_30day": 0, "daily_data": []}

    daily_avg = daily.mean()
    rolling_7 = daily.tail(7).mean() if len(daily) >= 7 else daily.mean()
    rolling_30 = daily.tail(30).mean() if len(daily) >= 30 else daily.mean()

    # Return last 30 daily data points for sparkline
    daily_data = [
        {"date": str(date), "amount": _sanitize(round(float(amt), 2))}
        for date, amt in daily.tail(30).items()
    ]

    return {
        "daily_avg": _sanitize(round(float(daily_avg), 2)),
        "rolling_7day": _sanitize(round(float(rolling_7), 2)),
        "rolling_30day": _sanitize(round(float(rolling_30), 2)),
        "daily_data": daily_data,
    }


@router.get("/analytics/anomalies")
async def get_anomalies(sessionId: str = Query(...)):
    """Find transactions beyond 2 standard deviations from category mean."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if df.empty:
        return {"anomalies": []}

    expenses = df[df["סכום"] < 0].copy()
    if expenses.empty or "קטגוריה" not in expenses.columns:
        return {"anomalies": []}

    anomalies = []

    for cat, group in expenses.groupby("קטגוריה"):
        if len(group) < 5:
            continue

        amounts = group["סכום"].abs()
        mean_amt = amounts.mean()
        std_amt = amounts.std()

        if std_amt == 0:
            continue

        for _, row in group.iterrows():
            amt = abs(row["סכום"])
            deviation = (amt - mean_amt) / std_amt

            if deviation > 2:
                anomalies.append({
                    "description": str(row.get("תיאור", "")),
                    "amount": _sanitize(round(amt, 2)),
                    "category": str(cat),
                    "date": str(row.get("תאריך", "")),
                    "deviation": _sanitize(round(deviation, 2)),
                    "category_mean": _sanitize(round(mean_amt, 2)),
                    "category_std": _sanitize(round(std_amt, 2)),
                })

    # Sort by deviation descending, limit to 15
    anomalies.sort(key=lambda x: x["deviation"], reverse=True)

    return {"anomalies": anomalies[:15]}


@router.get("/search")
async def search_transactions(
    sessionId: str = Query(...),
    q: str = Query(..., min_length=1),
    limit: int = Query(default=20, le=50),
):
    """Full-text search across transaction descriptions and categories."""
    if sessionId not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    df = sessions[sessionId]
    if df.empty:
        return {"results": [], "total": 0}

    q_lower = q.lower()

    mask = df["תיאור"].astype(str).str.lower().str.contains(q_lower, na=False)

    if "קטגוריה" in df.columns:
        mask = mask | df["קטגוריה"].astype(str).str.lower().str.contains(q_lower, na=False)

    results_df = df[mask].head(limit)

    results = []
    for _, row in results_df.iterrows():
        results.append({
            "תאריך": str(row.get("תאריך", "")),
            "תיאור": str(row.get("תיאור", "")),
            "סכום": _sanitize(round(float(row.get("סכום", 0)), 2)),
            "קטגוריה": str(row.get("קטגוריה", "")) if "קטגוריה" in row.index else "",
        })

    return {"results": results, "total": int(mask.sum())}
