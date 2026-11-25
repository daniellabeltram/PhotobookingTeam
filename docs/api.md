# API contract (v1)

Owner: software-architect · Last updated: 2026-11-25 · Implements: ADRs 0002–0007 · Types: `shared/api-types.ts` must match this file.

## Conventions
- **Base path:** `/api/...` on the site's own origin. Each Netlify function sets `config.path` (and `config.method`), so it is served **only** at these paths, not at `/.netlify/functions/<name>`. Locally the same paths are served by `npm run dev` at `http://localhost:5173`.
- **JSON only**, UTF-8. Requests with a body need `Content-Type: application/json` and are at most 32 KB. Unknown fields are rejected (`VALIDATION_FAILED`).
- **Success:** `{ "data": ... }` with `200` (or `201` for creates, `204` with no body for deletes and logout).
- **Error:** `{ "error": { "code": "SLOT_TAKEN", "message": "Human-readable text", "details": { ... } } }`. `message` is safe to show. Clients branch on `code`.
- **Times:** instants are UTC ISO strings (`2026-12-05T22:30:00.000Z`). ET dates are `YYYY-MM-DD` and ET times `HH:mm`. Ready-made display strings (labels) are in Eastern Time with "ET". **Money:** integer cents.
- **Headers on every response:** `X-Request-Id`. API responses send `Cache-Control: no-store`, except `GET /api/config` and `GET /api/policies/:version`, which send `public, max-age=60`. Admin responses also send `X-Robots-Tag: noindex, nofollow`.
- **Admin auth:** the session cookie `__Host-dbp_admin` (`dbp_admin` locally), see ADR 0003. Without a valid session every `/api/admin/*` endpoint except `login` returns `401 UNAUTHORIZED`. State-changing admin requests also need `Origin` equal to the site origin (else `403 FORBIDDEN`).
- **Optimistic concurrency (admin writes on a booking):** the body carries `expectedVersion` (the `version` from the last read). A mismatch returns `409 VERSION_CONFLICT` with `details: { currentVersion, currentStatus }`.

### Error codes
| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Body or query invalid. `details.fieldErrors: { "<path>": "message" }` (paths like `contact.email`, `extra.events.guestCount`) |
| `UNAUTHORIZED` | 401 | No or expired admin session |
| `INVALID_CREDENTIALS` | 401 | Login failed (same message for every cause) |
| `FORBIDDEN` | 403 | Origin/content-type check failed on an admin write |
| `NOT_FOUND` | 404 | Unknown or malformed booking/block/mini slot/policy version |
| `METHOD_NOT_ALLOWED` | 405 | |
| `SLOT_TAKEN` | 409 | Time no longer available. `details.alternatives: Slot[]` (0–3) |
| `POLICY_VERSION_CHANGED` | 409 | The client accepted an older policy. `details.currentVersion` |
| `REQUEST_IN_PROGRESS` | 409 | Same `Idempotency-Key` still processing. `Retry-After: 1` |
| `VERSION_CONFLICT` | 409 | Booking changed since it was loaded |
| `BLOCK_OVERLAPS_BOOKINGS` | 409 | A block would cover active bookings. Re-send with `confirmOverlaps: true` |
| `MINI_DAY_HAS_BOOKINGS` | 409 | Can't remove a mini day or slot that is booked |
| `INVALID_TRANSITION` | 422 | Action not allowed from the current status. `details: { currentStatus, allowedActions }` |
| `IDEMPOTENCY_KEY_REUSED` | 422 | Same key, different body |
| `SESSION_TYPE_UNAVAILABLE` | 422 | Type unknown or `active: false` |
| `PAYLOAD_TOO_LARGE` | 413 | |
| `RATE_LIMITED` | 429 | `Retry-After` in seconds |
| `BUSY` | 503 | Reservation lost the race 5 times. Retry with the same `Idempotency-Key` |
| `INTERNAL` | 500 | Generic message, details never included |

