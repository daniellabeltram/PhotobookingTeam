---
name: create-agent
description: "Procedure for adding or changing an agent or skill on this team: overlap check, role design, official file formats, model choice, knowledge folder seeding, and wiring into the orchestrator and CLAUDE.md. Use when the team needs a new capability or an agent definition must change."
when_to_use: "add an agent, new team member, hire a specialist, create a skill, change an agent's model or tools"
argument-hint: "[role or capability needed]"
---

# Create or change an agent

Requested capability: $ARGUMENTS

## 1. Check for overlap
- List `.claude/agents/*.md` and `.claude/skills/*/SKILL.md`, and read the roster in `CLAUDE.md`.
- If an existing agent can do the job with one more skill, add the skill instead of a new agent.

## 2. Design the role
Answer these in a few lines: mission, what it owns, what it must not do, inputs, outputs, which agents it hands off to.

## 3. Write `.claude/agents/<name>.md`
Use [agent-template.md](agent-template.md). Format rules (from the official docs):
- The file starts with `---` on line 1. YAML frontmatter, then a Markdown body, which is the system prompt.
- `name` (required) is lowercase with hyphens, unique, and has no `:`. `description` (required) is one or two short sentences saying **when** to delegate, and keeps overall token use low.
- Optional fields used on this team: `tools`, `model`, `effort`, `memory: project`, `skills`, `color`. Field names are case-sensitive camelCase. Unknown fields are silently ignored.
- `tools`: least privilege. Reviewers get `Read, Glob, Grep, Bash, Skill` (no Write/Edit). Don't list `Agent` for specialists, because only the orchestrator delegates.
- `skills`: preloads full skill content at startup. Always include `project-context` and `team-workflow`, then only what the role needs. Skills with `disable-model-invocation: true` can't be preloaded.
- `memory: project` gives the agent its knowledge folder `.claude/agent-memory/<name>/`, auto-loads the first 200 lines of `MEMORY.md`, and enables Read/Write/Edit for it.
- Colors: `red, blue, green, yellow, purple, orange, pink, cyan`.

## 4. Choose the model
See [models.md](models.md). The default is `sonnet` for building, `opus` for judgment-heavy review or planning, `haiku` for high-volume light work, and `fable` only for rare, hardest reasoning.

## 5. New skills (if needed)
- Path: `.claude/skills/<skill-name>/SKILL.md`. The folder name is the command name.
- Frontmatter: `name`, `description` (put the key use case first, under 1,536 characters together with `when_to_use`). Use `user-invocable: false` for background knowledge. Use `disable-model-invocation: true` only for manual-only actions with side effects, and note that those can't be preloaded into agents.
- Keep the body under 500 lines and move long reference material into sibling files linked from `SKILL.md`.

## 6. Seed the knowledge folder
Create `.claude/agent-memory/<name>/MEMORY.md` with: role summary, key facts from `docs/` relevant to the role, open questions, and an empty "Learned" log. Keep it under 200 lines.

## 7. Wire it in
- Add the agent name to the `Agent(...)` list in `.claude/agents/orchestrator.md` frontmatter **and** to its "Your team" table.
- Add a row to the roster table in `CLAUDE.md` (agent, persona, model, skills, knowledge folder).
- If a skill was added, add it to the skills table in `CLAUDE.md`.

## 8. Validate
```bash
for f in .claude/agents/*.md; do head -1 "$f" | grep -q '^---$' || echo "bad start: $f"; done
grep -h '^name:' .claude/agents/*.md | sort | uniq -d   # must print nothing
```
- Every name under `skills:` must exist as `.claude/skills/<name>/SKILL.md`.
- If the Claude Code CLI is available: `claude plugin validate .claude/agents` and `claude plugin validate .claude/skills`.

## 9. Record and report
Log the change in `.claude/agent-memory/team-builder/MEMORY.md` (date, what, why) and end with a `team-workflow` handoff.
