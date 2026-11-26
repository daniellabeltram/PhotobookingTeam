# 020 — Events approval (request mode)
**Scope:** v1 (Daniella's decision 2026-11-25; docs/04 §1 "Request (approval needed)")      **Status:** ready      **Priority:** P0
**As a** client booking an event, **I want** to send a request that holds my date while Daniella reviews it, **and as** Daniella (admin) **I want** to approve or decline each event request before a retainer is asked for, **so that** I only take events I can cover well and the client knows exactly where they stand.

## Behaviour in one table
Request mode applies to any session type whose `booking_mode` is `request`. In the v1 config only **Events** is `request`; Portraits, Couples, Families and Holiday Minis are `instant` (story 007).

| From | Action (admin) | To | Slot | Client email |
|---|---|---|---|---|
| (new submission) | — | `requested` | Reserved at once | "We received your event request" (no payment link, no `.ics`) |
| `requested` | Approve | `pending_deposit` (or `confirmed` if `deposit` is 0) | Stays reserved | "Your event is approved" with retainer amount, payment link and `.ics` |
| `requested` | Decline | `declined` | Freed at once | Polite "We can't take this event" email |

Requests do **not** expire automatically in v1. `requested` does not use `unpaid_hold_hours`; that clock starts when a booking is approved.

## Acceptance criteria

### Client: sending a request
1. **Given** a session type with `booking_mode: request` (Events) and an open slot, **When** the client submits a valid booking (intake valid, policies accepted), **Then** the server creates the booking with status `requested`, stores `requested_at` (server time), and reserves the slot atomically under the same rules as story 004. The slot is no longer offered to anyone (story 002 #3 counts `requested` as active).
2. **Given** two clients submit overlapping Events requests (or an Events request and an instant booking) for the same time at once, **When** the server processes them, **Then** exactly one booking exists for that time and the other client sees "That time was just booked" with alternatives (story 004 #1).
3. **Given** a `requested` booking was created, **When** the confirmation screen shows, **Then** the heading reads "Request received — not confirmed yet" (not "You're booked"). It shows the reference, session type, coverage length, date and start–end time in ET with the "ET" label, the venue, and the status in plain words ("Waiting for Daniella's approval"). It says "Your time is reserved while Daniella reviews your request. You'll hear back within [request_response_days] days" and "No payment is due yet. If Daniella approves, you'll get an email with your retainer link". It shows the estimated retainer (story 009 #3) labelled "due after approval".
4. **Given** a `requested` booking's confirmation screen, **When** shown, **Then** it has **no** "Pay retainer" link, no "Your time is held for [unpaid_hold_hours] hours" text, and no "Add to calendar" / `.ics`.
5. **Given** a `requested` booking was created, **When** it is saved, **Then** the client gets one email with the subject "We received your event request — [reference]". The email repeats the same request wording, details and reply time as #3 and has no payment link and no `.ics` attachment. The other rules of story 008 still apply (sender, plain text alternative, 375px, client text shown as text only, failure shows "Email not sent" with resend).
6. **Given** a `requested` booking was created, **When** it is saved, **Then** Daniella's notification at `admin_notification_email` has the subject "New event request — needs your approval — [reference]" and a link to the booking in admin (same PII limits as story 008 #2).
7. **Given** the client reloads the request confirmation or taps Submit twice, **When** the server receives duplicates of the same attempt, **Then** one booking and one client email exist (story 004 #6, story 007 #4).

### Admin: seeing requests
8. **Given** one or more `requested` bookings exist, **When** Daniella opens the admin list, **Then** each shows the status "Requested" and how long it has been waiting, in whole days and hours since `requested_at` (e.g. "Waiting 2 days 5 h"; under 1 hour shows "Waiting < 1 h"). The summary at the top shows the count of requests waiting (story 011).
9. **Given** a `requested` booking has waited longer than `request_response_days`, **When** the list or detail shows, **Then** it also carries the flag "Reply overdue". Nothing else happens to it automatically: its status stays `requested` and its slot stays reserved.
10. **Given** a `requested` booking's session start time has passed, **When** the list or detail shows, **Then** it carries the flag "Session time passed". Approve is not offered, and Decline is.

### Admin: approve
11. **Given** a `requested` booking whose start time is in the future, **When** Daniella chooses "Approve" and confirms in a dialog that names the client, event and time, **Then** the status becomes `pending_deposit` (or `confirmed` when the type's `deposit` is 0), `approved_at` is stored, and a history entry records `requested` → new status, who and when.
12. **Given** a booking was just approved into `pending_deposit`, **When** saved, **Then** the client gets one email with the subject "Your event is approved — [reference]". It contains the reference, date and start–end time in ET, venue, the estimated retainer amount, the "Pay retainer" link from `deposit_payment_link` (or "Daniella will send you a payment link shortly" if none is configured, story 009 #6), "Your time is held for [unpaid_hold_hours] hours until the retainer is received", and an `.ics` that follows story 008 #3–4. **Given** it was approved straight to `confirmed`, **Then** the email is the "You're confirmed" email from story 013 #3 instead.
13. **Given** a booking was approved into `pending_deposit`, **When** "Deposit overdue" is calculated (story 009 #7), **Then** `unpaid_hold_hours` is counted from `approved_at`, not from `requested_at`.
14. **Given** the approval email fails to send, **When** Daniella approves, **Then** the status still changes, the booking shows "Email not sent", and "Resend approval email" is offered on the detail (story 012 #5). A resend sends exactly one email.

### Admin: decline
15. **Given** a `requested` booking, **When** Daniella chooses "Decline", **Then** a dialog names the client, event and time, offers an optional message to the client (plain text, up to 1,000 characters), an optional internal note, and "Email the client" (checked by default), and requires her to confirm.
16. **Given** Daniella confirms a decline, **When** saved, **Then** the status becomes `declined`, a history entry records `requested` → `declined`, who, when and the note, and the slot is offered again in client availability on the next load (story 002 #4, #15).
17. **Given** a decline with "Email the client" checked, **When** saved, **Then** the client gets one email with the subject "About your event request — [reference]". In warm, polite wording (copy by ux-designer) it says Daniella can't take this event and repeats the date and time. It includes Daniella's optional message as plain text, says no payment was taken and nothing is owed, and links to the booking page so the client can choose another time. **Given** the box is unchecked, **Then** no email is sent. **Given** the email fails, **Then** the decline still stands and the booking shows "Email not sent" with resend.

### Unhappy paths
18. **Given** a request is no longer `requested` (it was declined, or approved and then cancelled, in another tab or device), **When** Daniella submits Approve or Decline from a stale screen, **Then** the server rejects it with "This request was already handled (now: [current status]). Reload to see the latest", nothing changes, and no email is sent (story 013 #8).
19. **Given** a `declined` booking, **When** an Approve request reaches the server through any route, **Then** it is rejected and the booking stays `declined`. To take the event after all, Daniella asks the client to book again, because the slot may already be taken. Story 013 #6 applies: `declined` is final in v1.
20. **Given** Daniella double-clicks Approve or Decline, or the network retries the request, **When** the server receives the duplicates, **Then** exactly one transition, one history entry and at most one client email result, and the screen shows the final status. The button is disabled while the request is in flight.
21. **Given** a `requested` booking, **When** "Mark deposit paid", "Confirm without payment", "Cancel" or "Mark completed" is attempted through the UI or a direct request, **Then** it is not offered in the UI and the server rejects it. A request must be approved or declined first.
22. **Given** Daniella has no valid admin session, **When** an approve or decline request is made directly, **Then** it is refused as unauthorized and the booking is unchanged (story 010 #2).
23. **Given** a network failure during approve or decline, **When** it happens, **Then** Daniella sees that the change was not saved, and the displayed status is the stored one (story 013 #9).
24. **Given** a type with `booking_mode: instant`, **When** a client books it, **Then** none of the request wording, statuses or actions above appear (stories 007–009 apply unchanged).

## Out of scope
- Automatic expiry or reminders for unanswered requests (v1.1 candidate). Admin shows the waiting time and "Reply overdue" instead.
- Counter-offering a different time from the decline dialog. In v1 Daniella reschedules the request first (story 014) or declines it with a message.
- Reopening a declined request.
- Changing `booking_mode` in admin (v1.1, editable content). In v1 it is a config value.
- Request mode for types other than Events. It works through config, but only Events is tested and configured as `request` in v1.

## Notes / open questions
- [PLACEHOLDER] values used: `booking_mode` (Events = `request`), `request_response_days` (**proposed new global config field**, not yet in docs/04), `deposit`, `price_from`, `deposit_payment_link`, `unpaid_hold_hours`.
- My call: "Reply overdue" (#9) and "Session time passed" (#10) are derived flags only. They are cheap, and they help Daniella keep the reply promise shown to clients.
- My call: no `.ics` until a request is approved, so an unconfirmed event never lands in the client's calendar.
- Risk accepted by Daniella: a request with no reply holds its slot indefinitely.
- Questions for Daniella: value of `request_response_days`, and is it calendar days or business days (proposed: calendar days)? Final wording of the decline email (ux-designer drafts it, Daniella approves).
- Also see story 009: how a payment link handles variable Event retainers is still open.

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
