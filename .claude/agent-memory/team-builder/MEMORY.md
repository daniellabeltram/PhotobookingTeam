# Team-builder knowledge (Scout)

## Official formats (read 2026-11-25)
- Agents: `.claude/agents/<file>.md`, YAML frontmatter on line 1; required `name` + `description`. Fields used here: tools, model (sonnet|opus|haiku|fable|inherit|full ID), effort, memory, skills, color. Unknown fields silently ignored; camelCase.
- `Agent(a, b)` allowlist in tools only applies when the agent runs as the main thread (`claude --agent orchestrator`).
- Subagents never get AskUserQuestion, so questions go back to the orchestrator.
- Nesting: subagents can spawn up to 3 levels deep if given `Agent`. Specialists here have no `Agent`.
- `skills:` preloads full skill content. Skills with `disable-model-invocation: true` can't be preloaded.
- `memory: project` gives `.claude/agent-memory/<name>/`, auto-loads the first 200 lines / 25KB of MEMORY.md, and enables Read/Write/Edit.
- Skills: `.claude/skills/<name>/SKILL.md`; description plus when_to_use is capped at 1,536 chars; body under 500 lines; supporting files sit alongside.
- Docs: https://code.claude.com/docs/en/sub-agents · https://code.claude.com/docs/en/skills

## Current roster (12)
orchestrator, team-builder, product-manager, ux-designer, software-architect, frontend-developer, backend-developer, qa-tester, security-reviewer, devops-engineer, code-reviewer, technical-writer

## Candidate future agents (not created)
- payments-specialist (Stripe Checkout and webhooks, v1.1)
- localization-specialist (Spanish booking flow, later)
- seo-content / marketing (if the booking page needs organic traffic)

## Change log
- 2026-11-25: initial team of 12 agents and 15 skills created.
