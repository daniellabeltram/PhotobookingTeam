# 018 — Privacy notice
**Scope:** v1 (02 Platform)      **Status:** ready      **Priority:** P0
**As a** client, **I want** to know what information is collected and why, **so that** I'm comfortable sharing details about my family and children.

## Acceptance criteria
1. **Given** any step of the booking flow, **When** viewed, **Then** a "Privacy" link is visible (e.g. in the footer), and the intake form shows a one-line note near Submit linking to it.
2. **Given** the privacy notice page, **When** read, **Then** it states in plain language: what is collected (matching the intake fields, including children's ages), why (plan and deliver the session, contact the client about it), who can see it (Daniella, and the service providers that host, store, email and take payments), that it is never sold, how long it is kept (`data_retention_months`), and how to ask for a copy or deletion (contact email).
3. **Given** the notice, **When** shown, **Then** it has a "Last updated" date and is marked `[PLACEHOLDER]` for attorney review until Daniella approves the final text.
4. **Given** opening the notice from the form, **When** the client returns, **Then** their answers are unchanged.
5. **Given** a 375px viewport, **When** the notice is read, **Then** it is readable without horizontal scroll and headings are navigable by screen reader.
6. **Given** the app, **When** inspected, **Then** no third-party advertising or tracking scripts are loaded in the booking flow (so the notice stays accurate).

## Out of scope
- Cookie banner (not needed if no tracking cookies are used). Automatic deletion after the retention period (v1.1 candidate).

## Notes / open questions
- [PLACEHOLDER] values used: `data_retention_months` (**proposed new config value**), privacy text (docs/04 §9).
- Questions for Daniella: how long should booking data be kept? Which contact email for privacy requests?

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
