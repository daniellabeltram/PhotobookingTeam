# Security-reviewer knowledge (Vera)

NOTE: this repo is PUBLIC (checked 2026-11-25 via gh api). Everything here is world-readable:
keep notes at threat-model level, no exploit recipes for unfixed issues, never any secret value.

## Threat model (updated 2026-11-25, design review T-007)
- Assets: client PII (names, phones, emails, locations, children's ages, free-text notes), Daniella's
  admin session, booking integrity/availability, Resend sending reputation, Netlify credits (cost DoS).
- Stack facts: own auth (PBKDF2 hash + optional TOTP in env, HMAC cookie, ADR 0003); Netlify Blobs
  site-wide store `dbp-<DATA_NAMESPACE>` (ADR 0002); Resend via fetch (ADR 0004); payment links only,
  no card data, no payment secrets in v1 (ADR 0005); Vite vanilla TS, no VITE_ vars (ADR 0001).
- Trust boundaries:
  1. Browser -> /api/* (public: config, policies, availability, POST bookings; admin: cookie + Origin).
  2. Deploy previews share the SAME site-wide Blobs as production. The namespace guard is our own
     code, so it only stops misconfiguration, never malicious code. Fork PRs on a public repo run
     attacker code: Netlify "untrusted deploys policy" must stay on "Require approval" (Netlify
     changelog 2026-11-16).
  3. Env vars: Netlify UI per deploy context. The UI default "same value for all contexts" is the
     main misconfiguration risk. Platform truth = Functions `context.deploy.context`
     (`@netlify/types` 3.3.1: deploy.{context,id,published}), use it to cross-check APP_ENV.
  4. Anyone with Netlify team or GitHub write access effectively controls the app (2FA on both).
- Threats tracked: login brute force/parallel bypass; lockout DoS of Daniella; dev placeholder
  secrets reaching prod; previews touching prod data or emailing real clients; PII in logs via
  error messages (JSON.parse snippets, provider errors); PII copies in admin notice emails and Resend
  retention; booking-form email relay/phishing + calendar lock-up (no hold expiry in v1); CSV formula
  injection; XSS on same-origin public pages reaching admin API; open redirect on login return.
- Out of scope: card data (hosted links only in v1).

## Design review 2026-11-25 (T-007): open findings to re-check in code review
- H1 env guards must bind to platform deploy context; prod must reject EMAIL_REDIRECT_TO, FAKE_NOW etc.
- H2 env.ts must reject placeholder/dev secrets, dev hash, *.test admin email in preview/prod.
- H3 login limiter: reserve attempt before PBKDF2, fail closed, global bucket.
- M1 lockout DoS (device-cookie bucket). M2 TOTP required in prod (Daniella decision).
- M3 log error messages. M4 admin notice email contents (doc conflict 008 #2 vs emails.md section 2).
- M5 global booking cap + first-name-only echo in client emails. M6 preview/prod isolation ops.
- Lows: revocation epoch, secret bundle defense, open redirect, payment.method wipe, retention flag,
  q= in URLs, password tool CSP, iteration bounds, childrenAges optional, IPv6 /64 bucketing.
- Detail lives in the T-007 handoff (orchestrator has it); board task T-007.

## Pre-release code review 2026-11-26 (v1, feature/v1): verdict BLOCK, one item
- Verified in code: H1, H3, M1, M2, M3 (code), M4, L2-L4, L6, L9; admin guard on every admin
  function with a config-derived path x method 401 test; bundle has no secrets or maps; public
  endpoints return no other clients' data; history scan found no real keys. npm audit: 0.
- Open (High, blocks): H2 is only partly done. Deployed-context secret validation must reject
  every secret-shaped literal that exists anywhere in this public repo (dev defaults, test and e2e
  seeds), not only placeholder words. Re-check this first on re-review.
- Open (Medium/Low): client-typed free text still reaches outbound client email/.ics (relay);
  idempotency replay records keep a copy of booking output beyond "delete client data"; CI dist
  scan pattern collides with the password tool's help text (fix the text, never loosen the scan).
- Not built (known): L5 retention flag, "sign out everywhere" UI (valid-after check exists).

## Accepted risks (need Daniella's OK, dated)
- (none yet) Candidates awaiting her answer: TOTP optional in prod; no automatic hold expiry in v1
  (she chose manual 2026-11-25, security impact = calendar lock-up by bots); full intake in her
  notice email.

## Recurring findings / lessons
- 2026-11-25: guards keyed only on APP_ENV fail open when APP_ENV itself is misconfigured. Always
  ask "what if this env var is wrong or missing?" and prefer platform-provided signals.
- 2026-11-25: "fail open" rate limits are fine for booking spam, never for login.
- 2026-11-26: "reject placeholders" rules miss realistic-looking dev/test values. In a public repo
  every literal secret is public: deny-list them by value and require the documented format.
- 2026-11-26: probe env guards by running readEnv directly (node --experimental-strip-types on a
  scratch copy); vitest with --root / hangs.
- 2026-11-25: @netlify/blobs 11.1.11 pulls ~60 transitive packages, but the native keyring and
  dev-utils chain is only reachable via `@netlify/blobs/server` (local emulator). The functions must
  import only the main entry. npm audit on the proposed tree: 0 vulnerabilities (237 packages).
