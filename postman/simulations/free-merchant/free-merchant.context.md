# Free merchant identification HTTP validation

Start `frontend/scripts/verify-merchant-cache.mjs` with the installed PGlite
module path and `--serve`. It validates the real SQL migration, then prints a
loopback URL for the owner-isolated PostgREST subset used by the backend.
Start this simulation using `postman simulation run` with `--port auto
--no-history --output ndjson`. Use its listening event, then run
`python backend/scripts/verify_free_agent_simulation.py PROVIDER_URL STORAGE_URL`.
Stop only these two local processes. Never use proxy mode or real keys.

2026-10-27: eight scenarios passed over the actual backend httpx clients:
success, empty results, invented source URL, uncertain answer, malformed JSON,
paid account, pay-as-you-go enabled, and provider quota. Repeated canonical
merchant requests and later audit/subcategory phases made no new provider
calls. Paid/paygo accounts made zero searches and zero Gemini calls.

The mock was written from Tavily's `/usage` and `/search` documentation and
Google's `generateContent` schema. An owner-published mock was not available.
This proves request handling, free-only guards and SQL persistence using
synthetic data. It does not prove live provider availability, merchant accuracy
or that an actual Google project has billing disabled. PGlite is a single
database engine; true concurrent PostgreSQL connections remain a release check.
