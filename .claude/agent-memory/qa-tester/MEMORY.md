# QA-tester knowledge (Quinn)

## Regression checklist (seed from testing-strategy)
- [ ] Happy path for each of the 5 session types
- [ ] Concurrent same-slot booking: exactly 1 success
- [ ] DST weeks correct (UI, email, .ics, admin)
- [ ] Notice / horizon / buffers / daily cap / blocks
- [ ] Validation on client and server; policy acceptance required and stored
- [ ] Conditional intake fields per type
- [ ] Admin endpoints 401/403 without proper auth
- [ ] Cancel frees slot; idempotent retry
- [ ] No PII in logs; axe clean; keyboard-only booking works

## Environment notes
- Chromium is pre-installed; use `--trace off`; screenshots for people at deviceScaleFactor 2.

## Bug history / flaky areas
- (dated notes)

## 2026-11-25 Phase A done (code not yet runnable)
- Written, NOT yet run: `playwright.config.ts` (projects `phone` 375x812 zone LA, `desktop` 1280x800 zone UTC; per-run data dir `.data/e2e/run-<ts>`, no rm needed), `tests/helpers/*`, `e2e/*.e2e.ts` (+support/), `tests/integration/qa/*.test.ts`, `docs/test-plans/001..020 + README`.
- e2e files are `*.e2e.ts` so vitest never collects them. Orchestrator: CI may drop `--project`, so both projects must pass.
- Primary concurrency test: `tests/integration/qa/concurrency.test.ts` (twin of docs/operations.md section 6 launch gate).
- Guesses to verify when code lands: `extra.<typeId>` field names (builders.ts), memory email driver `sent`/`failNext`, `getServices` export, minis id `holiday-minis`, admin UI routes/labels (selectors follow docs/design copy; admin design says no Reschedule button, API has one).
- Tooling note: shell heredocs containing certain patterns were blocked by the safety check; use the Write tool for files.
- Open `gap` rows in test plans (mini-days admin rules, list filters/summary, waiting/overdue flags, decline/approve email content, network-fail e2e, tap-target sweep, privacy page checks, idle expiry).
- 2026-11-25 aligned with real code: extra keys are `extra.<prefix>.<name>` (events: eventType (select "Birthday"), venueAddress, eventStartTime, eventEndTime, guestCount, onsiteContactName/Phone required, timeline; couples.occasion value `engagement`; minis.cardDeadline); `getServices()` is sync; memory email has `sent[]` and `failNext(n)`; ICS is a base64 attachment (`contentBase64`); Minis id `holiday-minis`. Admin app uses hash routes (`/admin/#/bookings?status=..&view=all`). tsconfig has noUncheckedIndexedAccess + erasableSyntaxOnly: use `!`/defaults, no constructor parameter properties. Chromium: playwright.config.ts uses /opt/pw-browsers/chromium (or PW_CHROMIUM) when it exists.
- 2026-11-26 Phase B run: vitest 397/397 (x3 incl. test:tz), qa integration 106/106, playwright 54 pass / 12 fail (all = BUG-1..4 in docs/test-plans/bugs.md, soft assertions). Flaky areas: calendar loads availability after grid renders (wait for open day before paging months); time list re-renders (retry click via toPass); axe needs ~600ms settle for transitions; run playwright per spec if memory is tight (OOM kill seen once).
- 2026-11-26 final sign-off: check 442/442, e2e 66/66 (both projects), BUG-1 by design, BUG-2..4 fixed. PASS.
