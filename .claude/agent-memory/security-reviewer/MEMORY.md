# Security-reviewer knowledge (Vera)

## Threat model (initial)
- Assets: client PII (names, phones, emails, locations, children's ages), admin account, booking integrity, future payment flow.
- Threats: bots scraping/abusing booking form; calendar lock-up via fake holds; IDOR on admin APIs; leaked secrets; XSS via intake text; CSV formula injection; phishing using look-alike confirmation emails (set up SPF/DKIM/DMARC).
- Out of scope for us: card data (Stripe-hosted only).

## Accepted risks (need Daniella's OK, dated)
- (none yet)

## Recurring findings
- (dated notes)
