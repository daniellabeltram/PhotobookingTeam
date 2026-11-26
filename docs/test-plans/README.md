# Test plans and release sign-off

Owner: qa-tester (Quinn) · Last updated: 2026-11-25 · One plan per story: `NNN-<slug>.md`, one row per acceptance criterion.

## How the suites are laid out
| Suite | Where | Run with | Owner |
|---|---|---|---|
| Unit | `tests/unit/` | `npm test` | developers |
| Integration (handlers called in-process, memory drivers) | `tests/integration/` (dev tests) and `tests/integration/qa/` (QA regression) | `npm test` | developers / QA |
| Device-zone independence | same suites | `npm run test:tz` | QA / CI |
| End to end + axe | `e2e/*.e2e.ts`, projects `phone` (375x812, zone America/Los_Angeles) and `desktop` (1280x800, zone UTC) | `npm run test:e2e -- --trace off` | QA |
| Helpers | `tests/helpers/` (fixed clock `FAKE_NOW=2026-12-01T09:00:00-05:00`, request builders, seeded PII, handler harness) | imported | QA |

Vitest must only collect `tests/**/*.test.ts` (e2e files end in `.e2e.ts` so they never collide). The e2e web server uses a fresh data directory per run under `.data/e2e/run-<timestamp>/`.

QA regression files (`tests/integration/qa/`): `concurrency.test.ts` (primary double-booking check, in-process twin of the preview launch gate in `docs/operations.md` section 6), `dst.test.ts`, `admin-auth.test.ts`, `logs-pii.test.ts`, `csv.test.ts`, `idempotency.test.ts`, `rules.test.ts`.

Assumptions that may need a one-line fix in `tests/helpers/` once the code lands: `extra.<typeId>` field names for Events/Couples/Families (`builders.ts`), memory email driver exposes `sent` and `failNext` (`app.ts`), `getServices()` export in `netlify/lib/services` (`app.ts`), Minis type id `holiday-minis` (`seed.ts`).

## Must-have regression list (testing-strategy)
| # | Scenario | Automated by |
|---|---|---|
| 1 | Happy path for each session type through confirmation and email | `e2e/booking-happy.e2e.ts` |
| 2 | Concurrent booking of one slot: exactly one wins, others `SLOT_TAKEN` with alternatives | `concurrency.test.ts`, `e2e/booking-errors.e2e.ts` |
| 3 | DST weeks (2027-03-14, 2027-11-07): slots, displays, `.ics` | `dst.test.ts` |
| 4 | Minimum notice, horizon, buffers, daily cap, blocked dates | `rules.test.ts`, `concurrency.test.ts`, `e2e/admin.e2e.ts` |
| 5 | Required fields, invalid email/phone, missing policy: client side and server side | `rules.test.ts`, `e2e/booking-errors.e2e.ts` |
| 6 | Conditional intake fields only for their type | `e2e/booking-happy.e2e.ts` |
| 7 | Every admin endpoint: 401 without session, 403 wrong origin | `admin-auth.test.ts` |
| 8 | Cancel frees the slot, reschedule moves it, history recorded | `rules.test.ts`, `e2e/admin.e2e.ts` |
| 9 | Idempotent retry creates no duplicate and no second email | `idempotency.test.ts` |
| 10 | No PII in logs | `logs-pii.test.ts` |
| + | CSV formula injection, BOM, filters, PII deletion | `csv.test.ts` |
| + | axe on every page, keyboard-only booking, no horizontal scroll at 375px | `e2e/a11y.e2e.ts`, `e2e/keyboard.e2e.ts` |

## Release sign-off checklist
- [ ] `npm run check` green (lint, typecheck, unit and integration), output pasted in the handoff.
- [ ] `npm run test:tz` green (Los Angeles and UTC).
- [ ] `npx playwright test --trace off` green on both `phone` and `desktop`.
- [ ] Concurrency run against the preview deploy (`docs/operations.md` section 6) shows exactly 1 booking for 20 parallel submits.
- [ ] No test skipped, quarantined or weakened (grep for `.skip`, `.only`, `fixme`).
- [ ] Every story plan has no `gap` rows, or each gap is accepted in writing.
- [ ] Manual rows done: VoiceOver iOS and TalkBack Android, 200% zoom, real-device matrix, throttled 4G, email on a phone, CSV in Excel/Sheets/Numbers, admin recovery path, 5-person usability test.
- [ ] `docs/test-plans/bugs.md`: zero open blockers or majors, or each accepted by Daniella.
- [ ] Preview deploy smoke test: book one of each type, approve/decline an Events request, cancel one, block a date, export CSV.
- [ ] Verdict recorded: **PASS** or **FAIL**, with the list of what was run.
