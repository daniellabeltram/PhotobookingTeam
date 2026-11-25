# Test plan: 012 — Admin booking detail
Story: `docs/stories/012-admin-booking-detail.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | E2E | e2e/admin.e2e.ts 'list ... detail' | written |
| 2 | E2E | e2e/admin.e2e.ts (tel:/mailto: hrefs) | written |
| 3 | E2E | e2e/admin.e2e.ts (policy version); tests/integration/qa/rules.test.ts stored policy | written |
| 4 | Integration | tests/integration/qa/rules.test.ts lifecycle/reschedule history | written |
| 5 | Integration | tests/integration/qa/rules.test.ts 'email failure ... resend' | written |
| 6 | Integration | tests/integration/qa/admin-auth.test.ts/tests/integration/qa/rules.test.ts 'not-a-ref' 404; UI message TODO | partial |
| 7 | Integration | tests/integration/qa/csv.test.ts 'deleted client data' | written |
| 8 | E2E | TODO: book with <img onerror> text, assert no execution in admin detail | gap |
| 9 | Integration | tests/integration/qa/admin-auth.test.ts 'approve/decline direct requests' (allowedActions in tests/integration/qa/rules.test.ts) | written |
| 10 | Integration | tests/integration/qa/admin-auth.test.ts stale/declined; tests/integration/qa/rules.test.ts | written |
