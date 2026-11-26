# Architecture (v1)

Owner: software-architect · Last updated: 2026-11-25 · Decisions: `docs/adr/0001`–`0007` · API contract: `docs/api.md`

## 1. Overview
A static, multi-page TypeScript front end (Vite, no framework) and a handful of Netlify Functions (`/api/*`) on one origin. Data sits in **Netlify Blobs** behind a key/value adapter. Double bookings are prevented by a **per-day ledger document updated with compare-and-swap** (ETag `onlyIfMatch` / `onlyIfNew`). Email goes through **Resend** via `fetch`, with an `.ics` we generate ourselves. Admin auth is our own: a PBKDF2 hash plus optional TOTP in env vars, and an HMAC-signed HttpOnly cookie. All times are computed in America/New_York with **Luxon** in one shared module.

Everything runs locally with **no accounts or keys**: `npm run dev` (Vite serves the functions through a dev plugin), a file-backed store and a file email outbox in `.data/`. Tests use in-memory drivers and call handlers directly with `Request` objects.

## 2. Diagram
```
 Phone / laptop browser
 ┌─────────────────────────────────────────────────────────────┐
 │ index.html  booking flow (5 steps)   policies.html privacy  │
 │ admin/index.html  admin app          admin/password-tool    │
 │ src/lib/api.ts (only caller of /api)  src/lib/datetime.ts   │
 └───────────────┬─────────────────────────────────────────────┘
                 │ HTTPS, JSON, same origin (cookie for admin)
 ┌───────────────▼─────────────────────────────────────────────┐
 │ Netlify CDN: dist/ (static)      Netlify Functions /api/*    │
 │  config · availability · bookings-create                     │
 │  admin-auth · admin-bookings · admin-availability            │
 │  admin-blocks · admin-mini-days · admin-export               │
 │        │ netlify/lib: http, auth, domain (availability,      │
 │        │ reserve, transitions), repos, email, datetime       │
 └────────┼──────────────────────────────┬─────────────────────┘
          │ KvStore adapter              │ EmailSender adapter
 ┌────────▼─────────────────┐   ┌────────▼────────────────────┐
 │ prod/preview: Netlify    │   │ prod/preview: Resend REST   │
 │  Blobs store             │   │  (+ .ics attachment)        │
 │  "dbp-<DATA_NAMESPACE>"  │   │ local: .data/outbox files   │
 │  strong consistency, CAS │   │ tests: memory               │
 │ local: .data/store files │   └─────────────────────────────┘
 │ tests: memory            │
 └──────────────────────────┘
 Config (session types, windows, policies) = config/*.ts in the repo, validated by Zod.
 Payments: hosted payment links from config; Daniella marks paid in admin.
```

