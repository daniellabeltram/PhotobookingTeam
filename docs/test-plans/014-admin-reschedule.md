# Test plan: 014 — Admin reschedule a booking
Story: `docs/stories/014-admin-reschedule.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | Integration | tests/integration/qa/rules.test.ts 'reschedule' (admin availability TODO) | partial |
| 2 | Integration | tests/integration/qa/rules.test.ts 'reschedule moves the slot atomically' | written |
| 3 | Integration | tests/integration/qa/rules.test.ts (clash -> SLOT_TAKEN, original kept) | written |
| 4 | Integration | TODO assert rescheduled email has .ics with SEQUENCE bumped | gap |
| 5 | Integration | tests/integration/qa/rules.test.ts (rescheduleCount); filter rescheduled=true TODO | partial |
| 6 | Integration | TODO minis reschedule | gap |
| 7 | Integration | TODO requested reschedule: stays requested, no .ics | gap |
