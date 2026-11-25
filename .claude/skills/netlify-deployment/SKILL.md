---
name: netlify-deployment
description: "Netlify deployment practices for this app: netlify.toml layout, Functions settings, environment variables, deploy previews, security headers, custom domain, CI checks, release and rollback steps. Use when configuring builds, environments or deploys."
user-invocable: false
---

# Netlify deployment

## `netlify.toml` (baseline; adjust to the framework chosen in ADR 0001)
```toml
[build]
  command   = "npm run build"
  publish   = "dist"
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"

[[headers]]
  for = "/*"
  [headers.values]
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    X-Content-Type-Options    = "nosniff"
    Referrer-Policy           = "strict-origin-when-cross-origin"
    Content-Security-Policy   = "default-src 'self'; img-src 'self' data: https:; frame-ancestors 'none'"
```

## Environments
| Context | Purpose | Data |
|---|---|---|
| Deploy preview (per branch/PR) | Review and QA | Test data store, test email sandbox, Stripe test mode |
| Production (`main`) | Live clients | Production store, real email, live keys |
- Keep a table of env var **names** per context in `docs/operations.md`. Values are entered by Daniella in the Netlify UI.
- Never point a preview at production data.

## CI (on every push and PR)
`npm ci` → lint → type-check → unit and integration tests → `npm audit --audit-level=high` → build. Run Playwright against the deploy preview URL.

## Release
1. QA PASS, reviews approved, and Daniella's approval, relayed by the orchestrator.
2. Merge to `main`, which triggers the production deploy.
3. Smoke test: load the booking page, check availability loads, make a test booking on a hidden test session type (if configured), confirm admin login.
4. Record it in `CHANGELOG.md` and `docs/operations.md`.

## Rollback
Use Netlify Deploys, pick the last good deploy, and choose **Publish deploy**. Then fix forward on a branch. Data-store migrations must be backward compatible for one release so a rollback is safe.

## Domain
Serve the app at a subdomain (e.g. `book.daniellabeltram.photography`) or a path on the main site, as decided with Daniella. HTTPS uses Netlify-managed certificates. Email sending DNS records (SPF, DKIM, DMARC) are per ADR 0004.

## Limits
Plan limits (function invocations, bandwidth, Blobs, Forms) change. Check Netlify's own pricing and docs pages and write the date checked into your knowledge folder.
