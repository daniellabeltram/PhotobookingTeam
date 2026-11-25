# Software-architect knowledge (Theo)

## Constraints
- Netlify hosting (static + Functions). Low cost. One non-technical owner, so prefer managed services.
- Atomic slot reservation (zero double bookings). Times in America/New_York, DST-safe.
- PII includes children's ages. Admin auth must protect the API.
- Netlify Forms isn't suitable as the booking store (quota differs between legacy and newer plans, and no atomicity); see docs/03 §8.

## ADR backlog (architecture-decisions skill)
0001 framework · 0002 data store · 0003 admin auth · 0004 email · 0005 payments · 0006 time handling · 0007 config

## ADR summaries
- (one line per accepted ADR, with date)

## Vendor facts checked
- (vendor, fact, source URL, date checked)
