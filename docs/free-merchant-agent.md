# Free-only merchant identification

`AI_PROVIDER=gemini-free` is the production default. It never creates an
Anthropic client and has no paid fallback. When setup, storage or quota checks
fail, identification stops. `/api/ai-status` reports the mode and whether the
required configuration is present; it does not call either provider.

## Required accounts

- Gemini 2.5 Flash API key from a project with **no linked Cloud Billing**.
  Verify that state in AI Studio before setting `GEMINI_FREE_KEY_SHA256` to
  the SHA-256 of that exact key. This is a deployment attestation, not a live
  billing API check. A replacement key needs a new verification. Do not enable
  billing on this project later without revisiting this design.
- Tavily Researcher/Free account, with pay-as-you-go disabled. The backend
  checks `/usage` before every new search and refuses paid plans, any paygo
  allowance or exhausted free credits. It uses `basic`, disables automatic
  depth selection and requests at most five results. No answer/extraction.

Only normalized merchant descriptors and public search snippets are sent.
Amounts, dates, account identifiers, notes and transaction counts are excluded.
Long numbers, emails and bank-transfer descriptors are rejected locally.
The model returns one category/subcategory and a confidence estimate. Only
confidence >= 0.9 with a URL actually returned by search is accepted.
The confidence estimate is not a measured accuracy percentage.

Google's integrated Search Grounding is deliberately not used: its documented
storage/reuse restrictions do not fit a durable merchant lookup database.
Tavily provides the search evidence separately; raw search bodies are not kept.

## Persistence and limits

Apply `20261027102401_merchant_identification_cache.sql` before deploying.
Every result is stored under `(auth.uid(), canonical merchant)` in Supabase.
Resolved results do not expire automatically and are reused by categorization,
audit, subcategory selection, dashboard restores and local bank synchronization.
Manual rules and transaction pins retain precedence.

An atomic claim serializes new lookups through the owner's monthly quota row.
An in-flight lookup has a 15-minute lease; a late worker cannot overwrite a
new lease. Unresolved results wait seven days; provider failures wait one day.
The app permits at most 100 new attempts/day and 900/month per owner. Failed
attempts still count, conservatively. Provider quotas may stop work sooner.
These are request ceilings, not dollar budgets. The chosen payment policy is
zero paid usage, replacing the earlier proposed $10 Anthropic allowance.

All storage access uses the requesting user's JWT and RLS. A storage failure
prevents a new lookup. The database functions are SECURITY INVOKER, revoke
PUBLIC/anon execution and have fixed search paths. No service-role key is used.
Old snapshots/rules are not deleted or relabeled to establish the cache.

## Validation

- Backend unit tests for canonical reuse, in-flight claims, provider failures,
  missing/unverified credentials, privacy filtering and disabled Anthropic.
- Real PostgreSQL/WASM schema/RLS/lease/quota checks through
  `frontend/scripts/verify-merchant-cache.mjs`.
- Local Postman HTTP simulation in `postman/simulations/free-merchant/`.
- Existing frontend/backend/bank-sync checks and a local cache precedence test.

Live activation additionally requires user acceptance of provider terms,
verified free account settings and secrets installed only in Render's backend.
Keys must never enter frontend environment variables, Git, logs or chat.

Sources checked 2026-10-27:
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/terms
- https://ai.google.dev/api/generate-content
- https://docs.tavily.com/documentation/api-credits
- https://docs.tavily.com/documentation/api-reference/endpoint/usage
- https://docs.tavily.com/documentation/api-reference/endpoint/search
