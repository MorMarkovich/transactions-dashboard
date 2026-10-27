# Free-only merchant identification

`AI_PROVIDER=gemini-free` is the production default. It never creates an
Anthropic client and has no paid fallback. When setup, storage or quota checks
fail, identification stops. `/api/ai-status` reports the mode and whether the
required configuration is present; it does not call either provider.

## Required accounts

- Gemini 3.5 Flash-Lite API key from a project with **no linked Cloud Billing**.
  Verify that state in AI Studio before setting `GEMINI_FREE_KEY_SHA256` to
  the SHA-256 of that exact key. This is a deployment attestation, not a live
  billing API check. A replacement key needs a new verification. Do not enable
  billing on this project later without revisiting this design.
- Tavily Researcher/Free account, with pay-as-you-go disabled. The backend
  checks `/usage` at most once per ten minutes per process/key and refuses paid plans, positive
  paygo limits, paid usage or exhausted free credits. Set
  `TAVILY_FREE_KEY_SHA256` only after verifying this exact key's account is
  free with PAYG off. The live free account returns `paygo_limit: null`; this
  value alone does not prove PAYG is disabled. The key-specific attestation
  records the dashboard verification, just as for Gemini. Do not enable
  billing or PAYG later without revisiting the configuration. It uses `basic`, disables automatic
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

The verified Tavily account check is reused for up to ten minutes because
`/usage` itself permits only ten requests per ten minutes. Each new search
atomically reserves one of the verified remaining free credits in that process;
errors do not refund it. Expiry or key rotation requires a fresh successful check,
and failed refreshes never reuse stale approval. The current single-worker
service uses a lock to prevent concurrent refreshes; horizontal scaling requires
shared account admission state. Provider free-plan enforcement, deployment
attestations and persistent owner/month quotas remain required. Billing/PAYG
must remain off; account settings are not checked continuously during this TTL.

## Model compatibility

New Google projects cannot generate with the legacy Gemini 2.5 models even
when the model metadata endpoint returns HTTP 200. Use `gemini-3.5-flash-lite`
with `thinkingLevel: minimal`, JSON output and a 4096-token output ceiling.
The ceiling includes reasoning tokens; incomplete responses are not accepted.
A live `generateContent` call with the no-billing project verified this contract.
There is no model fallback or integrated Google Search tool.

## Persistence and limits

Apply `20261027102401_merchant_identification_cache.sql` before deploying.
Every result is stored under `(auth.uid(), canonical merchant)` in Supabase.
Resolved results do not expire automatically and are reused by categorization,
audit, subcategory selection, dashboard restores and local bank synchronization.
Manual rules and transaction pins retain precedence. The existing foreign-card
trip policy also takes precedence over automatic business identification; those
descriptors are excluded from web audits. Legacy automatic rules follow the
same policy; explicitly manual rules remain exceptions. ScrapingBee, Real-Debrid
and Dodo Payments are online-service exemptions. Online-service exemptions still apply,
and an explicit manual choice can override the trip category.

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
- https://ai.google.dev/gemini-api/docs/deprecations
- https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- https://ai.google.dev/gemini-api/terms
- https://ai.google.dev/api/generate-content
- https://docs.tavily.com/documentation/api-credits
- https://docs.tavily.com/documentation/rate-limits
- https://docs.tavily.com/documentation/api-reference/endpoint/usage
- https://docs.tavily.com/documentation/api-reference/endpoint/search
