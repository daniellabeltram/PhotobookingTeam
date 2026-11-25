# 007 — Booking creation and confirmation screen
**Scope:** v1 (02 §1.6)      **Status:** ready      **Priority:** P0
**As a** client, **I want** an immediate on-screen confirmation with a reference and next steps, **so that** I know my booking went through and what to do now.

## Acceptance criteria
1. **Given** a valid submission (open slot, valid intake, policies accepted), **When** the server creates the booking, **Then** it stores the session type, start and end time, intake answers, policy version and acceptance time, a unique booking reference, and a status: `pending_deposit` when `deposit` > 0 or `full`, `confirmed` when `deposit` is 0.
2. **Given** booking references, **When** generated, **Then** each is unique, short enough to read over the phone (≤ 10 characters), avoids look-alike characters (0/O, 1/I), and cannot be guessed from another booking's reference (not sequential).
3. **Given** the booking was created, **When** the confirmation screen shows, **Then** it shows the reference, session type, date, start and end time in ET with the "ET" label, location (or "Daniella will help you choose a spot"), the deposit amount and payment step (story 009), the status in plain words ("Pending deposit"), and how to reschedule (in v1: reply to the email or contact Daniella).
4. **Given** the confirmation screen, **When** the client reloads it or uses the back button, **Then** no second booking is created and the client either sees the same confirmation or the start of the flow.
5. **Given** the server is unreachable or returns an unexpected error on submit, **When** the client submits, **Then** they see "Something went wrong and your booking was not made. Please try again" with their answers kept; no confirmation is shown unless a booking exists.
6. **Given** the confirmation, **When** compared with the email, `.ics` and admin view of the same booking, **Then** the date and time are identical (invariant).
7. **Given** a 375px viewport, **When** the confirmation shows, **Then** the reference and the payment action are visible without horizontal scroll.

## Out of scope
- Client account or "my bookings" page (not planned). Self-reschedule link (v1.1).

## Notes / open questions
- Proposed v1 call: **all types book instantly** (see README scope decisions), so no booking starts in `requested`.
- [PLACEHOLDER] values used: `deposit`, `duration_min`, `unpaid_hold_hours`.

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