## 3. Repository layout and ownership
```
/
├─ package.json, package-lock.json        backend (scaffold)   scripts and deps per §4 / ADR 0001
├─ tsconfig.json                          backend (scaffold)   one config for src, shared, config, netlify, tests, e2e
├─ eslint.config.js                       backend (scaffold)   incl. no-innerHTML, luxon-only-in-shared/datetime, no config/ in src/
├─ vitest.config.ts                       backend (scaffold)   QA may edit include globs / setup files
├─ vite.config.ts                         frontend             multi-page inputs; imports netlify/dev/functions-dev-plugin
├─ playwright.config.ts                   QA                   webServer: npm run dev (APP_ENV=local, FAKE_NOW, DATA_DIR=.data/e2e)
├─ netlify.toml                           devops               build, functions dir, NODE_VERSION=22, headers, redirects
├─ .github/workflows/ci.yml               devops
├─ .env.example                           devops               every name from §5, no values
├─ .gitignore                             devops               .env, .data/, dist/, node_modules/, test-results/
├─ index.html                             frontend             booking flow
├─ policies.html, privacy.html            frontend
├─ admin/index.html                       frontend             admin app (list, detail, blocks, minis)
├─ admin/password-tool.html               frontend             offline hash + TOTP tool (ADR 0003); logic in src/admin/password-tool.ts
├─ public/                                frontend             favicon, robots.txt (Disallow: /admin, /api)
├─ src/                                   frontend
│  ├─ booking/                            steps: type, datetime, intake, policies, confirmation; flow-state.ts
│  ├─ admin/                              list, detail, actions dialogs, blocks, mini-days, login, password-tool
│  ├─ components/                         small presentational pieces (calendar grid, field, status chip, dialog)
│  ├─ lib/api.ts                          the only place that calls /api; typed with shared/api-types.ts
│  ├─ lib/datetime.ts                     re-exports shared/datetime.ts
│  ├─ lib/dom.ts                          h() helper (textContent only)
│  └─ styles/                             tokens.css from docs/design/tokens.md
├─ shared/                                backend (browser-safe: no node:* imports)
│  ├─ datetime.ts                         ADR 0006 (the only Luxon importer)
│  ├─ config-schema.ts                    Zod config schema + types (ADR 0007)
│  ├─ schemas/booking.ts                  POST /api/bookings body schema builder (from intake catalogue)
│  ├─ schemas/admin.ts                    admin request bodies
│  ├─ api-types.ts                        request/response types for every endpoint in docs/api.md
│  ├─ errors.ts                           error code union + HTTP status map
│  ├─ money.ts                            amount-due rules (ADR 0005), formatUsd
│  ├─ policy-render.ts                    fill policy summary placeholders
│  ├─ status.ts                           BookingStatus, transition table, derived flags
│  └─ reference.ts                        reference format/validate (DBP-XXXXXX)
├─ config/                                backend (content from Daniella)
│  ├─ booking.config.ts, intake-fields.ts
│  └─ policies/index.ts, v0.1-draft.ts, hashes.json
├─ netlify/
│  ├─ functions/                          backend   one file per resource (§7); each exports default handler + config {path, method}
│  ├─ lib/                                backend   server-only
│  │  ├─ env.ts                           typed env reader + production guards
│  │  ├─ services.ts                      lazy container {store, email, clock, config}; setServicesForTest()
│  │  ├─ http.ts                          json(), errorResponse(), readJson(schema), requestId, headers
│  │  ├─ route.ts                         tiny ":param" path matcher shared with the dev plugin
│  │  ├─ log.ts                           structured JSON logs with a key allowlist (no PII)
│  │  ├─ clock.ts, config.ts, ratelimit.ts, idempotency.ts, csv.ts, ip.ts
│  │  ├─ auth/                            password.ts, session.ts, totp.ts, guard.ts (withAdmin)
│  │  ├─ store/                           kv.ts (interface), memory.ts, file.ts, netlify-blobs.ts, index.ts
│  │  ├─ repos/                           bookings.ts, ledger.ts, blocks.ts
│  │  ├─ domain/                          availability.ts, reserve.ts, alternatives.ts, transitions.ts,
│  │  │                                   reschedule.ts, mini-days.ts, create-booking.ts, delete-pii.ts
│  │  └─ email/                           sender.ts, memory.ts, file.ts, resend.ts, ics.ts, notify.ts, templates/*.ts
│  └─ dev/functions-dev-plugin.ts         backend   Vite plugin: /api/* → handlers (ADR 0001)
├─ scripts/admin-hash.ts                  backend   `node scripts/admin-hash.ts` → ADMIN_PASSWORD_HASH
├─ tests/                                 QA (developers add tests for their own code here)
│  ├─ unit/        tests/integration/     tests/helpers/ (request builders, fixed clock, seeded config)
├─ e2e/                                   QA   Playwright specs (375×812 and 1280×800), axe
├─ docs/                                  per documentation-standards
└─ .data/                                 gitignored: local store (.data/store), outbox (.data/outbox), e2e data
```
Ownership rule: change only files you own. Anything else goes through the owner (or the orchestrator). Cross-cutting changes need architect review.

