# 004 — Double-booking protection
**Scope:** v1 (02 §1.3)      **Status:** ready      **Priority:** P0
**As a** client, **I want** my time to be really mine once I book it, **and as** Daniella **I want** zero double bookings, **so that** no two clients ever show up for the same time.

## Acceptance criteria
1. **Given** a Families slot at 5:30 pm ET on a date is open, **When** two clients submit bookings for it at the same time, **Then** exactly one booking is created, and the other client sees "That time was just booked" with the 3 nearest open times for the same type (closest first, same date preferred).
2. **Given** two overlapping slots of **different** types (including buffers), **When** they are submitted at the same time, **Then** only one booking is created.
3. **Given** a client loaded a time that has since been taken, blocked, or moved inside `minimum_notice_hours` or past the daily cap, **When** they submit, **Then** the server re-checks every rule from story 002 and rejects the booking with the same "just booked / no longer available" message and alternatives.
4. **Given** a client is shown the conflict message, **When** they pick one of the alternatives (or go back to the calendar), **Then** all intake answers and the policy checkbox state they entered are kept and they can resubmit without retyping.
5. **Given** no alternative open time exists within the horizon, **When** a conflict happens, **Then** the client sees the conflict message with a link back to the calendar and Daniella's contact email, and no alternatives list.
6. **Given** a client taps Submit twice quickly or the network retries the request, **When** the server receives duplicate submissions for the same attempt, **Then** one booking is created and both responses lead to the same confirmation.
7. **Given** a load test of 20 simultaneous submissions for one slot, **When** it runs, **Then** exactly 1 booking exists for that slot afterwards and 19 requests get the conflict response (no server errors).
8. **Given** a Holiday Mini slot, **When** two families submit it at once, **Then** only one gets it and the "spots left" count drops by exactly one.
9. **Given** any time after any test run, **When** all active bookings are checked, **Then** no two overlap including buffers (invariant check usable by QA).

## Out of scope
- Holding a slot for a few minutes while the form is filled (not in v1).

## Notes / open questions
- The atomic reservation mechanism is the architect's decision (ADR). These criteria only describe behavior.
- [PLACEHOLDER] values used: same as story 002.

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
