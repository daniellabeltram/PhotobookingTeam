# Test plan: 008 — Confirmation emails to the client and Daniella, with .ics
Story: `docs/stories/008-confirmation-emails.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | E2E | e2e/booking-happy.e2e.ts (outbox contains email with reference); content assertions TODO when file format known | partial |
| 2 | E2E | e2e/booking-happy.e2e.ts (outbox >= 1) | partial |
| 3 | Integration | tests/integration/qa/dst.test.ts (.ics DTSTART) | partial |
| 4 | Integration | tests/integration/qa/dst.test.ts | written |
| 5 | Integration | tests/integration/qa/rules.test.ts 'email failure does not fail the booking' | written |
| 6 | Integration | tests/integration/qa/idempotency.test.ts (one email); tests/integration/qa/rules.test.ts resend | written |
| 7 | Manual | Open email in a 375px mail client; check plain-text part | manual |
| 8 | Integration | TODO: assert <script> in client text is escaped in email HTML | gap |
| 9 | E2E | e2e/booking-happy.e2e.ts 'Events' (subject 'event request' in outbox) | partial |
| 10 | Integration | tests/integration/qa/rules.test.ts 'Events approve'; email content TODO | partial |
