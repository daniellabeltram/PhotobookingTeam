# 0005. Payments in v1: payment link per session type plus admin "mark paid"
Date: 2026-11-25 · Status: accepted

## Context
- v1 scope (docs/02 1.8, stories 009, 013, 020): show the amount due and a payment link. The booking stays `pending_deposit` until Daniella marks it paid. Integrated checkout and webhooks are v1.1.
- Card data must never touch our code. No Stripe SDK in v1.
- Events deposits vary with coverage length (percent × hourly price × hours), so a fixed-amount link can't fit every event (story 009 open question).
- Holiday Minis are paid in full. Unpaid bookings are **not** released automatically in v1. They are flagged "Deposit overdue" after `unpaidHoldHours`.

## Options considered
1. **A hosted payment link per session type in config** (for example a Stripe Payment Link, or the equivalent from Square or PayPal), plus "mark paid" in admin. Pros: no code touches payments, no secrets, works with any provider. Cons: manual reconciliation.
2. **Stripe Checkout Session created by a Function, plus a webhook.** That is the v1.1 plan. It needs keys, webhook signature checks and tax review (docs/03 §9).
3. **Daniella sends links by hand.** No app support. Clients would wait.

## Decision
**Option 1.** Each session type has `deposit` and `depositPaymentLink` (an `https://` URL or `null`) in config.
- **Amount due** is computed in `shared/money.ts` (integer cents):
  - `{ kind: "flat", amountCents }` gives that amount.
  - `{ kind: "percent", percent }` gives `round(percent/100 × priceFromCents × durationMin/60)` for per-hour types (Events), labelled "estimated".
  - `{ kind: "full" }` gives `priceFromCents` (Minis, "Pay in full").
  - `{ kind: "none" }` gives 0, and the booking starts `confirmed` (instant types) or is approved straight to `confirmed`.
- **Events:** configure a "customer chooses what to pay" link and show the estimated amount next to it. Daniella can switch to one link per length later without code changes: `depositPaymentLink` may also be a map `{ "<durationMin>": url }`.
- **Reference passing:** if the link host is `buy.stripe.com`, append `client_reference_id=<reference>`. Stripe accepts alphanumerics, dashes and underscores up to 200 characters, and the value reaches the Checkout Session and `checkout.session.completed` (https://docs.stripe.com/mobile/digital-goods/payment-links, checked 2026-11-25). For other providers the reference is shown with "Include your booking reference DBP-XXXXXX with the payment". No `prefilled_email` (it would put the client's email in URLs and browser history).
- **When the link is shown:** instant types right after booking (screen and email). Events only after approval (approved email). Never for `requested`.
- **No link configured:** booking still succeeds; client sees "Daniella will send you a payment link shortly"; admin shows "No payment link configured" (story 009 #6).
- **Mark paid:** `PATCH /api/admin/bookings/:id` with `action: "mark_paid"`, `amountCents` (prefilled with the amount due), `receivedOn` (ET date, default today), optional `method` and `note`. This stores `payment` on the booking and moves it to `confirmed`. `confirm_without_payment` requires a note.
- **Deposit overdue** is derived, never stored: `status = pending_deposit` and `now ≥ holdStartedAt + unpaidHoldHours`, where `holdStartedAt` is `createdAt` for instant types and `approvedAt` for approved requests (story 020 #13).
- Non-production: `PAYMENT_LINK_OVERRIDE_URL` (if set, and only when `APP_ENV` ≠ `production`) replaces every link with a test-mode link.

## Consequences
- No payment secrets in v1. Payment links are public URLs and can sit in the repo's config.
- Daniella reconciles payments by reference in her payment provider's dashboard.
- v1.1 path: add `netlify/functions/payments-webhook.ts` with signature verification that calls the same `mark_paid` transition, replacing the manual step. The data model already has `payment`.
- Open for Daniella: which provider account, and how to handle Events links (default: a pay-what-you-choose link).
