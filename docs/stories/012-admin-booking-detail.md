# 012 — Admin booking detail
**Scope:** v1 (02 §1.11)      **Status:** ready      **Priority:** P0
**As** Daniella (admin), **I want** a full view of one booking, **so that** I can prepare for the shoot and contact the client in one tap.

## Acceptance criteria
1. **Given** Daniella opens a booking, **When** the detail shows, **Then** it shows the reference, session type, date and start–end time (ET), location, status, amount due and payment info recorded so far, and **every** intake answer for that type, labelled with the question text (empty optional answers shown as "—").
2. **Given** the client's phone and email, **When** shown, **Then** the phone is a tap-to-call link, a "Text" link is offered, and the email is a tap-to-email link with the reference in the subject.
3. **Given** the booking, **When** shown, **Then** it shows `policy_version`, `policy_accepted_at` (ET) and a link to that version's full text.
4. **Given** the booking's history, **When** shown, **Then** every status change and reschedule is listed with from-status, to-status (or old/new time), who made it, when (ET) and any note.
5. **Given** the last client email for this booking failed (confirmation, request received, approval, decline or status change), **When** the detail shows, **Then** a "Resend [that email]" action is offered (story 008 #5–6, story 020 #14, #17).
6. **Given** a booking reference that does not exist or is malformed, **When** its URL is opened, **Then** Daniella sees "Booking not found" with a link to the list.
7. **Given** a cancelled, declined or completed booking, **When** Daniella chooses "Delete client data" and confirms by typing the reference, **Then** the booking's personal data is permanently removed, the slot history keeps only date, type and status, and the booking no longer appears in CSV exports with any PII. The action is not offered on active bookings.
8. **Given** client-entered text, **When** shown, **Then** it is displayed as plain text (no HTML or scripts from client input run).
9. **Given** a `requested` booking (Events), **When** the detail shows, **Then** it shows "Requested — waiting for your approval", the time waiting since `requested_at` (plus "Reply overdue" after `request_response_days`), the estimated retainer, and two clearly labelled actions, "Approve" and "Decline", each at least 44×44 CSS px (story 020 #8–17). Mark paid, Confirm without payment, Cancel and Mark completed are not shown.
10. **Given** an approved or declined Events booking, **When** the detail shows, **Then** the history shows the `requested` → `pending_deposit`/`confirmed` or `requested` → `declined` entry with who and when, and any decline message sent to the client.

## Out of scope
- Editing intake answers in admin (v1.1 candidate; Daniella notes changes in the status-change note).
- Private admin notes field (v1.1 candidate).

## Notes / open questions
- Criteria 9–10 and the email list in #5 were added 2026-11-25 for Events request mode (story 020).
- "Delete client data" supports privacy requests (story 018). Question for Daniella: is this needed in v1, or are deletion requests rare enough to handle manually?

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