### Shared shapes
```ts
type Slot = {
  startUtc: string; endUtc: string;
  localDate: string;          // "2026-12-05"
  localTime: string;          // "17:30"
  label: string;              // "5:30 PM"
  rangeLabel: string;         // "5:30 – 6:30 PM ET"
  miniSlotId?: string;        // minis only
};
type Money = { cents: number; label: string };   // { cents: 10000, label: "$100.00" }
type AmountDue = Money & { kind: "deposit" | "estimated_deposit" | "full" | "none"; dueNow: boolean };
type BookingStatus = "requested" | "pending_deposit" | "confirmed" | "completed" | "cancelled" | "declined";
```

---

## Public endpoints

### GET `/api/config`
Public projection of config (ADR 0007). No auth.
**200**
```json
{ "data": {
  "business": { "name": "Daniella Beltram Photography", "contactEmail": "hello@daniellabeltram.photography", "siteUrl": "https://daniellabeltram.photography", "timezone": "America/New_York" },
  "scheduling": { "minimumNoticeHours": 72, "unpaidHoldHours": 48, "requestResponseDays": 3 },
  "features": { "portfolioOptOutEnabled": true },
  "privacy": { "dataRetentionMonths": 24, "privacyContactEmail": "hello@daniellabeltram.photography", "lastUpdated": "2026-11-25" },
  "policy": { "version": "v0.1-draft", "summaryTemplate": "A non-refundable retainer of {{depositText}} ...", "values": { "freeRescheduleDays": 7, "lateCancelHours": 48 } },
  "intakeFields": [ { "id": "contact.email", "label": "Email", "input": "email", "maxLength": 254 } ],
  "sessionTypes": [ {
    "id": "events", "name": "Events", "description": "...", "included": ["..."], "kind": "standard",
    "bookingMode": "request", "durationMin": 120, "durationOptionsMin": [120, 180, 240],
    "price": { "fromCents": 25000, "unit": "hour", "label": "from $250/hour" },
    "deposit": { "kind": "percent", "percent": 50, "text": "50% of estimated total" },
    "hasPaymentLink": true, "maxPeople": null, "includedPeople": null, "extraPersonFeeCents": null,
    "locationOptions": [], "allowOwnLocation": true, "allowHelpMeChoose": false,
    "commonFieldsProfile": "full", "intakeExtraFields": [ { "id": "events.eventName", "required": true } ],
    "bookingHorizonDays": 365, "nextMiniDates": null
  } ]
} }
```
Inactive types are omitted. For `kind: "mini"`, `nextMiniDates` lists up to 3 future dates with open slots (`[{ "date": "2027-12-04", "spotsLeft": 4 }]`) or `[]` (card shows "No mini dates open right now"). Payment link URLs are not exposed here; they come back with a booking.

### GET `/api/policies/:version`
Full text of any published policy version (current or old). No auth.
**200** `{ "data": { "version": "v0.1-draft", "effectiveDate": "2026-11-25", "isCurrent": true, "summaryTemplate": "...", "values": {...}, "sections": [ { "heading": "Retainer", "paragraphs": ["..."] } ] } }` · **404** `NOT_FOUND`.

### GET `/api/availability`
Query: `type` (required), `from`, `to` (ET dates, inclusive, `to − from ≤ 62` days; default: from today for 35 days), `durationMin` (required for types with `durationOptionsMin`, must be one of them; otherwise ignored).
Rate limit: `limits.availabilityRateLimit` per IP → `429`.
**200**
```json
{ "data": {
  "sessionTypeId": "families", "durationMin": 60, "timezone": "America/New_York",
  "from": "2026-12-01", "to": "2026-12-31", "horizonEndDate": "2027-05-27", "firstOpenDate": "2026-12-01",
  "days": [
    { "date": "2026-12-01", "status": "closed", "slots": [] },
    { "date": "2026-12-02", "status": "open", "slots": [
      { "startUtc": "2026-12-02T12:00:00.000Z", "endUtc": "2026-12-02T13:00:00.000Z", "localDate": "2026-12-02", "localTime": "07:00", "label": "7:00 AM", "rangeLabel": "7:00 – 8:00 AM ET" } ] }
  ] } }
```
Mini type days add `"mini": { "location": "Phillips Point", "theme": "Winter", "spotsLeft": 4, "totalSpots": 6 }`, and `status` is `"full"` when no spots are left. Days before today or after the horizon are not returned. `firstOpenDate` is `null` when nothing is open within the horizon. Errors: `400 VALIDATION_FAILED`, `422 SESSION_TYPE_UNAVAILABLE`, `429`.

