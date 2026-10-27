# Merchant identification agent

When a merchant is unknown, the categorizer asks Claude to use its web search
tool to identify that business. Each search request covers one merchant.
The final answer must reference a URL present in the actual search results and
report confidence of at least 0.9. Tool invocation alone, a search error inside
an HTTP 200 response, an empty result, an invented URL or malformed/duplicate
answer indices cannot authorize a classification. Confidence is a model
estimate, not a measured accuracy percentage. Recognized brands still have a
fast classification path, followed by the existing web audit.

The agent runs in the dashboard's existing post-restore background chain and
uses the configured Anthropic API key. It is not a separate always-on daemon.
No bank access is required to identify already-imported merchants. Public web
pages and merchant descriptors are treated as data, not instructions.

## Decisions and persistence

- A transaction pin wins, then an explicit manual merchant rule, then the
  curated catalog/overrides, then automatic or legacy rules and weak hints.
- Manual category and subcategory choices survive restores and in-flight AI
  responses. Changing BOLT EUO ride references map to one canonical merchant.
- Existing rules become `legacy`: their original human/automatic origin is
  unknown. Automatic saves cannot overwrite them. Conflicting old rules can
  be reviewed and saved explicitly; they are not silently promoted to manual.
- Automatic saves use insert-ignore followed by a conditional update restricted
  to `source=ai`. A manual save between those operations remains protected.
- Failed lookups remain retryable. Low-confidence proposals are not permanently
  entered into the verified ledger. Persistence failures are shown rather than
  reported as a fully completed run.

The supplied merchant examples are covered by regression tests. Confirmed trip
spend is travel; MERKAZA is food / large grocery shops. Kitan and Mika Max are
home shopping; Maya Mobile is travel connectivity. The confirmed LEVI S purchase
must receive a transaction pin, not a permanent all-purchases travel rule.
The private prepared mappings are outside the repository and contain no
credentials. No real data has been rewritten during validation.

## Verification

- Backend: full pytest suite, including manual edits during remote work,
  source precedence, search failures, invalid evidence and merchant collisions.
- Bank sync: full Node test suite, including the same dictionary examples and
  generated Python/JavaScript parity.
- Frontend: Vitest, TypeScript, ESLint and production build.
- `postman/simulations/merchant-search/merchant-search.sim.yaml`: real Anthropic
  SDK over loopback HTTP, five synthetic success/failure/evidence scenarios.
- `frontend/scripts/verify-category-rules.mjs`: real Supabase client over local
  HTTP against Postgres WASM (@electric-sql/pglite 0.5.12), using synthetic
  owner-isolated rows. Checks the actual migration, provenance, conditional
  writes, interleaved manual saves, subcategories and propagated errors.
  The HTTP adapter covers the used PostgREST subset; it is not a hosted
  Supabase end-to-end test or a parallel multi-connection PostgreSQL test.

Public merchant research and deterministic test cases establish individual
fixes, not 99% classification accuracy. That requires a labeled, representative
sample and separate measurements of accepted accuracy and unresolved coverage.
Live provider latency/cost and the deployed UI remain release checks.

## Release order

1. Apply `supabase/migrations/20261027090358_category_rule_source.sql`.
   It adds provenance; existing rules and RLS policies are retained.
2. Deploy the backend and frontend together, then update the installed local
   bank-sync release from the same tree. Do not trigger a bank sync to validate.
3. Apply only the user-confirmed merchant choices and the LEVI S transaction pin
   from the private prepared mapping file. Keep all other existing rules/pins.
4. Restore the saved dashboard snapshot and verify the eight example merchants
   plus a manual edit/reload. Starting the live dashboard can run the agent and
   persist automatic rules, so this belongs to activation, not read-only QA.

Sources for response validation:
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- https://supabase.com/docs/reference/javascript/upsert
- https://pglite.dev/docs/api
