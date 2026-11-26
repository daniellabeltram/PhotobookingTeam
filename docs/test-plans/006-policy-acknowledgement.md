# Test plan: 006 — Policy acknowledgement with stored version and timestamp
Story: `docs/stories/006-policy-acknowledgement.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | E2E | e2e/booking-errors.e2e.ts 'policies step: summary' | written |
| 2 | Unit (dev-owned) | tests/unit/policy-render.test.ts | dev-owned |
| 3 | E2E | e2e/booking-errors.e2e.ts 'policy required' | written |
| 4 | Integration | tests/integration/qa/rules.test.ts 'policy: missing, false, or stale' | written |
| 5 | Integration | tests/integration/qa/rules.test.ts 'policy version and server-time acceptance are stored' | written |
| 6 | Unit (dev-owned) | tests/unit/config policies versions (old version stays viewable via GET /api/policies/:version); QA smoke in rules.test.ts 404 check | dev-owned |
| 7 | E2E | TODO: open full policies page and return (needs UI) | gap |
| 8 | E2E | e2e/a11y.e2e.ts '/policies.html' | written |