### POST `/api/bookings`
Creates a booking (instant types) or a request (`bookingMode: "request"`). No auth.
Headers: **`Idempotency-Key: <uuid v4>`** (required; the front end makes a new key whenever the slot or answers change, and reuses it for retries of the same attempt).
Body:
```json
{
  "sessionTypeId": "families",
  "startUtc": "2026-12-02T12:00:00.000Z",
  "durationMin": 60,
  "miniSlotId": null,
  "contact": { "fullName": "Ana Rivera", "email": "ana@example.com", "phone": "5615550123", "preferredContact": "text" },
  "subjectsNames": "Ana, Luis, Sofia, Mateo",
  "people": { "adults": 2, "children": 2, "pets": 1 },
  "location": { "kind": "suggested", "optionId": "downtown-waterfront" },
  "styleNotes": "Bright and airy", "mustHaveShots": "", "anythingElse": "Mateo is shy", "heardAbout": "Instagram",
  "extra": { "families": { "childrenAges": "6, 3", "extendedFamily": false } },
  "portfolioOptOut": false,
  "policy": { "accepted": true, "version": "v0.1-draft" },
  "website": ""
}
```
Rules: `durationMin` is required for Events (one of `durationOptionsMin`) and must equal `durationMin` for other types (or be omitted). `miniSlotId` is required for minis, and `startUtc` must match that slot. `location` is omitted for minis (the server sets `mini_day`). `extra` may only contain the key for the chosen type. Minis use the short field set (story 005). `website` is the honeypot and must be empty or absent. Text lengths are in ADR 0007.

**201**
```json
{ "data": {
  "reference": "DBP-7K3F9Q", "status": "pending_deposit", "bookingMode": "instant",
  "sessionTypeId": "families", "sessionTypeName": "Families", "durationMin": 60,
  "startUtc": "2026-12-02T12:00:00.000Z", "endUtc": "2026-12-02T13:00:00.000Z",
  "display": { "date": "Wednesday, December 2, 2026", "timeRange": "7:00 – 8:00 AM ET" },
  "locationLabel": "Downtown West Palm Beach / waterfront",
  "amountDue": { "cents": 15000, "label": "$150.00", "kind": "deposit", "dueNow": true },
  "paymentLinkUrl": "https://buy.stripe.com/xyz?client_reference_id=DBP-7K3F9Q",
  "holdHours": 48,
  "requestResponseDays": null,
  "emailSent": true
} }
```
For a request (`status: "requested"`): `amountDue.kind = "estimated_deposit"`, `dueNow: false`, `paymentLinkUrl: null`, `holdHours: null`, `requestResponseDays: 3`. For no configured link: `paymentLinkUrl: null` with `dueNow: true` (UI shows "Daniella will send you a payment link shortly"). The response holds no contact details or intake answers.
Honeypot filled → the same 201 shape with a random reference. Nothing is stored or sent.
Errors: `400 VALIDATION_FAILED` (incl. missing `Idempotency-Key` → `fieldErrors["header.idempotencyKey"]`, `policy.accepted` not true), `409 SLOT_TAKEN` (example below), `409 POLICY_VERSION_CHANGED`, `409 REQUEST_IN_PROGRESS`, `422 IDEMPOTENCY_KEY_REUSED`, `422 SESSION_TYPE_UNAVAILABLE`, `429 RATE_LIMITED` (message: "Too many attempts. Please wait a few minutes and try again, or contact Daniella at …"), `503 BUSY`.
```json
{ "error": { "code": "SLOT_TAKEN", "message": "That time was just booked.",
  "details": { "alternatives": [
    { "startUtc": "2026-12-02T13:30:00.000Z", "endUtc": "2026-12-02T14:30:00.000Z", "localDate": "2026-12-02", "localTime": "08:30", "label": "8:30 AM", "rangeLabel": "8:30 – 9:30 AM ET" } ] } } }
```
Idempotency: a repeat with the same key and body returns the original `201` body (with `emailSent` as originally reported) and sends no email.

