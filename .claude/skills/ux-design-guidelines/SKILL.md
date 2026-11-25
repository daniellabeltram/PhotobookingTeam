---
name: ux-design-guidelines
description: "UX, UI copy and accessibility rules for the booking flow and admin page: mobile-first layout, form design, calendar patterns, states, tone of voice, WCAG 2.1 AA checklist. Use when designing, building or reviewing any screen."
user-invocable: false
---

# UX design guidelines

## Principles
1. **Phone first.** Design at 375px wide, then scale up. Tap targets must be at least 44×44px.
2. **One decision per screen.** Show progress ("Step 2 of 4"). Back never loses what the client entered.
3. **No surprises.** Show price, length and deposit before the date step. Show a policy summary before the client submits.
4. **The confirmation should feel like a gift.** It's a clear summary, with an add-to-calendar button and what to wear and bring.

## Booking flow patterns
- **Session cards:** photo placeholder, name, length, "from $X", deposit, and a one-line "best for".
- **Calendar:** open days are clearly marked and unavailable days are visibly disabled. Selecting a day lists its times as buttons, labeled in Eastern time ("All times Eastern"). Holiday Minis show "X spots left".
- **Intake form:** single column. Labels sit above fields (never placeholder-only). Use the correct input types (`email`, `tel`). Validate inline on blur. Conditional fields appear only for the relevant session type. Mark optional fields "(optional)" rather than marking required ones.
- **Location:** "Choose a favorite spot", "Enter your own", or "Help me choose".
- **Policies:** a short summary with an expandable full text. The checkbox is unchecked by default and its label is a full sentence.
- **Errors:** say what happened and what to do next. "That time was just booked. Here are the closest open times."

## Admin patterns
- Show today and upcoming first, with status chips (Pending deposit, Confirmed, Completed, Cancelled, Rescheduled).
- Filters by date range, type and status persist in the URL.
- The detail view groups contact, session, intake answers and policy acceptance. Phone and email are tap-to-call and tap-to-email.
- Destructive actions (cancel) need confirmation and say what happens to the slot.

## Every screen defines these states
Loading, empty, error, success, and offline or timeout where relevant.

## Tone of voice
Warm, short and confident. Use second person and plain words. One exclamation mark at most per screen. Avoid "Submit" in favor of "Book my session".

## WCAG 2.1 AA checklist
- [ ] Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI components)
- [ ] Everything works by keyboard, with a visible focus ring and logical tab order
- [ ] Every input has a programmatic label. Errors are linked with `aria-describedby` and announced
- [ ] The calendar is navigable by arrow keys, and dates have accessible names ("Saturday, December 6, 3 times available")
- [ ] Color is never the only signal (status chips have text)
- [ ] `prefers-reduced-motion` is respected, and content zooms to 200% without loss
- [ ] Page language is set, headings are in order, and there is one `h1` per page
