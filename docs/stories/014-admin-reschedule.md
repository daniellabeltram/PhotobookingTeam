# 014 — Admin reschedule a booking
**Scope:** v1 (02 §1.10 "Rescheduled" filter; booking-domain-rules: reschedules applied by Daniella in admin in v1)      **Status:** ready      **Priority:** P1
**As** Daniella (admin), **I want** to move a booking to another open time, **so that** I can handle client requests and South Florida weather without cancelling and rebooking.

## Acceptance criteria
1. **Given** a `requested`, `pending_deposit` or `confirmed` booking, **When** Daniella chooses "Reschedule", **Then** she sees open times for that session type and length using the rules of story 002, except that `minimum_notice_hours` and `booking_horizon_days` are not applied (she may pick a sooner or later time); overlaps, buffers, blocks and the daily cap still apply.
2. **Given** she picks a new time and a reason (client request / weather / photographer), **When** she confirms, **Then** the booking moves to the new time in one step (the new slot is reserved and the old slot is released together), the status is unchanged, and the history records old time, new time, reason, who and when.
3. **Given** the chosen new time was taken in the meantime, **When** she confirms, **Then** the reschedule fails with "That time was just booked", the booking keeps its original time, and the list of times refreshes.
4. **Given** a successful reschedule, **When** saved, **Then** the client is emailed the new date/time (ET) and an updated `.ics` that replaces the original event when imported (not a second event), unless Daniella unchecks "Email the client".
5. **Given** a booking has been rescheduled at least once, **When** the "Rescheduled" filter is used (story 011), **Then** it appears, and the detail shows each move; a "weather" reschedule is labelled so it isn't confused with the client's free reschedule.
6. **Given** a Holiday Minis booking, **When** rescheduled, **Then** only other open mini slots are offered.
7. **Given** a `requested` Events booking, **When** Daniella reschedules it (for example to agree a time before approving), **Then** it stays `requested`, its waiting time keeps counting from the original `requested_at`, and the client email gives the new time, says it is still a request awaiting approval, and has no `.ics` and no payment link (story 020 #4–5).

## Out of scope
- Client self-reschedule link and automatic fee rules (v1.1). One-click weather tool with bulk emails (v1.1).

## Notes / open questions
- [PLACEHOLDER] values used: reschedule windows and fee (docs/04 §3) — applied by Daniella's judgment in v1, not enforced.
- P1 because 02 lists "Rescheduled" as a v1 filter and weather moves are common; can slip to just after launch if needed (Daniella would cancel and ask the client to rebook).

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
