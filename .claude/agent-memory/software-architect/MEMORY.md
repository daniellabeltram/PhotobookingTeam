# Software-architect knowledge (Theo)

## Constraints
- Netlify hosting (static + Functions). Low cost. One non-technical owner, so prefer managed services.
- Atomic slot reservation (zero double bookings). Times in America/New_York, DST-safe.
- PII includes children's ages. Admin auth must protect the API.
- Netlify Forms isn't suitable as the booking store (quota differs between legacy and newer plans, and no atomicity); see docs/03 §8.
- Must run and test locally with no accounts/keys (adapters: store + email; drivers chosen by env).

## ADR backlog (architecture-decisions skill)
0001 framework · 0002 data store · 0003 admin auth · 0004 email · 0005 payments · 0006 time handling · 0007 config — all accepted 2026-11-25.

## ADR summaries
- 2026-11-25 · 0001: Vite 8 + vanilla TS multi-page, Zod 4 shared schemas, Vitest 5 + happy-dom, Playwright, ESLint 10 + typescript-eslint 8. TypeScript pinned 6.0.3 (typescript-eslint 8.74 peer is <6.1; TS 7.0.2 is npm latest). `npm run dev` = `vite` with a backend Vite plugin that serves netlify/functions at /api/* (netlify dev optional).
- 2026-11-25 · 0002: Netlify Blobs (strong consistency) behind a KvStore adapter (memory/file/netlify-blobs). Reservation = per-ET-date ledger `days/<date>` updated by CAS (onlyIfMatch/onlyIfNew), 5 retries. Ledger first, then booking record; orphans pruned lazily. Idempotency claim via onlyIfNew. Launch gate: 20-parallel test on a preview.
- 2026-11-25 · 0003: Own auth: ADMIN_EMAIL + PBKDF2-SHA256 600k hash env var, optional TOTP, HMAC session token in `__Host-dbp_admin` cookie (idle 60 min / abs 12 h), Origin check on writes. Offline browser password tool for recovery.
- 2026-11-25 · 0004: Resend REST via fetch (no SDK), EmailSender adapter (memory/file/resend), EMAIL_REDIRECT_TO for previews, hand-written .ics in UTC with stable UID + SEQUENCE.
- 2026-11-25 · 0005: Payment link per type from config (`depositPaymentLink`, optional map by duration), `client_reference_id` for Stripe links, admin mark_paid / confirm_without_payment. Deposit overdue is a derived flag (no auto-release in v1).
- 2026-11-25 · 0006: Luxon 3.7.2 only in shared/datetime.ts (both server and browser). UTC ISO instants + ET date/time strings. DST gap → null; ambiguous → earlier (EDT). FAKE_NOW only local/test.
- 2026-11-25 · 0007: config/*.ts validated by Zod; camelCase keys with mapping table from story names; immutable policy version files with hash lock; browser reads config via GET /api/config only.

## Design decisions to remember
- Events = booking_mode request in v1 (Daniella, 2026-11-25): `requested` holds the slot; approve/decline; no auto-expiry; "Reply overdue" flag after requestResponseDays.
- Minis = admin-created mini day per date with explicit slots in the day ledger; any mini slot blocks other types; minis don't count to daily cap.
- Booking id = reference `DBP-` + 6 chars (no 0/O/1/I/L/U). No public GET of a booking.
- Honeypot filled → fake 201 (story 017 #2).
- Window end + buffer must stay before midnight (ledger is per ET date).

## Vendor facts checked
- 2026-11-25 · Netlify Blobs: set/setJSON support `onlyIfNew` / `onlyIfMatch` (ETag), return `{modified, etag}`; default eventual consistency (≤60 s propagation), opt-in `consistency: "strong"` per store/read; keys ≤600 bytes, store names ≤64 bytes no `/` `:`; site-wide stores shared by all deploys; troubleshooting text still says "last write wins / no concurrency control" (stale). https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- 2026-11-25 · Netlify Functions: custom `config.path` means NOT served at /.netlify/functions/<name>; `method` filter; URLPattern syntax, params on context.params; sync limit 60 s, scheduled 30 s; fallback runtime Node 24; runtime set via AWS_LAMBDA_JS_RUNTIME (UI only). https://docs.netlify.com/build/functions/configuration/
- 2026-11-25 · Netlify env vars in netlify.toml are NOT available to functions; only URL, SITE_NAME, SITE_ID read-only at runtime; changes need a redeploy. https://docs.netlify.com/build/functions/environment-variables/
- 2026-11-25 · Scheduled functions: `config.schedule`, only on published deploys, 30 s limit. https://docs.netlify.com/build/functions/scheduled-functions/ (not used in v1)
- 2026-11-25 · Netlify pricing: Free 300 credits/mo; prod deploy 15 credits; compute 10 credits/GB-h; web requests 2 credits/10k; Personal $9/mo with 1,000 credits. https://www.netlify.com/pricing/
- 2026-11-25 · Netlify Identity: deprecated 2025, community reports reversal 2026-02-19; original changelog gone. Not used. https://answers.netlify.com/t/netlify-identity-is-staying-feb-2026-reversal-what-changed-whos-affected-and-how-to-proceed/162733
- 2026-11-25 · Resend: Free $0, 3,000/mo, 100/day, 3 domains, 30-day retention; Pro $20/50k. POST https://api.resend.com/emails, Bearer, attachments base64 (≤40 MB), Idempotency-Key header. https://resend.com/pricing · https://resend.com/docs/api-reference/emails/send-email
- 2026-11-25 · Stripe Payment Links accept `client_reference_id` (alnum, `-`, `_`, ≤200) and `prefilled_email` URL params. https://docs.stripe.com/mobile/digital-goods/payment-links
- 2026-11-25 · OWASP: PBKDF2-HMAC-SHA256 600,000 iterations; scrypt N=2^17 r=8 p=1. https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- 2026-11-25 · npm versions: vite 8.3.8, typescript 6.0.3 (7.0.2 latest), @netlify/blobs 11.1.11, @netlify/functions 6.1.2, luxon 3.7.2, @types/luxon 3.7.6, zod 4.6.7, vitest 5.1.2, happy-dom 21.0.4, @playwright/test 1.65.1, @axe-core/playwright 4.14.1, eslint 10.15.0, @eslint/js 10.0.1, typescript-eslint 8.74.0, globals 17.14.0, @types/node 22.20.7. Node local 22.23.5 (type stripping on by default ≥22.18). Vite 8 still has `server.ssrLoadModule`.
- Network note: docs.netlify.com is not reachable with WebFetch in this sandbox; Firecrawl scrape works.
