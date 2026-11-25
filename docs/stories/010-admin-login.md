# 010 — Admin login and access control
**Scope:** v1 (02 §1.9)      **Status:** ready      **Priority:** P0
**As** Daniella (admin), **I want** the admin page to be reachable only by me (and staff I approve), **so that** client names, phone numbers and children's details stay private.

## Acceptance criteria
1. **Given** a visitor who is not signed in, **When** they open any admin URL, **Then** they are sent to the login screen and no booking data is shown or downloaded (checked by viewing the page source and network responses).
2. **Given** a request to any admin data endpoint (list, detail, status change, blocks, mini slots, CSV) without a valid admin session, **When** it is made directly, **Then** it is refused with an "unauthorized" response and no data.
3. **Given** a signed-in user whose identity is not on the `admin_allowlist`, **When** they open admin, **Then** they see "You don't have access" and no data.
4. **Given** wrong credentials, **When** submitted, **Then** the message is the same whether the account exists or not ("Those details didn't work").
5. **Given** repeated failed sign-in attempts from one account or address, **When** they exceed the limit set by the architect, **Then** further attempts are slowed or blocked for a period and the message says to try again later.
6. **Given** Daniella is signed in, **When** she selects "Sign out", **Then** her session ends and the back button does not show admin data.
7. **Given** Daniella is idle longer than the admin session timeout, **When** she next acts, **Then** she is asked to sign in again and, after signing in, returns to the page she was on; no unsaved status change is applied silently.
8. **Given** Daniella forgets her credentials, **When** she uses the recovery path, **Then** she can regain access without developer help.
9. **Given** any admin page or response, **When** inspected, **Then** it is served over HTTPS only and is not cached by shared caches or indexed by search engines.

## Out of scope
- Multiple roles or permissions (one admin role in v1). Staff accounts beyond the allowlist.

## Notes / open questions
- The auth method (e.g. hosted identity provider, magic link, passkey) is the architect's ADR. Multi-factor sign-in is strongly recommended; security-reviewer to confirm.
- `admin_allowlist` is a config/env value (not a policy value). Lockout limits and session timeout are set in the ADR.
- Questions for Daniella: will anyone besides Daniella need access in v1 (02 §1.9 mentions "approved staff")?

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
