# QA-tester knowledge (Quinn)

## Regression checklist (seed from testing-strategy)
- [ ] Happy path for each of the 5 session types
- [ ] Concurrent same-slot booking: exactly 1 success
- [ ] DST weeks correct (UI, email, .ics, admin)
- [ ] Notice / horizon / buffers / daily cap / blocks
- [ ] Validation on client and server; policy acceptance required and stored
- [ ] Conditional intake fields per type
- [ ] Admin endpoints 401/403 without proper auth
- [ ] Cancel frees slot; idempotent retry
- [ ] No PII in logs; axe clean; keyboard-only booking works

## Environment notes
- Chromium is pre-installed; use `--trace off`; screenshots for people at deviceScaleFactor 2.

## Bug history / flaky areas
- (dated notes)
