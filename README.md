# Daniella Beltram Photography: booking app

**Status:** v1 in progress. Docs are drafted ahead of the build, so some commands and file names may still change. The orchestrator checks them before release.

## What this app is

A booking and intake website for Daniella Beltram Photography in West Palm Beach, Florida. It lives on the studio's own domain.

- **Clients** pick a session type, choose an open time, fill out a short form, accept the policies and get a confirmation email with a calendar file.
- **Daniella** sees every booking on one private admin page. She can approve or decline event requests, mark deposits paid, change a booking's status, block dates, add Holiday Minis slots and export a CSV.

Business values such as prices, lengths, deposits and policy wording are placeholders marked `[PLACEHOLDER]` until Daniella confirms them. See `docs/04-booking-policies.md`.

## Features in v1

| Area | What is included |
|---|---|
| Booking | Five session types: Portraits, Couples, Families, Events and Holiday Minis. Cards show length, starting price and deposit. |
| Availability | Only real open times are shown. Session length, buffers, working days, blocked dates and minimum notice are all respected. |
| No double bookings | The server checks and reserves each slot in one step. Two people can't get the same time. |
| Intake form | Common fields plus a few questions for each session type. Checked on the phone and again on the server. |
| Policies | A required checkbox. The policy version and the time of acceptance are stored with each booking. |
| Events requests | Events need Daniella's approval. The time is held while she reviews it. |
| Deposits | The client gets a payment link. The booking stays "Pending deposit" until Daniella marks it paid. |
| Emails | Confirmation, request received, approved, declined, confirmed, cancelled and rescheduled emails. Each one has a calendar file where it applies. |
| Admin | Sign-in with a password and optional second code, booking list with filters, booking detail, status changes, blocked dates, Holiday Minis slots, CSV export and "Delete client data". |
| Privacy and access | The admin pages and API need a valid sign-in. Logs don't contain names, emails or phone numbers. |
| Accessibility | Built to WCAG 2.1 AA, tested at phone width (375 px) and laptop width. |

**Not in v1** (planned for v1.1 or later): online card payment at checkout, automatic reminders, client self-reschedule, a Holiday Minis generator, text search in admin, and editing prices in admin. See `docs/02-features.md`.

## Tech stack

The front end is plain TypeScript with Vite, a multi-page build and no UI framework. The server logic runs as Netlify Functions in `netlify/functions/`, using shared Zod validation and Luxon for Eastern time. Booking data is stored in Netlify Blobs, using a per-day ledger that is updated with compare-and-swap, so two bookings can't win the same slot. Email is sent through Resend's REST API, and calendar (.ics) files are generated in our own code. Admin sign-in uses a password hash and optional TOTP stored in environment variables, with a signed HttpOnly cookie. Tests use Vitest and Playwright. Architecture decisions are in `docs/adr/`.

## Run it locally

You need **Node 22** (version 22.18 or newer, below 23). You don't need any accounts, API keys or the Netlify CLI.

1. Open a terminal in the project folder.
2. Install the packages:
   ```bash
   npm ci
   ```
3. Make your local settings file:
   ```bash
   cp .env.example .env
   ```
4. *Optional:* on your own computer you can skip steps 4 and 5. With no `.env` values, local mode signs in with `admin@example.test` and the passphrase `dev-passphrase-change-me`. These built-in practice values are refused on Netlify. To use your own local password instead, run this command and type a passphrase of at least 14 characters:
   ```bash
   npm run admin:hash
   ```
   Copy the line it prints into `.env` as the value of `ADMIN_PASSWORD_HASH`. It looks like this (this example is fake):
   ```
   ADMIN_PASSWORD_HASH=pbkdf2-sha256$600000$EXAMPLE_SALT$EXAMPLE_KEY
   ```
5. Set a local session secret. Run this command and paste the output into `ADMIN_SESSION_SECRET` in `.env`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
6. Start the app:
   ```bash
   npm run dev
   ```
7. Open these links in your browser:
   - Booking site: http://localhost:5173
   - Admin: http://localhost:5173/admin/ (sign in with `ADMIN_EMAIL`, which defaults to `admin@example.test`, and the passphrase from step 4)
   - Offline password tool: http://localhost:5173/admin/password-tool.html

Local data and emails are not sent anywhere:

| What | Where on your computer |
|---|---|
| Bookings and other stored data | `.data/store/` |
| Emails and calendar files | `.data/outbox/`. Each email gets its own folder with `message.json`, `body.txt`, `body.html` and the `.ics` file. |

Both folders are ignored by git. Never commit `.env`.

**If something goes wrong**
- *The admin page says the email and passphrase don't match:* check that `ADMIN_EMAIL` in `.env` matches what you typed, then restart `npm run dev`. Restart after every change to `.env`.
- *Port 5173 is busy:* stop the other program using it, or stop any old `npm run dev` still running.
- *`npm ci` fails on the Node version:* run `node --version`. It must show v22.18 or newer.

