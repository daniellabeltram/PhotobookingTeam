# Test plan: 015 — Admin blocked dates and times
Story: `docs/stories/015-admin-blocked-times.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | E2E | e2e/admin.e2e.ts 'blocking a date' | written |
| 2 | Integration+E2E | tests/integration/qa/rules.test.ts 'blocked times'; e2e/admin.e2e.ts | written |
| 3 | Integration+E2E | tests/integration/qa/rules.test.ts; e2e/admin.e2e.ts 'block over an existing booking' | written |
| 4 | Integration+E2E | tests/integration/qa/rules.test.ts 'end before start'; e2e/admin.e2e.ts 'end before start' | written |
| 5 | Integration+E2E | tests/integration/qa/rules.test.ts; e2e/admin.e2e.ts (Remove block) | written |
| 6 | Integration+E2E | tests/integration/qa/rules.test.ts (label never in public availability) | written |
| 7 | Integration | tests/integration/qa/dst.test.ts 'all-day block and time-range block' | written |
