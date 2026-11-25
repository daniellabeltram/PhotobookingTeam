# 001 — Session type picker
**Scope:** v1 (02 §1.1)      **Status:** ready      **Priority:** P0
**As a** client, **I want** to see each session type with its length, starting price, what's included and the deposit, **so that** I can choose the right session before I look at times.

## Acceptance criteria
1. **Given** the session type config has the five types (Portraits, Couples, Families, Events, Holiday Minis) all `active`, **When** a client opens the booking page, **Then** one card per type is shown, each with its `name`, `description`, `duration_min` (as a length, e.g. "60 minutes"), `price_from`, the included items, and the deposit text derived from `deposit`.
2. **Given** a type's `deposit` is a flat amount, **When** its card is shown, **Then** it reads as that amount (e.g. "$[deposit] non-refundable retainer to book"). **Given** it is a percent, **Then** it reads as "[n]% of estimated total". **Given** it is `full`, **Then** it reads as "Paid in full at booking".
3. **Given** a type has `active: false`, **When** the page loads, **Then** that card is not shown and that type cannot be booked by URL either (the client sees "This session isn't available to book right now" with a link back to the picker).
4. **Given** Holiday Minis is active but no open mini slot exists in the future (see story 003), **When** the page loads, **Then** the Minis card shows "No mini dates open right now" and its select action is disabled; **Given** open mini slots exist, **Then** the card shows the next mini date(s).
5. **Given** a client selects a card, **When** the selection is made, **Then** the client moves to the date-and-time step for that type and the chosen type, length and price stay visible on the following steps.
6. **Given** a link with a session type preselected (for example from Instagram, `?type=families`), **When** it is opened, **Then** the picker is skipped and the client lands on the date step for that type; **Given** the type in the link is unknown or inactive, **Then** the client sees the full picker with no error page.
7. **Given** a developer changes `price_from` or `description` for a type in the config file, **When** the site is redeployed, **Then** the card shows the new value with no code change.
8. **Given** the config cannot be loaded, **When** the page loads, **Then** the client sees "Booking is temporarily unavailable. Please try again or contact Daniella at [contact email]" and no partial or empty cards.
9. **Given** a 375px-wide viewport, **When** the picker is shown, **Then** all cards are readable without horizontal scrolling and each card's select target is at least 44×44 CSS px.

## Out of scope
- Editing session types in the admin page (v1.1).
- Add-ons, packages or promo codes (later).

## Notes / open questions
- [PLACEHOLDER] values used: `duration_min`, `price_from`, `deposit`, included items, `active` for all five types (docs/04 §1).
- Events show `price_from` as a per-hour rate with the minimum length ("from $[price_from]/hour, [duration_min] minimum").
- Events have `booking_mode: request` (decided by Daniella 2026-11-25, story 020). The Events card should say "Request to book — Daniella replies within [request_response_days] days", and its select action should read "Request this date" or similar, so the client knows before they start (ux-designer to finalise the copy).
- Questions for Daniella: final card descriptions and "what's included" wording.

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
