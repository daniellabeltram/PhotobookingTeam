# CLAUDE.md: Daniella Beltram Photography booking app

This repository holds the booking and intake web app for **Daniella Beltram Photography** (West Palm Beach, FL), along with the **team of AI agents** that builds it. Clients pick a session type, choose an open time, complete an intake form and get a confirmation. Daniella manages every booking from one admin page. The app deploys on Netlify.

Business source of truth: `docs/01-project-brief.md`, `docs/02-features.md`, `docs/03-research.md`, `docs/04-booking-policies.md`. Policy values marked `[PLACEHOLDER]` are not final.

---

## How to run the team

Start Claude Code with the orchestrator as the main agent:

```bash
claude --agent orchestrator
```

Then describe what you want in plain words, for example "Plan v1", "Build the session type picker", or "Get a preview deploy I can click through". The orchestrator (Marlo) plans the work, briefs the specialists, runs reviews and tests, and reports back. It asks you only about decisions that are yours to make.

Other ways to use the team:
- In a normal session, name an agent ("Have the qa-tester check the booking flow") or @-mention it (`@agent-security-reviewer`).
- To make the orchestrator the default for this project, add `"agent": "orchestrator"` to `.claude/settings.json`.
- To grow the team, ask for a new capability ("we need a Stripe specialist"). The orchestrator hands it to `team-builder`, or you can run `/create-agent payments specialist`.

> The orchestrator's `Agent(...)` allowlist and its ability to ask you questions only apply when it runs as the main agent (`claude --agent orchestrator`). Specialists can't ask you directly. Their questions come back through the orchestrator.

---

## Team roster

| Agent | Persona | Model | Effort | Role | Preloaded skills |
|---|---|---|---|---|---|
| `orchestrator` | Marlo, Studio Producer | opus | high | Plans, delegates, enforces gates, reports to Daniella | project-context, team-workflow, orchestration-playbook, requirements-writing |
| `team-builder` (meta) | Scout, Talent Scout | opus | medium | Adds or revises agents and skills | project-context, team-workflow, create-agent |
| `product-manager` | Priya | opus | medium | Stories, acceptance criteria, scope | project-context, team-workflow, requirements-writing, booking-domain-rules, documentation-standards |
| `ux-designer` | Luz | sonnet | medium | Flows, wireframes, copy, accessibility | project-context, team-workflow, ux-design-guidelines, booking-domain-rules |
| `software-architect` | Theo | fable | high | Stack, data model, ADRs, API contracts | project-context, team-workflow, architecture-decisions, booking-domain-rules, security-privacy-checklist, netlify-deployment, documentation-standards |
| `frontend-developer` | Kai | sonnet | high | Booking flow and admin UI | project-context, team-workflow, frontend-conventions, ux-design-guidelines, booking-domain-rules, testing-strategy |
| `backend-developer` | Omar | sonnet | high | Netlify Functions, data, email, payments | project-context, team-workflow, backend-api-conventions, booking-domain-rules, security-privacy-checklist, testing-strategy |
| `qa-tester` | Quinn | sonnet | medium | Test plans, automated tests, sign-off | project-context, team-workflow, testing-strategy, booking-domain-rules, requirements-writing, ux-design-guidelines |
| `security-reviewer` | Vera | opus | high | Read-only security and privacy review | project-context, team-workflow, security-privacy-checklist, code-review |
| `devops-engineer` | Dex | sonnet | medium | Netlify config, CI, deploys, rollbacks | project-context, team-workflow, netlify-deployment, security-privacy-checklist |
| `code-reviewer` | Iris | sonnet | high | Read-only correctness and quality review | project-context, team-workflow, code-review, frontend-conventions, backend-api-conventions, testing-strategy |
| `technical-writer` | Paige | haiku | medium | README, admin guide, changelog | project-context, team-workflow, documentation-standards |

