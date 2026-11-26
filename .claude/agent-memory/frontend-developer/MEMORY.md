# Frontend-developer knowledge (Kai)

## Must-haves
- Mobile-first at 375px; WCAG 2.1 AA; times labelled "ET".
- Flow: type, then date/time, intake, policies, confirmation. Back preserves answers.
- Server is authoritative; handle 409 SLOT_TAKEN by showing the nearest alternatives.
- Admin: login, list with URL-persisted filters, detail, status changes, blocked dates, CSV.

## Environment notes
- Playwright and Chromium are pre-installed in cloud sessions: `require('playwright')`; don't run `playwright install`; use `--trace off`.

## Conventions learned
- (dated notes)

## v1 build notes (2026-11-25, Kai)
- Layout: `src/booking/` (flow-state.ts, validation.ts, submit.ts, app.ts controller, steps/, intake/), `src/admin/` (hash router: `#/bookings?filters`, `#/bookings/<ref>`, `#/blocks`, `#/minis`), `src/components/`, `src/lib/{dom,api,types,datetime,links,storage,calendar-math}.ts`. Pure logic (flow-state, validation, format, return-target, password-hash) is unit-tested in `tests/unit/frontend/`.
- CSP is `style-src 'self'`: never set `style=""` attributes; use classes. No inline scripts. System fonts only (names in tokens are placeholders).
- `h()` ignores `false/null`, writes `aria-*`/`data-*` booleans as "true". `DOM.append(null)` throws, so spread conditionals (`...(cond ? [x] : [])`).
- Calendar: `role=grid` may not contain `caption[aria-live]` (axe aria-required-children). Use `aria-labelledby` on the table and announce month changes through the live region.
- The server uses strict Zod objects: unknown fields are rejected. `portfolioOptOut` only when `features.portfolioOptOutEnabled`; Minis (`commonFieldsProfile: short`) send no location/style/mustHave; optional time/date/tel extras are omitted when empty.
- Stories beat design docs: on-site contact name/phone are REQUIRED for Events (drive "(optional)" labels from config `required`); children's ages optional; Reschedule and Delete client data are in v1; no search filter; no "Expired" chip; no password reset flow.
- Security rules applied: links via `src/lib/links.ts` (validated mailto/tel/sms), `safeHref` for API URLs (https only), admin return target `^/admin/` only, flow state removed from sessionStorage after a booking (confirmation keeps reference and times, no contact data).
- Local testing: Chromium here is build 1243, Playwright wants 1255, so launch with `executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox']`. Dev booking rate limit is 5/hour per IP; start the dev server with `RATE_LIMIT_DISABLED=1 DATA_DIR=<tmp>` for walkthroughs. A scratch mock API is handy while the back end is incomplete.
- Public config does not expose Minis `bufferMin`; the admin minis form asks for "minutes between starts" (default length + 10). Ask architect to add it.
