# 019 — Accessibility and mobile baseline
**Scope:** v1 (02 Platform; project-context hard constraints)      **Status:** ready      **Priority:** P0 (cross-cutting: applies to every client and admin screen)
**As a** client on a phone, possibly using a screen reader or larger text, **I want** to book without obstacles, **so that** anyone can book in under 5 minutes.

## Acceptance criteria
1. **Given** every client screen (picker, calendar, intake, policies, confirmation, privacy) and every admin screen, **When** checked with an automated accessibility scanner, **Then** there are zero serious or critical WCAG 2.1 AA violations.
2. **Given** a 375px-wide viewport, **When** any screen is shown, **Then** there is no horizontal page scroll and no content is cut off.
3. **Given** any tappable control, **When** measured, **Then** its target is at least 44×44 CSS px.
4. **Given** keyboard only, **When** a tester books a session end to end, **Then** every step can be completed, focus order follows the visual order, focus is always visible, and there is no keyboard trap.
5. **Given** VoiceOver on iOS Safari and TalkBack on Android Chrome, **When** a tester books a session, **Then** every field, time slot and button is announced with its label and state (e.g. "5:30 pm ET, available" / "selected"), and errors and the conflict message are announced.
6. **Given** text, **When** measured, **Then** contrast is at least 4.5:1 for body text and 3:1 for large text and UI component boundaries.
7. **Given** browser zoom at 200% or the OS large-text setting, **When** used, **Then** all content and controls remain usable without overlapping.
8. **Given** information conveyed by colour (status badges, available vs unavailable dates), **When** viewed, **Then** it is also conveyed by text or icon.
9. **Given** the current versions of iOS Safari and Android Chrome (plus current desktop Chrome, Safari, Firefox, Edge for admin), **When** the end-to-end booking is run, **Then** it works on each.
10. **Given** a mid-range phone on a throttled 4G profile, **When** the booking page is first opened, **Then** the session type cards are visible and usable within 3 s.
11. **Given** 5 test users on phones who have not seen the app, **When** asked to book a Families session, **Then** the median time from landing page to confirmation is under 5 minutes (docs/01 goal).

## Out of scope
- WCAG AAA. Spanish translation (later).

## Notes / open questions
- ux-designer owns the patterns (`ux-design-guidelines`); qa-tester runs the checks before sign-off on each story.

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
