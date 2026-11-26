# Test plan: 007 — Booking creation and confirmation screen
Story: `docs/stories/007-booking-confirmation-screen.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | Integration | tests/integration/qa/rules.test.ts 'lifecycle' (instant vs request) | written |
| 2 | Integration | tests/integration/qa/rules.test.ts 'references are unique' | written |
| 3 | E2E | e2e/booking-happy.e2e.ts (all instant types) | written |
| 4 | E2E | e2e/booking-happy.e2e.ts 'Confirmation survives reload' | written |
| 5 | E2E | e2e/booking-errors.e2e.ts 'offline at submit' | written |
| 6 | Integration | tests/integration/qa/dst.test.ts 'same ET time in response, admin, .ics' | written |
| 7 | E2E | e2e/booking-happy.e2e.ts (scrollWidth check on phone project) | written |
| 8 | E2E | e2e/booking-happy.e2e.ts 'Events: request flow' | written |
