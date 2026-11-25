# 005 — Intake form (common and per-type fields)
**Scope:** v1 (02 §1.4, intake field list)      **Status:** ready      **Priority:** P0
**As a** client, **I want** a short form that only asks what matters for my session, **so that** Daniella has everything she needs without follow-up emails.

## Fields
**Common (all types except Holiday Minis, see below)**
| Field | Required |
|---|---|
| Full name, email, mobile phone, preferred contact method (email / phone call / text) | Yes |
| Names of everyone being photographed (free text) | Yes |
| Number of people: adults, children, pets (whole numbers ≥ 0; at least 1 person) | Yes |
| Location: one of `location_options`, "Enter my own" (text required), or "Help me choose" | Yes |
| Style notes (mood or vibe) | No |
| Must-have shots or groupings | No |
| Anything Daniella should know (mobility, sensory needs, shy kids, etc.) | No |
| How did you hear about us | No |

**Extra by type**
| Type | Fields |
|---|---|
| Couples | Occasion (engagement / anniversary / just because / other) — required; Surprise proposal? (yes/no) — required |
| Families | Children's ages (required when children > 0); pets included (from pet count); extended family joining? (yes/no) — required |
| Events | Event name, event type, venue address, event start and end time, guest count, on-site contact name and phone — required; timeline or must-have moments — optional |
| Holiday Minis | Only: primary contact fields, names, number of people, card deadline (optional date), anything to know (optional), how heard (optional). No location, style or must-have questions. |

## Acceptance criteria
1. **Given** a client chose a type, **When** the form shows, **Then** it shows exactly the common fields plus that type's extra fields from the table above (Minis: only the listed short set), driven by `intake_extra_fields` in config.
2. **Given** a required field is empty or invalid, **When** the client submits, **Then** submission is blocked, each invalid field shows a specific message next to it (e.g. "Enter an email like name@example.com"), focus moves to the first invalid field, and the errors are announced to screen readers.
3. **Given** an email without "@domain", a phone number that is not 10 US digits or a "+" international number, or a negative/non-whole count, **When** validated, **Then** it is rejected with a field-specific message.
4. **Given** a request that bypasses the browser (missing required field, wrong type, unknown field, over-length text, a field for another session type), **When** it reaches the server, **Then** the server rejects it with a field-level error and no booking is created.
5. **Given** a type with `max_people` and no `extra_person_fee` (e.g. Couples), **When** the total people exceeds `max_people`, **Then** the client sees "This session is for up to [max_people] people" and cannot submit. **Given** a type with `extra_person_fee` (Families), **Then** submission is allowed and the form shows "Extra people beyond [max_people] are $[extra_person_fee] each".
6. **Given** the client picks "Enter my own" location, **When** shown, **Then** a text field is required and a note says client-chosen venues need Daniella's approval and any permit fees are the client's. **Given** "Help me choose", **Then** no location text is required and the booking is flagged "Location: help me choose".
7. **Given** a Couples booking marked "surprise proposal: yes", **When** it is saved, **Then** the flag is visible in admin (story 012).
8. **Given** an Events booking, **When** the event end time is not after the start time, or guest count is not a whole number ≥ 1, **Then** it is rejected with a field-specific message.
9. **Given** a free-text field, **When** the client types, **Then** the maximum length is shown and enforced the same way on client and server.
10. **Given** the client goes back to the calendar to change the time, **When** they return, **Then** their answers are still filled in.
11. **Given** a 375px viewport, **When** the form is used, **Then** every field has a visible label (not placeholder-only), uses the matching mobile keyboard (email, tel, numeric), and the Minis form fits on no more than 2 screen heights of scrolling above the submit control.

## Out of scope
- Wardrobe questions (go in confirmation/reminder emails instead, per docs/03 §2).
- File uploads (inspiration photos), saving a draft across devices, SMS consent (later).

## Notes / open questions
- [PLACEHOLDER] values used: `location_options` (docs/04 suggested locations), `max_people`, `extra_person_fee`, `intake_extra_fields`.
- Portfolio-use opt-out (docs/04 §7) is a `[PLACEHOLDER]` decision. Proposed: a config flag `portfolio_opt_out_enabled`; when on, the form shows an optional "Don't use my images in your portfolio" checkbox. Question for Daniella: yes or no.
- Children's ages are PII about minors: collect ages only, never birthdates or school names.
- Questions for Daniella: final list of suggested locations; should Families ask about nap times (docs/03 §2)?

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
