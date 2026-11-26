# 0003. Admin authentication
Date: 2026-11-25 · Status: accepted

## Context
- One admin (Daniella) in v1. The admin API returns PII, including children's ages, so **every admin endpoint** must check the session on the server (story 010 #2). Hiding pages is not protection.
- Requirements from story 010: same error for any wrong credential, lockout after repeated failures, sign-out, idle timeout with return to the same page, a recovery path without developer help, HTTPS only, no shared caching, no indexing. MFA is strongly recommended.
- Must run locally with no accounts. Few dependencies. Free.

## Options considered
1. **Netlify Identity.** Pros: hosted, free tier, email/password. Cons: its status has been unstable. Netlify announced its deprecation in 2025 alongside the Auth0 extension (https://www.netlify.com/blog/auth0-extension-identity-changes/); community and maintainer posts report the deprecation was reversed on 2026-02-19 (https://answers.netlify.com/t/netlify-identity-is-staying-feb-2026-reversal-what-changed-whos-affected-and-how-to-proceed/162733, https://github.com/decaporg/decap-cms/discussions/7419, both read 2026-11-25), but I could not find the original changelog on netlify.com. It also doesn't run locally without the Netlify CLI and a linked site. Too uncertain for the one control that guards PII.
2. **Auth0 / Clerk / Supabase Auth.** Pros: MFA, recovery flows. Cons: another vendor account and SDK, JWT verification setup, and a local fake needed for tests. Heavy for one user.
3. **Own minimal auth with Node `crypto` and env vars only.** Pros: no vendor, no dependency, fully testable locally, short code (about 200 lines). Cons: we own it, so it needs careful review (security-reviewer gate).

## Decision
**Option 3: a password hash in an env var, optional TOTP second factor, and an HMAC-signed, expiring session token in an HttpOnly cookie.** All code is in `netlify/lib/auth/`, and it uses only `node:crypto`.

### Credentials (env vars, set by Daniella in the Netlify UI)
| Name | Value |
|---|---|
| `ADMIN_EMAIL` | Her sign-in email. This is the v1 admin allowlist (one entry). Compared case-insensitively in constant time. |
| `ADMIN_PASSWORD_HASH` | `pbkdf2-sha256$600000$<salt base64url, 16 bytes>$<key base64url, 32 bytes>` |
| `ADMIN_SESSION_SECRET` | At least 32 random bytes, base64url. Signs session tokens. Rotating it signs everyone out. |
| `ADMIN_TOTP_SECRET` | Optional. Base32 RFC 6238 secret. If set, sign-in also requires a 6-digit code. |

**Why PBKDF2-HMAC-SHA256 with 600,000 iterations instead of scrypt:** it is the OWASP-recommended PBKDF2 setting (https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html, checked 2026-11-25; OWASP's scrypt minimum is N=2^17, r=8, p=1). PBKDF2 is also available in the browser's Web Crypto API. That lets us ship a **static, offline password tool** (`/admin/password-tool.html`) that turns a new passphrase into the hash string in her own browser and sends nothing over the network. That is the recovery path (story 010 #8): she signs in to Netlify (her account has its own 2FA), pastes the new hash into `ADMIN_PASSWORD_HASH`, and clicks "Trigger deploy". Env var changes only apply on the next deploy (https://docs.netlify.com/build/functions/environment-variables/, checked 2026-11-25). The same page generates a TOTP secret and shows it as text and an `otpauth://` URI to type into an authenticator app (no QR library). There is also `node scripts/admin-hash.ts` for developers. The tool enforces a passphrase of at least 14 characters.

### Sign-in (`POST /api/admin/login`)
1. Rate limit: at most 5 failed attempts per hashed IP per 10 minutes, and 50 failures per hour site-wide. When over the limit, return `429 RATE_LIMITED` before checking anything ("Too many attempts. Please wait 10 minutes and try again.").
2. Always run the PBKDF2 derivation (even when the email is wrong), then compare email and key with `crypto.timingSafeEqual`. Any mismatch returns `401 INVALID_CREDENTIALS` with the same message, plus a failure count.
3. If `ADMIN_TOTP_SECRET` is set: accept the current 30-second step ±1, and reject a step that was already used (`auth/totp-last-step` stored with CAS).
4. Issue the session cookie.

### Session token and cookie
- Token: `v1.<base64url(JSON payload)>.<base64url(HMAC-SHA256(secret, "v1." + payload))>`. Payload: `{ sub: ADMIN_EMAIL, iat, idleExp, absExp, jti }` (epoch seconds).
- Lifetimes: idle timeout `admin.sessionIdleMinutes` (60) and absolute limit `admin.sessionMaxHours` (12), from config. On each authenticated request, if more than 5 minutes have passed since `iat`, the response re-issues the cookie with a new `iat` and `idleExp` but the same `absExp`.
- Cookie: `__Host-dbp_admin=<token>; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=<seconds to idleExp>`. When `APP_ENV=local` or `test` (plain `http://localhost`), the name is `dbp_admin` and `Secure` is dropped. Nothing else changes.
- Logout (`POST /api/admin/logout`) sets the same cookie with `Max-Age=0`. Tokens are not stored on the server, so a stolen token works until it expires. To kill all sessions, rotate `ADMIN_SESSION_SECRET` and redeploy. A token whose `sub` no longer equals `ADMIN_EMAIL` is rejected, so changing the email also revokes sessions.

### Guard (`requireAdmin(req)`), first line of every admin handler
1. Parse the cookie, verify the HMAC with `timingSafeEqual`, check `idleExp` and `absExp`, and check `sub === ADMIN_EMAIL`. Otherwise `401 UNAUTHORIZED`. The response clears the cookie.
2. For `POST`/`PATCH`/`PUT`/`DELETE`: the `Origin` header must equal the request URL's origin (CSRF defense on top of `SameSite=Strict`), and bodies must be `Content-Type: application/json`. Otherwise `403 FORBIDDEN`.
3. Every admin response sets `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`.
Deny by default: the admin function files export a handler wrapped by `withAdmin(handler)`, and a unit test lists every file named `admin-*.ts` and asserts that each returns 401 without a cookie (story 010 #2).

`403 FORBIDDEN` ("You don't have access") covers a valid signature whose `sub` is not on the allowlist only after we add a multi-admin allowlist (v1.1). In v1 it can't happen, so we return 401.

## Consequences
- No vendor, no SDK, fully testable: tests mint tokens with a test secret and a fixed clock.
- `security-reviewer` must review `netlify/lib/auth/` before merge.
- MFA is available but optional. **Recommend that Daniella turns on TOTP and 2FA on her Netlify account** (whoever controls the Netlify account controls the app).
- A sign-in costs one PBKDF2 run, about 0.3–0.6 s of CPU per attempt. Fine for one user.
- Revisit for v1.1 if staff accounts are needed: add an `ADMIN_USERS` JSON env var (email → hash, role) or move to a hosted provider.
