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
