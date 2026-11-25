# 015 — Admin blocked dates and times
**Scope:** v1 (02 §1.13)      **Status:** ready      **Priority:** P0
**As** Daniella (admin), **I want** to block days or hours (vacation, personal time, a weather backup day), **so that** clients can't book when I'm not available.

## Acceptance criteria
1. **Given** Daniella is signed in, **When** she adds a block for a single date, a date range (e.g. a week of vacation), or a time range on one date (ET), with an optional private label, **Then** it is saved and appears in her list of upcoming blocks.
2. **Given** a block is saved, **When** any client next loads availability, **Then** no slot overlapping the block is offered (story 002 #8).
3. **Given** a block overlaps one or more active bookings, **When** she saves it, **Then** she sees a warning listing those bookings; the block is saved only after she confirms, and the bookings are **not** changed or cancelled.
4. **Given** the end is before the start, or the block is entirely in the past, **When** she saves, **Then** it is rejected with a specific message.
5. **Given** an existing block, **When** she deletes it, **Then** those times become available again (subject to all other rules).
6. **Given** a block label, **When** a client views availability, **Then** the label is never shown to clients (blocked times simply aren't offered).
7. **Given** blocks across the DST change dates, **When** saved and displayed, **Then** start and end times show exactly as entered in ET.

## Out of scope
- Recurring blocks (weekly days off are covered by `working_days` in config). Calendar sync (later).

## Notes / open questions
- [PLACEHOLDER] values used: `working_days` (for context only).

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
