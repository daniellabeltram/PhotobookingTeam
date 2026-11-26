# Test plan: 001 — Session type picker
Story: `docs/stories/001-session-type-picker.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | E2E+Integration | e2e/booking-happy.e2e.ts (all 5 types selectable); tests/integration/qa/rules.test.ts 'API conventions' (/api/config) | written |
| 2 | Unit (dev-owned) | tests/unit/money-deposit-text.test.ts | dev-owned |
| 3 | Integration+E2E | tests/integration/qa/rules.test.ts 'inactive or unknown type'; e2e/booking-errors.e2e.ts 'unknown or inactive type in the link' | written |
| 4 | Manual | Minis card with no mini days shows 'No mini dates open right now', select disabled; then add a mini day in admin and see next dates (needs UI) | manual |
| 5 | E2E | e2e/booking-happy.e2e.ts (summary strip persists through steps) | written |
| 6 | E2E | e2e/booking-errors.e2e.ts 'unknown or inactive type'; add ?type=families skip-picker check in e2e/booking-happy.e2e.ts (TODO when UI lands) | partial |
| 7 | Unit (dev-owned) | tests/unit/config-schema.test.ts (changing price/description changes /api/config) | dev-owned |
| 8 | E2E | e2e/booking-errors.e2e.ts 'offline' covers network; config 500 via page.route (TODO) | partial |
| 9 | E2E | e2e/a11y.e2e.ts (no horizontal scroll on phone project); tap-target check TODO in e2e/a11y.e2e.ts | partial |