## Run the tests

| Command | What it checks |
|---|---|
| `npm run check` | Lint, type-check and unit and integration tests. Run this before every handoff. |
| `npm run test:tz` | The same tests in two time zones, to make sure the device's time zone doesn't change results. |
| `npm run test:e2e` | Browser tests with Playwright at phone and laptop sizes, including accessibility checks. It starts the app itself and wipes `.data/e2e`. |

If `test:e2e` fails with a browser error, don't run `npx playwright install`. Chromium is already installed for this project.

## Deploy to Netlify (step by step)

These steps are written for Daniella. Developers can find the details in `docs/operations.md`. Netlify's screens change from time to time, so the names of some buttons may differ slightly.

**Before you start:** you need a GitHub account with access to the repository `daniellabeltram/PhotobookingTeam`, your business email, your phone for two-factor sign-in, and access to your domain's DNS settings.

1. **Create a Netlify account and turn on two-factor sign-in.** Go to netlify.com and sign up. In your account settings, turn on two-factor authentication. Whoever controls this account controls the whole app.

2. **Import the GitHub repository as a new site.** Sign in to Netlify with GitHub. Choose **Add new site** (Netlify may call it "Add new project"), then **Import an existing project**, and pick `daniellabeltram/PhotobookingTeam`. Set the production branch to `main`. The build settings (`npm run build`, publish folder `dist`, functions folder `netlify/functions`) are read from `netlify.toml`, so don't change them. Keep **Deploy Previews** turned on, so every proposed change gets its own test website.

3. **Set up email with Resend.** Create a free account at resend.com. Add your sending domain (for example `daniellabeltram.photography` or `mail.daniellabeltram.photography`). Resend shows DNS records to add at your domain host: **SPF**, **DKIM**, and a **DMARC** record. A DMARC record to start with looks like `v=DMARC1; p=none; rua=mailto:YOUR-ADDRESS`. Wait until Resend shows the domain as verified. Then create **two API keys**: one for production and one for previews. Keep both somewhere safe, such as a password manager.

4. **Make the admin password and the second-factor code.** Open `/admin/password-tool.html` on your preview website (the link is in the Netlify deploy page after step 6). The tool runs entirely in your browser and sends nothing over the internet. Type a passphrase of at least 14 characters and copy the hash it shows. Then generate the TOTP secret and add it to an authenticator app such as Google Authenticator or 1Password. Keep the passphrase somewhere safe. If you lose it, you can make a new hash with this same tool.

5. **Enter the environment variables.** In Netlify, go to **Site configuration → Environment variables**. Add each name from the table below. Where the table shows different values, choose **Different value for each deploy context**, and fill in the production value and the deploy-preview value separately. Tick **Contains secret values** for every secret. Type the secrets yourself. Never paste them into chat, email or a file in the repository.

   | Name | Secret? | What it is for | Production | Deploy previews |
   |---|---|---|---|---|
   | `APP_ENV` | no | Turns on safety checks for each environment | `production` | `preview` |
   | `STORE_DRIVER` | no | Where bookings are stored | `netlify-blobs` | `netlify-blobs` |
   | `DATA_NAMESPACE` | no | Separates preview data from real data | `production` | `preview` |
   | `EMAIL_DRIVER` | no | How email is sent | `resend` | `resend` |
   | `RESEND_API_KEY` | yes | Lets the app send email through Resend | live key | preview key (different) |
   | `EMAIL_REDIRECT_TO` | no | Sends every preview email to one test inbox | **leave unset** | your test inbox (required) |
   | `ADMIN_EMAIL` | no | Daniella's sign-in email | her email | a test address |
   | `ADMIN_PASSWORD_HASH` | yes | The password hash from step 4 | her hash | a different test hash |
   | `ADMIN_SESSION_SECRET` | yes | Signs sign-in sessions. Changing it signs everyone out. | random value | a different random value |
   | `ADMIN_TOTP_SECRET` | yes | The second-factor secret from step 4. **Required in production** (the site refuses to start without it) | set | optional |
   | `PUBLIC_BASE_URL` | no | The web address used in email links | `https://book.daniellabeltram.photography` `[PLACEHOLDER domain]` | leave unset |
   | `PAYMENT_LINK_OVERRIDE_URL` | no | Swaps real payment links for test links | **leave unset** | optional test link |
   | `RATE_LIMIT_DISABLED` | no | Turns off form limits for the launch test only | **leave unset** | `1` only during the launch test, then remove it |
   | `LOG_LEVEL` | no | How much the logs record | `info` | `info` |

   The names `DATA_DIR`, `EMAIL_OUTBOX_DIR` and `FAKE_NOW` are for local use only. Never set them on Netlify.

   Production must **not** have `EMAIL_REDIRECT_TO`, `RATE_LIMIT_DISABLED` or `PAYMENT_LINK_OVERRIDE_URL`. The app refuses to start if the settings don't match these rules, which is a good sign that it is working.