---

## Admin: session

### POST `/api/admin/login`
Body `{ "email": "string", "password": "string", "totp": "123456" }` (`totp` only when enabled; `GET /api/admin/session` returning `401` with `details.totpRequired: true` tells the UI to show the field).
**200** sets the cookie. `{ "data": { "email": "d***@daniellabeltram.photography", "idleExpiresAt": "...", "absoluteExpiresAt": "..." } }`
**401** `INVALID_CREDENTIALS` "That email and password don't match. Please try again." (also for a wrong or missing TOTP) · **429** `RATE_LIMITED` "Too many attempts. Please wait 10 minutes and try again." · **400** `VALIDATION_FAILED`.

### POST `/api/admin/logout`
**204**, clears the cookie (works without a valid session too).

### GET `/api/admin/session`
**200** `{ "data": { "email": "...", "idleExpiresAt": "...", "absoluteExpiresAt": "..." } }` (refreshes the idle timer) · **401** `UNAUTHORIZED`, `details: { "totpRequired": boolean }`.

---

## Admin: bookings

### GET `/api/admin/bookings`
Query (all optional, combined with AND):
| Param | Values | Default |
|---|---|---|
| `view` | `upcoming` (start ≥ now, soonest first) · `past` (start < now, newest first) · `all` (newest first) | `upcoming` |
| `status` | comma list of `BookingStatus` | upcoming: active statuses; past/all: any |
| `rescheduled` | `true` (`rescheduleCount > 0`; the "Rescheduled" filter) | – |
| `flag` | `deposit_overdue`, `reply_overdue`, `email_not_sent` | – |
| `type` | comma list of session type ids | – |
| `from`, `to` | ET dates, inclusive, on `localDate` | – |
| `q` | case-insensitive substring of client name or email (≤ 100 chars) | – |
| `page`, `pageSize` | page ≥ 1; pageSize 1–100 | 1, 50 |
**200**
```json
{ "data": {
  "items": [ {
    "id": "DBP-7K3F9Q", "version": 3, "status": "pending_deposit",
    "sessionTypeId": "families", "sessionTypeName": "Families",
    "startUtc": "...", "endUtc": "...", "localDate": "2026-12-02",
    "display": { "date": "Wed, Dec 2, 2026", "timeRange": "7:00 – 8:00 AM ET" },
    "clientName": "Ana Rivera",
    "flags": ["deposit_overdue", "email_not_sent", "surprise_proposal", "help_me_choose_location", "reply_overdue", "session_time_passed", "rescheduled", "no_payment_link", "pii_deleted"],
    "waitingSince": null, "waitingLabel": null
  } ],
  "total": 12, "page": 1, "pageSize": 50,
  "summary": { "upcomingPendingDeposit": 3, "depositOverdue": 1, "requestsWaiting": 1, "replyOverdue": 0 }
} }
```
`waitingSince`/`waitingLabel` are set for `requested` ("Waiting 2 days 5 h", "Waiting < 1 h"). `flags` lists only those that apply. `summary` ignores filters. Errors: `400`, `401`.

