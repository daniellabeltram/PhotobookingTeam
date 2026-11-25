# v1 user stories

Requirements for **version 1** (the "Version 1 — Must-have" section of `docs/02-features.md`), written before anything is built.
Each story uses the `requirements-writing` template. Policy values are referenced by config name and are `[PLACEHOLDER]`s until Daniella confirms them in `docs/04-booking-policies.md`.

**Priority:** P0 = launch blocker. P1 = in v1, but can ship last or slip just after launch without breaking the core promise.

## Index
| ID | Title | Scope | Priority | Status | 02 ref |
|---|---|---|---|---|---|
| [001](001-session-type-picker.md) | Session type picker | v1 | P0 | ready | 1.1 |
| [002](002-availability-calendar.md) | Availability calendar and slot generation | v1 | P0 | ready | 1.2 |
| [003](003-holiday-minis-manual-slots.md) | Holiday Minis: manually added mini slots | v1 | P0 | ready | 1.2 |
| [004](004-double-booking-protection.md) | Double-booking protection | v1 | P0 | ready | 1.3 |
| [005](005-intake-form.md) | Intake form (common and per-type fields) | v1 | P0 | ready | 1.4 |
| [006](006-policy-acknowledgement.md) | Policy acknowledgement with stored version and timestamp | v1 | P0 | ready | 1.5 |
| [007](007-booking-confirmation-screen.md) | Booking creation and confirmation screen | v1 | P0 | ready | 1.6 |
| [008](008-confirmation-emails.md) | Confirmation emails to the client and Daniella, with .ics | v1 | P0 | ready | 1.7 |
| [009](009-deposit-payment-link.md) | Deposit payment link and `pending_deposit` status | v1 | P0 | ready | 1.8 |
| [010](010-admin-login.md) | Admin login and access control | v1 | P0 | ready | 1.9 |
| [011](011-admin-booking-list.md) | Admin booking list with filters | v1 | P0 | ready | 1.10 |
| [012](012-admin-booking-detail.md) | Admin booking detail | v1 | P0 | ready | 1.11 |
| [013](013-admin-status-changes.md) | Admin status changes (mark paid, confirm, cancel, complete) | v1 | P0 | ready | 1.12 |
| [014](014-admin-reschedule.md) | Admin reschedule a booking | v1 | P1 | ready | 1.10 / domain rules |
| [015](015-admin-blocked-times.md) | Admin blocked dates and times | v1 | P0 | ready | 1.13 |
| [016](016-admin-csv-export.md) | CSV export | v1 | P1 | ready | 1.14 |
| [017](017-spam-protection.md) | Spam protection (honeypot and rate limit) | v1 | P0 | ready | Platform |
| [018](018-privacy-notice.md) | Privacy notice | v1 | P0 | ready | Platform |
| [019](019-accessibility-mobile-baseline.md) | Accessibility and mobile baseline (WCAG 2.1 AA, 375px) | v1 | P0 | ready | Platform |

## Suggested build order
Dependencies first; items in the same phase can run in parallel. Story 019 applies to every phase and is checked at each story's QA sign-off, with a full audit before release.

| Phase | Stories | Why this order |
|---|---|---|
| 1. Foundations | 001, 002, 010 | Config, slot engine and admin auth everything else depends on |
| 2. Booking core | 004, 005, 006, 007, 017 | Atomic booking with intake, policy acceptance and spam guard — the core promise |
| 3. After booking | 008, 009, 018 | Email + .ics, payment link, privacy notice (needed before any real client data) |
| 4. Admin | 011, 012, 013, 015, 003 | Daniella manages bookings, blocks and mini slots (003 needs admin auth and the slot engine) |
| 5. Finish | 016, 014 | P1: export and reschedule |
| Release gate | 019 full audit | Accessibility, devices and the 5-minute booking test |

