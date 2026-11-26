# Technical-writer knowledge (Paige)

## Audience
- Daniella: photographer and business owner, not a developer. Plain language, numbered steps, explain jargon in a few words.
- Future developers/freelancers: precise setup and runbooks (`docs/operations.md`, `docs/architecture.md`).

## Terminology (decided)
- "Session type" (not service/package) · "booking" (not appointment) · times as "5:30 PM ET".
- "Retainer" for the amount that holds a date (docs/03 §3, docs/04). Admin buttons use "Mark deposit paid" (story 013, architecture). The guide says "retainer" and notes the button name.
- Statuses in Daniella's words: Requested, Pending deposit, Confirmed, Completed, Cancelled, Declined, Rescheduled. "Expired" is NOT a v1 status (v1.1).
- Flags: "Deposit overdue", "Reply overdue", "Session time passed", "Email not sent".
- Unpaid bookings are flagged, not released automatically (Daniella, 2026-11-25). Never write "released after 48 hours".

## Docs status (2026-11-25)
- README.md: written (features, local run, tests, 10-step deploy, launch gate, docs map, decisions list).
- docs/admin-guide.md: written. Reschedule section marked [CONFIRM before release].
- CHANGELOG.md: [1.0.0] - 2026-11-25 written. The date is a target, so verify it at release.

## Verify before release (names may change while devs build)
- `npm run admin:hash` and `scripts/admin-hash.ts` (not yet present at drafting).
- `/admin/password-tool.html` and `/admin/` routes; `/api/config` used by uptime check.
- `npm run check`, `npm run test:tz`, `npm run test:e2e`.
- `config/booking.config.ts`, `config/policies/` (hashes.json) as the edit points for prices.
- Netlify UI labels: "Add new site" vs "Add new project" (operations.md says project).

## Known contradictions to flag (not resolved by me)
1. admin.md §3 says no Reschedule button in v1; story 014 (P1) and architecture have it. Guide documents it with a CONFIRM marker.
2. admin.md §2 has "Search name or email" filter; story 011 puts text search out of v1.
3. admin.md approve dialog says "held for 48 hours"; contradicts decision 4 (no auto-release).
4. admin.md cancel dialog offers "Refund retainer"; story 013 says refunds happen in the payment provider.
5. admin.md uses "Expired" chip; not a v1 status.
6. Story 012 asks whether "Delete client data" is needed in v1; decision 8 includes it. Guide documents it.
7. architecture §5 says local ADMIN_PASSWORD_HASH default is "a dev passphrase in .env.example comments"; .env.example has no such comment.
8. operations.md §6 launch-gate script writes to /tmp (scratch rules say use a project-scoped dir; devops to decide).
9. docs/04 §2 "released after 48 hours" still conflicts with decision 4.
10. admin.md login has "Forgot your password?"; ADR 0003 has no reset flow (offline tool only).
11. Terminology: admin.md mixes "deposit" and "retainer"; ux-designer to pick one for UI copy.

## Learned
- 2026-11-25: Orchestrator asked for the deploy section to follow the 10-step outline and to flag that Netlify facts (runtime env vars via UI only, plan credits) must be re-checked on Netlify's own pages before launch. Done in README.
- 2026-11-25: Bash is not available to this agent; git branch and remote could not be checked directly. Repo name taken from the brief.
