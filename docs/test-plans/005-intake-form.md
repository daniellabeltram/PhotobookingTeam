# Test plan: 005 — Intake form (common and per-type fields)
Story: `docs/stories/005-intake-form.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | E2E | e2e/booking-happy.e2e.ts 'Conditional intake fields' | written |
| 2 | E2E | e2e/booking-errors.e2e.ts 'intake validation' | written |
| 3 | Integration+E2E | tests/integration/qa/rules.test.ts server-validation table; e2e/booking-errors.e2e.ts 'intake validation' | written |
| 4 | Integration | tests/integration/qa/rules.test.ts 'server-side validation' table | written |
| 5 | Integration+E2E | tests/integration/qa/rules.test.ts 'Couples above max'; e2e/booking-errors.e2e.ts 'Couples: more than the maximum' | written |
| 6 | E2E | e2e/booking-happy.e2e.ts Events uses 'Enter my own'; help-me-choose flag in admin TODO | partial |
| 7 | Integration | surprise_proposal flag: TODO assert flags in admin detail (couples surpriseProposal true) | gap |
| 8 | Integration | tests/integration/qa/rules.test.ts 'Events end must be after start' | written |
| 9 | Unit (dev-owned) | tests/unit/booking-schema.test.ts (shared client/server length) | dev-owned |
| 10 | E2E | e2e/booking-errors.e2e.ts policies 'Edit details'; back-navigation TODO spec | gap |
| 11 | E2E | e2e/a11y.e2e.ts (labels via getByLabel in all flows); keyboard types in e2e/keyboard.e2e.ts | partial |
