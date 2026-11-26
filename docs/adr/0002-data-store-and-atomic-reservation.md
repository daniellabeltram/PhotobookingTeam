# 0002. Data store and atomic slot reservation
Date: 2026-11-25 · Status: accepted

## Context
- **Zero double bookings** is the top requirement. Two clients may submit the same 5:30 pm slot at the same moment, and slots of **different** types (and lengths) can overlap once buffers are counted (story 004 #2), so "one key per start time" is not enough.
- Volume is tiny: a few hundred bookings a year, at most a handful per day.
- No PII in logs, low cost, no extra vendor accounts if possible, and the app must run locally without accounts (story 019 and the brief).
- Netlify Forms is ruled out (docs/03 §8).

## Options considered
1. **Netlify Blobs** (key/value, built into Netlify). Pros: zero setup, no extra account or keys, encrypted at rest and in transit, included in the Netlify plan. Supports **conditional writes** (`onlyIfNew`, `onlyIfMatch` with an ETag) and **strong consistency** reads. Cons: no queries or transactions across keys, so we design our own key scheme and do filtering in code (fine at this volume).
2. **Hosted Postgres (Neon / Supabase).** Pros: real transactions, an exclusion constraint could enforce "no overlap". Cons: another vendor account, a connection string secret, free tiers that pause or change, a migration tool, and local dev needs Docker or a cloud database (breaks the "no accounts locally" rule unless we also build a fake).
3. **Turso / SQLite.** Similar trade-offs to Postgres, plus another account.

## Vendor facts (checked 2026-11-25)
Source: https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- `store.set(key, value, { metadata, onlyIfMatch, onlyIfNew })` and `setJSON(...)` resolve to `{ modified: boolean, etag?: string }`. `onlyIfMatch`: "the write will only succeed if the entry exists and has an ETag matching this value". `onlyIfNew`: "the write will only succeed if the entry does not exist". The docs present these as how "to do atomic, conditional writes".
- `getWithMetadata(key, { consistency, type })` returns `{ data, etag, metadata }`. `getMetadata` returns the ETag without the body. `list({ prefix })` returns `{ blobs: [{ key, etag }] }`.
- Default consistency is **eventual** ("updates and deletions are guaranteed to be propagated to all edge locations within 60 seconds"). **Strong** consistency can be set per store with `getStore({ name, consistency: "strong" })` or per read, "with the cost of slower reads".
- In Functions, `siteID` and `token` are set automatically. Site-wide stores default to region `us-east-2`.
- Limits: store names max 64 bytes, no `/` or `:`; keys max 600 bytes, not starting with `/`; object max 5 GB; metadata max 2 KB.
- Site-wide stores are **shared by every deploy of the site** (production and deploy previews alike). Only deploy-specific stores are tied to a deploy.
- The docs' troubleshooting section still says "last write wins ... Netlify Blobs does not include a concurrency control mechanism". That sentence predates the conditional-write options on the same page. We rely only on `onlyIfNew`/`onlyIfMatch`, and we **prove it on a deploy preview** (see Consequences) before launch.
- Netlify Free plan: 300 credits/month; production deploys cost 15 credits each; compute 10 credits per GB-hour; web requests 2 credits per 10k (https://www.netlify.com/pricing/, checked 2026-11-25). Personal plan is $9/month with 1,000 credits.

## Decision
**Netlify Blobs in production, behind a small key/value adapter, with a per-day "ledger" document updated by compare-and-swap.**

### Storage adapter
```ts
// netlify/lib/store/kv.ts
export interface KvEntry<T> { value: T; etag: string }
export type WriteCondition = { onlyIfNew: true } | { onlyIfMatch: string };
export interface KvStore {
  get<T>(key: string): Promise<KvEntry<T> | null>;                 // always strongly consistent
  set<T>(key: string, value: T, cond?: WriteCondition): Promise<{ ok: true; etag: string } | { ok: false }>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;                           // keys, all pages
}
```
Drivers, picked by `STORE_DRIVER`:
| Driver | Use | Notes |
|---|---|---|
| `memory` | unit/integration tests (default when `APP_ENV=test`) | A `Map`. `get` and `set` each `await` a macrotask (`setImmediate`) before touching the map, so parallel requests really interleave and the CAS path is exercised. The compare and the write happen in one synchronous step, so CAS is atomic. |
| `file` | local dev and e2e (default when `APP_ENV=local`) | One JSON file per key under `DATA_DIR` (default `.data/store`, gitignored). Per-key in-process mutex, write to temp file then `rename`. ETag = SHA-256 of the stored bytes. Safe for one dev process only. |
| `netlify-blobs` | deploy previews and production | `getStore({ name: "dbp-" + DATA_NAMESPACE, consistency: "strong" })`. `set` maps to `setJSON` with `onlyIfNew`/`onlyIfMatch` and returns `ok = modified`. |

Guards in `netlify/lib/store/index.ts` (fail closed at first use): `APP_ENV=production` requires `STORE_DRIVER=netlify-blobs` and `DATA_NAMESPACE=production`; any other `APP_ENV` must **not** use `DATA_NAMESPACE=production`. This keeps previews off production data, because site-wide stores are shared across deploys.

All business logic (repositories, reservation, availability) sits **above** the adapter, so it is tested once with the memory driver. A shared contract test suite runs against `memory` and `file`.

### Key scheme (one store per namespace)
| Key | Value | Written with |
|---|---|---|
| `days/<YYYY-MM-DD>` (ET date) | `DayLedger`: active reservations and the mini day for that date | `onlyIfNew` (first write) / `onlyIfMatch` (every update) |
| `bookings/<reference>` | `Booking` (full record incl. PII) | `onlyIfNew` on create, `onlyIfMatch` on every update |
| `blocks/<blockId>` | `BlockedTime` | plain `set`; `delete` |
| `idem/<sha256(Idempotency-Key)>` | idempotency record | `onlyIfNew` (claim), `onlyIfMatch` (finish) |
| `rl/<scope>/<hmac(ip)>/<windowStart>` | `{ count }` rate-limit counter | `onlyIfNew` / `onlyIfMatch`, up to 3 tries, fail open |

Entity fields are in `docs/architecture.md` (Data model).

### Atomic reservation (the "day ledger")
Every session starts and ends on the same Eastern date (config validation rejects any window whose end plus buffer passes midnight). So every conflict that can exist (overlap with buffers, any type against any type, mini slots, the daily cap) is between items **on the same ET date**. We keep one document per date, `days/<date>`, listing its active reservations with their buffered busy intervals, and we change it only with compare-and-swap:

```
reserve(date, newEntry):
  repeat up to 5 times:
    cur    = kv.get("days/" + date)                     # strong read, gives etag
    ledger = cur?.value ?? emptyLedger(date)
    prune entries that are invalid orphans (see below)
    if conflicts(ledger, newEntry, rules): return SLOT_TAKEN
    next = ledger with newEntry added
    res  = cur ? kv.set(key, next, {onlyIfMatch: cur.etag})
               : kv.set(key, next, {onlyIfNew: true})
    if res.ok: return OK
    sleep random 20–80 ms                               # lost the race: re-read and re-check
  return BUSY (503, client may retry with the same Idempotency-Key)
```
`conflicts` = any existing entry (other than the same booking during a reschedule) whose `[busyStart, busyEnd)` overlaps the new one, **or** for a non-mini type, any mini slot's busy interval (booked or not), **or** for a non-mini type, the day already has `maxSessionsPerDay` entries that count toward the cap, **or** for a mini booking, the chosen mini slot is missing or already has a `bookingId`. Busy interval = `[start − bufferMin, end + bufferMin)` using the booking's own type buffer. Two bookings conflict when their busy intervals overlap; this is the rule in story 002 #3. (Implemented rule, accepted in code review 2026-11-26: two sessions conflict when the gap between one's end and the other's start is less than the **larger** of their two buffers, i.e. `gap < max(bufferA, bufferB)`. Buffers are not added together.)

Because the second writer's `onlyIfMatch` fails whenever anyone changed the ledger after it read it, two overlapping requests can never both be written. The loser re-reads, sees the winner's entry and returns `SLOT_TAKEN`.

Checked **before** `reserve`, outside the CAS (they don't change under contention in a way that causes a double booking): type is active, start is on the grid and inside a window and a working day, notice, horizon, and blocked times (read fresh from `blocks/`).

### Write ordering (fail safe: a slot may be held too long, never given away twice)
- **Create:** (1) claim idempotency key, (2) `reserve` ledger entry for the new reference, (3) write `bookings/<ref>` with `onlyIfNew`, (4) mark idempotency record done with the response, (5) send emails, (6) record email outcome on the booking. If (3) fails, release the ledger entry and return 500. If the process dies between (2) and (3), the ledger holds an orphan.
- **Cancel / decline:** update the booking (CAS on its ETag) first, then remove the ledger entry (CAS loop). A repeated cancel of an already-cancelled booking retries only the release, so a failed release is fixed by retrying.
- **Reschedule:** same date: one ledger CAS that removes the old entry and adds the new one. Different date: reserve the new date, then update the booking (CAS), then release the old date. A crash leaves the booking holding two slots, never zero.
- **Orphan pruning:** a ledger entry is valid only if `bookings/<ref>` exists, is in an active status, and has the same `startUtc`. During `reserve`, entries older than 5 minutes that are not yet marked `verified` are checked; valid ones are marked `verified: true` in the same CAS write, invalid ones are dropped. So each entry is checked at most once and orphans heal on the next write to that day.

### Idempotency
`Idempotency-Key` (UUID v4) is required on `POST /api/bookings`. The handler claims `idem/<sha256(key)>` with `onlyIfNew` as `{ state: "pending", requestHash, createdAt }`. On success it stores `{ state: "done", status: 201, body }` (the body has no PII beyond what the same client just sent; see `docs/api.md`). A repeat with the same key and same body returns the stored 201; with a different body, `422 IDEMPOTENCY_KEY_REUSED`; while still pending, `409 REQUEST_IN_PROGRESS` with `Retry-After: 1`. On 4xx/5xx the claim is deleted so the client can try again. A pending claim older than 2 minutes may be taken over (CAS on its ETag). Records are ignored after 24 hours.

### Reads
- Availability for a range reads `days/<date>` for each date (in parallel, max 62 days per request) plus all `blocks/`. All reads are strong, so a new booking or block hides its slots on the next load (story 002 #15).
- The admin list does `list("bookings/")` and reads each record, then filters and sorts in memory. Fine for thousands of records.

## Consequences
- No new vendor or secret. Local dev and tests need nothing.
- Business logic owns correctness. Required tests: the CAS race with the memory driver (20 parallel creates → exactly 1 booking, 19 `SLOT_TAKEN`), cross-type overlap, daily cap under concurrency, mini slots, orphan pruning, and the "no two active ledger entries overlap" invariant check (story 004 #9).
- **Launch gate (QA + devops):** run the 20-parallel-POST concurrency test against a deploy preview (real Blobs, `DATA_NAMESPACE=preview`, `RATE_LIMIT_DISABLED=1`) and attach the result. If it ever produces two bookings, stop and move to Postgres (option 2).
- `@netlify/blobs` major versions have changed namespacing before (data written with ≤ 6.5.0 is unreadable from ≥ 7.0.0 without migration). Pin the exact version and read release notes before upgrading.
- Revisit triggers: more than about 5,000 booking records (add a monthly index document), a need for ad-hoc reporting (export to a database), or any CAS failure on the preview test.