### Why these models
- **fable** (Claude Fable 5.2, the most capable and most expensive) is used only for the architect. It is called rarely, and its decisions shape everything else.
- **opus** (Claude Opus 5.5) handles judgment-heavy work where mistakes are costly: orchestration, team design, scope and security.
- **sonnet** (Claude Sonnet 5.5) handles everyday building and review: fast and capable at coding.
- **haiku** (Claude Haiku 5.5) handles high-volume, low-risk documentation upkeep.

More detail is in `.claude/skills/create-agent/models.md`. To run everything on one model, set `CLAUDE_CODE_SUBAGENT_MODEL` and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`.

---

## Shared skills (`.claude/skills/`)

| Skill | What it gives an agent | Used by |
|---|---|---|
| `project-context` | Business, flow, constraints, where the docs live | All agents |
| `team-workflow` | Branching, definition of done, handoff format, escalation | All agents |
| `orchestration-playbook` | Intake, plan, delegate, gate, report | orchestrator |
| `requirements-writing` | Story and Given/When/Then templates | orchestrator, product-manager, qa-tester |
| `ux-design-guidelines` | Mobile-first patterns, copy tone, WCAG 2.1 AA checklist | ux-designer, frontend-developer, qa-tester |
| `architecture-decisions` | ADR template, decision criteria, open ADR list | software-architect |
| `frontend-conventions` | UI structure, forms, time display, performance, tests | frontend-developer, code-reviewer |
| `backend-api-conventions` | Functions layout, error format, atomic booking, logging | backend-developer, code-reviewer |
| `booking-domain-rules` | Slot generation, lifecycle, policy versioning, invariants | product-manager, ux-designer, software-architect, frontend-developer, backend-developer, qa-tester |
| `testing-strategy` | Test pyramid, must-have regressions, bug report format | frontend-developer, backend-developer, qa-tester, code-reviewer |
| `security-privacy-checklist` | Auth, PII, abuse, secrets, headers, privacy | software-architect, backend-developer, security-reviewer, devops-engineer |
| `code-review` | Review procedure and output format | security-reviewer, code-reviewer |
| `netlify-deployment` | `netlify.toml`, environments, CI, release, rollback | software-architect, devops-engineer |
| `documentation-standards` | Docs map, style, changelog | product-manager, software-architect, technical-writer |
| `create-agent` | How to add or change agents and skills (`/create-agent`) | team-builder |

Most skills are background knowledge (`user-invocable: false`) and are preloaded into the agents that need them. `/create-agent` can also be run by hand.

---

## Knowledge folders

Every agent has `memory: project` and its own knowledge folder at `.claude/agent-memory/<agent-name>/`:
- `MEMORY.md` is loaded automatically when the agent starts (the first 200 lines).
- The folders are seeded with role-specific facts from `docs/`. Agents add dated notes on decisions, Daniella's preferences and lessons learned.
- The folders are committed to git, so the team's knowledge survives across sessions.

---

## How work flows

```
Daniella ─▶ orchestrator ─▶ product-manager (story + acceptance criteria)
                         ─▶ ux-designer ∥ software-architect
                         ─▶ frontend-developer ∥ backend-developer
                         ─▶ code-reviewer ∥ qa-tester (∥ security-reviewer)
                         ─▶ devops-engineer (preview) ─▶ technical-writer
                         ─▶ report to Daniella ─▶ (her OK) merge + deploy
```

**Ground rules for every agent:**
1. Work on feature branches. Only Daniella approves merges to `main` and production deploys.
2. Nothing is done without passing tests, a code review and QA sign-off. Security review is also required for auth, PII, payments, secrets or config.
3. Never invent prices or policies. Use config values and keep `[PLACEHOLDER]` markers visible.
4. All times are America/New_York. Zero double bookings. No PII in logs. No secrets in the repo.
5. End every task with the handoff report from `team-workflow`.

The task board is in `docs/team/board.md`.

---

## Repository map

```
CLAUDE.md                 this file
.claude/agents/           12 agent definitions
.claude/skills/           15 shared skills
.claude/agent-memory/     per-agent knowledge folders
docs/01-04-*.md           brief, features, research, policies
docs/team/board.md        task board and decisions log
```