6. **Deploy a preview and run the launch test.** Open a pull request, or use the preview that Netlify builds for you. Once it is ready, run the 20-bookings launch test in the section below. Don't go live until it passes.

7. **Approve the first production deploy.** When the launch test passes and the developers say the preview is ready, tell the team you approve. Merging to `main` starts the first production deploy. Watch **Deploys** until it says **Published**. Then run the smoke test in `docs/operations.md` section 7. It checks that the booking page loads, that the policy and privacy pages open, that the security headers are present and that you can sign in to `/admin/`.

8. **Connect your domain (after you approve the name).** In Netlify, go to **Domain management → Add a domain** and enter `book.daniellabeltram.photography` `[PLACEHOLDER domain]`. At your DNS host, add the **CNAME** record that Netlify shows. Netlify then issues the HTTPS certificate automatically. This can take a little while. Once the domain works, set `PUBLIC_BASE_URL` to the same address for production, and trigger a new deploy.

9. **Turn on alerts.** Ask the developers to set up a free uptime check on `https://<your-site>/api/config`, with an email alert to you. In Netlify, go to **Project configuration → Notifications** and turn on the alert for failed deploys.

10. **Roll back if a release goes wrong.** Go to **Deploys**, open the last deploy that worked, and click **Publish deploy**. The old version is live within seconds. Rolling back does not change booking data. It also does not undo environment variable changes. If the problem was a variable, fix it there and trigger a new deploy. To pause all deploys while you investigate, use **Lock publishing**.

> **Check before launch:** Two Netlify facts in this guide must be confirmed on Netlify's own pages before launch. First, that functions read environment variables from the Netlify UI at runtime (values in `netlify.toml` do not reach them). Second, the current plan limits and credit costs. Each production deploy uses plan credits, so avoid unnecessary deploys. The team recorded these facts on 2026-11-25 without confirming them on Netlify's pages.

## Launch test: 20 bookings at once (required before going live)

Before the first real booking, the team must show that 20 people booking the same time at the same moment produce exactly one booking. This is the only way to be confident that double bookings can't happen on the real storage system. The steps and the test script are in `docs/operations.md` section 6.

In short:
- Run it three times, each on a different time slot. One of the runs must try two session types whose buffers overlap.
- Each run must produce exactly one success. The other requests must be refused as taken or busy, and none may succeed.
- Check the admin page: there must be one booking for that time.
- The test inbox must receive one confirmation for each run.
- If the test ever produces two bookings, stop. Don't go live. Tell the developers straight away.

## Where the docs live

| Document | What it covers |
|---|---|
| `README.md` | This guide: what the app is, running it, testing, deploying |
| `docs/admin-guide.md` | How Daniella uses the admin page, step by step |
| `CHANGELOG.md` | What changed in each release |
| `docs/01-project-brief.md` | The problem, users, goals and constraints |
| `docs/02-features.md` | What is in v1, v1.1 and later |
| `docs/03-research.md` | Industry research with sources |
| `docs/04-booking-policies.md` | Prices, deposits, policies (placeholders until confirmed) |
| `docs/adr/` | Architecture decisions and the reasons for them |
| `docs/architecture.md` | How the system fits together, commands and environment variable names |
| `docs/operations.md` | Environments, release steps, rollback, launch test, monitoring |
| `docs/stories/` | User stories and acceptance criteria |
| `docs/design/` | Screens, copy and design tokens |
| `CLAUDE.md` | How the AI agent team works |

## Decisions still needed from Daniella

These are business decisions. The app uses placeholder values until you confirm them.

1. Final prices, session lengths, image counts and deposit amounts for each session type (`docs/04-booking-policies.md`).
2. Retainer amounts: flat fee or percentage. Is "retainer" the word you want, instead of "deposit"?
3. Reschedule and cancellation windows (7 days and 48 hours are placeholders).
4. How long a booking can stay unpaid before you're reminded. Unpaid bookings are flagged, not released automatically.
5. How many days you promise for a reply to an event request, and whether that means calendar or business days (`request_response_days`).
6. For event deposits: one payment link per event length, a link where the client chooses the amount, or links you send yourself.
7. Which payment provider account the retainer links come from.
8. Weather decision time and rain threshold.
9. Holiday Minis: do they run in the 2027 season? Should minimum notice apply to them?
10. Session windows (for example morning and golden-hour times by month).
11. The sender name and address for confirmation emails, and the address that receives your new-booking alerts.
12. Whether your new-booking alert includes the full intake answers or only a link to admin (the draft says link only).
13. Whether anyone besides you needs admin access in v1.
14. Portfolio-use opt-out on the intake form: yes or no.
15. How long booking data is kept, and which email address takes privacy requests.
16. The suggested locations list, and the "what's included" text for each session.
17. Final policy wording, reviewed by a Florida attorney before launch.
18. Sales tax on sessions that include prints, reviewed by a CPA before any online payment is switched on.
