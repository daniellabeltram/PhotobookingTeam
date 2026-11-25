# Test plan: 004 — Double-booking protection
Story: `docs/stories/004-double-booking-protection.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | Integration+E2E | tests/integration/qa/concurrency.test.ts '20 parallel creates', 'alternatives are nearest'; e2e/booking-errors.e2e.ts 'slot taken at submit' | written |
| 2 | Integration | tests/integration/qa/concurrency.test.ts 'different types' | written |
| 3 | Integration | tests/integration/qa/rules.test.ts 'minimum notice' (stale slot), 'blocked times' | written |
| 4 | E2E | e2e/booking-errors.e2e.ts 'slot taken at submit' (checkbox kept, rebook works) | written |
| 5 | Unit (dev-owned) | tests/unit/alternatives.test.ts (empty list) | dev-owned |
| 6 | Integration | tests/integration/qa/idempotency.test.ts | written |
| 7 | Integration | tests/integration/qa/concurrency.test.ts '20 parallel creates' (also run vs preview per docs/operations.md section 6) | written |
| 8 | Integration | tests/integration/qa/concurrency.test.ts 'Holiday Minis race' | written |
| 9 | Integration | tests/integration/qa/concurrency.test.ts '20 parallel over 5 slots' uses findOverlaps invariant | written |
