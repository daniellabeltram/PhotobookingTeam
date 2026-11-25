# 008 — Confirmation emails to the client and Daniella, with .ics
**Scope:** v1 (02 §1.7)      **Status:** ready      **Priority:** P0
**As a** client, **I want** a confirmation email with a calendar file, **and as** Daniella **I want** a copy of every new booking, **so that** we both have the details in our inbox and calendar.

## Acceptance criteria
1. **Given** a booking is created, **When** it is saved, **Then** the client receives an email at their address from `email_from_name` / `email_from_address` containing: reference, session type, date and start–end time in ET, location (or "help me choose" note), deposit amount and payment link (story 009), status, what to bring or wear for that type (from config), the weather policy in plain language, and how to reschedule (in v1: reply or contact Daniella).
2. **Given** a booking is created, **When** it is saved, **Then** Daniella receives a notification at `admin_notification_email` with the reference, type, date/time, client name and a link to the booking in admin. It contains no more PII than name and booking details needed to recognise it (full intake stays behind admin login).
3. **Given** the client email, **When** opened, **Then** it has an `.ics` attachment that imports into Google Calendar, Apple Calendar and Outlook as one event with title "[Session type] with Daniella Beltram Photography", the correct start and end in America/New_York, the location, and the reference in the description.
4. **Given** a booking on 2027-03-14 or 2027-11-07 (DST change dates), **When** the `.ics` is imported on a device set to another time zone, **Then** the event shows at the same instant as the ET time on the confirmation screen.
5. **Given** the email provider fails or times out, **When** the booking is created, **Then** the booking is still saved and the client still sees the confirmation screen; the booking shows "Confirmation email not sent" in admin, and Daniella can resend it from the booking detail (story 012).
6. **Given** a resend, **When** it succeeds, **Then** the client gets one email and the flag clears; repeating a booking creation request (story 004 #6) never sends duplicate emails.
7. **Given** the email is viewed on a phone (375px), **When** opened, **Then** it is readable without horizontal scroll and has a plain-text alternative.
8. **Given** client-entered text (names, notes) appears in an email, **When** rendered, **Then** it is shown as text only (no HTML or links from client input are rendered).

## Out of scope
- Reminder emails at 7 days / 48 hours (v1.1). SMS (later).

## Notes / open questions
- [PLACEHOLDER] values used: `email_from_name`, `email_from_address`, `admin_notification_email`, per-type `what_to_bring_text` (**proposed new config field**), weather policy text.
- Questions for Daniella: which address and sender name should confirmations come from (docs/01 open question)? Does she want the full intake in her notification email (convenient, but puts PII in her inbox)? Proposed: no, link to admin instead.
- Email copy is the ux-designer's; status-change emails are in story 013.

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
