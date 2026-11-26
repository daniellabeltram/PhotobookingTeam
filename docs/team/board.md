# Team board

Maintained by the `orchestrator`. Status values: todo · doing · review · done · blocked.

| ID | Task | Owner | Status | Links / notes |
|---|---|---|---|---|
| T-012 | Preview deploy, launch-gate concurrency run, manual a11y/device checks | devops-engineer, qa-tester | todo | docs/operations.md §6, docs/test-plans/README.md |
| T-001 | Confirm `[PLACEHOLDER]` values in `docs/04-booking-policies.md` (prices, deposits, windows) | Daniella | todo | Decisions checklist at the end of that file |
| T-002 | Write user stories for the v1 must-haves | product-manager | done | `docs/stories/` 001–019, plus 020 in progress |
| T-003 | ADRs 0001–0007 (framework, data store, admin auth, email, payments, time, config) | software-architect | done | `architecture-decisions` skill |
| T-004 | Booking flow and admin wireframes, copy, tokens | ux-designer | done | `docs/design/`, brand assets still placeholders |
| T-005 | netlify.toml, CI, .env.example, docs/operations.md | devops-engineer | done | Dist secret scan runs in CI and in the Netlify build |
| T-006 | Back end: scaffold, store, all /api functions, email, admin auth, tests | backend-developer | done | Code review: Approve; should-fix items done |
| T-007 | Security design review (auth, secrets, PII, preview isolation) | security-reviewer | done | 3 High, 6 Medium, 9 Low; fixes assigned to backend, frontend, devops |
| T-008 | Front end: booking flow, admin, password tool | frontend-developer | done | Code review fixes and QA bugs 2–4 done |
| T-009 | QA: test plans, e2e, regression suite, sign-off | qa-tester | done | PASS: 442/442 unit+integration, 66/66 e2e (phone + desktop) |
| T-010 | Code review and final security review | code-reviewer, security-reviewer | done | Security: OK to ship (2026-11-26) |
| T-011 | README with deploy steps, admin guide, CHANGELOG | technical-writer | done | Commands verified against package.json |

## Decisions log
| Date | Decision | By |
|---|---|---|
| 2026-11-25 | Agent team created (12 agents, 15 skills) | Daniella |
| 2026-11-25 | Events need Daniella's approval in v1 (request mode); other types book instantly | Daniella |
| 2026-11-25 | Unpaid bookings are flagged "Deposit overdue" after the hold period, not released automatically | Daniella |
| 2026-11-25 | software-architect runs on opus (Fable needs usage credits) | Orchestrator |
| 2026-11-25 | Defaults pending Daniella: TOTP required in production; minimal new-booking email to Daniella; site-wide cap of 20 bookings/day [PLACEHOLDER]; children's ages optional | Orchestrator (security review) |
| 2026-11-26 | v1 sends the .ics by email only; no Add to calendar button on the confirmation screen | Orchestrator |
| 2026-11-26 | Buffer rule: gap between sessions >= the larger of the two buffers | Orchestrator (code review) |
