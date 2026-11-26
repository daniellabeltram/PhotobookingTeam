# 013 — Admin status changes (approve, decline, mark paid, confirm, cancel, complete)
**Scope:** v1 (02 §1.12)      **Status:** ready      **Priority:** P0
**As** Daniella (admin), **I want** to move a booking through its statuses, **so that** the list reflects reality and cancelled times open up again.

## Allowed transitions in v1
| From | Action | To |
|---|---|---|
| `requested` | Approve (Events, story 020) | `pending_deposit` (or `confirmed` when `deposit` is 0) |
| `requested` | Decline (Events, story 020) | `declined` (slot freed) |
| `pending_deposit` | Mark deposit paid | `confirmed` |
| `pending_deposit` | Confirm without payment (waived / paid another way) | `confirmed` |
| `pending_deposit`, `confirmed` | Cancel | `cancelled` |
| `confirmed` | Mark completed (only once the session start time has passed) | `completed` |

`cancelled`, `declined` and `completed` are final in v1. A `requested` booking can only be approved or declined (or rescheduled, story 014). It cannot be cancelled, marked paid or completed.

## Acceptance criteria
1. **Given** a `pending_deposit` booking, **When** Daniella chooses "Mark deposit paid" and enters the amount (prefilled with the amount due), the date received (defaults to today ET) and an optional method/note, **Then** the status becomes `confirmed` and the payment details appear on the detail.
2. **Given** a `pending_deposit` booking, **When** Daniella chooses "Confirm without payment", **Then** a note is required and the status becomes `confirmed`.
3. **Given** a booking is moved to `confirmed`, **When** saved, **Then** the client is emailed "You're confirmed" with the same date/time/location and the `.ics`; if the email fails, the booking still changes and shows "Email not sent" with resend.
4. **Given** a `pending_deposit` or `confirmed` booking, **When** Daniella chooses "Cancel", **Then** she must confirm in a dialog that names the client and time, choose a reason (client cancelled / deposit not received / photographer cancelled / other) and decide whether to email the client (checked by default). After confirming, the status is `cancelled` and the slot is immediately offered again in client availability (story 002).
5. **Given** a `confirmed` booking whose start time has passed, **When** Daniella chooses "Mark completed", **Then** the status is `completed`; **Given** the start time has not passed, **Then** the action is not offered.
6. **Given** any transition not in the table (e.g. `cancelled` → `confirmed`, `pending_deposit` → `completed`, `requested` → `confirmed` by "Mark deposit paid", `requested` → `cancelled`, `declined` → `pending_deposit`), **When** attempted through the UI or a direct request, **Then** it is not offered in the UI and the server rejects it; the booking is unchanged.
7. **Given** any successful transition, **When** saved, **Then** a history entry records from-status, to-status, who, when (server time) and the note/reason.
8. **Given** the booking was changed in another tab or device since Daniella loaded it, **When** she submits a status change, **Then** it is rejected with "This booking changed. Reload to see the latest" and nothing is overwritten.
9. **Given** a network failure during a change, **When** it happens, **Then** Daniella sees that the change was not saved and the displayed status is the stored one.
10. **Given** a `requested` Events booking, **When** Daniella approves or declines it, **Then** the behaviour, emails and unhappy paths follow story 020 #11–23, and criteria 7–9 above also apply.
11. **Given** Daniella double-clicks any status action, or the network retries it, **When** the server receives the duplicates, **Then** exactly one transition, one history entry and at most one client email result.
12. **Given** a `pending_deposit` booking flagged "Deposit overdue" (story 009 #7), **When** Daniella cancels it with the reason "deposit not received", **Then** criterion 4 applies. Nothing releases the slot without her action in v1.

## Out of scope
- Automatic expiry of unpaid bookings (v1.1 candidate; Daniella decided 2026-11-25 to keep it manual in v1). Automatic expiry of unanswered Events requests (v1.1 candidate). Refund processing (done in the payment provider). Automatic fee calculation for late cancellations (v1.1). Reopening a cancelled or declined booking (client rebooks instead).

## Notes / open questions
- [PLACEHOLDER] values used: `unpaid_hold_hours`, cancellation tiers (docs/04 §4) — Daniella applies these herself in v1.
- Status-change email copy comes from ux-designer.
- Updated 2026-11-25: Daniella decided Events need her approval in v1, so the `requested` and `declined` statuses and the Approve and Decline actions are now in v1 (details in story 020).

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
