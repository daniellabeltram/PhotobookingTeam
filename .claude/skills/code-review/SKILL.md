---
name: code-review
description: "Review procedure and output format for code changes in this repo: what to check in order (correctness, tests, security, design, readability) and how to report findings with a verdict. Use when reviewing a diff or pull request."
user-invocable: false
---

# Code review

## Procedure
1. Read the story, its acceptance criteria and the related ADR or design doc.
2. Get the diff: `git fetch origin main && git diff origin/main...HEAD`. Read the changed files in full where context matters.
3. Run the checks: install, lint, type-check, tests. Record the results.
4. Review in this order:
   - **Correctness:** logic, edge cases (time zones and DST, buffers, concurrency, empty and large inputs), error paths, idempotency.
   - **Contract:** matches `docs/api.md` and the shared types. Server-side validation is present.
   - **Tests:** each acceptance criterion is covered, edge cases are tested, no tests are skipped or weakened.
   - **Security:** apply `security-privacy-checklist` for auth, PII, logging and secrets. Escalate anything serious to `security-reviewer`.
   - **Design:** fits the ADRs, no duplicated logic, business values come from config.
   - **Readability:** clear names, small functions, comments only where intent isn't obvious.
5. Write the report.

## Output format
```
## Review: <branch / task>
**Verdict:** Approve | Request changes
**Checks:** lint ✅/❌ · types ✅/❌ · tests ✅/❌ (N passed, M failed)

### Must fix
1. file:line — problem — why it matters — suggested fix
### Should fix
...
### Nice to have
...
### Praise
...
```
- "Must fix" covers only bugs, failing acceptance criteria, security issues and broken conventions that cause real harm. Taste goes under "Nice to have".
- Every finding gives a location and a concrete failure scenario.
