# Team board

Maintained by the `orchestrator`. Status values: todo · doing · review · done · blocked.

| ID | Task | Owner | Status | Links / notes |
|---|---|---|---|---|
| T-001 | Confirm `[PLACEHOLDER]` values in `docs/04-booking-policies.md` (prices, deposits, windows) | Daniella | todo | Decisions checklist at the end of that file |
| T-002 | Write user stories for the v1 must-haves | product-manager | done | `docs/stories/` 001–019, plus 020 in progress |
| T-003 | ADRs 0001–0007 (framework, data store, admin auth, email, payments, time, config) | software-architect | doing | `architecture-decisions` skill |
| T-004 | Booking flow and admin wireframes, copy, tokens | ux-designer | done | `docs/design/`, brand assets still placeholders |
| T-005 | Netlify site and CI skeleton | devops-engineer | todo | After T-003 (ADR 0001) |

## Decisions log
| Date | Decision | By |
|---|---|---|
| 2026-11-25 | Agent team created (12 agents, 15 skills) | Daniella |
| 2026-11-25 | Events need Daniella's approval in v1 (request mode); other types book instantly | Daniella |
| 2026-11-25 | Unpaid bookings are flagged "Deposit overdue" after the hold period, not released automatically | Daniella |
| 2026-11-25 | software-architect runs on opus (Fable needs usage credits) | Orchestrator |
