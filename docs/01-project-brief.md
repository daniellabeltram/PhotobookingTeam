# 01 — Project Brief

**Business:** Daniella Beltram Photography — West Palm Beach, Florida
**Website:** daniellabeltram.photography
**Product:** Online booking and intake web app
**Hosting:** Netlify
**Status:** Planning (docs only, no code yet)

---

## The problem

Today a booking means a string of emails or DMs: "What do you have open?", "How long is a family session?", "Where should we meet?", "How many kids?" Details end up in different inboxes, dates can get double-booked, and nothing holds a slot until the client actually commits.

## What the app does

The app replaces that back-and-forth with one guided flow on the photographer's own domain:

1. **Pick a session type.** Portraits, Couples, Families, Events, or Holiday Minis, each with its length, starting price and a short description.
2. **Choose an open date and time.** The calendar shows only slots that are actually available for that session type. Session length and buffer time are already accounted for, and booked or blocked times are hidden.
3. **Fill out the intake form.** Names, contact info, location (or a request for location suggestions), number of people, and style notes. The questions change a little by session type.
4. **Agree to the policies.** A checkbox to accept the booking, deposit, cancellation and weather policies (see `04-booking-policies.md`).
5. **Get a confirmation.** An on-screen confirmation and an email with the date, time, location, what to bring or wear, and how to reschedule.

The photographer sees every booking on **one admin page**. It can be filtered by date, session type and status, and it shows each client's full intake answers.

## Who uses it

| User | What they need | How often |
|---|---|---|
| **Clients**: individuals, couples, families and event hosts, mostly in Palm Beach County | A fast, mobile-friendly way to see what's available, book with confidence and know what to expect | Once or twice a year; Holiday Minis are seasonal |
| **Daniella (admin)** | One place to see upcoming sessions, read intake answers before each shoot, block off dates, and update a booking's status | Daily or weekly |
| **Event clients** (a sub-group) | Room to describe the event: venue, timeline, guest count, must-have shots | Occasionally; often booked further ahead |

### Client assumptions
- Most clients will book **on a phone**, often from an Instagram or Google link. The flow has to be thumb-friendly and quick.
- Many sessions are **outdoors** (beaches, parks, downtown West Palm, Palm Beach Island), so location and weather matter a lot more than they would for a studio.
- Families booking **Holiday Minis** are short on time and need to feel the slot is gone if they don't act. The minis flow should be the fastest one.

## Goals for version 1

- A client can go from landing page to confirmed booking in **under 5 minutes** on a phone.
- **Zero double bookings.** A slot disappears the moment it's taken.
- Every booking arrives with the information Daniella needs to plan the shoot, with **no follow-up email needed** just to collect basics.
- The client explicitly accepts the policies before booking.
- Daniella can see and manage everything from **one admin page**.

## Non-goals for version 1
- Image galleries, delivery or print sales (handled by existing tools).
- Full CRM, contracts with e-signature, or invoicing for the remaining balance.
- Multiple photographers or second shooters on the calendar.

See `02-features.md` for the full scope split.

## Constraints and technical direction

- **Netlify** hosting: static front end plus Netlify Functions for server logic (availability checks, saving bookings, sending email).
- Booking data needs a **real data store** so availability can be checked atomically (for example Netlify Blobs, Supabase, or a hosted Postgres or SQLite option). Netlify Forms alone can't prevent double booking, and its free-tier quota differs between legacy and newer plans (see `03-research.md`).
- The **admin page must be authenticated** (for example Netlify Identity or another auth provider). It holds client names, phone numbers and sometimes details about children.
- Times are stored and shown in **America/New_York** (Eastern). West Palm Beach observes daylight saving time.
- **Accessibility:** WCAG 2.1 AA as the target, with large tap targets and readable contrast.

## Open questions for Daniella
- Online deposit payment in v1, or collect deposits by a payment link at first? (`02-features.md` suggests a phased approach.)
- Do you want to approve every booking before it's confirmed (request mode), or should bookings confirm instantly (instant mode)? Request mode could be used for Events only.
- Which email address and sender name should confirmations come from?
- Is there a list of favorite locations to offer clients as choices?
