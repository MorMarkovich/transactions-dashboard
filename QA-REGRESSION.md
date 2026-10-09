# QA regression list and visual checklist

Every user-found visual bug goes in the table below. Every deploy verification
re-checks each entry and says so in its report (pass, fail, or not checked, with
the reason). Add new entries in the same PR as the fix.

## Regression list

| ID | Found | Bug | Root cause | Fixed in | Check | Automated |
|----|-------|-----|------------|----------|-------|-----------|
| R1 | 2026-10-09 (Mor) | Login email field: placeholder and icon left-aligned (LTR) while the password field was RTL. Same on register and forgot-password. | The shared `Input` forced `type=email/url/tel` to LTR with the icon on the left. | #115 | On login, register and forgot-password, at 1280 and 390: every field is RTL, icon on the right, placeholder on the right. | Yes: `e2e/tests/auth-alignment.spec.ts` (fails on the old Input, passes on the fix). |
| R2 | 2026-10-09 (Mor) | Category summary: a "hide category" x button with its tooltip stuck visible over the top-left of each card, covering the first digit of the amount. | A global `.main-content .category-hide-btn {min-width:36px;min-height:36px}` turned the 16px dot into a 36px disc over the amount. It was always visible at opacity 0.4. | #115 | Dashboard, category summary cards, desktop: the button is hidden until card hover or keyboard focus, 24px, in the bottom-left corner, never overlapping the amount. Mobile 390: visible, bottom-left, not over the amount. Tooltip disappears when the pointer leaves. | Not yet. Needs a logged-in fixture with data. Manual until then. |
| R3 | 2026-10-09 (QA) | Sample-data banner rendered at the bottom of the dashboard. | `.studio-dashboard` positions children by CSS `order`; an extra child lands last (`order:8`). | #114 | Load the sample as a non-owner user: the banner is the first thing under the header at 1280 and 390. | Not yet. |

New users (non-owner accounts) must be tested too: the empty state, the wizard
and the sample data are separate surfaces from the owner view.

## Visual checklist (run for every changed surface and the pages that share its components)

Run at desktop (1280) and mobile (390). Look at real screenshots, not the DOM.

1. RTL and LTR alignment: every input, select, textarea and button label. Placeholder, typed text and icon sit on the same side. No field in a form differs from its neighbours.
2. Icons: on the right in RTL, vertically centred, not overlapping text.
3. Hover-only controls: hidden until hover or focus on desktop, reachable by keyboard, visible without hover on touch.
4. Tooltips: appear on hover or focus, disappear when the pointer leaves or focus moves, never stick, never cover the value they describe.
5. Overlaps and clipping: no element covers a number, label or control. Check large values (6 digits and up, with the shekel sign) and long Hebrew names.
6. Overflow: no horizontal scroll at 390 and 320. Nothing cut off at the edges.
7. Touch targets at 390: at least 36px, not overlapping neighbours.
8. States: empty, loading, error and populated. Light and dark theme.
9. Layout order: a new element inside a CSS-grid page container (`.studio-dashboard` uses `order`) must be placed on purpose.
10. Shared components: when a shared component changes (`Input`, `Card`, `Button`, layout), check every page that uses it, not only the page being fixed.

## Automated visual checks

`e2e/` holds Playwright layout tests that run in CI against the production
build (dummy Supabase env, no network). Run locally:

    cd frontend && VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=test npm run build
    cd ../e2e && npm ci && npx playwright install chromium && npx playwright test

The tests assert computed layout (direction, alignment, icon side, overflow)
rather than pixel diffs, so they need no baseline images and do not flake on
font rendering. Screenshots are attached to the HTML report as a CI artifact.

Next to cover: the logged-in dashboard with a mocked API (R2), transactions,
categories, insights.
