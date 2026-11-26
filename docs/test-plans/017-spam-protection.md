# Test plan: 017 — Spam protection (honeypot and rate limit)
Story: `docs/stories/017-spam-protection.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | E2E | e2e/booking-errors.e2e.ts 'honeypot is hidden' | written |
| 2 | Integration | tests/integration/qa/idempotency.test.ts 'honeypot filled' | written |
| 3 | Integration | tests/integration/qa/idempotency.test.ts 'bookingRateLimit' (run with RATE_LIMIT_DISABLED unset) | written |
| 4 | Integration | TODO availability rate limit (300 per 10 min) loop | gap |
| 5 | Integration | tests/integration/qa/rules.test.ts/tests/integration/qa/concurrency.test.ts (one retry after conflict is below limit) | partial |
| 6 | Integration | tests/integration/qa/logs-pii.test.ts | written |
