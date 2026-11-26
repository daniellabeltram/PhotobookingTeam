# Test plan: 009 — Deposit payment link and `pending_deposit` status
Story: `docs/stories/009-deposit-payment-link.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | E2E | e2e/booking-happy.e2e.ts (Pay my retainer visible) | written |
| 2 | Manual | Payment link includes client_reference_id; text tells client to include the reference | manual |
| 3 | Integration | tests/integration/qa/rules.test.ts 'lifecycle' (estimated_deposit, no link, holdHours null) | written |
| 4 | Integration | TODO Minis amountDue kind=full == price (add to tests/integration/qa/concurrency.test.ts Minis block) | gap |
| 5 | Integration | tests/integration/qa/rules.test.ts (stays pending_deposit until mark_paid) | written |
| 6 | Unit (dev-owned) | tests/unit/payment-link-missing.test.ts | dev-owned |
| 7 | Integration | tests/integration/qa/rules.test.ts 'Events approve' (hold from approvedAt); overdue with later FAKE_NOW TODO | partial |
| 8 | Integration | tests/integration/qa/concurrency.test.ts; e2e/admin.e2e.ts cancel | written |
