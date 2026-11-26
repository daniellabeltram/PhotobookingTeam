---
name: booking-domain-rules
description: "Business rules of the booking domain: session-type config fields, how open slots are generated (working hours, buffers, notice, booking window, daily cap, blocks), booking status lifecycle, policy versioning, reschedule/cancel/weather rules. Use when implementing, designing or testing anything about availability or bookings."
user-invocable: false
---

# Booking domain rules

All numbers come from config, seeded from `docs/04-booking-policies.md`. Those values are **placeholders** until Daniella confirms them, so never hard-code them.

## Session type config (per type)
`id, name, description, duration_min, buffer_min, price_from, deposit (flat or percent | "full"), max_people, extra_person_fee, booking_mode (instant | request), intake_extra_fields[], location_options[], active`

## Global scheduling config
`timezone: America/New_York, working_days, working_hours or session windows (e.g. sunrise-based / golden hour), minimum_notice_hours, booking_horizon_days (per type), max_sessions_per_day, unpaid_hold_hours`

## Slot generation (for a type and a date range)
1. Start with working days and the windows on each date (in Eastern time).
2. Generate start times on a fixed grid (e.g. every 30 min) where `start + duration` fits inside the window.
3. Remove any slot whose gap to an existing active booking (end to start, either side) is less than the **larger** of the two sessions' buffers (`gap < max(bufferA, bufferB)`). Buffers are not added together.
4. Remove slots that overlap blocked times, fall inside `minimum_notice_hours` of now, fall beyond the booking horizon, or sit on days that have reached `max_sessions_per_day`.
5. **Holiday Minis:** only on defined mini days, as back-to-back slots of `duration + buffer`, showing the remaining count.
6. Active bookings are `pending_deposit`, `requested` and `confirmed`. Cancelled bookings free their slot.

## Booking lifecycle
```
requested ──approve──▶ pending_deposit ──deposit paid──▶ confirmed ──▶ completed
   │                        │   └─ unpaid > unpaid_hold_hours ─▶ expired (slot freed)
   └──decline──▶ declined   └──────────────── cancel ──────────▶ cancelled (slot freed)
confirmed ──reschedule──▶ confirmed (new slot; history kept as rescheduled event)
```
- `instant` types start at `pending_deposit`. Types with a full or zero deposit may go straight to `confirmed` per config. `request` types (Events by default) start at `requested`.
- Every transition records who made it, when, and from which status to which.

## Policy versioning
- Each booking stores `policy_version` and `policy_accepted_at`. Changing the policy text creates a new version, and old bookings keep theirs.

## Reschedule, cancel and weather (rules from the draft policy)
- Client reschedule: free when more than N days out (placeholder 7), then a fee (placeholder) down to 48 h. Inside 48 h it counts as a cancellation.
- Cancellation outcomes follow the tiered table in `docs/04-booking-policies.md`.
- A weather reschedule is started by the photographer, is always free, and doesn't use up the client's free reschedule.
- In v1 these are applied by Daniella in admin. Automating them is v1.1.

## Invariants (must always hold, and must be tested)
- No two active bookings overlap, and every gap between them is at least the larger of their two buffers.
- No booking without policy acceptance.
- A booking's displayed time is the same in the confirmation, the email, the `.ics` and admin.
