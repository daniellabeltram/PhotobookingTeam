---
name: testing-strategy
description: "Testing approach for the booking app: test pyramid, tools, required regression scenarios (double booking, DST, notice, buffers, auth), test-plan and bug-report formats, and release sign-off. Use when writing tests, test plans or bug reports."
user-invocable: false
---

# Testing strategy

## Pyramid
- **Unit (most):** slot generation, booking rules, validation schemas, date formatting, state transitions.
- **Integration:** each Netlify Function against a test data store, including auth and error codes.
- **End-to-end (few, critical):** Playwright on 375×812 (phone) and 1280×800 (desktop). Run it with `--trace off` unless you are debugging. Chromium is pre-installed, so don't run `playwright install`.
- **Accessibility:** axe on every page, plus a keyboard-only pass of the booking flow.

## Must-have regression scenarios
1. Happy path for each session type, from session type through to the confirmation screen and email.
2. **Concurrent booking** of the same slot: exactly one succeeds, and the other gets `SLOT_TAKEN` with alternatives.
3. **DST weeks** (the second Sunday in March, the first Sunday in November): slots, displays and `.ics` times are all correct.
4. Minimum notice, booking horizon, buffers, daily cap and blocked dates are all respected.
5. Required fields, invalid email or phone, missing policy acceptance: each is rejected client-side **and** server-side.
6. Conditional intake fields appear only for their session type.
7. Every admin endpoint returns 401 without a token and 403 with the wrong role.
8. Cancelling frees the slot. Rescheduling moves it. Status history is recorded.
9. Idempotent retry of booking creation doesn't create a duplicate.
10. No PII appears in logs (assert on captured logs).

## Test plan: `docs/test-plans/<story-id>.md`
A table with one row per acceptance criterion: AC #, test type, test name or file, status.

## Bug report
```
**Title:** <short, specific>
**Severity:** blocker | major | minor | cosmetic
**Env:** <branch/deploy URL, viewport, browser>
**Steps:** 1. … 2. …
**Expected:** …   **Actual:** …
**Evidence:** <log excerpt, screenshot path, failing test>
**Owner:** <agent>
```

## Release sign-off
- The suite is green on the release branch and the preview deploy has been smoke-tested.
- Open bugs: zero blockers or majors, or each one accepted by Daniella.
- The verdict is **PASS** or **FAIL**, with a list of what was run.
- Never skip, quarantine or weaken a test to get to green.
