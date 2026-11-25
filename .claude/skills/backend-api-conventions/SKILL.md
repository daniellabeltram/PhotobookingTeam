---
name: backend-api-conventions
description: "Back-end conventions for Netlify Functions: endpoint layout, JSON request/response and error format, validation, idempotency, atomic booking, auth checks, logging without PII, email and payment integration patterns. Use when writing or reviewing server code."
user-invocable: false
---

# Back-end API conventions

## Layout
```
netlify/functions/
  availability.ts        GET  ?type=&from=&to=
  bookings-create.ts     POST
  admin-bookings.ts      GET list / GET :id / PATCH :id   (auth)
  admin-blocks.ts        GET / POST / DELETE              (auth)
  admin-export.ts        GET CSV                          (auth)
shared/                  types, validation schemas, booking rules, datetime
```
Paths and verbs are final once documented in `docs/api.md`.

## Request and response
- JSON only. Validate every input with a schema at the edge of each handler. Reject unknown fields.
- Success: `200`/`201` with `{ "data": ... }`.
- Error: an appropriate status with `{ "error": { "code": "SLOT_TAKEN", "message": "human text", "details": {...} } }`.
- Codes: `VALIDATION_FAILED` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `SLOT_TAKEN` (409), `RATE_LIMITED` (429), `INTERNAL` (500, generic message).

## Booking creation (must hold)
1. Validate input, run the honeypot check, apply a per-IP rate limit.
2. Recompute availability on the server from config, existing bookings and blocks. Never trust the client.
3. **Reserve the slot atomically** (a unique constraint or transaction on the slot key, or a conditional write). On conflict, return `409 SLOT_TAKEN` with the nearest alternatives.
4. Store the booking with `policy_version`, `policy_accepted_at`, and status `pending_deposit` (or per config).
5. Honor the `Idempotency-Key` header. A repeat returns the original result.
6. Send the emails *after* the commit. An email failure doesn't roll back the booking. Log the failure and flag it in admin.

## Auth
- Every `admin-*` function verifies the token and role server-side before anything else.
- Deny by default.

## Logging
- Structured logs with a request ID, booking ID, code and duration.
- **No names, emails, phones, intake text or payment data in logs.**

## Time
- Store UTC ISO instants. Compute slots in `America/New_York` with the shared datetime module. Test DST transition weeks.

## Payments (v1.1)
- Use Stripe Checkout (hosted). Card data never touches our code.
- The webhook verifies the signature, is idempotent, and moves `pending_deposit` to `confirmed`.

## Tests
- Unit-test the rules (slot generation, notice, buffers). Integration-test each function.
- **Concurrency test:** N parallel creates for the same slot produce exactly 1 success.
