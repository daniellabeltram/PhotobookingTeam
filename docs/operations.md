# Operations: shipping, running and rolling back the booking app

Owner: devops (Dex) · Last updated: 2026-11-25 · Related: `docs/architecture.md` section 5, ADRs 0002, 0003, 0004

Plain version: the site is cheap to run and safe to undo. Every release can be reverted in one click. Previews can never touch real client data or email real clients, because the app refuses to start when the settings are wrong.

## 1. Where things live
| Thing | Where |
|---|---|
| Build and header settings | `netlify.toml` (no secrets) |
| Checks on every push | `.github/workflows/ci.yml` |
| Variable names | `.env.example` (names only) |
| Variable values | Netlify UI, per deploy context (never in the repo or in chat) |
| Booking data | Netlify Blobs, store `dbp-<DATA_NAMESPACE>` |

Important: values in `netlify.toml` reach only the build, not the running functions. Every variable below is set in the Netlify UI, and a change takes effect on the next deploy.

## 2. Environment variables per deploy context
Set under Site configuration, Environment variables. For each variable, use "Different value for each deploy context" where the table shows different values. Secrets: tick "Contains secret values".

| Name | Secret | Production | Deploy preview | Branch deploy | Must differ from production? |
|---|---|---|---|---|---|
| `APP_ENV` | no | `production` | `preview` | `preview` | Yes |
| `STORE_DRIVER` | no | `netlify-blobs` | `netlify-blobs` | `netlify-blobs` | No |
| `DATA_NAMESPACE` | no | `production` | `preview` | `preview` | Yes (the app refuses to start otherwise) |
| `EMAIL_DRIVER` | no | `resend` | `resend` | `resend` | No |
| `RESEND_API_KEY` | yes | live key | separate test key | separate test key | Yes (use a different key) |
| `EMAIL_REDIRECT_TO` | no | **not set** | a test inbox (required) | the same test inbox (required) | Yes (must be unset in production) |
| `ADMIN_EMAIL` | no | Daniella's email | test address | test address | Yes |
| `ADMIN_PASSWORD_HASH` | yes | her real hash | a different test hash | a different test hash | Yes |
| `ADMIN_SESSION_SECRET` | yes | own random value | different random value | different random value | Yes |
| `ADMIN_TOTP_SECRET` | yes | set (recommended) | optional | optional | Yes |
| `PUBLIC_BASE_URL` | no | `https://book.daniellabeltram.photography` [PLACEHOLDER domain] | leave unset (falls back to Netlify's `URL`) | leave unset | Yes |
| `PAYMENT_LINK_OVERRIDE_URL` | no | **not set** | optional test link | optional | Yes |
| `RATE_LIMIT_DISABLED` | no | **not set** | `1` only while running the concurrency test, then remove | not set | Yes |
| `LOG_LEVEL` | no | `info` | `info` | `info` | No |
| `FAKE_NOW`, `DATA_DIR`, `EMAIL_OUTBOX_DIR` | no | not set | not set | not set | Local use only. Never set on Netlify. |

`NODE_VERSION=22` is set in `netlify.toml` (build only), so there is nothing to enter in the UI.

Guards (the app fails closed at first use): production must use `netlify-blobs` and `DATA_NAMESPACE=production`; anything else must not use the `production` namespace; a non-production site using `resend` must have `EMAIL_REDIRECT_TO`. Notes: branch deploys share the preview namespace, so test data from different branches mixes there. That is fine for testing.

Rotating a secret: change it in the Netlify UI, then Deploys, Trigger deploy. Rotating `ADMIN_SESSION_SECRET` signs everyone out.

## 3. First-time Netlify setup (Daniella does the steps that need her accounts)
1. Create a Netlify account and turn on two-factor sign-in. Whoever controls this account controls the app.
2. Add new project, Import an existing project, pick the GitHub repo. Production branch: `main`. Build command `npm run build`, publish `dist`, functions `netlify/functions` (these come from `netlify.toml`).
3. Site configuration, Build and deploy: keep Deploy Previews on ("Any pull request against your production branch"). Turn on "Branch deploys" only for `feature/v1` if wanted.
4. Create a Resend account. Add the domain (or `mail.daniellabeltram.photography`), add the SPF and DKIM records Resend shows at the domain's DNS host, and add a DMARC record (`v=DMARC1; p=none; rua=mailto:<her address>` to start). Create two API keys: one for production, one for previews.
5. Make the admin password hash: open `/admin/password-tool.html` from a preview (it runs in her browser and sends nothing), choose a passphrase of at least 14 characters, copy the hash. Also generate the TOTP secret and add it to her authenticator app.
6. Enter the variables from section 2 in the Netlify UI. She types the secrets herself. They are never pasted into chat or committed.
7. Trigger a deploy of a preview first and run the launch gate (section 6). Then, when she approves, merge to `main`.
8. Domain (only after she approves the name): Domain management, Add a domain, `book.daniellabeltram.photography`. At her DNS host add the CNAME record Netlify shows. Netlify issues the HTTPS certificate. Then set `PUBLIC_BASE_URL` for production and redeploy.

## 4. Release checklist
Production deploys happen only with Daniella's explicit approval (relayed by the orchestrator).
- [ ] CI is green on the PR: lint, typecheck, tests, timezone tests, audit, build.
- [ ] `code-reviewer` approved. `security-reviewer` approved (this app handles personal data and sign-in).
- [ ] `qa-tester` signed off, including the Playwright run.
- [ ] The latest deploy preview was smoke-tested (section 7 steps 1 to 5).
- [ ] The ADR 0002 launch gate passed on a preview (first release, and after any change to booking, store or ledger code).
- [ ] Variables in section 2 match the table (production has no `EMAIL_REDIRECT_TO`, `RATE_LIMIT_DISABLED`, `PAYMENT_LINK_OVERRIDE_URL`).
- [ ] Any data-shape change keeps working with the previous release (so a rollback is safe).
- [ ] Daniella approved the release.
- [ ] Merge to `main`. Watch Deploys until it shows Published.
- [ ] Production smoke test (section 7).
- [ ] Add the release to `CHANGELOG.md` and the log in section 10 below.

## 5. Rollback (one click)
1. Netlify, Deploys. Open the last deploy that was good.
2. Click Publish deploy. The old version is live within seconds. This does not touch booking data.
3. Check the booking page loads and `/api/config` answers.
4. Fix the problem on a branch, test it on a preview, and release again the normal way.
Notes: a rollback does not undo environment variable changes, so if the problem was a variable, fix it and trigger a deploy instead. To pause deploys while investigating, use Deploys, Lock publishing.

## 6. Launch gate: 20 parallel bookings (ADR 0002)
Goal: prove on real Netlify Blobs that 20 people booking the same slot at once produces exactly one booking. If it ever produces two, stop. The fallback is a hosted database (ADR 0002 option 2).

Set up (Netlify UI, Deploy Previews context): `DATA_NAMESPACE=preview`, `RATE_LIMIT_DISABLED=1`. Open a PR so Netlify builds a preview and note its URL, `https://deploy-preview-<n>--<site>.netlify.app`. Preview emails go to the test inbox, so no client is contacted.

Run it (bash, from any machine with `curl`, `jq` and `uuidgen`; it makes only test bookings in the preview store):
```bash
BASE="https://deploy-preview-<n>--<site>.netlify.app"
TYPE="families"
# 1. find an open slot
curl -s "$BASE/api/availability?type=$TYPE" \
  | jq -r '[.data.days[] | select(.status=="open")][0].slots[0] | .startUtc' > /tmp/slot.txt
START=$(cat /tmp/slot.txt); echo "slot: $START"
# 2. fire 20 requests at once (a distinct Idempotency-Key and email each)
mkdir -p /tmp/gate && rm -f /tmp/gate/*
for i in $(seq 1 20); do
  ( curl -s -o /tmp/gate/$i.json -w "%{http_code}\n" -X POST "$BASE/api/bookings" \
      -H "Content-Type: application/json" -H "Idempotency-Key: $(uuidgen)" \
      -d "{\"sessionTypeId\":\"$TYPE\",\"startUtc\":\"$START\",
           \"contact\":{\"fullName\":\"Gate Test $i\",\"email\":\"gate$i@example.com\",\"phone\":\"5615550123\",\"preferredContact\":\"email\"},
           \"subjectsNames\":\"Test\",\"people\":{\"adults\":2,\"children\":0,\"pets\":0},
           \"location\":{\"kind\":\"help_me_choose\"},
           \"extra\":{\"families\":{\"childrenAges\":\"\",\"extendedFamily\":false}},
           \"portfolioOptOut\":false,\"policy\":{\"accepted\":true,\"version\":\"<current policy version from /api/config>\"},\"website\":\"\"}" \
      > /tmp/gate/$i.code ) &
done; wait
cat /tmp/gate/*.code | sort | uniq -c
```
The request body must match the current `docs/api.md` for the chosen type (field names for the type's `extra` block can change). If the server answers 400, read the error, fix the body, and run it again on a different slot. The QA test (`tests/` or `e2e/`, owned by QA) does the same thing in code and is the version to attach once it exists.

Pass criteria, for each of 3 rounds on 3 different slots (include one round that races two different session types whose buffers overlap):
- Exactly one `201`. Every other response is `409` (`SLOT_TAKEN`) or `503` (`BUSY`, which is safe: no booking was made). Any other code is a failure to investigate.
- Sign in to the admin page and confirm exactly one booking exists for that slot (no `Gate Test` duplicates at the same time).
- The test inbox received exactly one confirmation for that round.
Record the date, the preview URL, the commit, the counts and the result in section 10. Afterwards remove `RATE_LIMIT_DISABLED` from the preview context, and clean the test data (admin, Delete client data, or delete the `preview` store in Netlify, Blobs).

## 7. Smoke test (after every production deploy)
1. Open the booking page on a phone-sized window. It loads without console errors.
2. Pick a session type. Real dates and times load (availability works).
3. Open `/policies.html` and `/privacy.html`.
4. Check headers once: `curl -sI https://<site>/` shows Strict-Transport-Security, Content-Security-Policy and nosniff; `curl -sI https://<site>/admin/` shows `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
5. Open `/admin/`, sign in (with the second factor), see the list, sign out.
6. Production only, with Daniella's agreement: make one booking on the hidden test session type if configured, confirm the email arrives, then cancel it and use Delete client data. Do not test with a real client's slot.

## 8. Backups and export
- Booking data lives only in Netlify Blobs. Blobs are encrypted and replicated by Netlify, but that is not a backup against our own mistakes.
- Weekly (and before every release that changes stored data): admin page, Export CSV, save the file to Daniella's private storage (not email, not a shared folder). It contains personal details, so delete old copies when they are no longer needed. Retention is Daniella's decision [PLACEHOLDER].
- The CSV is a readable record, not a full restore. If a full restore is ever needed, the developers can rebuild from it. A scripted full export of the Blobs store is a follow-up (needs a small function or CLI script; not in v1 scope).
- Config, policies and code are in git, so they are already backed up.

## 9. Monitoring
- Uptime: add a free external check (for example UptimeRobot or Better Stack) on `https://<site>/api/config` every 5 minutes with an email alert to Daniella. It checks the page host and the functions together. Do not monitor `/api/admin/*`.
- Function logs: Netlify, Logs and metrics, Functions. Logs hold request IDs, booking references and status codes only, never names or contact details. If a client reports a problem, ask for the booking reference or the time and look it up by that.
- Email problems: the admin list flags "Email not sent"; Resend's dashboard shows delivery and bounces.
- Build failures: Netlify emails the site owner on failed deploys (Project configuration, Notifications). Turn on deploy-failed notifications. GitHub emails about failed CI.
- Watch for: a burst of `429` (someone hammering the form), repeated `503 BUSY` (contention), any `5xx`.
- Cost: Netlify's free plan is credit-based (ADR 0002 recorded 300 credits per month, 15 per production deploy, checked 2026-11-25 from the ADR; devops could not open netlify.com during setup). Re-check Netlify's pricing page before launch and note the date in `.claude/agent-memory/devops-engineer/`. Avoid pointless production deploys, since each one costs credits.

## 10. Release and incident log
| Date | What | Result |
|---|---|---|
| 2026-11-25 | Delivery set up (netlify.toml, CI, env names, this guide) | Launch gate not yet run |
