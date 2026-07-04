# CLAUDE.md — project memory

Hebrew/RTL credit-card & bank analyzer ("מנתח עסקאות"). This file is auto-loaded
each session so context carries over. **Never put secrets here** (it's committed).

## Architecture
- **frontend/** — React 19 + TypeScript + Vite + Tailwind v4, Recharts, Framer Motion, React Router 7. RTL/Hebrew.
- **backend/** — FastAPI (Python 3.11), Pandas. Sessions are an **in-memory** `sessions: dict[str, pd.DataFrame]` (wiped on Render cold-start; the frontend re-restores from Supabase).
- **bank-sync/** — a **local** Node tool the user runs on their own Mac. Scrapes Israeli banks (`israeli-bank-scrapers`), writes a transaction snapshot to the user's Supabase. NOT deployed (Docker image copies only frontend/ + backend/).
- **Supabase** — `saved_transactions` (JSONB snapshots) + `user_category_rules`; RLS; new-style `sb_publishable_…` anon key. bank-sync and the dashboard both sign in **as the user** with the anon key — **never `service_role`**.

## Deploy
- Render free tier, single Docker service, **auto-deploys from `main`**.
- Backend/frontend changes go live only when merged to `main`. bank-sync changes are pulled locally by the user.
- Workflow: develop on branch **`claude/adoring-goldberg-l1dc69`**, then fast-forward `main` and push to deploy.
- `ANTHROPIC_API_KEY` is set on Render (enables the AI categorizer).

## Security rules (do not violate)
- **Never** ask for / accept the user's bank passwords, Supabase login, or sync token. They live only in the OS keychain.
- Never use the Supabase `service_role` key.
- `.gitignore` blocks `.env`, secrets, and `debug/`. Don't commit secrets.

## Domain decisions (locked)
- **Per-person owner attribution** (`_owner`): מור / שלי / משותף(joint). A *personal* account forces its owner; a *joint* account splits by salary keyword (`בנק פועלים משכורת`→מור, `ישראכרט מש משכורת`→שלי). **בנק דיסקונט must be joint (משותף).**
- **Accounts**: discount (joint bank), MAX (מור), Isracard `isracard`=מור, Isracard `isracard-2`=שלי.
- **Income-month shift**: end-of-month salaries (day ≥25) attributed to the *next* month. bank-sync records this in the `חודש` / `חודש_חיוב` columns. **All month grouping must go through `_month_series()` in routes.py** — never re-derive the month from the raw date (that discards the shift).
- **Categorization**: ~1000-keyword catalog. Source of truth = `backend/app/core/constants.py`; `bank-sync/src/categorize.js` is **generated to match it** (regenerate after edits, keep them identical). Foreign card transactions (trailing 2-letter country code, no Hebrew, not `IL`) → `טיסות ותיירות`. Leftover `שונות` → AI fallback (Claude + web search) in restore-session; returned as `ai_categorized` and persisted as user rules.
- **Unconditional overrides** (Psagot→`העברה להשקעות`, foreign-card→travel, AI tools→`בינה מלאכותית`) live in `data_processor.apply_unconditional_overrides()` — shared by `process_data` and `restore_session` so they never drift, and run on **all** rows (AI tools migrate even pre-tagged `חשמל ומחשבים` charges on restore). `AI_OVERRIDE_KEYWORDS` is the curated AI-tool list.
- **`בינה מלאכותית` (AI)** is a top-level category (icon 🤖) for AI-tool spend (ChatGPT/Claude/Midjourney/…), kept out of `חשמל ומחשבים`.
- **Subcategories** (`קטגוריה_משנה`): keyword-seeded via `SUBCATEGORY_KEYWORDS` (scoped per parent) in `data_processor.derive_subcategory()` (runs **after** user rules, fills only empties), plus manual assignment persisted as `user_category_rules.subcategory` (**run the idempotent `ALTER` in `supabase_setup.sql` once in Supabase**). Catalog exposed via `GET /api/categories/catalog`.
- **Month-by-month category comparison**: `GET /api/charts/v2/category-monthly-comparison` (shift-aware `_month_series`, `date_type`), each cell carries amount + `pct_of_month` + MoM delta.
- **Card-bill payments** (bank-row outbound matching card keywords) are stripped to avoid double-counting. **Installments** are split per billing month. `שונות` should be rare (genuine one-offs only).

## bank-sync commands (run locally)
- `npm run setup` — manage account registry + creds (keychain). Shows each account's current owner; can update a login.
- `npm run sync` — scrape + **merge** (never wipes). `ACCOUNTS=isracard-2 npm run sync` limits to specific account keys.
- `npm run resync` — full re-pull (`--fresh`). Now **preserves** rows for accounts that fail mid-run; keeps last 3 snapshots as backups.
- `npm run retag` — re-attribute `_owner` AND re-run the keyword catalog on `שונות` rows in the stored snapshot, **no bank login** (use after owner changes, catalog updates via `git pull`, or while a provider is blocked). Needed because `mergeSnapshots` never overwrites stored fields — new catalog keywords don't reach old rows via `npm run sync`.
- `npm run check` — read-only sanity report (accounts, per-owner split, uncategorized `שונות`, sign/outlier checks).
- Isracard anti-bot ("Block Automation" / HTTP 429): run headful (`SHOW_BROWSER=true` in `.env`), space logins out, and pull the two Isracard cards in **separate** runs (delays via `ACCOUNT_DELAY_MS` / `SAME_PROVIDER_DELAY_MS`).

## Tests
- bank-sync: `cd bank-sync && node --test` (categorizer/normalizer/owner/income).
- backend: `pytest` in `backend/` (e.g. `tests/test_month_attribution.py`).
- Sandbox note: pandas 3.0 here triggers a numpy-int JSON-serialize quirk in FastAPI's encoder; prod pins pandas 2.x. Verify endpoint logic by calling the handler functions directly.
