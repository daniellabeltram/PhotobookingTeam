# Backend-developer knowledge (Omar)

## Must-haves
- Atomic reservation, idempotent create, server-side availability, policy_version stored.
- Emails after commit (client + Daniella, with .ics). Email failure doesn't roll back the booking.
- Admin endpoints: auth first, deny by default. No PII in logs.
- Store UTC; compute in America/New_York; test DST weeks (2nd Sun Mar, 1st Sun Nov).

## Statuses
requested · pending_deposit · confirmed · completed · cancelled · expired · declined (+ reschedule history)

## Data-store and provider notes
- (record quirks, limits and their sources with dates)
