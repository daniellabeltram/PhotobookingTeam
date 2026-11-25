# Code-reviewer knowledge (Iris)

## Hot spots to always check in this app
- Time zone/DST handling uses the shared datetime module only.
- Slot reservation is atomic; buffers applied on both sides.
- Business values come from config, not literals.
- Admin handlers check auth first; no PII in logs.
- Tests cover each acceptance criterion; none skipped.
- Front end: async loaders (calendar month, admin slot pickers) need a stale-response guard.
- Front end: anything persisted to sessionStorage after success (confirmation keys) must not hold intake text.

## Conventions agreed in reviews
- (2026-11-25) Orchestrator rulings override docs/design/admin.md: Reschedule in v1; no search filter, no Expired chip, no refund action, no password-reset flow; Delete client data in; Approve copy says unpaid bookings are flagged "Deposit overdue" and nothing is auto-released.
- (2026-11-25) `npm run typecheck` is red repo-wide from test/e2e files (tests/helpers/builders.ts erasableSyntaxOnly + noUncheckedIndexedAccess in tests/integration/qa and e2e). Front-end scope (src, tests/unit/frontend, vite.config.ts) is clean. Review the front end with `tsc ... | grep -E "^(src|tests/unit/frontend|vite.config)"`.

## Review log
- See [reviews/2026-11-25-v1-frontend.md](reviews/2026-11-25-v1-frontend.md).
