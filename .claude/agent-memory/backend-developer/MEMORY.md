# Backend-developer knowledge (Omar)

## Must-haves
- Atomic reservation, idempotent create, server-side availability, policy_version stored.
- Emails after commit (client + Daniella, with .ics). Email failure doesn't roll back the booking.
- Admin endpoints: auth first, deny by default (`withAdmin`). No PII in logs.
- Store UTC; compute in America/New_York; test DST weeks (2nd Sun Mar, 1st Sun Nov).

## Statuses
requested · pending_deposit · confirmed · completed · cancelled · declined (+ reschedule history). `expired` is v1.1.

## Where things are (v1 built 2026-11-25)
- Layout and detail: `docs/architecture.md` section 3. Details of decisions: [decisions.md](decisions.md).
- Tests: `tests/unit/backend`, `tests/integration/backend` (mine); `tests/integration/qa` and `tests/helpers` are QA's.
- Dev: `npm run dev` serves /api through `netlify/dev/functions-dev-plugin.ts`. Local sign-in: `admin@example.test` /
  `dev-passphrase-change-me` (only accepted when APP_ENV is local or test; env.ts rejects the dev hash elsewhere).

## Data-store and provider notes
- Netlify Blobs: conditional writes (`onlyIfNew`, `onlyIfMatch`) + `consistency: "strong"`. Import only `@netlify/blobs`,
  never `@netlify/blobs/server` (review L9). Not proven on a real deploy yet: devops runs the 20-parallel preview test (ADR 0002 gate).
- Resend: only the HTTP status is logged on failure (the reply body can echo the recipient address).
- npm: plain `npm install` crashed (arborist `edgesOut`) after pinning vitest 5.1.1; `npm install --legacy-peer-deps` fixed it.
- Node 22.23 strips types natively: files run by `node` (scripts/admin-hash.ts) import `.ts` extensions and only self-contained modules.
- Tooling gotchas: `erasableSyntaxOnly` forbids constructor parameter properties; Write converts ` ` escapes into literal
  characters (breaks regex literals), so build such regexes with python or escape in a string; the safety hook sometimes blocks heredoc-heavy
  bash commands with a false "removal" warning: use the Write tool for files.
