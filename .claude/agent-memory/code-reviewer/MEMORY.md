# Code-reviewer knowledge (Iris)

## Hot spots to always check in this app
- Time zone/DST handling uses the shared datetime module only.
- Slot reservation is atomic (one CAS on days/<date>); buffer rule is gap >= max(bufferA, bufferB) between sessions, not busy-busy overlap (agreed 2026-11-25, see review log).
- Business values come from config, not literals.
- Admin handlers check auth first; no PII in logs.
- Tests cover each acceptance criterion; none skipped.
- Back end: any write that is a 'second step' after a booking CAS (release old/cancelled slot) needs a recovery path. Verified ledger entries are never re-pruned (ADR 0002), so a failed release is a permanent hold.
- Back end: retry budgets (CAS tries, email timeouts) must be judged against real Blobs latency, not the test driver (setRetryDelay 0-4 ms).
- Front end: async loaders (calendar month, admin slot pickers) need a stale-response guard.
- Front end: anything persisted to sessionStorage after success (confirmation keys) must not hold intake text.

## Conventions agreed in reviews
- (2026-11-25) Back end deliberate deviation accepted: buffer = minimum gap between two sessions, using the larger of the two buffers (story 002 #3, api.md mini spacing). ADR 0002 and architecture s9 wording should be updated to match; QA invariant helpers should use the same rule.
- (2026-11-25) Experiments: run throwaway vitest files from the scratchpad with a plain .mjs config (root = repo, include = absolute scratchpad glob); write results with appendFileSync because console output is swallowed.
- (2026-11-25) Orchestrator rulings override docs/design/admin.md: Reschedule in v1; no search filter, no Expired chip, no refund action, no password-reset flow; Delete client data in; Approve copy says unpaid bookings are flagged "Deposit overdue" and nothing is auto-released.
- (2026-11-25, now fixed: typecheck is green repo-wide as of the back-end review) `npm run typecheck` was red repo-wide from test/e2e files (tests/helpers/builders.ts erasableSyntaxOnly + noUncheckedIndexedAccess in tests/integration/qa and e2e). Front-end scope (src, tests/unit/frontend, vite.config.ts) is clean. Review the front end with `tsc ... | grep -E "^(src|tests/unit/frontend|vite.config)"`.

## Review log
- See [reviews/2026-11-25-v1-backend.md](reviews/2026-11-25-v1-backend.md).
- See [reviews/2026-11-25-v1-frontend.md](reviews/2026-11-25-v1-frontend.md).
