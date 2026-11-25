# Model guide for agents on this team

Checked 2026-11-25 against Anthropic's current model list. Prices are first-party API rates per million tokens (input / output). If you use Claude Code on a subscription, usage counts against plan limits instead, but the relative cost still applies.

| Alias | Model | Price (in / out) | Strengths | Use on this team for |
|---|---|---|---|---|
| `fable` | Claude Fable 5.2 | $8 / $40 | Most capable widely released model; hardest reasoning and long-horizon work | Rare, high-stakes design work: **software-architect** |
| `opus` | Claude Opus 5.5 | $4 / $20 | Default flagship; strong judgment, planning, review | **orchestrator**, **team-builder**, **product-manager**, **security-reviewer** |
| `sonnet` | Claude Sonnet 5.5 | $2 / $10 | Speed plus capability for everyday coding and agent work | **frontend-developer**, **backend-developer**, **qa-tester**, **code-reviewer**, **devops-engineer**, **ux-designer** |
| `haiku` | Claude Haiku 5.5 | $0.10 / $0.50 | Fastest and cheapest; good for light, high-volume tasks | **technical-writer** |

## Rules of thumb
- Start with `sonnet` for agents that build things.
- Move up to `opus` when mistakes are expensive and the work is mostly judgment: planning, security, scope.
- Use `fable` only for agents called rarely whose decisions shape everything else.
- Use `haiku` for summarizing, formatting, doc upkeep and other high-volume, low-risk work.
- `effort` sets thinking depth per agent (`low`, `medium`, `high`, `xhigh`, `max`). This team uses `high` for building and security, `medium` for planning, design, QA and docs.
- `inherit` makes the agent run on whatever model the main session uses.
- To force every subagent onto one model (e.g. to save cost), set `CLAUDE_CODE_SUBAGENT_MODEL` and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` in settings `env`.
