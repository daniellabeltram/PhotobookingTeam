# 006 — Policy acknowledgement with stored version and timestamp
**Scope:** v1 (02 §1.5)      **Status:** ready      **Priority:** P0
**As a** client, **I want** to read a short plain-language summary of the policies before I book, **and as** Daniella **I want** proof of which policy each client accepted and when, **so that** expectations are clear and protected.

## Acceptance criteria
1. **Given** the client is on the final step, **When** it shows, **Then** a collapsible policy summary (from `policy_summary_text`) is shown with the deposit amount and windows filled in from config for the chosen type, plus a link to the full policies page.
2. **Given** the summary references values (deposit amount, reschedule window, cancellation window), **When** it renders, **Then** each value is the same one used elsewhere in config (no number typed into the text by hand). A test changes `deposit` for a type and sees the summary change.
3. **Given** the checkbox "I have read and agree to the booking, cancellation and weather policies", **When** the step loads, **Then** it is unchecked; **Given** it stays unchecked, **When** the client submits, **Then** submission is blocked with "Please accept the policies to book" next to the checkbox.
4. **Given** a request without policy acceptance reaches the server, **When** processed, **Then** no booking is created and an error is returned (invariant: no booking without policy acceptance).
5. **Given** a client accepts and the booking is created, **When** it is saved, **Then** it stores `policy_version` (the current config value) and `policy_accepted_at` (server time, not the device clock).
6. **Given** the config `policy_version` changes from A to B, **When** new bookings are made, **Then** they store B, existing bookings still show A, and the full text of version A remains viewable from those bookings in admin.
7. **Given** the client opens "Read full policies", **When** they return, **Then** their form answers and selected time are unchanged.
8. **Given** the full policies page, **When** opened directly by URL, **Then** it shows the current policy text and its version label, readable at 375px.

## Out of scope
- E-signed contracts (later). Editing policy text in admin (v1.1).

## Notes / open questions
- [PLACEHOLDER] values used: `policy_version` (`v0.1-draft`), `policy_summary_text`, `policy_full_text`, `deposit`, reschedule/cancellation windows — all docs/04.
- Launch blocker: final policy wording needs Daniella's approval and attorney review (docs/04 decisions list).

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
