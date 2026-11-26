# 017 — Spam protection (honeypot and rate limit)
**Scope:** v1 (02 Platform)      **Status:** ready      **Priority:** P0
**As** Daniella, **I want** bots and floods blocked from the booking form, **so that** fake bookings don't take real slots or fill my inbox.

## Acceptance criteria
1. **Given** the booking form, **When** rendered, **Then** it includes a honeypot field that is hidden from sighted users **and** from screen readers and keyboard focus (so real users can't fill it by accident).
2. **Given** a submission with the honeypot filled, **When** received, **Then** no booking is created, no slot is reserved, no email is sent, and the response looks like a normal response to the sender.
3. **Given** more than `booking_rate_limit` booking submissions from one source within the rate window, **When** the next one arrives, **Then** it is refused, no booking is created, and a real person sees "Too many attempts. Please wait a few minutes and try again, or contact Daniella at [contact email]."
4. **Given** availability requests far above normal use from one source, **When** the limit is exceeded, **Then** further requests are refused for a period without affecting other visitors.
5. **Given** a real client booking normally (one submission, maybe one retry after a conflict), **When** they book, **Then** they never hit the limit.
6. **Given** blocked or rate-limited requests, **When** logged, **Then** logs record counts and reasons only, with no names, emails, phones or full IP addresses.

## Out of scope
- CAPTCHA (added only if spam gets through in practice, per 02).

## Notes / open questions
- `booking_rate_limit` and its window are **proposed new config values** (`[PLACEHOLDER]`, e.g. a few per hour); architect/security to set.

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