### GET `/api/admin/bookings/:id`
`:id` is the reference (`DBP-XXXXXX`, case-insensitive). Malformed or unknown → `404 NOT_FOUND`.
**200**
```json
{ "data": {
  "id": "DBP-7K3F9Q", "version": 3, "status": "pending_deposit", "bookingMode": "instant",
  "sessionTypeId": "families", "sessionTypeName": "Families", "durationMin": 60, "bufferMin": 30,
  "startUtc": "...", "endUtc": "...", "localDate": "2026-12-02", "localStartTime": "07:00", "localEndTime": "08:00",
  "display": { "date": "Wednesday, December 2, 2026", "timeRange": "7:00 – 8:00 AM ET", "createdAt": "Nov 25, 2026 · 3:12 PM ET" },
  "location": { "kind": "suggested", "optionId": "downtown-waterfront", "label": "Downtown West Palm Beach / waterfront" },
  "contact": { "fullName": "Ana Rivera", "email": "ana@example.com", "phone": "5615550123", "preferredContact": "text" },
  "people": { "adults": 2, "children": 2, "pets": 1 },
  "intake": [ { "id": "subjectsNames", "label": "Names of everyone being photographed", "value": "Ana, Luis, Sofia, Mateo" },
              { "id": "families.childrenAges", "label": "Children's ages", "value": "6, 3" },
              { "id": "mustHaveShots", "label": "Must-have shots", "value": null } ],
  "portfolioOptOut": false,
  "policy": { "version": "v0.1-draft", "acceptedAt": "...", "acceptedAtLabel": "Nov 25, 2026 · 3:12 PM ET", "url": "/policies.html?version=v0.1-draft" },
  "pricing": { "amountDue": { "cents": 15000, "label": "$150.00", "kind": "deposit", "dueNow": true }, "estimatedTotal": null, "paymentLinkUrl": "https://..." },
  "payment": null,
  "timestamps": { "createdAt": "...", "requestedAt": null, "approvedAt": null, "confirmedAt": null, "completedAt": null, "cancelledAt": null, "declinedAt": null, "holdStartedAt": "..." },
  "cancellation": null, "decline": null,
  "rescheduleCount": 0,
  "emails": { "booking_received": { "status": "sent", "at": "..." }, "admin_new_booking": { "status": "sent", "at": "..." } },
  "flags": ["deposit_overdue"],
  "history": [ { "at": "...", "atLabel": "Nov 25, 2026 · 3:12 PM ET", "by": "client", "action": "create", "fromStatus": null, "toStatus": "pending_deposit", "note": null } ],
  "allowedActions": ["mark_paid", "confirm_without_payment", "cancel", "reschedule", "resend_email"],
  "piiDeletedAt": null
} }
```
`intake` lists every field for that type in form order, with `value: null` for unanswered ones (the UI shows "—"). `allowedActions` comes from the transition table (architecture §8) and the current time, so the UI shows only what the server would accept. Possible values: `approve`, `decline`, `mark_paid`, `confirm_without_payment`, `cancel`, `complete`, `reschedule`, `resend_email`, `delete_client_data`.

