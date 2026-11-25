# Test plan: 013 — Admin status changes (approve, decline, mark paid, confirm, cancel, complete)
Story: `docs/stories/013-admin-status-changes.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | Integration | tests/integration/qa/rules.test.ts 'mark paid' | written |
| 2 | Integration | tests/integration/qa/rules.test.ts 'confirm_without_payment requires a note' | written |
| 3 | Integration | tests/integration/qa/rules.test.ts 'mark paid ... email' | written |
| 4 | E2E+Integration | e2e/admin.e2e.ts 'cancel'; tests/integration/qa/rules.test.ts | written |
| 5 | Integration | tests/integration/qa/rules.test.ts (complete rejected before start); completed after start needs later FAKE_NOW TODO | partial |
| 6 | Integration | tests/integration/qa/admin-auth.test.ts 'approve/decline direct requests'; tests/integration/qa/rules.test.ts lifecycle | written |
| 7 | Integration | tests/integration/qa/rules.test.ts (history by/from/to) | written |
| 8 | Integration | tests/integration/qa/admin-auth.test.ts 'stale expectedVersion' | written |
| 9 | E2E | TODO PATCH aborted via page.route | gap |
| 10 | E2E | e2e/admin.e2e.ts 'Events request: approve' and 'decline' | written |
| 11 | Integration | tests/integration/qa/rules.test.ts 'double-submitting' | written |
| 12 | E2E | e2e/admin.e2e.ts cancel flow with reason deposit_not_received TODO variant | partial |
