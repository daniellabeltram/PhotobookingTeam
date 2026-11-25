# Code-reviewer knowledge (Iris)

## Hot spots to always check in this app
- Time zone/DST handling uses the shared datetime module only.
- Slot reservation is atomic; buffers applied on both sides.
- Business values come from config, not literals.
- Admin handlers check auth first; no PII in logs.
- Tests cover each acceptance criterion; none skipped.

## Conventions agreed in reviews
- (dated notes)