## 4. npm scripts (backend provides them in `package.json`)
| Script | Command | Notes |
|---|---|---|
| `dev` | `vite` | Front end + functions on http://localhost:5173. Defaults: `APP_ENV=local`, `STORE_DRIVER=file`, `EMAIL_DRIVER=file`. |
| `build` | `vite build` | Outputs `dist/`. Netlify bundles `netlify/functions` itself (esbuild). |
| `preview` | `vite preview` | Optional, static only. |
| `test` | `vitest run` | Unit + integration, memory drivers, `APP_ENV=test`. |
| `test:tz` | `TZ=America/Los_Angeles vitest run && TZ=UTC vitest run` | Device-zone independence (CI runs it). |
| `test:e2e` | `playwright test` | Starts `npm run dev` with `DATA_DIR=.data/e2e` (wiped by global setup) and `FAKE_NOW`. |
| `lint` | `eslint .` | |
| `typecheck` | `tsc --noEmit -p tsconfig.json` | |
| `check` | `npm run lint && npm run typecheck && npm test` | Run before every handoff. |
| `admin:hash` | `node scripts/admin-hash.ts` | Prompts for a passphrase and prints the hash string (Node ≥ 22.18 type stripping). |
`netlify dev` also works (optional). It runs the same functions on port 8888.

