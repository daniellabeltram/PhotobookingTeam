# Backend decisions and edge cases (dated)

## 2026-11-25
- **Buffer = minimum gap.** Two sessions conflict when `a.start < b.end + gap && b.start < a.end + gap`, gap = max(bufferA, bufferB)
  (`netlify/lib/domain/overlap.ts`). Reason: story 002 #3 ("a slot ending exactly at 10:00 - B is offered") and minis fit back to back at
  duration + buffer (api.md). ADR 0002 literally says "busy intervals overlap", which would need 2B. `busyStartUtc/busyEndUtc` are still stored
  as [start - B, end + B). Flag to the architect.
- **Reschedule is two-phase** (reserve new entry, CAS the booking, release old entry) for the same date too, so a crash can leave two slots, never zero.
  Same start with a new length replaces the entry in place.
- **Idempotency record gets the bookingId** right after the booking is written; a retry after a crash resumes from the stored booking.
  Once a booking exists the claim is never released.
- **Login limiter** reserves per-IP (/64 for IPv6) + site-wide (50/h) attempts BEFORE PBKDF2, fails closed; successful sign-in refunds. A signed
  device cookie (`dbp_device`, 90 days) uses its own bucket only. RATE_LIMIT_DISABLED never affects login.
- **Site-wide booking cap** `limits.bookingGlobalLimit` 20/ET day [PLACEHOLDER], counted before reserve, refunded if the booking fails, fails open.
- **Env guards** in `netlify/lib/env.ts` (H1/H2): see tests/unit/backend/env.test.ts, one test per rule. The platform deploy context comes from
  Functions v2 `context.deploy.context` (or CONTEXT env). If a deploy exposes neither, production still needs DATA_NAMESPACE=production +
  TOTP + real secrets, but the APP_ENV-vs-platform match cannot be checked: verify on the first preview deploy.
- **Policy v0.1-draft was edited once** (2026-11-25) to add summaryVariants and "may be released" wording; nobody had accepted it yet, hash re-pinned.
  From the first real acceptance on: new file + new version only.
- **Emails:** greeting = first token only (30 chars, links/addresses dropped), no free text echoed (Events say "your event", not its name),
  Daniella's notice = reference, type, time, name, admin link. Subjects sanitized (80 chars, no control or separator characters).
- `shared/schemas/booking.ts` accepts a public session type (null `extraPersonFeeCents`/`maxPeople`) as well as the config type.
- Left out on purpose (not in api.md): "sign out everywhere" endpoint (guard already checks `auth/sessions-valid-after`), "Retention due" flag (L5).
- Log keys allowed: requestId, fn, route, status, code, bookingId, durationMs, count, reason, driver, kind, honeypot, providerStatus, errorName, rule (+ level, msg, ts).
