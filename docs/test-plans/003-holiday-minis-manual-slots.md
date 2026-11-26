# Test plan: 003 — Holiday Minis: manually added mini slots
Story: `docs/stories/003-holiday-minis-manual-slots.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | Integration+E2E | tests/integration/qa/concurrency.test.ts 'Holiday Minis race' (admin creates day); e2e/booking-happy.e2e.ts Minis (ensureMiniDay) | written |
| 2 | Integration | TODO mini-days overlap/rejected list in tests/integration/qa/rules.test.ts; dev unit mini-days.test.ts | gap |
| 3 | Integration | TODO IN_PAST rejection in tests/integration/qa/rules.test.ts | gap |
| 4 | Integration | TODO remove unbooked/booked slot (MINI_DAY_HAS_BOOKINGS) in tests/integration/qa/rules.test.ts | gap |
| 5 | Integration | tests/integration/qa/concurrency.test.ts (spotsLeft 3 -> 2) | written |
| 6 | Unit (dev-owned) | tests/unit/availability.test.ts (minis ignore windows/cap) | dev-owned |
| 7 | Integration | tests/integration/qa/concurrency.test.ts Minis race (full day status) - extend to assert status 'full' | partial |
| 8 | E2E | e2e/booking-happy.e2e.ts Minis (no location question) | written |
