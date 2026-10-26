# Pending approvals offline simulation

## Purpose
Run the actual callback, collector, store and Supabase HTTP client against local
synthetic responses. No bank session, credentials or real financial rows.

## Execution
From the repository root: `postman simulation run postman/simulations/pending/pending.sim.yaml --port auto --no-history --output ndjson`.
Use the listening event's port with `node bank-sync/scripts/verify-pending-simulation.mjs http://127.0.0.1:PORT`.
Stop that simulation process after verification. Never use proxy mode here.

## Assumptions
Issuer fixtures follow the supplied continuation contract. Owner mock lookup was
skipped to keep this run local and unauthenticated. The storage mock covers wire
responses and CAS conflicts, not RLS, Postgres concurrency or account deletion.

## Observations
2026-10-26 local CLI 1.73.0 run: PASS, 7 scenarios; both members served requests.
14 issuer calls covered four approvals, 429, HTML challenge, partial data, explicit
empty and rollover. The actual store retained stale rows, retained unresolved
prior scope and rejected a CAS conflict; posted data stayed unchanged. Snapshot
member served 17 calls (reset, reads and writes). This does not prove live issuer
compatibility or database policies. No cloud mock lookup, push or deploy occurred.
CLI required version 1, a default handler and explicit manifest file paths.
