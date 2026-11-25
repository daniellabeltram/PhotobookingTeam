# Test plan: 016 — CSV export
Story: `docs/stories/016-admin-csv-export.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | Integration+E2E | tests/integration/qa/csv.test.ts 'filters', 'ALL rows'; e2e/admin.e2e.ts 'Export CSV downloads' | written |
| 2 | Integration | tests/integration/qa/csv.test.ts 'format' (BOM, quotes, commas, newline, accents); open in Excel/Sheets/Numbers manually | partial |
| 3 | Integration | tests/integration/qa/csv.test.ts 'format' (header order) | written |
| 4 | Integration | tests/integration/qa/csv.test.ts 'formula injection' (6 payloads) | written |
| 5 | Integration+E2E | tests/integration/qa/admin-auth.test.ts; e2e/admin.e2e.ts 'CSV link without a session' | written |
| 6 | Integration+E2E | tests/integration/qa/csv.test.ts 'format'; e2e/admin.e2e.ts | written |
| 7 | Integration | tests/integration/qa/csv.test.ts 'no match' | written |