## 5. Environment variables (names only; values in Netlify UI per context, local in `.env`)
Netlify `netlify.toml` env vars do **not** reach functions at runtime (https://docs.netlify.com/build/functions/environment-variables/, checked 2026-11-25), so all of these are set in the Netlify UI with deploy-context values. A change needs a redeploy.

| Name | Secret | Local default | Preview | Production | Purpose |
|---|---|---|---|---|---|
| `APP_ENV` | no | `local` (`test` in Vitest) | `preview` | `production` | Drives guards, cookie flags, FAKE_NOW allowance |
| `STORE_DRIVER` | no | `file` (`memory` in tests) | `netlify-blobs` | `netlify-blobs` | ADR 0002 |
| `DATA_DIR` | no | `.data/store` | – | – | File driver root |
| `DATA_NAMESPACE` | no | – | `preview` | `production` | Blobs store name `dbp-<ns>`; guards stop previews from using `production` |
| `EMAIL_DRIVER` | no | `file` (`memory` in tests) | `resend` | `resend` | ADR 0004 |
| `EMAIL_OUTBOX_DIR` | no | `.data/outbox` | – | – | File email driver |
| `RESEND_API_KEY` | **yes** | – | preview key | live key | Resend API |
| `EMAIL_REDIRECT_TO` | no | – | a test inbox (required) | must be unset | Sends every preview email to one inbox |
| `ADMIN_EMAIL` | no | `admin@example.test` | set | set | Admin username / allowlist |
| `ADMIN_PASSWORD_HASH` | **yes** | hash of a dev passphrase in `.env.example` comments | set | set | ADR 0003 |
| `ADMIN_SESSION_SECRET` | **yes** | any 32+ byte dev value | own value | own value | Signs sessions |
| `ADMIN_TOTP_SECRET` | **yes** | – | optional | recommended | Second factor |
| `PUBLIC_BASE_URL` | no | `http://localhost:5173` | deploy URL | `https://book.daniellabeltram.photography` [PLACEHOLDER domain] | Links in emails (falls back to Netlify's `URL`) |
| `PAYMENT_LINK_OVERRIDE_URL` | no | – | optional test link | ignored | ADR 0005 |
| `FAKE_NOW` | no | optional | ignored | ignored | Pins the clock in local/test only |
| `RATE_LIMIT_DISABLED` | no | optional | optional (concurrency test) | ignored | Load tests only |
| `LOG_LEVEL` | no | `info` | `info` | `info` | `debug` never logs PII either |
| `NODE_VERSION` | no | – | `22` | `22` | Set in `netlify.toml` (build) |

## 6. Data model
All instants are UTC ISO strings. ET date/time strings follow ADR 0006. Money is integer cents.

### Booking (`bookings/<reference>`)
| Field | Type | Notes |
|---|---|---|
| `id` | `"DBP-" + 6 chars` from `23456789ABCDEFGHJKMNPQRSTVWXYZ` | Booking reference, random (about 31^6 ≈ 887M values). Unique by `onlyIfNew`. Never sequential. |
| `version` | int | +1 on every write. The API exposes it as `expectedVersion` for optimistic concurrency. |
| `status` | `requested \| pending_deposit \| confirmed \| completed \| cancelled \| declined` | (`expired` is reserved for v1.1) |
| `sessionTypeId`, `sessionTypeName` | string | Name snapshot at booking time |
| `bookingMode` | `instant \| request` | Snapshot |
| `durationMin`, `bufferMin` | int | Snapshot (Events: the chosen length) |
| `startUtc`, `endUtc`, `busyStartUtc`, `busyEndUtc` | ISO | Busy = with buffers |
| `localDate`, `localStartTime`, `localEndTime`, `timezone` | strings | Denormalized ET |
| `miniSlotId` | string \| null | Minis only |
| `location` | `{kind:"suggested", optionId, label} \| {kind:"own", text} \| {kind:"help_me_choose"} \| {kind:"mini_day", label}` | |
| `contact` | `{fullName, email, phone, preferredContact}` | PII |
| `people` | `{adults, children, pets}` | |
| `intake` | object keyed by catalogue ids (common optional fields + type extras) | PII, including children's ages |
| `portfolioOptOut` | boolean \| null | |
| `policyVersion`, `policyAcceptedAt` | string, ISO (server time) | |
| `pricing` | `{priceFromCents, priceUnit, estimatedTotalCents?, amountDueCents, amountDueKind:"deposit"\|"estimated_deposit"\|"full"\|"none", paymentLinkUrl: string\|null}` | Computed at create, refreshed on reschedule of Events |
| `payment` | `{amountCents, receivedOn, method?, note?, recordedAt} \| null` | |
| `createdAt`, `requestedAt?`, `approvedAt?`, `confirmedAt?`, `completedAt?`, `cancelledAt?`, `declinedAt?` | ISO | |
| `holdStartedAt` | ISO \| null | `createdAt` (instant) or `approvedAt` (requests). Basis for "Deposit overdue" |
| `cancellation` | `{reason: "client_cancelled"\|"deposit_not_received"\|"photographer_cancelled"\|"other", note?}` \| null | |
| `decline` | `{messageToClient?, note?}` \| null | |
| `rescheduleCount`, `lastRescheduledAt` | int, ISO \| null | "Rescheduled" filter = `rescheduleCount > 0` |
| `icsSequence` | int | +1 on confirm and reschedule |
| `emails` | `Record<EmailKind, {status:"sent"\|"failed"\|"skipped", at, attempts, providerId?}>` | "Email not sent" = latest client email failed |
| `history` | `{at, by:"client"\|"admin"\|"system", action, fromStatus?, toStatus?, fromStartUtc?, toStartUtc?, reason?, note?}[]` | Append-only |
| `piiDeletedAt` | ISO \| null | After "Delete client data" |

Derived (never stored, computed in `shared/status.ts` with `now`): `depositOverdue`, `replyOverdue` (`requested` and `now ≥ requestedAt + requestResponseDays`), `sessionTimePassed`, `waitingSince`, `emailNotSent`, `noPaymentLink`, plus flag chips `surpriseProposal` and `helpMeChooseLocation`.

**Delete client data** (only `cancelled`, `completed` or `declined`): sets `contact`, `intake`, `people`, `portfolioOptOut`, `payment.note`, `cancellation.note`, `decline.*` and each history `note` to null; `location` becomes `{kind:"removed"}`; sets `piiDeletedAt`, adds a history entry. It keeps the reference, type, times, status, amounts and policy version.

### DayLedger (`days/<YYYY-MM-DD>`)
```ts
{ date: "2026-12-05", updatedAt: ISO,
  entries: [{ bookingId, sessionTypeId, kind: "standard"|"mini", startUtc, endUtc, busyStartUtc, busyEndUtc,
              countsTowardDailyCap: boolean, miniSlotId: string|null, createdAt: ISO, verified: boolean }],
  miniDay: null | { location: string, theme: string|null, createdAt: ISO,
              slots: [{ id: "ms_<date>_<HHmm>", startUtc, endUtc, busyStartUtc, busyEndUtc, bookingId: string|null }] } }
```
Only **active** bookings (`requested`, `pending_deposit`, `confirmed`) have entries. Holiday Minis are modelled as **specific windows** that Daniella creates (`miniDay.slots`). A mini booking points at one slot. Every mini slot, booked or not, blocks other types over its busy interval. Minis never count toward the daily cap. Working days and windows don't apply to minis. Notice and the minis horizon do apply.

### Slot-reservation key scheme
- Conflict scope is **one ET date**. Config validation guarantees no busy interval crosses midnight.
- Reservation = CAS update of `days/<date>` (ADR 0002): read with ETag, check conflicts, write with `onlyIfMatch` (or `onlyIfNew` for a new day), retry up to 5 times on a lost race, then return `SLOT_TAKEN` or `503 BUSY`.
- Conflicts: busy-interval overlap with any entry; for non-mini types, overlap with any mini slot and the daily cap; for minis, the slot must exist and be free.

### BlockedTime (`blocks/<blk_xxxxxxxx>`)
`{ id, kind: "all_day" | "time_range", startDate, endDate, startTime: "HH:mm"|null, endTime: "HH:mm"|null, startUtc, endUtc, label: string|null (private), createdAt }`. All-day blocks cover `[startDate 00:00 ET, endDate+1 00:00 ET)`. A time range sits on one date. Blocks never change bookings. Saving one that overlaps active bookings needs `confirmOverlaps: true` (story 015 #3).

### Other keys
`idem/<sha256>` (ADR 0002), `rl/<scope>/<hmac-sha256(ip, key derived from ADMIN_SESSION_SECRET)>/<windowStartEpoch>`, `auth/totp-last-step`.

## 7. Functions (route table; details in `docs/api.md`)
| File | Paths | Methods |
|---|---|---|
| `config.ts` | `/api/config`, `/api/policies/:version` | GET |
| `availability.ts` | `/api/availability` | GET |
| `bookings-create.ts` | `/api/bookings` | POST |
| `admin-auth.ts` | `/api/admin/login`, `/api/admin/logout`, `/api/admin/session` | POST, POST, GET |
| `admin-bookings.ts` | `/api/admin/bookings`, `/api/admin/bookings/:id`, `/api/admin/bookings/:id/reschedule`, `/api/admin/bookings/:id/resend-email`, `/api/admin/bookings/:id/delete-client-data` | GET, GET/PATCH, POST, POST, POST |
| `admin-availability.ts` | `/api/admin/availability` | GET |
| `admin-blocks.ts` | `/api/admin/blocks`, `/api/admin/blocks/:id` | GET/POST, DELETE |
| `admin-mini-days.ts` | `/api/admin/mini-days`, `/api/admin/mini-days/:date`, `/api/admin/mini-days/:date/slots`, `/api/admin/mini-days/:date/slots/:slotId` | GET, DELETE, POST, DELETE |
| `admin-export.ts` | `/api/admin/export.csv` | GET |
Each file exports `config = { path: [...], method: [...] }` (Netlify serves the function **only** at those paths, not at `/.netlify/functions/<name>`). Handlers get params from the URL with `netlify/lib/route.ts`, so they don't need Netlify's `context` and tests can call `handler(new Request(url, init))`. The client IP comes from `x-nf-client-connection-ip` (fallback `context.ip`, `127.0.0.1` locally).

## 8. Booking state machine
```
                 ┌──────── decline ───────▶ declined ●
 (request type)  │
 create ──▶ requested ── approve ──▶ pending_deposit ── mark_paid / confirm_without_payment ──▶ confirmed ── complete ──▶ completed ●
                 │                    ▲   │                                                       │   (start time passed)
 (instant type,  │                    │   └──────────────── cancel ──────────────▶ cancelled ● ◀── cancel
  deposit > 0) ──┼────────────────────┘                                              ▲
 (instant, none) ┴─────────────────────────────────────────────────▶ confirmed        │
 requested ── approve (deposit none) ──▶ confirmed                                    │
 reschedule: requested→requested, pending_deposit→pending_deposit, confirmed→confirmed (new time, history kept)
 ● terminal. Slot freed on: decline, cancel. Kept on: complete (in the past anyway, entry removed).
```
| From | Action | To | Side effects | Client email |
|---|---|---|---|---|
| (new) | create, `bookingMode=request` | `requested` | reserve slot, `requestedAt` | `request_received` (no `.ics`), admin `admin_new_booking` |
| (new) | create, instant, deposit ≠ none | `pending_deposit` | reserve, `holdStartedAt=createdAt` | `booking_received` + `.ics` (TENTATIVE), admin notice |
| (new) | create, instant, deposit none | `confirmed` | reserve | `booking_received` + `.ics` (CONFIRMED), admin notice |
| requested | `approve` (start in future) | `pending_deposit` or `confirmed` | `approvedAt`, `holdStartedAt` | `approved` + link + `.ics`, or `confirmed` |
| requested | `decline` | `declined` | release slot | `declined` (if `notifyClient`) |
| pending_deposit | `mark_paid` | `confirmed` | `payment`, `icsSequence++` | `confirmed` + `.ics` |
| pending_deposit | `confirm_without_payment` (note required) | `confirmed` | `icsSequence++` | `confirmed` + `.ics` |
| pending_deposit, confirmed | `cancel` (reason) | `cancelled` | release slot | `cancelled` (if `notifyClient`) |
| confirmed | `complete` (start < now) | `completed` | remove ledger entry | none |
| requested, pending_deposit, confirmed | `reschedule` | same | move slot, `rescheduleCount++`, `icsSequence++` (not for requested) | `rescheduled` (+ `.ics` unless requested), if `notifyClient` |
| cancelled, completed, declined | `delete_client_data` | same | wipe PII | none |
Anything else returns `422 INVALID_TRANSITION`. Every transition appends a history entry (`by: "admin"` or `"client"`) and requires `expectedVersion` (`409 VERSION_CONFLICT` on mismatch). There is no automatic expiry in v1: "Deposit overdue" and "Reply overdue" are flags.

## 9. Availability algorithm (`netlify/lib/domain/availability.ts`, pure)
Input: config, type, `durationMin`, date range, `now`, ledgers for the dates, blocks, and options `{ ignoreNoticeAndHorizon, excludeBookingId }` (admin reschedule).
1. Clamp the range to `[todayEt(now), todayEt(now) + bookingHorizonDays]` unless ignored. Max 62 days.
2. Per date. **Standard types:** skip if the weekday is not in `workingDays`, or the date already has `maxSessionsPerDay` cap-counting entries. Take the type's window set for the date's month. Generate the grid (ADR 0006). **Mini type:** candidate slots = the date's `miniDay.slots` with `bookingId = null`.
3. Drop a candidate if: start < now + notice (unless ignored); its busy interval overlaps any ledger entry (other than `excludeBookingId`) or, for standard types, any mini slot; or its `[start, end)` overlaps a block (blocks use the session interval, not the buffer). (Implemented rule, accepted in code review 2026-11-26: two sessions conflict when the gap between one's end and the other's start is less than the **larger** of their two buffers, i.e. `gap < max(bufferA, bufferB)`. Buffers are not added together.)
4. Output each date as `open` (with slots), `full` (minis: had slots, none left; standard: cap reached or every slot taken), or `closed`. Minis also report `spotsLeft`, `totalSpots`, `location` and `theme`.
**Alternatives on `SLOT_TAKEN`:** compute availability for the requested date ±14 days and return the 3 slots nearest to the requested start: same date first, then by absolute time difference.

## 10. Request lifecycle: `POST /api/bookings`
1. Method, JSON and size (≤ 32 KB) checks; request ID.
2. Rate limit per hashed IP (`limits.bookingRateLimit`) → 429.
3. Honeypot `website` non-empty → **fake 201** with a random reference (no store, no email; log `honeypot=1`) (story 017 #2).
4. `Idempotency-Key` claim (ADR 0002) → stored 201 / 409 / 422.
5. Zod validation (schema built from config + intake catalogue; unknown fields rejected) → 400 with field errors.
6. Policy: `policy.accepted === true` and `policy.version === config.policyVersion`, else 400 / 409 `POLICY_VERSION_CHANGED`.
7. Rule checks: type active, start on the grid / mini slot free, notice, horizon, blocks → 409 `SLOT_TAKEN` with alternatives.
8. `reserve()` CAS → 409 `SLOT_TAKEN` + alternatives, or 503 `BUSY`.
9. Write the booking (`onlyIfNew`). Finish the idempotency record.
10. Send the client email + admin notice (awaited, 10 s timeout), and record the outcomes on the booking.
11. 201 with the confirmation payload. Log `{requestId, bookingId, status, durationMs}` only.

## 11. Security notes (summary; checklist in the security-privacy-checklist skill)
- Headers (devops, `netlify.toml`): HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP `default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` (no inline scripts, which Vite production output satisfies), `Permissions-Policy` minimal. Admin and API responses add `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
- No public endpoint returns a stored booking. The confirmation screen uses the POST response, kept in `sessionStorage`.
- CSV cells starting with `=`, `+`, `-`, `@`, tab or CR are prefixed with `'`. The file has a UTF-8 BOM and CRLF line endings, and every field is quoted.
- Logs: `netlify/lib/log.ts` only emits allowlisted keys (`requestId, fn, route, status, code, bookingId, durationMs, count, reason, driver, kind`). A test greps captured logs for the seeded PII.

## 12. Task breakdown
**Backend (Omar), in order:**
1. Scaffold: `package.json` (exact versions from ADR 0001), `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `netlify/lib/{env,services,http,route,log,clock}.ts`, dev plugin. Exit: `npm run dev` serves a stub `/api/config`.
2. `shared/` schemas, `shared/datetime.ts`, `shared/money.ts`, `shared/status.ts`, `config/*` with `[PLACEHOLDER]` values from docs/04 (stories 001, 006).
3. Store adapter (3 drivers + contract tests), repos, `reserve()` with the concurrency test (002, 004).
4. `GET /api/config`, `GET /api/policies/:v`, `GET /api/availability` (001, 002, 003-client side).
5. `POST /api/bookings` incl. idempotency, honeypot, rate limit (004, 005, 006, 007, 017, 020 #1–7).
6. Email adapter, templates, `.ics` (008, 009, 020).
7. Admin auth + guard + `scripts/admin-hash.ts` (010).
8. Admin bookings list/detail/PATCH/resend/delete-PII (011, 012, 013, 020 #8–23), reschedule + admin availability (014), blocks (015), mini days (003), CSV (016).

**Frontend (Kai), in order:** tokens and `h()` helper → `lib/api.ts` (typed by `shared/api-types.ts`; can start against the documented examples) → booking steps 1–5 incl. Events length picker, minis spots left, request-mode wording (001–009, 017 honeypot, 020) → policies and privacy pages (006, 018) → admin login + session handling (010) → list, detail, action dialogs (011–013, 020) → reschedule (014), blocks (015), mini days (003), CSV link (016) → password tool page (ADR 0003).

**devops (Dex):** `netlify.toml`, CI (`npm ci` → lint → typecheck → test → test:tz → `npm audit --audit-level=high` → build), `.env.example`, Netlify contexts and env vars per §5, the preview concurrency run (ADR 0002 launch gate).

**QA (Quinn):** helpers, the must-have regression scenarios, the preview concurrency test, DST suites.
