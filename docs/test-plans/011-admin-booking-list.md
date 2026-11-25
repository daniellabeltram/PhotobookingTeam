# Test plan: 011 — Admin booking list with filters
Story: `docs/stories/011-admin-booking-list.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | E2E | e2e/admin.e2e.ts 'list shows a new booking' | written |
| 2 | Integration | TODO status filter combos in tests/integration/qa/rules.test.ts | gap |
| 3 | Integration | tests/integration/qa/csv.test.ts 'filters apply' (same filter parser) | partial |
| 4 | Integration | TODO view=past ordering | gap |
| 5 | E2E | e2e/admin.e2e.ts (filters in URL) | partial |
| 6 | E2E | TODO empty-filter state | gap |
| 7 | E2E | TODO list error state via page.route | gap |
| 8 | Integration | TODO summary counts | gap |
| 9 | Integration | tests/integration/qa/csv.test.ts 'exports ALL'; paging check TODO (pageSize) | partial |
| 10 | E2E | e2e/a11y.e2e.ts (phone + desktop projects) | written |
| 11 | Integration | TODO waitingLabel for requested | gap |
| 12 | Integration | tests/integration/qa/rules.test.ts 'Events approve' | partial |
