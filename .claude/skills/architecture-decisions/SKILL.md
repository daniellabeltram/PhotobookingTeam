---
name: architecture-decisions
description: "How to make and record technical decisions for this app: ADR template, decision criteria, the open decisions list (framework, data store, admin auth, email, payments), and reference architecture on Netlify. Use when choosing technology or changing system design."
user-invocable: false
---

# Architecture decisions

## Decision criteria, in priority order
1. **Correctness:** no double bookings, no lost bookings, correct Eastern times.
2. **Security and privacy** of client PII and admin access.
3. **Simplicity and maintainability** for a one-person business (managed services, few moving parts).
4. **Cost:** free or low tiers first.
5. **Developer speed.**

## ADR template: `docs/adr/NNNN-<kebab-title>.md`
```markdown
# NNNN. <Title>
Date: YYYY-MM-DD · Status: proposed | accepted | superseded by NNNN
## Context
<forces, constraints, links to docs/research>
## Options considered
1. <option> — pros / cons / cost
2. ...
## Decision
<the choice, one paragraph>
## Consequences
<what gets easier/harder, follow-ups, revisit triggers>
```

## Open decisions (write these ADRs first)
| # | Decision | Notes |
|---|---|---|
| 0001 | Front-end framework and build | Must deploy cleanly to Netlify. A static or SSR-light option is preferred |
| 0002 | Data store | Needs an atomic conditional write or transaction for slot reservation. Candidates: Netlify Blobs (check consistency guarantees), Supabase/Postgres, Turso/SQLite, Neon. Check current pricing |
| 0003 | Admin authentication | Netlify Identity, or a provider such as Auth0, Clerk or Supabase Auth. Must protect the API, not just the page |
| 0004 | Transactional email | Provider plus sending domain (SPF, DKIM, DMARC on daniellabeltram.photography) |
| 0005 | Payments | v1: a payment link with a manual "mark paid". v1.1: Stripe Checkout plus webhook |
| 0006 | Time handling | Store UTC instants plus the IANA zone `America/New_York`. Use one shared date library |
| 0007 | Config for session types and policies | A versioned file in the repo for v1, editable in admin in v1.1 |

## Reference architecture (v1)
```
Browser (booking flow, admin UI)
   │ HTTPS (JSON)
   ▼
Netlify Functions ── availability · create booking (atomic) · admin CRUD · export
   │            └── email provider (confirmation + .ics)
   ▼
Data store: bookings · blocked_times · (config: session types, policies, versions)
```

## Rules
- Business values (prices, lengths, buffers, windows) live in config, never in code.
- Keep the API contract in `docs/api.md` in sync with any decision.
- When an ADR depends on a vendor limit or price, cite the vendor's own page and the date you checked it.
