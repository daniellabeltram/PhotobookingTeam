# DevOps-engineer knowledge (Dex)

## Facts
- Hosting: Netlify. Domain: daniellabeltram.photography (booking subdomain or path TBD with Daniella; docs use book.daniellabeltram.photography as [PLACEHOLDER]).
- Production deploys and DNS changes only with Daniella's explicit approval.
- Netlify plan limits changed in 2026 (credit-based plans); verify on Netlify's own pages before relying on any number.
- 2026-11-25: docs.netlify.com and netlify.com were NOT reachable from the agent sandbox (host not allowed). Limits and the "netlify.toml env does not reach functions" claim rest on the architect's notes (ADR 0002, architecture.md s5, checked by them 2026-11-25). Re-verify when network allows. ADR 0002 figures: Free plan 300 credits/month, 15 credits per production deploy.

## Site settings (set up 2026-11-25, not yet applied on Netlify)
- Build: `npm run build`, publish `dist`, functions `netlify/functions`, esbuild bundler, NODE_VERSION=22 (netlify.toml, build only).
- No redirects (multi-page Vite; functions self-route at /api/*).
- Headers: HSTS, nosniff, Referrer-Policy, Permissions-Policy, strict CSP (self only, no inline) on /*; immutable cache on /assets/*; no-store + noindex on /admin/*.
- Runtime env var NAMES (UI, per context): APP_ENV, STORE_DRIVER, DATA_NAMESPACE, EMAIL_DRIVER, RESEND_API_KEY(secret), EMAIL_REDIRECT_TO, ADMIN_EMAIL, ADMIN_PASSWORD_HASH(secret), ADMIN_SESSION_SECRET(secret), ADMIN_TOTP_SECRET(secret), PUBLIC_BASE_URL, PAYMENT_LINK_OVERRIDE_URL, RATE_LIMIT_DISABLED, LOG_LEVEL. Local-only: DATA_DIR, EMAIL_OUTBOX_DIR, FAKE_NOW. Full table: docs/operations.md s2.
- CI: .github/workflows/ci.yml (checks job + optional e2e job with continue-on-error).

## Open items
- Launch gate (ADR 0002, 20 parallel bookings on a preview) not yet run. Procedure: docs/operations.md s6.
- CI e2e step uses `--project=chromium`: QA's playwright.config.ts must name a project `chromium`.

## Incidents
- (none)
