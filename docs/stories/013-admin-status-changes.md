# 013 — Admin status changes (mark paid, confirm, cancel, complete)
**Scope:** v1 (02 §1.12)      **Status:** ready      **Priority:** P0
**As** Daniella (admin), **I want** to move a booking through its statuses, **so that** the list reflects reality and cancelled times open up again.

## Allowed transitions in v1
| From | Action | To |
|---|---|---|
| `pending_deposit` | Mark deposit paid | `confirmed` |
| `pending_deposit` | Confirm without payment (waived / paid another way) | `confirmed` |
| `pending_deposit`, `confirmed` | Cancel | `cancelled` |
| `confirmed` | Mark completed (only once the session start time has passed) | `completed` |

## Acceptance criteria
1. **Given** a `pending_deposit` booking, **When** Daniella chooses "Mark deposit paid" and enters the amount (prefilled with the amount due), the date received (defaults to today ET) and an optional method/note, **Then** the status becomes `confirmed` and the payment details appear on the detail.
2. **Given** a `pending_deposit` booking, **When** Daniella chooses "Confirm without payment", **Then** a note is required and the status becomes `confirmed`.
3. **Given** a booking is moved to `confirmed`, **When** saved, **Then** the client is emailed "You're confirmed" with the same date/time/location and the `.ics`; if the email fails, the booking still changes and shows "Email not sent" with resend.
4. **Given** an active booking, **When** Daniella chooses "Cancel", **Then** she must confirm in a dialog that names the client and time, choose a reason (client cancelled / deposit not received / photographer cancelled / other) and decide whether to email the client (checked by default). After confirming, the status is `cancelled` and the slot is immediately offered again in client availability (story 002).
5. **Given** a `confirmed` booking whose start time has passed, **When** Daniella chooses "Mark completed", **Then** the status is `completed`; **Given** the start time has not passed, **Then** the action is not offered.
6. **Given** any transition not in the table (e.g. `cancelled` → `confirmed`, `pending_deposit` → `completed`), **When** attempted through the UI or a direct request, **Then** it is not offered in the UI and the server rejects it; the booking is unchanged.
7. **Given** any successful transition, **When** saved, **Then** a history entry records from-status, to-status, who, when (server time) and the note/reason.
8. **Given** the booking was changed in another tab or device since Daniella loaded it, **When** she submits a status change, **Then** it is rejected with "This booking changed. Reload to see the latest" and nothing is overwritten.
9. **Given** a network failure during a change, **When** it happens, **Then** Daniella sees that the change was not saved and the displayed status is the stored one.

## Out of scope
- Automatic expiry of unpaid bookings (proposed v1.1). Refund processing (done in the payment provider). Automatic fee calculation for late cancellations (v1.1). `requested`/approve/decline (v1.1 with request mode). Reopening a cancelled booking (client rebooks instead).

## Notes / open questions
- [PLACEHOLDER] values used: `unpaid_hold_hours`, cancellation tiers (docs/04 §4) — Daniella applies these herself in v1.
- Status-change email copy comes from ux-designer.

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
