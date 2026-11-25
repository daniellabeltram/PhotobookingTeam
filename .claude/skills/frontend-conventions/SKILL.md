---
name: frontend-conventions
description: "Front-end coding conventions for the booking app: structure, components, forms and validation, API calls, date/time display, accessibility, performance budgets and front-end tests. Use when writing or reviewing UI code."
user-invocable: false
---

# Front-end conventions

The framework is whatever ADR 0001 says. These rules apply regardless.

## Structure
```
src/
  pages/ or routes/      booking flow steps, admin pages
  components/            small, reusable, presentational
  features/booking/      flow state, step logic
  features/admin/
  lib/api.ts             the only place that calls Functions
  lib/datetime.ts        the only place that formats/parses dates (America/New_York)
  config/                session types & policy values (generated from shared config)
```
- Use TypeScript in strict mode. Share types with the back end (`shared/types`) where possible.
- Components do one thing. No component file over about 200 lines.

## Forms
- Use native elements first (`<button>`, `<input type="email">`, `<fieldset>` with `<legend>`).
- The validation schema is shared with the back end where possible (e.g. Zod). Client validation is a convenience. The server is authoritative.
- Keep the flow state so Back and Next preserve answers. On refresh, restore from session storage (wrapped in try/catch).
- Disable the submit button while a request is in flight. Treat booking creation as idempotent by sending an `Idempotency-Key`.

## Data and time
- Never use `new Date()` string parsing for business times. Use `lib/datetime.ts`.
- Show times with the zone label, for example "5:30 PM ET".

## Accessibility and UX
- Follow `ux-design-guidelines`. Every interactive element is keyboard-operable with a visible focus ring.
- Announce async results (slot taken, booking confirmed) in an `aria-live` region.

## Performance budgets (mobile, 4G)
- Booking pages: LCP under 2.5 s, JS under 150 KB gzipped on first load, CLS under 0.1.
- Images are responsive (`srcset`) and lazy-loaded below the fold.

## Security
- No secrets in client code. Admin pages call the API with the auth token. Hiding a page isn't protection.
- Never use `innerHTML` with user content.

## Tests
- Unit-test step logic and formatting. Component-test the forms.
- Playwright: full booking happy path, slot-taken path, validation errors, admin login required. Cover 375px and 1280px viewports.
