---
name: project-context
description: "Core facts about the Daniella Beltram Photography booking and intake app: who it serves, the five-step booking flow, session types, constraints (Netlify, Eastern time, PII), and where the source docs live. Use whenever working on any part of this project."
user-invocable: false
---

# Project context: Daniella Beltram Photography booking app

**Business:** Daniella Beltram Photography, West Palm Beach, Florida (daniellabeltram.photography). There is one photographer. Daniella is the owner and the only admin.
**Product:** A web app where clients book a session and fill out an intake form, plus one admin page that shows every booking.
**Hosting:** Netlify (static front end plus Netlify Functions).

## Sources of truth (read the relevant one before deciding)
| File | Holds |
|---|---|
| `docs/01-project-brief.md` | Problem, users, goals, non-goals, constraints, open questions |
| `docs/02-features.md` | Scope: v1 must-have / v1.1 / later / out of scope, plus intake fields |
| `docs/03-research.md` | Industry findings with sources (deposits, intake, weather, minis, reminders, Netlify, FL tax) |
| `docs/04-booking-policies.md` | Session types, lengths, prices, policies. **Values marked `[PLACEHOLDER]` are not final** |
| `docs/adr/` | Architecture decisions (once written) |
| `docs/team/board.md` | Current tasks, owners, status |

## The client flow (v1)
1. Pick a session type: **Portraits, Couples, Families, Events, Holiday Minis**.
2. Pick an open date and time. Only real availability is shown.
3. Fill out the intake form: names, contact, number of people, location, style notes, plus fields specific to the session type.
4. Accept the policies (required checkbox). The policy version and timestamp are stored.
5. Confirmation screen and email (with an `.ics` file). The deposit is paid by link in v1 and through integrated checkout in v1.1.

## Admin (v1)
Secure login, a list of all bookings with filters, a detail view, status changes, blocked dates, and CSV export.

## Hard constraints
- **Zero double bookings.** Slot reservation must be atomic on the server.
- **All times are America/New_York**, with DST handled correctly.
- **Mobile-first and WCAG 2.1 AA.** Most clients book from a phone, often from Instagram.
- **The data includes PII** (names, phone numbers, sometimes children's ages). Admin auth is mandatory, no PII goes in logs, and data is kept to a minimum.
- **Netlify Forms is not the booking store** (quotas, and it can't prevent double booking). Use Functions plus a real data store.
- **Low running cost.** Free or low tiers unless Daniella approves more.
- Outdoor sessions are common, so South Florida weather and hurricane season (June 1 to November 30) matter.

## Who decides what
Daniella decides prices, policies, brand, merges to `main` and production deploys. The team decides how to build it, recording decisions in ADRs.
