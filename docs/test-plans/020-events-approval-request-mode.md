# Test plan: 020 — Events approval (request mode)
Story: `docs/stories/020-events-approval-request-mode.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | Integration | tests/integration/qa/rules.test.ts 'lifecycle' (requested); tests/integration/qa/admin-auth.test.ts | written |
| 2 | Integration | tests/integration/qa/concurrency.test.ts 'different types' pattern; TODO Events vs instant race | partial |
| 3 | E2E | e2e/booking-happy.e2e.ts 'Events: request flow' | written |
| 4 | E2E | e2e/booking-happy.e2e.ts 'Events' (no pay, no calendar, no hold text) | written |
| 5 | E2E | e2e/booking-happy.e2e.ts (outbox has event request email) | partial |
| 6 | Integration | TODO admin notice subject in tests/integration/qa/rules.test.ts via sentEmails() | gap |
| 7 | Integration | tests/integration/qa/idempotency.test.ts | written |
| 8 | Integration | TODO waitingLabel ('Waiting 2 days 5 h') with later FAKE_NOW | gap |
| 9 | Integration | TODO reply_overdue flag | gap |
| 10 | Integration | TODO session_time_passed: approve not offered | gap |
| 11 | E2E+Integration | e2e/admin.e2e.ts 'approve'; tests/integration/qa/rules.test.ts 'Events approve' | written |
| 12 | Integration | TODO approval email content | gap |
| 13 | Integration | tests/integration/qa/rules.test.ts 'Events approve' (holdStartedAt = approvedAt) | written |
| 14 | Integration | tests/integration/qa/rules.test.ts 'email failure' pattern; approval variant TODO | partial |
| 15 | E2E | e2e/admin.e2e.ts 'decline' (dialog) | partial |
| 16 | E2E | e2e/admin.e2e.ts 'decline frees the slot' | written |
| 17 | Integration | TODO decline email subject/body and notifyClient=false | gap |
| 18 | Integration | tests/integration/qa/admin-auth.test.ts 'stale expectedVersion' | written |
| 19 | Integration | tests/integration/qa/admin-auth.test.ts (declined is final) | written |
| 20 | Integration | tests/integration/qa/rules.test.ts 'double-submitting' | written |
| 21 | Integration | tests/integration/qa/admin-auth.test.ts 'Mark paid on a request is INVALID_TRANSITION' | written |
| 22 | Integration | tests/integration/qa/admin-auth.test.ts 'approve/decline direct requests' (401) | written |
| 23 | E2E | TODO network failure on approve via page.route | gap |
| 24 | E2E | e2e/booking-happy.e2e.ts (instant types show no request wording) | partial |
