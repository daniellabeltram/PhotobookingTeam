---
name: security-privacy-checklist
description: "Security and privacy checklist for this app: admin auth, input validation, PII handling (including children's details), secrets, spam/abuse, payments, headers, dependencies, and data retention. Use when designing, building, deploying or reviewing anything sensitive."
user-invocable: false
---

# Security and privacy checklist

## Data we hold
Client names, email, phone, location, number of people, children's ages, pets, style notes and free text, policy acceptance, and booking status. Treat all of it as **PII**. There is no card data, ever (Stripe-hosted only).

## Checklist
**Authentication and authorization**
- [ ] Every admin API checks the token and role on the server. Deny by default.
- [ ] Admin sessions expire. Logout works. MFA is available or recommended to Daniella.
- [ ] No admin data is reachable by guessing IDs (IDOR). Public endpoints never return other clients' data.

**Input and output**
- [ ] Schema validation on every endpoint, rejecting unknown fields, with length limits on free text.
- [ ] Output is encoded and there is no `innerHTML` with user content. CSV export guards against formula injection (prefix `=`, `+`, `-`, `@`).
- [ ] Email headers can't be injected through names or addresses.

**Abuse**
- [ ] Honeypot field and per-IP rate limit on booking creation. Add a CAPTCHA only if abuse is seen.
- [ ] Unpaid holds expire so bots can't lock the calendar.

**Secrets and config**
- [ ] Secrets only in Netlify env vars. `.env` is gitignored. No secrets in the client bundle or logs.
- [ ] Webhook signatures are verified (Stripe). Keys follow least privilege.

**Transport and headers**
- [ ] HTTPS only. HSTS, a CSP (no `unsafe-inline` where avoidable), `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'` for admin.

**Privacy**
- [ ] Collect only what the intake needs. The children's ages field is optional.
- [ ] A privacy notice states what is collected, why, and how to request deletion.
- [ ] No PII in logs or analytics. There is a retention plan, e.g. purge or anonymize N months after the session (placeholder, Daniella decides).
- [ ] The portfolio-use opt-out is stored and visible in admin.
- [ ] SMS (later) requires explicit consent and opt-out (TCPA).

**Dependencies**
- [ ] Lockfile is committed. `npm audit` (or equivalent) has no high or critical findings. Dependencies are few and well maintained.

## Finding format
`[Severity] Title — file:line — Scenario — Impact — Fix`. Severities are Critical, High, Medium and Low. Any Critical or High blocks release.

## Not legal advice
Florida and US privacy, consumer and tax questions go to Daniella's attorney or CPA, as noted in `docs/03-research.md`.
