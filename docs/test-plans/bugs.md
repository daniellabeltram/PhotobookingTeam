# Bugs found by QA (v1 release candidate, branch feature/v1)

Run: 2026-11-26, FAKE_NOW 2026-12-01. BUG-1 is closed (by design). Three open product bugs (BUG-2 to BUG-4), all minor or cosmetic. Each is caught by a soft assertion in the e2e suite, so the test fails until it is fixed (tests were not weakened).

## BUG-1  Closed — by design (orchestrator, 2026-11-26)
In v1 the .ics goes by email only and the API intentionally returns no calendarUrl. The e2e now asserts the confirmation screen has NO "Add to calendar" and that the confirmation email has the .ics.

**Title:** Confirmation screen has no "Add to calendar" button for instant bookings
**Severity:** minor
**Env:** feature/v1, phone 375x812 and desktop 1280x800, Chromium
**Steps:** 1. Book Portraits, Couples or Families end to end. 2. Reach step 5 "You're booked, Zelda!".
**Expected:** A "Add to calendar (.ics file)" button, per `docs/design/booking-flow.md` step 5 (the email already carries the .ics).
**Actual:** No button. `src/booking/steps/confirmation.ts` renders it only when `r.calendarUrl` is set, but `POST /api/bookings` (docs/api.md) never returns `calendarUrl`, so it never shows.
**Evidence:** `e2e/booking-happy.e2e.ts` "Portraits/Couples/Families: pick, intake, policies, confirmation, email", soft assertion "Add to calendar on the confirmation screen", both projects.
**Owner:** frontend-developer (build the .ics client-side or from a link), with software-architect if the API should return a URL.

## BUG-2
**Title:** Events start time is not prefilled from the chosen time on step 2
**Severity:** minor
**Env:** feature/v1, both viewports
**Steps:** 1. Choose Events. 2. Pick a date and a time. 3. On the intake step look at "Start time".
**Expected:** Prefilled with the chosen time (booking-flow.md step 3, Events row).
**Actual:** Empty. Continue shows "Please enter a start time."
**Evidence:** `e2e/booking-happy.e2e.ts` "Events: request flow ...", message "Events start time should be prefilled from step 2".
**Owner:** frontend-developer

## BUG-3
**Title:** Holiday Minis final button says "Book my session" instead of "Book my mini"
**Severity:** cosmetic
**Env:** feature/v1, both viewports
**Steps:** 1. Choose Holiday Minis and go to the policies step.
**Expected:** Button "Book my mini" (booking-flow.md step 4 and copy table).
**Actual:** "Book my session" (`src/booking/steps/policies.ts` only switches the label for request mode).
**Evidence:** `e2e/booking-happy.e2e.ts` "Holiday Minis: short form, books a mini slot", soft assertion on the button label.
**Owner:** frontend-developer

## BUG-4
**Title:** Blocked dates: field label is "Reason (optional)", design says "Reason (optional, private)"
**Severity:** cosmetic
**Env:** feature/v1, admin, both viewports
**Steps:** 1. Sign in. 2. Open Blocked dates.
**Expected:** Label "Reason (optional, private)" with helper "Only you can see this." (admin.md section 5).
**Actual:** "Reason (optional)".
**Evidence:** `e2e/admin.e2e.ts` "blocking a date removes it for clients...", soft assertion on the label (the rest of that test passes).
**Owner:** frontend-developer

## Not bugs (test bugs fixed by QA)
BOM stripped by `Response.text()`; availability ranges over 62 days; stale selectors (Email label matched the radio too, hash routes, link versus button, double alerts); calendar paging before availability loaded; axe sampled a mid-transition colour; Events field names; childrenAges is now optional by decision.