## Success metrics (from docs/01)
| Metric | Target | How measured |
|---|---|---|
| Double bookings | 0 | Concurrency tests (004 #7) and the overlap invariant check (004 #9) on every release |
| Time to book on a phone | median < 5 min | Usability test with 5 phone users (019 #11) |
| Bookings needing a follow-up email for basics | 0 | Daniella reviews the first 20 bookings: intake answered every required question |
| Bookings without policy acceptance | 0 | Server rejects them (006 #4); spot-check in CSV |

## Config names referenced
Per type: `duration_min`, `buffer_min`, `price_from`, `deposit`, `max_people`, `extra_person_fee`, `booking_mode`, `intake_extra_fields`, `location_options`, `active`, `booking_horizon_days`.
Global: `timezone` (America/New_York), `working_days`, `session_windows`, `slot_interval_min`, `minimum_notice_hours`, `max_sessions_per_day`, `unpaid_hold_hours`, `policy_version`, `policy_summary_text`, `policy_full_text`.
**Proposed new fields** (architect to add to the config schema): `duration_options_min` (Events lengths), `deposit_payment_link` (per type), `what_to_bring_text` (per type), `email_from_name`, `email_from_address`, `admin_notification_email`, `admin_allowlist`, `booking_rate_limit`, `data_retention_months`, `portfolio_opt_out_enabled`.
All business values are `[PLACEHOLDER]` until Daniella confirms them.

## v1 scope decisions
Judgment calls made while writing these stories (2026-11-25). The orchestrator should confirm the ones marked ★ with Daniella, because they shape what she sees.

1. ★ **All session types book instantly in v1, including Events.** Request/approval mode is v1.1 (02). Events start in `pending_deposit` like the others; if an event doesn't suit, Daniella cancels it (013). This contradicts the draft "Request (approval needed)" for Events in docs/04, so Daniella should confirm. If she wants approval for Events in v1, it adds a `requested` status and approve/decline actions (about one extra story).
2. **Events pick a coverage length** (from `duration_options_min`, minimum `duration_min`) before seeing times, so availability is accurate. The deposit shown is an estimate: `deposit` % × hourly `price_from` × hours.
3. **Holiday Minis:** Daniella adds mini slots by hand (003); the generator is v1.1. Mini slots block other session types at those times. Minis don't count toward `max_sessions_per_day`, and working days/windows don't apply to them. "Spots left" is shown per mini date because it's cheap with manual slots. Minis are paid in full and show "Pending payment" until marked paid.
4. ★ **No automatic release of unpaid bookings in v1.** Bookings older than `unpaid_hold_hours` are flagged "Deposit overdue" and Daniella cancels them. Auto-expiry moves to v1.1 (with integrated checkout). Risk: an unpaid booking holds a mini slot until she acts.
5. **No slot hold while the client fills the form.** The server re-checks at submit and offers the 3 nearest alternatives while keeping their answers (004).
6. **Admin reschedule (014) is in v1 as P1.** 02 lists "Rescheduled" as a v1 filter, and the domain rules say reschedules are applied by Daniella in admin in v1. Client self-reschedule stays v1.1.
7. **Status-change emails** ("You're confirmed", cancellation notice) are included in 013, so clients don't need a follow-up email from Daniella.
8. **"Delete client data"** for cancelled/completed bookings (012 #7) is included to honour privacy requests; small, and reduces PII risk.
9. **Session windows come from config as fixed time ranges** (optionally per month), not from a sunrise/sunset calculation.
10. **Not in v1** (kindly, "not yet"): text search in admin, admin notes, editing intake answers, recurring blocks, CAPTCHA, cookie banner, automatic data deletion. All are v1.1 candidates.

## Open questions for Daniella
1. Events: confirm instant booking in v1, or do you need to approve Events before they're held? (decision 1)
2. Events retainer: one payment link per length, a link where the client types the amount, or you send Event links yourself? (009)
3. Is it OK that unpaid bookings are flagged, not released automatically, in v1? (decision 4)
4. Holiday Minis: we're unlikely to be live for the 2026 season (it's already late November). Plan for 2027? Should `minimum_notice_hours` apply to minis?
5. Session windows per month (e.g. summer mornings and golden hour) — what times? Or do you need sunrise/sunset-based times?
6. Confirmation email sender name and address; where your new-booking notices should go; full intake in your notice email or just a link to admin (proposed: link only)?
7. Which payment provider account will the retainer links come from?
8. Will anyone besides you need admin access in v1?
9. Portfolio-use opt-out on the intake form: yes or no?
10. How long should booking data be kept, and which email handles privacy requests?
11. Final suggested locations list and card descriptions / "what's included" text.
12. Still owed from docs/04: final prices, retainers, windows and policy wording, plus attorney review before launch.
