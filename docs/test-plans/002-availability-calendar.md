# Test plan: 002 — Availability calendar and slot generation
Story: `docs/stories/002-availability-calendar.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | Unit (dev-owned) | tests/unit/availability.test.ts (grid and window fit) | dev-owned |
| 2 | Integration | tests/integration/qa/rules.test.ts 'working days' | written |
| 3 | Integration | tests/integration/qa/rules.test.ts 'buffers'; tests/integration/qa/concurrency.test.ts 'buffer overlap' | written |
| 4 | Integration+E2E | e2e/admin.e2e.ts 'cancel ... slot is offered again'; e2e/admin.e2e.ts 'decline frees the slot' | written |
| 5 | Integration | tests/integration/qa/rules.test.ts 'minimum notice' | written |
| 6 | Integration | tests/integration/qa/rules.test.ts 'horizon' | written |
| 7 | Integration | tests/integration/qa/concurrency.test.ts 'daily cap holds under concurrency' | written |
| 8 | Integration+E2E | tests/integration/qa/rules.test.ts 'blocked times'; e2e/admin.e2e.ts 'blocking a date removes it for clients' | written |
| 9 | Unit (dev-owned) | tests/unit/availability.test.ts (mini slots block other types) | dev-owned |
| 10 | E2E | e2e/booking-happy.e2e.ts Events (duration select); tests/integration/qa/dst.test.ts events length | written |
| 11 | E2E+Integration | phone project runs in America/Los_Angeles, desktop in UTC (playwright.config.ts); tests/integration/qa/dst.test.ts | written |
| 12 | Integration | tests/integration/qa/dst.test.ts (all describe blocks, both dates, plus the DST week) | written |
| 13 | E2E | loading/error states: TODO spec 'times request fails' once UI lands | gap |
| 14 | Manual | Empty calendar shows 'No open times right now' (set FAKE_NOW beyond horizon) | manual |
| 15 | Integration | tests/integration/qa/concurrency.test.ts (second load after create); e2e/admin.e2e.ts cancel/block | written |
| 16 | E2E | e2e/keyboard.e2e.ts; e2e/a11y.e2e.ts | written |
