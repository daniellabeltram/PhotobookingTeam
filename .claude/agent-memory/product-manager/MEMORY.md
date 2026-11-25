# Product-manager knowledge (Priya)

## Product promise
Pick session, then pick an open time, fill the intake, accept the policies, get a confirmation. Daniella sees everything on one admin page.

## v1 goals (docs/01)
- Under 5 minutes to book on a phone · zero double bookings · no follow-up email needed for basics · explicit policy acceptance · one admin page.

## Scope anchors (docs/02)
- v1: session picker, availability calendar, double-booking protection, intake, policy ack, confirmation screen and email (.ics), deposit via payment link plus manual "mark paid", admin (login, list, detail, status, blocks, CSV).
- v1.1: Stripe Checkout, email reminders, self-reschedule link, weather reschedule tool, mini-day generator, request/instant per type, editable content.
- Later: SMS (TCPA consent), calendar sync, promo/gift cards, waitlist, reviews, e-sign, balance invoicing, gallery links, analytics, Spanish.

## Personas
- Busy parent booking Families or Holiday Minis on a phone from Instagram.
- Couple booking an engagement session (may be a surprise proposal).
- Event host needing venue, timeline and guest count, often booked months ahead.
- Daniella (admin): checks upcoming sessions daily or weekly, reads intake before shoots.

## Decisions still owed by Daniella
See the checklist at the end of docs/04-booking-policies.md.

## Learned
- 2026-11-25: Wrote v1 stories 001-019 in docs/stories/ (index + scope decisions in docs/stories/README.md). All `ready`.
- 2026-11-25: My calls (pending Daniella): all types incl. Events book instantly in v1 (request mode v1.1, contradicts docs/04 draft); no auto-expiry of unpaid bookings (flag "Deposit overdue", manual cancel); no slot holds; admin reschedule in v1 as P1; CSV P1.
- 2026-11-25: Minis v1 = manual slots by Daniella; mini slots block other types; minis exempt from daily cap/working days/windows; show "spots left". 2026 minis season likely missed; ask re 2027.
- 2026-11-25: Events pick coverage length from proposed `duration_options_min`; deposit estimate = % x hourly price x hours. Open: how a payment link handles variable Event amounts.
- 2026-11-25: Proposed new config fields: duration_options_min, deposit_payment_link, what_to_bring_text, email_from_*, admin_notification_email, admin_allowlist, booking_rate_limit, data_retention_months, portfolio_opt_out_enabled.
- 2026-11-25: Lesson: docs/02 lists "Rescheduled" as a v1 admin filter but no reschedule feature; reconcile such gaps explicitly in scope decisions.
