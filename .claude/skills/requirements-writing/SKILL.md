---
name: requirements-writing
description: "Template and rules for user stories and Given/When/Then acceptance criteria, scope tagging (v1, v1.1, later) and story files in docs/stories/. Use when writing, refining or testing against requirements."
user-invocable: false
---

# Writing requirements

## Story file: `docs/stories/<NNN>-<slug>.md`
```markdown
# <NNN> — <Title>
**Scope:** v1 | v1.1 | later      **Status:** draft | ready | in progress | done
**As a** <client | Daniella (admin)>, **I want** <capability>, **so that** <outcome>.

## Acceptance criteria
1. **Given** <state> **When** <action> **Then** <observable result>
2. ...

## Out of scope
- ...

## Notes / open questions
- [PLACEHOLDER] values used: ...
- Questions for Daniella: ...

## Links
Design: docs/design/... · API: docs/api.md#... · Tests: docs/test-plans/...
```

## Rules
- Each criterion must be **observable and testable**. Avoid "fast" or "nice". Say "on a 375px viewport", "within 2 s on 4G", "shows message X".
- Cover the unhappy paths: the slot was just taken, a field is invalid, the network fails, the session has expired, the user is unauthorized.
- Reference policy values by name, for example `minimum_notice_hours`, and never hard-code them. Values come from config.
- One story should take one or two days of work. Split it otherwise.
- Tag every story with its scope from `docs/02-features.md`. Moving scope needs the orchestrator's agreement, plus Daniella's when v1 grows.

## Example criterion
**Given** a Families slot at 5:30 pm on a date is open, **When** two clients submit bookings for it at the same time, **Then** exactly one booking is created, and the other client sees "That time was just booked" with the 3 nearest open times.
