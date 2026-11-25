# 011 — Admin booking list with filters
**Scope:** v1 (02 §1.10)      **Status:** ready      **Priority:** P0
**As** Daniella (admin), **I want** every booking on one page with filters, **so that** I can see what's coming up and what needs my attention.

## Acceptance criteria
1. **Given** Daniella signs in, **When** the list opens, **Then** by default it shows upcoming bookings (start time ≥ now) in all active statuses, sorted soonest first, each row showing date, start–end time (ET), session type, client name, status, and flags ("Deposit overdue", "Email not sent", "Surprise proposal", "Location: help me choose").
2. **Given** the status filter, **When** Daniella selects one or more of Pending deposit, Confirmed, Completed, Cancelled, Rescheduled, **Then** only matching bookings are shown ("Rescheduled" = bookings that have been moved at least once, story 014).
3. **Given** the session type filter and a date range (start and end date, ET), **When** set, **Then** only bookings of those types whose session date is inside the range (inclusive) are shown; filters combine with AND.
4. **Given** a "Past" view or a date range in the past, **When** chosen, **Then** past bookings are shown, newest first.
5. **Given** filters are set, **When** Daniella opens a booking and returns, **Then** the same filters and scroll position are kept.
6. **Given** no booking matches, **When** the list loads, **Then** it shows "No bookings match these filters" with a "Clear filters" action.
7. **Given** the list fails to load, **When** it errors, **Then** a message with "Try again" is shown, not an empty list that looks like "no bookings".
8. **Given** a summary at the top, **When** shown, **Then** it gives the counts of upcoming bookings in Pending deposit and Deposit overdue.
9. **Given** more than 50 bookings match, **When** the list shows, **Then** all of them remain reachable (paging or load more) and the total count is shown.
10. **Given** a phone (375px) or a laptop, **When** Daniella uses the list, **Then** it is usable on both without horizontal page scroll; each row opens the detail with one tap.

## Out of scope
- Text search by name or email (v1.1 candidate). Calendar view (later). Analytics (later).

## Notes / open questions
- [PLACEHOLDER] values used: `unpaid_hold_hours` (for "Deposit overdue").

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
