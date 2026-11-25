# 009 — Deposit payment link and `pending_deposit` status
**Scope:** v1 (02 §1.8)      **Status:** ready      **Priority:** P0
**As a** client, **I want** a clear way to pay my retainer right after booking, **and as** Daniella **I want** unpaid bookings clearly marked, **so that** slots are held only for clients who commit.

## Acceptance criteria
1. **Given** a booking is created for a type with `deposit` > 0 or `full`, **When** the confirmation screen and email show, **Then** both show the amount due and a "Pay retainer" (or "Pay in full" for `full`) link that opens the type's `deposit_payment_link`, plus "Your time is held for [unpaid_hold_hours] hours until the retainer is received".
2. **Given** the payment link, **When** shown, **Then** the client is told to include their booking reference with the payment (and the reference is passed to the payment page automatically if the payment provider supports it).
3. **Given** an Events booking, **When** the amount due is shown, **Then** it equals `deposit` percent × `price_from` (per hour) × chosen hours, labelled "estimated", rounded to whole cents.
4. **Given** a Holiday Minis booking with `deposit: full`, **When** shown, **Then** the amount equals the Minis `price_from` and the status reads "Pending payment".
5. **Given** a booking in `pending_deposit`, **When** the client pays through the link, **Then** the booking stays `pending_deposit` until Daniella marks it paid in admin (story 013); the app does not claim the booking is confirmed.
6. **Given** a type's `deposit_payment_link` is missing from config, **When** a booking is created, **Then** the booking still succeeds, the client sees "Daniella will send you a payment link shortly", and the admin booking shows "No payment link configured".
7. **Given** a `pending_deposit` booking older than `unpaid_hold_hours`, **When** Daniella views the admin list, **Then** it is marked "Deposit overdue" (it is **not** released automatically in v1; Daniella cancels it, story 013).
8. **Given** a `pending_deposit` booking, **When** availability is computed, **Then** its slot stays blocked until it is cancelled.

## Out of scope
- Integrated checkout and automatic confirmation on payment (v1.1). Automatic release of unpaid bookings (proposed v1.1). Balance invoicing (later). Sales tax (CPA question, docs/03 §9).

## Notes / open questions
- [PLACEHOLDER] values used: `deposit`, `price_from`, `unpaid_hold_hours`, `deposit_payment_link` (**proposed new per-type config field**).
- Events deposits vary by length, so a fixed-amount link can't fit every event. Question for Daniella / architect: one link per Events length, a link where the client enters the amount, or Daniella sends Event links manually?
- Questions for Daniella: which payment provider account will the links come from?

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
