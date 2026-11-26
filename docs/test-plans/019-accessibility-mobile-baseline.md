# Test plan: 019 — Accessibility and mobile baseline
Story: `docs/stories/019-accessibility-mobile-baseline.md` · Owner: qa-tester · Created 2026-11-25 · Status values: **written** (exists, not yet run: code not ready), **partial** (some of the criterion covered), **gap** (test still to write), **manual**, **dev-owned** (developer unit test).

| AC # | Test type | Test file / name | Status |
|---|---|---|---|
| 1 | E2E | e2e/a11y.e2e.ts (client 5 steps, policies, privacy, admin pages) | written |
| 2 | E2E | e2e/a11y.e2e.ts scan() horizontal scroll check, e2e/booking-happy.e2e.ts | written |
| 3 | E2E | TODO tap-target size sweep (boundingBox >= 44) in e2e/a11y.e2e.ts | gap |
| 4 | E2E | e2e/keyboard.e2e.ts | written |
| 5 | Manual | VoiceOver iOS Safari and TalkBack Android Chrome, full booking | manual |
| 6 | E2E | e2e/a11y.e2e.ts (axe color-contrast rule) | written |
| 7 | Manual | 200% zoom and OS large text, each step | manual |
| 8 | E2E | e2e/a11y.e2e.ts (axe) + manual review of chips and calendar | partial |
| 9 | Manual | Real devices: iOS Safari, Android Chrome, desktop Chrome/Safari/Firefox/Edge (Playwright covers Chromium only) | manual |
| 10 | Manual | Throttled 4G run (Lighthouse) at preview deploy | manual |
| 11 | Manual | Usability test with 5 users | manual |
