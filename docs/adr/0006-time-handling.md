# 0006. Time handling: America/New_York, DST-safe
Date: 2026-11-25 · Status: accepted

## Context
- All business times are Eastern (America/New_York). West Palm Beach observes DST: it starts on the second Sunday in March (2027-03-14, when 2:00 becomes 3:00) and ends on the first Sunday in November (2027-11-07, when 2:00 becomes 1:00 again).
- Clients may browse from any device time zone (story 002 #11). The confirmation screen, email, `.ics` and admin must show the same time (invariant).
- `new Date("2026-12-05 17:30")` parses in the device zone. That is a classic bug source.

## Options considered
1. **Luxon** (one package, IANA zones through `Intl`, explicit zone on every value, handles invalid and ambiguous local times). About 23 KB gzipped.
2. **date-fns 4 + @date-fns/tz.** Two packages, function style. Fine, but more surface.
3. **Hand-rolled `Intl.DateTimeFormat` offset math.** No dependency, but local-to-UTC conversion around DST gaps is easy to get subtly wrong.
4. **Temporal.** Not available in Node 22 and not in every browser we target. Revisit later.

## Decision
**Luxon 3.7.2, wrapped by a single module `shared/datetime.ts`, used by both the Functions and the browser** (`src/lib/datetime.ts` only re-exports it). No other file may import `luxon` or parse business times with `Date` (an ESLint `no-restricted-imports` rule allows `luxon` only in `shared/datetime.ts`).

### Representations
| Thing | Format | Example |
|---|---|---|
| An instant (stored, sent over the API) | UTC ISO 8601 with `Z`, milliseconds | `2026-12-05T22:30:00.000Z` |
| A calendar date in ET | `YYYY-MM-DD` | `2026-12-05` |
| A wall-clock time in ET | `HH:mm` (24 h) | `17:30` |
| A duration | integer minutes | `60` |
Bookings store `startUtc`/`endUtc` plus denormalized `localDate`, `localStartTime` and `localEndTime` (for CSV and fast filtering), and `timezone: "America/New_York"`.

### Module API (`shared/datetime.ts`)
```ts
export const ZONE = "America/New_York";
export function nowUtc(clock?: Clock): string;                                   // ISO; uses the injected clock
export function todayEt(nowIso: string): string;                                 // "YYYY-MM-DD"
export function etDateOf(instantIso: string): string;
export function etTimeOf(instantIso: string): string;                            // "HH:mm"
export function isoWeekdayEt(date: string): 1|2|3|4|5|6|7;                       // Mon=1 … Sun=7
export function addDays(date: string, days: number): string;                     // calendar arithmetic
export function daysBetween(a: string, b: string): number;
export function etLocalToUtc(date: string, time: string): string | null;         // null if the local time doesn't exist
export function addMinutes(instantIso: string, minutes: number): string;         // absolute time
export function monthOf(date: string): number;                                   // 1–12
export function formatDateLong(instantIso: string): string;                      // "Saturday, December 5, 2026"
export function formatTime(instantIso: string): string;                          // "5:30 PM"
export function formatRangeEt(startIso: string, endIso: string): string;         // "5:30 – 6:30 PM ET"
export function formatDateTimeShortEt(instantIso: string): string;               // "Sat, Dec 5 · 5:30 PM ET"
export function toIcsUtc(instantIso: string): string;                            // "20261205T223000Z"
```
All formatting uses `en-US`, a 12-hour clock and the "ET" label (admin headers say "All times Eastern").

### Rules
- **Local to UTC:** `DateTime.fromISO(date + "T" + time, { zone: ZONE })`. If the result's local wall time is not the input (a time inside the spring-forward gap, which Luxon shifts forward), return `null`, and callers skip that slot or reject the input with `VALIDATION_FAILED`. For an ambiguous fall-back time (1:00–1:59 on the November change day), use the **earlier** instant (EDT). Session windows never include these hours, but the rule is fixed and tested.
- **Slot grid:** walk wall-clock times on the date from window start by `slotIntervalMin`, convert each with `etLocalToUtc`, and compute end = start + `durationMin` in **absolute** minutes. Keep the slot only if the end's ET wall time is at or before the window end on the same date. Result: on DST days the slots have the same wall-clock times as on any other day (story 002 #12).
- **"Today", notice and horizon:** `minimumNoticeHours` is absolute hours from now (`start ≥ now + N h`). The horizon is in ET calendar days: `localDate ≤ todayEt(now) + bookingHorizonDays`.
- **Daily cap and ledger key** use `etDateOf(startUtc)`.
- **Clock injection:** `netlify/lib/clock.ts` provides `systemClock` and `fixedClock(iso)`. Handlers get the clock from the services container. `FAKE_NOW` (an ISO instant) is honored **only** when `APP_ENV` is `local` or `test`, so e2e can pin "now".
- **Browser:** it never converts ET input to UTC itself. Admin forms send `localDate` and `localTime` strings, and the server converts them. Availability responses include ready-made labels.

## Consequences
- One formatting path for the screen, email, `.ics` and admin, so the "same time everywhere" invariant holds by construction. Add a test that formats one booking via all four paths.
- Required tests: the 2027-03-14 and 2027-11-07 slot grids (no nonexistent or duplicate slots), `etLocalToUtc` gap returns null, a fall-back ambiguous time maps to EDT, notice exactly at the boundary, horizon at ET midnight, and tests run with `TZ=America/Los_Angeles` and `TZ=UTC` (set in the Vitest config with a second run in CI) to prove device-zone independence.
- Luxon's zone data comes from the runtime's ICU (Node 22 and current browsers ship full ICU).
