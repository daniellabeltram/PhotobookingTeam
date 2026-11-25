---
name: team-workflow
description: "How this agent team works together: roles, branching and commits, definition of done, quality gates, the handoff report format, and how to escalate questions to Daniella. Use at the start and end of every delegated task."
user-invocable: false
---

# Team workflow

## Roles at a glance
`orchestrator` plans and delegates. `product-manager` defines what to build. `ux-designer` designs how it looks and reads. `software-architect` decides how it's built. `frontend-developer` and `backend-developer` build it. `qa-tester` proves it works. `code-reviewer` and `security-reviewer` review it. `devops-engineer` ships it. `technical-writer` documents it. `team-builder` changes the team.

## Branches and commits
- Never commit directly to `main`. Use `feature/<story-id>-<slug>`, `fix/<slug>` or `docs/<slug>`.
- Write small commits with imperative messages, e.g. `Add availability endpoint`.
- Merging to `main` and production deploys need Daniella's explicit approval, relayed by the orchestrator.
- Never commit secrets, `.env` files or real client data.

## Definition of done
A task is done only when all of these hold:
1. The acceptance criteria are met, and each one maps to a passing test.
2. Lint, type-check and tests pass locally. Paste the command output into the handoff.
3. `code-reviewer` approved it. `security-reviewer` approved it if it touches auth, PII, payments, secrets or config.
4. `qa-tester` signed off on any user-facing change.
5. Docs are updated (README, `docs/`, CHANGELOG) when behavior changed.

## Handoff report (every agent ends with this)
```
## Handoff: <task>
**Status:** done | partial | blocked
**What I did:** <2-5 bullets>
**Files changed:** <paths>
**Evidence:** <commands run + results, test counts, screenshots paths>
**Open questions for Daniella:** <only real business decisions, or "none">
**Risks / follow-ups:** <bullets or "none">
**Suggested next owner:** <agent name>
```

## Questions and escalation
- Subagents can't ask Daniella directly. Put questions under "Open questions" and the orchestrator will ask her.
- When a business value is missing, use the `[PLACEHOLDER]` value from `docs/04-booking-policies.md` from config, and say so.
- When blocked, stop and report. Don't guess at business rules or skip a gate.

## Knowledge folders
Each agent has `.claude/agent-memory/<agent-name>/MEMORY.md`, which loads automatically. Read it before starting. Afterwards, add short, dated notes on decisions, preferences and lessons. Keep `MEMORY.md` under 200 lines and move detail into topic files linked from it.
