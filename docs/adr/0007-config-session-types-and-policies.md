# 0007. Config for session types, scheduling, policies and app settings
Date: 2026-11-25 · Status: accepted

## Context
- Business values (prices, lengths, buffers, windows, deposits, policy text) live in config, never in code, and are `[PLACEHOLDER]`s until Daniella confirms them (docs/04).
- v1: a versioned file in the repo. v1.1: editable in admin.
- Stories add new fields: `duration_options_min`, `deposit_payment_link`, `what_to_bring_text`, `email_from_name`, `email_from_address`, `admin_notification_email`, `admin_allowlist`, `booking_rate_limit`, `data_retention_months`, `portfolio_opt_out_enabled`, `request_response_days` (stories README and 020).
- Policy text must be versioned: old bookings keep showing the version they accepted (story 006 #6).

## Options considered
1. **TypeScript config files validated by a Zod schema** (`config/*.ts`). Pros: comments allowed, type-checked, imports shared types, validated at startup and in a test. Cons: needs a developer (or careful editing) to change.
2. **JSON/YAML files.** No comments in JSON. YAML needs a parser dependency.
3. **Store config in Blobs and edit it in admin.** That is the v1.1 path, and too much for v1.

## Decision
**Option 1.** Files (backend-owned; Daniella's changes go through a developer and a redeploy):
```
config/
  booking.config.ts        export default { business, email, scheduling, sessionTypes, policyVersion, privacy, limits, admin } satisfies BookingConfigInput
  intake-fields.ts         catalogue of intake fields (id, label, input type, validation, max length)
  policies/
    index.ts               export const policies = { "v0.1-draft": v0_1_draft } (all versions ever published)
    v0.1-draft.ts          { version, effectiveDate, summaryTemplate, sections: [{ heading, paragraphs[] }] }
shared/config-schema.ts    Zod schema + derived TS types (browser-safe)
netlify/lib/config.ts      loads, validates (throws on error at cold start), exposes getConfig() and getPublicConfig()
```
- **Keys are camelCase in code and JSON.** The table below maps the names used in stories and docs to config keys. `tests/unit/config.test.ts` validates the real config against the schema.
- **Never-edit rule for policies:** a published policy file is never changed. New wording means a new file and a new `policyVersion`. A test pins each file's SHA-256 in `config/policies/hashes.json`, so editing an old version fails CI.
- **Policy summary placeholders** (`{{depositText}}`, `{{freeRescheduleDays}}`, `{{lateCancelHours}}`, `{{unpaidHoldHours}}`) are filled by `shared/policy-render.ts`. The browser, the emails and the policies page all use it (story 006 #2). The numbers live in `policyValues` inside the policy version file, so each version pins its own numbers.
- **Browser access:** the front end never imports `config/`. It calls `GET /api/config`, which returns a public projection with no admin notification email, retention internals or rate limits (an ESLint `no-restricted-imports` rule blocks `config/*` under `src/`).
- **Load-time validation** (Zod `superRefine`): ids unique and kebab-case; every window `HH:mm`, start < end, and **window end + max buffer ≤ 24:00** (required by the day-ledger design in ADR 0002); `durationOptionsMin` all ≥ `durationMin` and multiples of `slotIntervalMin`; `windowSet` exists for every non-mini type; `depositPaymentLink` is `https://` or null; `intakeExtraFields` ids exist in the catalogue; `policyVersion` exists in `policies`.

### Schema (all values `[PLACEHOLDER]` from docs/04 unless noted)
```ts
type Cents = number;                          // integer
interface BookingConfig {
  business: { name: string; siteUrl: string; contactEmail: string; contactPhone?: string; timezone: "America/New_York" };
  email: { fromName: string; fromAddress: string; replyTo: string; adminNotificationEmail: string };
  scheduling: {
    slotIntervalMin: number;                  // 30
    minimumNoticeHours: number;               // 72
    maxSessionsPerDay: number;                // 3 (non-mini bookings only)
    unpaidHoldHours: number;                  // 48 (flag only in v1)
    requestResponseDays: number;              // e.g. 3 (Events "Reply overdue")
    workingDays: (1|2|3|4|5|6|7)[];           // ISO weekdays, Tue–Sun = [2,3,4,5,6,7]
    windowSets: Record<string, { months: number[]; windows: { start: "HH:mm"; end: "HH:mm" }[] }[]>;
      // e.g. outdoor: [{months:[11,12,1,2,3], windows:[{start:"07:00",end:"09:30"},{start:"15:30",end:"17:45"}]},
      //                {months:[4,5,6,7,8,9,10], windows:[{start:"06:45",end:"09:15"},{start:"17:30",end:"19:45"}]}]
      //      venue:   [{months:[1..12], windows:[{start:"09:00",end:"22:00"}]}]
  };
  sessionTypes: SessionType[];
  policyVersion: string;                      // "v0.1-draft"
  privacy: { dataRetentionMonths: number; privacyContactEmail: string; lastUpdated: "YYYY-MM-DD" };
  features: { portfolioOptOutEnabled: boolean };
  limits: {
    bookingRateLimit: { max: number; windowMinutes: number };       // 5 per 60
    availabilityRateLimit: { max: number; windowMinutes: number };  // 300 per 10
    loginFailureLimit: { max: number; windowMinutes: number };      // 5 per 10
  };
  admin: { sessionIdleMinutes: number; sessionMaxHours: number };   // 60, 12 (team decision, not business)
}
interface SessionType {
  id: "portraits" | "couples" | "families" | "events" | "holiday-minis" | string;
  name: string; description: string; included: string[];
  kind: "standard" | "mini";                  // "mini" = bookable only on admin-created mini slots
  active: boolean;
  bookingMode: "instant" | "request";         // Events = "request" (Daniella's decision, 2026-11-25)
  durationMin: number;                        // Events: the minimum coverage
  durationOptionsMin?: number[];              // Events: [120, 180, 240, 300, 360]
  bufferMin: number;                          // 30 (minis 10)
  windowSet?: string;                         // "outdoor" | "venue"; omitted for kind "mini"
  minimumNoticeHours?: number;                // optional per-type override (e.g. minis)
  bookingHorizonDays: number;                 // 183 (Events 365)
  priceFromCents: Cents; priceUnit: "session" | "hour";
  deposit: { kind: "flat"; amountCents: Cents } | { kind: "percent"; percent: number } | { kind: "full" } | { kind: "none" };
  depositPaymentLink: string | null | Record<string, string>;      // map keyed by durationMin (optional)
  maxPeople: number | null; includedPeople?: number; extraPersonFeeCents?: Cents;
  locationOptions: { id: string; label: string }[];                // ignored for kind "mini"
  allowOwnLocation: boolean; allowHelpMeChoose: boolean;
  intakeExtraFields: { id: string; required: boolean }[];         // ids from config/intake-fields.ts
  commonFieldsProfile: "full" | "short";      // "short" = Minis set from story 005
  whatToBringText: string;
  countsTowardDailyCap: boolean;              // false for minis
}
```

### Name mapping (stories/docs → config key)
| Story / doc name | Config key |
|---|---|
| `duration_min`, `duration_options_min`, `buffer_min` | `durationMin`, `durationOptionsMin`, `bufferMin` |
| `price_from`, `deposit`, `deposit_payment_link` | `priceFromCents` (+ `priceUnit`), `deposit`, `depositPaymentLink` |
| `max_people`, `extra_person_fee` | `maxPeople`, `extraPersonFeeCents` (+ `includedPeople`) |
| `booking_mode`, `intake_extra_fields`, `location_options`, `active` | `bookingMode`, `intakeExtraFields`, `locationOptions`, `active` |
| `booking_horizon_days`, `what_to_bring_text` | `bookingHorizonDays`, `whatToBringText` |
| `timezone`, `working_days`, `session_windows`, `slot_interval_min` | `business.timezone`, `scheduling.workingDays`, `scheduling.windowSets` + per-type `windowSet`, `scheduling.slotIntervalMin` |
| `minimum_notice_hours`, `max_sessions_per_day`, `unpaid_hold_hours`, `request_response_days` | `scheduling.*` with the same names in camelCase |
| `policy_version`, `policy_summary_text`, `policy_full_text` | `policyVersion`, `policies[v].summaryTemplate`, `policies[v].sections` |
| `email_from_name`, `email_from_address`, `admin_notification_email` | `email.fromName`, `email.fromAddress`, `email.adminNotificationEmail` |
| `admin_allowlist` | **env var `ADMIN_EMAIL`** (single admin in v1; credentials must sit beside the hash, ADR 0003) |
| `booking_rate_limit` | `limits.bookingRateLimit` |
| `data_retention_months` | `privacy.dataRetentionMonths` (shown in the privacy notice; automatic purge is v1.1) |
| `portfolio_opt_out_enabled` | `features.portfolioOptOutEnabled` |

### Intake field catalogue (`config/intake-fields.ts`)
Common: `contact.fullName` (≤ 100), `contact.email` (≤ 254), `contact.phone` (10 US digits or `+` and 8–15 digits), `contact.preferredContact` (`email|call|text`), `subjectsNames` (≤ 500), `people.adults|children|pets` (integers 0–50, total people ≥ 1), `location` (`{ kind: "suggested", optionId } | { kind: "own", text ≤ 300 } | { kind: "help_me_choose" }`), `styleNotes` (≤ 1000), `mustHaveShots` (≤ 1000), `anythingElse` (≤ 1000), `heardAbout` (≤ 200), `portfolioOptOut` (boolean, only if enabled). Extra: `couples.occasion` (`engagement|anniversary|just_because|other`), `couples.surpriseProposal` (boolean), `families.childrenAges` (≤ 200, required if children > 0; ages only), `families.extendedFamily` (boolean), `events.eventName` (≤ 150), `events.eventType` (≤ 100), `events.venueAddress` (≤ 300), `events.eventStartTime` and `events.eventEndTime` (`HH:mm`, end > start), `events.guestCount` (integer ≥ 1), `events.onsiteContactName` (≤ 100), `events.onsiteContactPhone`, `events.timeline` (≤ 2000, optional), `minis.cardDeadline` (`YYYY-MM-DD`, optional). The server builds the Zod schema from the catalogue plus the type's config, and rejects unknown fields and fields of other types (story 005 #4).

## Consequences
- One schema drives the front-end form, the server validation, the admin detail labels and the CSV columns.
- Changing a value = edit + PR + deploy (each production deploy costs 15 Netlify credits on credit plans, so batch changes).
- v1.1: move `sessionTypes` and policies into Blobs with the same schema, plus an admin editor.
