# 002 — Availability calendar and slot generation
**Scope:** v1 (02 §1.2)      **Status:** ready      **Priority:** P0
**As a** client, **I want** to see only dates and times that are really open for my session type, in Eastern time, **so that** I can pick a time with confidence and never pick one that can't happen.

Slot rules follow the `booking-domain-rules` skill. All values below are config names; their current values are `[PLACEHOLDER]`s from docs/04.

## Acceptance criteria
### Generation
1. **Given** a session type with `duration_min` and the scheduling config (`working_days`, `session_windows`, `slot_interval_min`), **When** availability is requested for a date range, **Then** candidate start times fall on the `slot_interval_min` grid inside each window and every slot's `start + duration_min` ends at or before the window end.
2. **Given** a date that is not in `working_days`, **When** the calendar is shown, **Then** that date shows no open times and cannot be selected.
3. **Given** an active booking (status `pending_deposit`, `requested` or `confirmed`) from 10:00 to 11:00 ET and `buffer_min` = B, **When** availability is requested for any type on that date, **Then** no slot is offered whose `[start − B, end + B)` overlaps `[10:00 − B, 11:00 + B)`; a slot ending exactly at 10:00 − B, or starting exactly at 11:00 + B, is offered.
4. **Given** a booking is `cancelled`, `completed`, `declined` or `expired`, **When** availability is requested, **Then** it does not block any slot (completed bookings are in the past anyway).
5. **Given** "now" is T, **When** availability is requested, **Then** no slot starting before T + `minimum_notice_hours` is offered, and a slot starting exactly at T + `minimum_notice_hours` is offered.
6. **Given** the type's `booking_horizon_days` = H, **When** availability is requested, **Then** no slot on a date later than today (ET) + H days is offered, and the calendar does not let the client navigate past that month.
7. **Given** a date already has `max_sessions_per_day` active non-mini bookings, **When** availability is requested, **Then** that date shows no open times for any non-mini type.
8. **Given** a blocked time (story 015) covers all or part of a date, **When** availability is requested, **Then** no slot overlapping the blocked range is offered (a full-day block removes the whole date).
9. **Given** a date has Holiday Mini slots defined (story 003), **When** availability is requested for a non-mini type, **Then** no slot overlapping any mini slot (booked or not) plus `buffer_min` is offered.

### Events length
10. **Given** the client chose Events, **When** the date step loads, **Then** the client first picks a coverage length from `duration_options_min` (every option ≥ `duration_min`), and only start times where that whole length fits are shown; changing the length refreshes the times.

### Display
11. **Given** any open slot, **When** it is shown on the calendar, **Then** the time is shown in America/New_York with a visible "ET" (Eastern) label, regardless of the device's time zone (tested with a device set to America/Los_Angeles and to UTC).
12. **Given** a session on 2027-03-14 (DST starts) or 2027-11-07 (DST ends), **When** slots are generated for that date, **Then** no slot is offered in the nonexistent 2:00–3:00 am hour, no slot appears twice in the repeated hour, and slot times match those of an ordinary day in the same window.
13. **Given** the client picks a date, **When** times load, **Then** a loading state is shown; **Given** the request fails, **Then** the client sees "We couldn't load times. Try again" with a retry control, and no stale times are shown.
14. **Given** no slot is open for the type within the horizon, **When** the calendar loads, **Then** the client sees "No open times right now" with a way to contact Daniella (email link), not an empty calendar.
15. **Given** a booking or a block was just created, **When** any client next loads availability, **Then** the affected slots are no longer offered.
16. **Given** a 375px viewport and keyboard-only use, **When** the client chooses a date and time, **Then** both can be chosen without horizontal scroll, using keyboard alone, and each time button is at least 44×44 CSS px.

## Out of scope
- Sunrise/sunset-calculated windows (v1 uses windows from config; see open questions).
- Holding a slot while the client fills the form (no holds in v1; story 004 handles conflicts).
- Waitlist (later).

## Notes / open questions
- [PLACEHOLDER] values used: `duration_min`, `buffer_min`, `working_days`, `session_windows`, `slot_interval_min`, `minimum_notice_hours`, `booking_horizon_days` (per type), `max_sessions_per_day`, `duration_options_min` (Events).
- `duration_options_min` is a **proposed new per-type config field** (Events only) — architect to add to the config schema.
- Proposed for v1: `session_windows` are fixed time ranges per type, optionally varying by month (e.g. summer mornings and golden hour). Working-hours windows apply to Events (indoor/venue), outdoor windows to the others.
- Questions for Daniella: exact session windows per month (or is a sunrise/sunset calculation needed?); do Holiday Minis bookings count toward `max_sessions_per_day` (proposed: no).

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
