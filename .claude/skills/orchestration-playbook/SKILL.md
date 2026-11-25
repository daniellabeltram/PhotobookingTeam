---
name: orchestration-playbook
description: "Step-by-step playbook for the orchestrator: intake, planning, delegation prompts, parallelization, quality gates and reporting to Daniella. Use when running a feature, sprint or release through the team."
user-invocable: false
---

# Orchestration playbook

## 1. Intake
- Restate the goal in one sentence and decide which scope it belongs to (`docs/02-features.md`).
- Check `docs/team/board.md` and your knowledge folder for related work.
- Ask Daniella only about decisions that are hers (prices, policies, brand, priorities). Use at most 4 concise questions, each with a recommended option.

## 2. Plan
Typical sequence for a feature:
```
product-manager (story + AC)
  → ux-designer (flow, copy)  ∥  software-architect (design/ADR, API contract)
  → frontend-developer  ∥  backend-developer
  → code-reviewer  ∥  qa-tester  (∥ security-reviewer when sensitive)
  → fixes loop → devops-engineer (preview deploy) → technical-writer
  → report to Daniella → (approval) merge + production deploy
```
- Write the tasks into `docs/team/board.md` with an ID, owner, status (todo / doing / review / done / blocked) and links.
- Skip steps that clearly don't apply (a typo fix doesn't need an ADR), and say that you skipped them.

## 3. Delegation prompt template
Specialists start with no memory of this conversation. Every brief must stand alone:
```
Goal: <one sentence>
Context: <story id / links to docs, design, ADRs, files>
Acceptance criteria: <list>
Constraints: <scope limits, files not to touch, branch name>
Deliverable: <files/artifacts> + Handoff report (team-workflow format)
```
Run independent tasks in parallel. Pass each agent the earlier handoffs it depends on.

## 4. Gates
- No implementation without acceptance criteria.
- No merge without approval from `code-reviewer` and sign-off from `qa-tester` (and `security-reviewer` when the change touches auth, PII, payments, secrets or config).
- When a review requests changes, send the findings back to the author, then re-review. Cap this at 3 loops, then escalate to Daniella with options.
- Verify the claims yourself: open the files, rerun the key test command. Don't relay "done" without evidence.

## 5. Report to Daniella
Keep it short and plain:
- **Done:** what she can now do or see, with a preview link if there is one
- **Tested:** what was checked and the results
- **Needs you:** decisions or approvals, each with a recommendation
- **Next:** the proposed next step

## 6. Growing the team
If a task needs expertise no agent has (e.g. Stripe specialist, SEO, Spanish translation), delegate to `team-builder` with the gap and examples of the work.
