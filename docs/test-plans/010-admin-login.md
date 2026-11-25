# Test plan: 010 — Admin login and access control
Story: `docs/stories/010-admin-login.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | E2E | e2e/admin.e2e.ts 'not signed in' | written |
| 2 | Integration | tests/integration/qa/admin-auth.test.ts '401 without a session' (all 16 routes) | written |
| 3 | Unit (dev-owned) | tests/unit/admin-allowlist test (ADMIN_EMAIL is the allowlist per ADR 0003) | dev-owned |
| 4 | Integration+E2E | tests/integration/qa/admin-auth.test.ts 'login'; e2e/admin.e2e.ts 'wrong password' | written |
| 5 | Integration | tests/integration/qa/admin-auth.test.ts 'repeated failures are rate limited' | written |
| 6 | E2E | e2e/admin.e2e.ts 'sign in, sign out' | written |
| 7 | Integration | TODO idle expiry with later FAKE_NOW (token idleExp) in tests/integration/qa/admin-auth.test.ts | gap |
| 8 | Manual | Recovery path: run /admin/password-tool.html, set hash, redeploy (preview) | manual |
| 9 | Integration | tests/integration/qa/admin-auth.test.ts (no-store, noindex headers); HTTPS-only via netlify.toml header review | partial |
