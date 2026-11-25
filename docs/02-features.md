# 02 — Features

Scope is split into **Version 1 (must-have)**, **Version 1.1 (soon after launch)** and **Later**. A feature is in v1 only if the core promise depends on it: pick a session, pick a time, fill the intake, get a confirmation, and see it on the admin page.

---

## Version 1 — Must-have

### Client booking flow
| # | Feature | Notes |
|---|---|---|
| 1.1 | **Session type picker** | Cards for Portraits, Couples, Families, Events, Holiday Minis, each showing length, starting price, what's included, and the deposit amount. Content comes from a config file so Daniella can edit it without touching code. |
| 1.2 | **Availability calendar** | Shows only open dates and times for the chosen session type. Takes session length, buffer time, working hours and blocked dates into account. Mobile-first. |
| 1.3 | **Double-booking protection** | The server re-checks the slot at submit time and rejects it if it was just taken, then offers the nearest alternatives. |
| 1.4 | **Intake form** | Common fields plus a few per session type (see the field list below). Validates on the client and on the server. |
| 1.5 | **Policy acknowledgement** | A required checkbox with the policies in a collapsible summary and a link to the full text. The policy version and the time it was accepted are stored with the booking. |
| 1.6 | **Confirmation screen** | Shows a booking reference, the date and time in Eastern, the location, and next steps. |
| 1.7 | **Confirmation email** | Sent to the client, with a copy to Daniella. Includes an "Add to calendar" (.ics) attachment and how-to-reschedule instructions. |
| 1.8a | **Events approval (request mode)** | Decided by Daniella 2026-11-25. Events bookings start as *Requested* with the slot held. Daniella approves (deposit link sent) or declines (slot freed) from admin. Other types book instantly. See story 020. |
| 1.8 | **Deposit step (simple)** | After booking, the client is shown and emailed a **payment link** (for example a Stripe Payment Link) for that session's deposit. The booking stays *Pending deposit* until Daniella marks it paid. Fully integrated checkout comes in v1.1. |

### Admin page
| # | Feature | Notes |
|---|---|---|
| 1.9 | **Secure login** | Only Daniella or approved staff. |
| 1.10 | **All bookings, one page** | A list or table of upcoming and past bookings with status filters (*Pending deposit, Confirmed, Completed, Cancelled, Rescheduled*), plus filters for session type and date range. |
| 1.11 | **Booking detail** | Full intake answers, contact links (tap to call or email), and policy acceptance info. |
| 1.12 | **Change status** | Mark a deposit paid, confirm, cancel or complete a booking. Cancelling frees the slot. |
| 1.13 | **Block dates and times** | Vacations, personal days, or a reserved weather backup day. |
| 1.14 | **Export CSV** | A simple backup and handoff to a spreadsheet. |

### Platform
- Hosted on Netlify, with Netlify Functions for APIs.
- Persistent data store with atomic slot reservation.
- All times in America/New_York, with daylight-saving changes handled correctly.
- Spam protection on the form (a honeypot field and rate limiting, adding a CAPTCHA only if needed).
- Basic privacy notice explaining what is collected and why.
- WCAG 2.1 AA target; works on current iOS Safari and Android Chrome.

### Intake form fields (v1)

**All session types**
- Primary contact: full name, email, mobile phone, preferred contact method
- Names of everyone being photographed (free text)
- Number of people (adults / children / pets)
- Location: choose from suggested spots, enter your own, or "Help me choose"
- Style notes: the mood or vibe they want (for example bright and airy, golden-hour, editorial, candid)
- Must-have shots or groupings
- Anything Daniella should know (mobility, sensory needs, shy kids, etc.)
- How they heard about the business
- Policy acknowledgement (required)

**Extra by session type**
- *Couples:* occasion (engagement, anniversary, just because), and whether it's a surprise proposal.
- *Families:* children's ages, whether pets are included, whether extended family will join.
- *Events:* event name and type, venue address, start and end times, guest count, on-site contact, timeline or must-have moments.
- *Holiday Minis:* just the basics. Keep it short (names, count, any card deadline).

---

## Version 1.1 — Soon after launch

| Feature | Why |
|---|---|
| **Integrated deposit checkout** (Stripe Checkout or Payment Element) | The booking confirms automatically once payment succeeds, with no manual "mark paid" step. Industry sources link upfront payment to fewer no-shows. |
| **Automated reminders** | Email reminders at about 7 days and 48 hours, with prep tips and what to wear. Reminders are widely reported to cut no-shows. |
| **Client self-reschedule and cancel link** | A secure link in the confirmation email that applies the policy rules automatically (for example, free reschedule more than 72 hours out). |
| **Weather reschedule tool** | One click in admin marks a session weather-affected, emails the client, and offers open slots without a fee. |
| **Holiday Minis "event" mode** | Daniella defines a mini day (date, location, theme, slot length, buffer) and the app generates back-to-back slots, showing "X spots left". |
| **Request vs instant booking for other types** | Events approval is already in v1 (decided 2026-11-25). v1.1 makes the mode editable per type in admin. |
| **Editable content in admin** | Edit session types, prices and policy text without a redeploy. |

## Later

- SMS reminders (needs explicit consent and opt-out handling under TCPA rules).
- Two-way calendar sync with Google Calendar or iCloud.
- Promo codes and gift cards.
- Waitlist for full mini-session days.
- Post-session feedback or review request email.
- E-signed contracts (especially for Events).
- Balance invoicing and automatic payment of the remaining balance.
- Gallery delivery integration (for example linking to Pixieset or ShootProof galleries).
- Simple analytics: bookings by type, conversion, popular times.
- Spanish-language version of the booking flow (useful for the South Florida audience).

---

## Out of scope
- Image editing, gallery hosting or print store.
- Multi-photographer scheduling.
- Native mobile apps.