### PATCH `/api/admin/bookings/:id`: status change
Body by action (exactly one `action`, plus `expectedVersion`):
| `action` | Extra fields | From → to |
|---|---|---|
| `approve` | – | requested → pending_deposit (or confirmed if deposit `none`); start must be in the future |
| `decline` | `messageToClient?` (≤ 1000), `note?` (≤ 1000), `notifyClient` (bool, default true) | requested → declined |
| `mark_paid` | `amountCents` (int ≥ 0), `receivedOn` (ET date, not in the future), `method?` (≤ 50), `note?` (≤ 1000) | pending_deposit → confirmed |
| `confirm_without_payment` | `note` (required, 1–1000) | pending_deposit → confirmed |
| `cancel` | `reason` (`client_cancelled \| deposit_not_received \| photographer_cancelled \| other`), `note?`, `notifyClient` (default true) | pending_deposit / confirmed → cancelled |
| `complete` | – | confirmed → completed; start must have passed |
Example: `{ "action": "mark_paid", "expectedVersion": 3, "amountCents": 15000, "receivedOn": "2026-11-26", "method": "Stripe" }`
**200** `{ "data": { "booking": <detail as GET>, "email": { "kind": "confirmed", "status": "sent" } } }` (`email` is `null` when no email applies or `notifyClient` is false; `status: "failed"` means the change stands and resend is offered).
Errors: `400`, `401`, `403`, `404`, `409 VERSION_CONFLICT` ("This booking changed. Reload to see the latest", or for requests "This request was already handled (now: Declined). Reload to see the latest"), `422 INVALID_TRANSITION`.
Idempotency: repeating an action that already took effect (same action, booking already in the target status, `expectedVersion` = previous version) returns `409 VERSION_CONFLICT` with `details.currentStatus`, and the UI shows the final status (story 020 #20). Repeating `cancel`/`decline` on an already cancelled/declined booking also retries the slot release.

### POST `/api/admin/bookings/:id/reschedule`
Body: `{ "expectedVersion": 4, "startUtc": "...", "durationMin": 60, "miniSlotId": null, "reason": "client_request" | "weather" | "photographer", "note": "optional", "notifyClient": true }`. Allowed for `requested`, `pending_deposit` and `confirmed`. Notice and horizon are **not** applied. Overlaps, buffers, blocks and the daily cap are (excluding the booking's own current slot). Minis must pick another free mini slot. Events may change `durationMin` (the estimate is recalculated).
**200** `{ "data": { "booking": <detail>, "email": { "kind": "rescheduled", "status": "sent" } | null } }`
Errors: `409 SLOT_TAKEN` (with alternatives; the booking keeps its time), `409 VERSION_CONFLICT`, `422 INVALID_TRANSITION`, `400`, `401`, `403`, `404`.

### GET `/api/admin/availability`
Same query and response as `GET /api/availability`, plus `excludeBookingId` (the booking being rescheduled). Notice and horizon are ignored, and the range may start up to today. Auth required. No rate limit.

### POST `/api/admin/bookings/:id/resend-email`
Body `{ "kind": "booking_received" | "request_received" | "approved" | "declined" | "confirmed" | "cancelled" | "rescheduled" }` (optional; default: the most recent client email with `status: "failed"`, else `400`). Sends one email with the booking's **current** data.
**200** `{ "data": { "kind": "booking_received", "status": "sent" } }` · `status: "failed"` → still 200 (the flag stays) · `422 INVALID_TRANSITION` if PII was deleted or the kind doesn't fit the status.

### POST `/api/admin/bookings/:id/delete-client-data`
Body `{ "confirmReference": "DBP-7K3F9Q", "expectedVersion": 7 }`. Allowed for `cancelled`, `completed` and `declined` only. `confirmReference` must equal the id (case-insensitive) or the result is `400`.
**200** `{ "data": { "booking": <detail with contact/intake null, piiDeletedAt set> } }` · `422 INVALID_TRANSITION` for active bookings · `409 VERSION_CONFLICT`.

---

## Admin: blocked times

### GET `/api/admin/blocks`
Query `includePast=true` (default false: blocks ending after now). **200** `{ "data": { "items": [ { "id": "blk_8f2k1m0q", "kind": "all_day", "startDate": "2026-12-24", "endDate": "2026-12-26", "startTime": null, "endTime": null, "startUtc": "...", "endUtc": "...", "label": "Family trip", "display": "Thu, Dec 24 – Sat, Dec 26, 2026 (all day)" } ] } }`

### POST `/api/admin/blocks`
Body: `{ "kind": "all_day", "startDate": "2026-12-24", "endDate": "2026-12-26", "label": "Family trip", "confirmOverlaps": false }` or `{ "kind": "time_range", "startDate": "2027-03-14", "endDate": "2027-03-14", "startTime": "15:00", "endTime": "18:00", "label": null, "confirmOverlaps": false }`. `label` ≤ 100, private. A time range needs `startDate = endDate` and `startTime < endTime`, and neither time may fall in the DST gap. The block may not end in the past, and ranges are limited to 366 days.
**201** `{ "data": { "block": <block>, "overlappingBookings": [] } }`
**409** `BLOCK_OVERLAPS_BOOKINGS` `details.bookings: [ { "id": "DBP-...", "clientName": "...", "display": { "date": "...", "timeRange": "..." }, "status": "confirmed" } ]`. Nothing is saved. Re-send with `confirmOverlaps: true` to save it (the bookings are not changed).
Errors: `400` (end before start: "The end must be after the start"; in the past: "That time has already passed"), `401`, `403`.

### DELETE `/api/admin/blocks/:id`
**204** · **404**.

---

## Admin: Holiday Minis (mini days and slots)
Minis are modelled as **specific windows created by Daniella** (one mini day per date, holding slots). The v1.1 generator will call the same endpoint.

### GET `/api/admin/mini-days`
Query `from` (ET date, default today), `to` (optional). **200** `{ "data": { "items": [ { "date": "2027-12-04", "location": "Phillips Point", "theme": "Winter", "slots": [ { "id": "ms_2027-12-04_0800", "localTime": "08:00", "rangeLabel": "8:00 – 8:20 AM ET", "bookingId": null } ], "totalSpots": 6, "booked": 2 } ] } }`

### POST `/api/admin/mini-days/:date/slots`
Creates the mini day if it doesn't exist and adds slots. Body: `{ "location": "Phillips Point", "theme": "Winter", "startTimes": ["08:00", "08:30", "09:00"] }` (1–30 times, `HH:mm`; the admin UI computes them from "first start + number of slots" with spacing `durationMin + bufferMin`). If the mini day already exists, `location` and `theme` must match or be omitted (the UI shows "That date already has a mini day. Edit it instead." when it wants a new one). Each start becomes a slot of the Minis `durationMin`. Busy interval = ± Minis `bufferMin`. Each slot is checked against the other mini slots, active bookings and blocks, and must be in the future. The whole update is one ledger CAS.
**201** (at least one created)
```json
{ "data": { "miniDay": { "date": "2027-12-04", "location": "Phillips Point", "theme": "Winter", "slots": [ ... ] },
  "created": ["08:00", "08:30"],
  "rejected": [ { "startTime": "09:00", "code": "OVERLAPS_BOOKING", "message": "These slots overlap another booking at 9:00 AM." } ] } }
```
Rejection codes: `OVERLAPS_MINI_SLOT`, `OVERLAPS_BOOKING`, `OVERLAPS_BLOCK`, `IN_PAST` ("That time has already passed"), `INVALID_TIME` (DST gap or bad format), `DUPLICATE`. When **all** are rejected: `409` with code `SLOT_TAKEN` and `details.rejected`. `400` for a missing location on a new day.

### DELETE `/api/admin/mini-days/:date/slots/:slotId`
Removes one **unbooked** slot. **204** · `409 MINI_DAY_HAS_BOOKINGS` if booked · `404`.

### DELETE `/api/admin/mini-days/:date`
Removes the whole day if no slot is booked. **204** · `409 MINI_DAY_HAS_BOOKINGS` (`details.booked: 2`) · `404`.

---

## Admin: CSV export

### GET `/api/admin/export.csv`
Same filter query as `GET /api/admin/bookings` (without `page`/`pageSize`). Exports **all** matching rows.
**200** `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="bookings-YYYY-MM-DD.csv"` (today, ET), UTF-8 BOM, CRLF, every field quoted (`"` doubled), formula-injection guard (cells starting with `= + - @`, tab or CR get a leading `'`).
Columns, in order: `Reference, Status, Session type, Date (ET), Start (ET), End (ET), Length (min), Client name, Email, Phone, Preferred contact, Adults, Children, Pets, Names photographed, Location, Style notes, Must-have shots, Anything to know, Heard about us, Portfolio opt-out, Couples: occasion, Couples: surprise proposal, Families: children's ages, Families: extended family, Events: name, Events: type, Events: venue address, Events: start, Events: end, Events: guest count, Events: on-site contact, Events: on-site phone, Events: timeline, Minis: card deadline, Policy version, Policy accepted at (ET), Amount due, Amount paid, Paid on, Reschedule count, Created at (ET)`. Type-specific columns are blank for other types. Rows with deleted PII have blank PII columns. No match → header row only. `401` without a session (the browser link uses the cookie).

---

## Examples (local)
```bash
# availability
curl 'http://localhost:5173/api/availability?type=families&from=2026-12-01&to=2026-12-31'
# booking (same key twice → same 201)
curl -X POST http://localhost:5173/api/bookings -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(node -e 'console.log(crypto.randomUUID())')" -d @booking.json
# admin
curl -c jar -X POST http://localhost:5173/api/admin/login -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' -d '{"email":"admin@example.test","password":"<dev passphrase>"}'
curl -b jar 'http://localhost:5173/api/admin/bookings?view=upcoming&status=pending_deposit'
```
Tests call handlers directly:
```ts
import handler from "../../netlify/functions/bookings-create";
const res = await handler(new Request("http://localhost/api/bookings", {
  method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
  body: JSON.stringify(body) }));
expect(res.status).toBe(201);
```
