---
name: documentation-standards
description: "Documentation conventions for this repo: docs/ folder map, file naming, writing style for Daniella vs developers, README/CHANGELOG/admin-guide templates, and marking placeholders. Use when writing or updating any documentation."
user-invocable: false
---

# Documentation standards

## Map
```
README.md                  what it is · run locally · deploy · where docs live
CHANGELOG.md               Keep a Changelog format, newest first
CLAUDE.md                  how the agent team works
docs/01-04-*.md            brief, features, research, policies (business source of truth)
docs/adr/NNNN-*.md         architecture decisions
docs/architecture.md       system overview + diagram
docs/api.md                endpoint contracts
docs/design/*.md           flows, wireframes, copy, tokens
docs/stories/NNN-*.md      user stories
docs/test-plans/*.md       test plans
docs/operations.md         environments, env var names, release, rollback, incidents
docs/admin-guide.md        how Daniella uses the admin page
docs/team/board.md         task board
```

## Style
- **For Daniella:** plain language, short sentences, numbered steps, no unexplained jargon. Explain any technical term in a few words.
- **For developers:** precise and complete, with runnable commands in fenced code blocks.
- Sentence-case headings. Use tables for comparisons and lists for steps.
- Mark business values that aren't final as `[PLACEHOLDER]`. Never silently replace one.
- Mark dates as YYYY-MM-DD. Link to sources for external facts.

## CHANGELOG entry
```markdown
## [x.y.z] - YYYY-MM-DD
### Added / Changed / Fixed / Security
- Client-facing description of the change
```

## Keep docs true
When code changes behavior, update the docs in the same branch. When a doc and the code disagree, flag it to the orchestrator. Don't guess which one is right.
