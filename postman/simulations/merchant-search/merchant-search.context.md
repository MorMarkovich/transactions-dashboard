# Merchant search HTTP validation

Run from the repository root with Postman CLI 1.73.0:
`postman simulation run postman/simulations/merchant-search/merchant-search.sim.yaml --port auto --no-history --output ndjson`.
Read the listening event; run
`python backend/scripts/verify_merchant_search_simulation.py http://127.0.0.1:PORT`.
Stop only this simulation process afterwards. Never use proxy mode.

The handler models Anthropic's documented Messages/web-search envelopes,
including successful HTTP responses containing a search error. Owner mock
lookup was skipped for this unauthenticated local run. No cloud mock was
published. Synthetic merchant names and a synthetic API key are used.

2026-10-27: PASS, five scenarios over the actual Anthropic SDK: success, failed
search, empty result, fabricated evidence URL and low confidence. The simulation
served 10 requests. This proves request/response handling, not real merchant
accuracy or live vendor availability.
