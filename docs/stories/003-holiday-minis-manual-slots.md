# 003 — Holiday Minis: manually added mini slots
**Scope:** v1 (02 §1.2; generator is v1.1)      **Status:** ready      **Priority:** P0
**As** Daniella (admin), **I want** to add Holiday Mini slots for a mini day by hand, **so that** families can book a mini on the dates, times and location I chose.
**As a** busy parent, **I want** to see the mini times left and book one fast, **so that** I get a spot before they're gone.

## Acceptance criteria
### Admin adds slots
1. **Given** Daniella is signed in, **When** she adds mini slots by entering a date, a location/theme label and one or more start times (ET), **Then** each start time becomes a mini slot of the Holiday Minis `duration_min`, and the slots appear in her list of mini slots for that date.
2. **Given** a new mini slot would overlap another mini slot including `buffer_min` of the Minis type, an active booking, or a blocked time, **When** she saves, **Then** that slot is rejected with a message naming the conflict, and the non-conflicting slots in the same save are created (the message lists which were created and which weren't).
3. **Given** a start time in the past, **When** she saves, **Then** it is rejected with "That time has already passed".
4. **Given** an unbooked mini slot, **When** she removes it, **Then** it disappears from client availability; **Given** a booked mini slot, **Then** the remove action is not offered (she must cancel the booking first, story 013).

### Client books
5. **Given** Holiday Minis is chosen, **When** the date step loads, **Then** only dates with open mini slots are selectable, and each date shows its location/theme label and "[n] spots left" (count of unbooked slots on that date that pass the notice rule).
6. **Given** mini slots exist, **When** availability is shown, **Then** `minimum_notice_hours` and the Minis `booking_horizon_days` still apply, but `working_days`, `session_windows` and `max_sessions_per_day` do not.
7. **Given** all mini slots on a date are booked, **When** the date step loads, **Then** that date shows "Fully booked" and cannot be selected.
8. **Given** a mini booking is created, **When** it is saved, **Then** its location is the mini day's label (the location question is not asked, story 005).

## Out of scope
- Mini-day generator that creates back-to-back slots from a start, end and interval (v1.1).
- Waitlist for full mini days (later). Rain-date automation (Daniella reschedules manually, story 014).

## Notes / open questions
- [PLACEHOLDER] values used: Minis `duration_min`, `buffer_min`, `deposit` (`full`), `booking_horizon_days`, `minimum_notice_hours`.
- Today is 2026-11-25 and the draft minis season is late November to mid-December. v1 will almost certainly **not** be live for the 2026 season. Question for Daniella: confirm minis target the 2027 season.
- Questions for Daniella: does `minimum_notice_hours` apply to minis, or should minis be bookable up to the last minute?

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
