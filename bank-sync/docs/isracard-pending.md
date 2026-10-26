# Pending approvals: local implementation, not activated in production

## What changed
The posted scraper reads monthly posted transactions, not the separate approvals
partition. The new runtime collects approvals inside the existing successful
session only for an explicitly enabled binding. Pending results stay outside
saved_transactions, normalization, settled totals, budgets and exports. MAX
remains retired and its history is preserved.

A binding includes a new immutable source UUID, authenticated dashboard user,
discovered company (11/77), partner flag and card suffix. Suffix alone is never
enough. pending:setup is an explicit interactive discovery/enable operation, not
an install/startup side effect. Credential replacement first invalidates the old
binding; failed invalidation stops the change.

## Contract and retention
The contract comes from the supplied 2026-10-26 continuation. It was not checked
against an authenticated issuer session in this fix. Only PENDING_ENDPOINTS' two
exact routes are allowed. Redirects, challenges, oversized/unknown responses fail
closed; no retries. Both requests share a 25-second outer budget.

Scope comes from the discovered Next billing period. Identity contains the native
location, string sequence and string timestamp plus scope. No matching by amount,
merchant or date. ILS only; FX or malformed data fails the whole observation.

Successful explicit empty replaces current rows for that scope. Failure retains
prior rows as stale. Rollover keeps prior nonempty scopes separately as unresolved.
At 12 unresolved scopes the next rollover blocks instead of deleting evidence.
Disappearance never proves that a charge posted.

Storage uses owner-scoped pending_card_snapshots and a versioned CAS RPC. The
release migration is `supabase/migrations/20261026211104_pending_card_snapshots.sql`.
Its foreign key cascades on account deletion without replacing the existing
account-deletion function. Privileged writes live in an unexposed private schema;
the public RPC is an invoker wrapper. Writes validate the complete snapshot and
lock the auth user before pending rows, preventing deletion races and writes from
a deleted user's still-valid JWT. Owner reads use forced RLS; direct writes are
denied. The owner quota is atomic.

## Hang containment
Upstream initializes outside its cleanup boundary. The adapter now cleans up
initialization failures and checks that its owned browser exited. The default
adapter runs in a separate process with a five-minute parent deadline.

A timeout, crash or unconfirmed cleanup reports BANK_CLEANUP_REQUIRED, aborts the
whole sync before the next account or posted snapshot write, and retains the
local lock. This cannot guarantee termination of a macOS process stuck in kernel
I/O. Locks are never automatically deleted; unrelated processes are never killed.
The existing legacy lock remains untouched. KEEP_BROWSER_OPEN is rejected by this
path. Diagnostics use fixed stages/codes, never credentials or raw replies.

## Dashboard
VITE_PENDING_APPROVALS=true enables the separate RTL panel after schema/binding
readiness. Default off; hidden in sample mode. It reads only the signed-in user's
snapshots and shows card/source, billing scope, observation times, stale/read
failures and separate unresolved periods. Invalidated bindings hide old rows.
Older than 24 hours or more than five minutes in the future is stale.

Panel refresh reads saved data only, never connects to a bank. Month, category
and owner filters do not apply, as explained in the panel. Failed reads retain
prior visible data with a warning. User changes unmount old state. Bank refresh
now distinguishes pending warnings and cleanup failures.

## Validation and release boundary
bank-sync tests exercise actual installed scraper classes with fake browsers at
four initialization failures, plus real synthetic workers that succeed, fail,
crash or hang. Parser/session/storage/binding/invalidation regressions run offline.

The Postman simulation runs the actual callback, collector, store and Supabase
HTTP client against loopback contract fixtures. Its context document records the
run and limits. Frontend tests cover four approvals, malformed data, stale
retention, invalidation, rollover and user-switch races. No personal data is used.

On 2026-10-26 the migration passed 31 real PostgreSQL 17.6 / PostgREST 16.5 checks
on two fresh disposable loopback databases, using synthetic users and rows only.
Tests cover RLS, direct-write denial, concurrent CAS and quota, malformed payloads,
unchanged posted data, account deletion and both write/delete lock orders. The
second run uses the same prepare/verify split as the new CI database job.
All 222 bank-sync tests, 165 frontend tests, frontend lint and the full production
build (including icon generation) passed under Node 24.19.0. Docker itself is not
available on this Mac; the image build and hosted CI remain unexecuted.

Read-only production metadata confirms PostgreSQL 17.6 and that the pending table,
RPC and private schema do not yet exist. No personal rows were queried. The
Docker build now forwards VITE_PENDING_APPROVALS; it remains false by default.

The additive production migration was subsequently approved and applied as
20261026211104. RLS, grants, cascade and the unchanged deletion-function hash were
verified. Remaining activation: deployment with the display flag, explicit local
binding and one authorized real observation. No bank operation was performed.
The four real missing purchases
have not been recovered or fabricated. See `release-2026-10-26.md` for the exact
release order, rollback and verification boundaries.
