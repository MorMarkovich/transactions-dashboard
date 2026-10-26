# Pending approvals

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
The initial contract came from the supplied 2026-10-26 continuation and was
verified against an authorized issuer session on 2026-10-27. Only PENDING_ENDPOINTS' two
exact routes are allowed. Redirects, challenges, oversized/unknown responses fail
closed; no retries. Both requests share a 25-second outer budget.

2026-10-27 compatibility correction: scraper 6.9.0 leaves the authenticated page
on `digital.isracard.co.il`; pending requests target `web.isracard.co.il`. The
hook now follows the normal `/transactions` page in that same browser session
before reading pending data, with a separate 15-second outer deadline. It stops
on authentication redirects, HTTP errors or an unexpected origin. It does not
copy cookies, weaken browser protections or change the login implementation.
The official transactions bundle (SHA256
`236f9f87e7ec470b4a8b8f63d48831dab74e02efd1b8478718c183034a435a64`)
uses a string company code for GetCardList and a numeric code for transaction
requests. The transport and synthetic fixtures now preserve that distinction.
Discovery failures retain fixed diagnostic codes through the CLI boundary.
The user's authenticated browser request on 2026-10-27 confirmed GetCardList uses
the combined string code `99`; its response carries each card's actual company
(`11` or `77`). Discovery and collection now use one combined-list request and
still match the complete company/partner/suffix tuple. Real pending row field
types and the selected Next billing period were inspected in that same browser;
no cookies, authentication headers or raw responses were exported.
An explicitly authorized pending-only run then completed discovery, binding,
collection and authenticated database readback successfully. The owned browser
and local lock were cleaned up. Posted snapshots and other issuer accounts were
outside that run's write/contact scope. Private live counts and values remain in
the local task report, not repository fixtures. This correction must also be
installed in the local bank-sync tool: deploying the dashboard alone does not
update the local scraper.

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
The initial release passed 222 bank-sync tests, 165 frontend tests, frontend lint
and the full production build under Node 24.19.0. All eight hosted CI jobs,
including the container build, passed for release commit `40fc9da`.

The approved additive migration was applied as 20261026211104. RLS, grants,
cascade and the unchanged deletion-function hash were verified. The dashboard
was deployed with VITE_PENDING_APPROVALS=true and checked live. Authorized local
bindings and pending-only observations subsequently completed with authenticated
database readback. Original historical missing purchases are not inferred from
today's pending counts.

This compatibility correction passes 231 bank-sync tests and all ten local
Postman HTTP simulation scenarios. Live issuer evidence is recorded separately
from synthetic fixtures. See `release-2026-10-26.md` for the initial release
order, rollback and verification boundaries.
