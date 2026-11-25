# Team board

Maintained by the `orchestrator`. Status values: todo · doing · review · done · blocked.

| ID | Task | Owner | Status | Links / notes |
|---|---|---|---|---|
| T-001 | Confirm `[PLACEHOLDER]` values in `docs/04-booking-policies.md` (prices, deposits, windows) | Daniella | todo | Decisions checklist at the end of that file |
| T-002 | Write user stories for the v1 must-haves | product-manager | done | `docs/stories/` 001–019, plus 020 in progress |
| T-003 | ADRs 0001–0007 (framework, data store, admin auth, email, payments, time, config) | software-architect | done | `architecture-decisions` skill |
| T-004 | Booking flow and admin wireframes, copy, tokens | ux-designer | done | `docs/design/`, brand assets still placeholders |
| T-005 | netlify.toml, CI, .env.example, docs/operations.md | devops-engineer | doing | |
| T-006 | Back end: scaffold, store, all /api functions, email, admin auth, tests | backend-developer | doing | docs/architecture.md §12 |
| T-007 | Security design review (auth, secrets, PII, preview isolation) | security-reviewer | doing | |
| T-008 | Front end: booking flow, admin, password tool | frontend-developer | todo | After T-006 scaffold |
| T-009 | QA: test plans, e2e, regression suite, sign-off | qa-tester | todo | |
| T-010 | Code review and final security review | code-reviewer, security-reviewer | todo | |
| T-011 | README with deploy steps, admin guide, CHANGELOG | technical-writer | todo | |

## Decisions log
| Date | Decision | By |
|---|---|---|
| 2026-11-25 | Agent team created (12 agents, 15 skills) | Daniella |
| 2026-11-25 | Events need Daniella's approval in v1 (request mode); other types book instantly | Daniella |
| 2026-11-25 | Unpaid bookings are flagged "Deposit overdue" after the hold period, not released automatically | Daniella |
| 2026-11-25 | software-architect runs on opus (Fable needs usage credits) | Orchestrator |
