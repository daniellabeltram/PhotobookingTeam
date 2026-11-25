# Admin (Daniella only, v1)

Used by one person, mostly on a laptop and sometimes on her phone (checking a shoot's details in the car). Design at 375px and 1024px. Tokens in `tokens.md`. Scannable first, pretty second.

## Global
- Header: wordmark, nav links "Bookings", "Blocked dates", "Add minis slots", and a "Sign out" button. At 375px the nav is a horizontally scrollable row of 44px links (no hamburger).
- One `h1` per page. Titles: "Bookings | Admin". Not indexed (`noindex`).
- Times always "Eastern Time" in the header of lists ("All times Eastern"), 12-hour.
- Status chips: icon + word, never color alone.

| Status | Chip text | Colors (from tokens) | Icon |
|---|---|---|---|
| requested | Requested | warning | clock |
| pending_deposit | Pending deposit | warning | hourglass |
| confirmed | Confirmed | success | check |
| completed | Completed | info | double check |
| cancelled | Cancelled | neutral | x |
| declined | Declined | neutral | x |
| expired | Expired | neutral | clock-off |
| rescheduled event | Rescheduled (tag on a booking with history) | neutral | arrows |

## 1. Login

**h1:** Admin sign in

```
375px
┌───────────────────────────────┐
│ [logo]                        │
│ Admin sign in                 │
│ Email                         │
│ [___________________________] │
│ Password                      │
│ [_______________________][Show]│
│ [ Sign in                   ] │
│  Forgot your password?        │
└───────────────────────────────┘
```
Fields and mechanism follow the architect's auth ADR (password, magic link or provider). If the chosen mechanism is passwordless, replace the password field with "We'll email you a sign-in link" and the button "Email me a link". Keep labels, errors and states below.
- Labels: "Email", "Password". Button "Sign in". Password has a "Show" toggle (`aria-pressed`).
- Errors (never reveal which part was wrong): "That email and password don't match. Please try again." Locked after repeated tries: "Too many attempts. Please wait 10 minutes and try again."
- Sending: "Signing in...". Session expired (redirect with notice): "You were signed out to keep things safe. Please sign in again." Offline: "We can't reach the server. Try again."
- Signed-in confirmation: lands on Bookings. Sign out returns here with "You're signed out."
- A11y: `autocomplete="username"` and `"current-password"`, errors in `role="alert"`, focus to the error. No CAPTCHA.

## 2. Booking list (home)

**h1:** Bookings

```
375px                               
┌───────────────────────────────┐
│ Bookings           [Export CSV]│
│ ┌ Filters ───────────────────┐│
│ │ Status [All ▾]  Type [All ▾]││
│ │ From [Dec 1]  To [Dec 31]  ││
│ │ Search name or email [____]││
│ │ [Apply]  Clear filters     ││
│ └────────────────────────────┘│
│ Upcoming (5)                  │
│ ┌───────────────────────────┐ │
│ │ Wed Dec 9 · 3:00 PM       │ │
│ │ Maya Torres               │ │
│ │ Families · 4 people       │ │
│ │ [✓ Confirmed]             │ │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ Thu Dec 10 · 8:00 AM      │ │
│ │ Sam & Lee                 │ │
│ │ Couples [⏳ Pending deposit]│ │
│ └───────────────────────────┘ │
│ Past (12)   [ Show past ]     │
└───────────────────────────────┘

1024px: same data as a table
Date & time | Client | Session | People | Status | Deposit | (row is a link)
```

- **Default view:** today and upcoming first, soonest on top, grouped "Today", "This week", "Later". Past bookings collapsed under "Past (N)" with button "Show past". Requests needing action ("Requested", "Pending deposit") show a count badge above the list: "2 need your attention" (links to filtered view).
- **Filters:** status (All, Requested, Pending deposit, Confirmed, Completed, Cancelled, Declined, Expired), session type, date range (From, To), search (name or email). Filters are in the **URL query string** and persist on reload and when pressing Back from detail. "Apply" button (and Enter in search); "Clear filters" link. Filter panel is a disclosure on mobile ("Filters (2)") with `aria-expanded`.
- **Row:** the whole row/card is a link to detail with accessible name "Wednesday, December 9, 3:00 PM, Maya Torres, Families, Confirmed". On the table, only the date cell is the link (stretched), avoiding nested interactive elements.
- **Sorting (table):** column buttons for Date and Client with `aria-sort`. Default Date ascending for upcoming.
- **Pagination:** 25 per page, "Previous / Next" links and "Showing 1 to 25 of 61" in `role="status"`.
- **Export CSV** button here (see 7).

**States**
- Loading: skeleton rows, `aria-busy`, "Loading bookings...".
- Empty (no bookings at all): "No bookings yet" / "When someone books, it will appear here." Empty with filters: "No bookings match these filters." + "Clear filters".
- Error: "We couldn't load bookings. Please try again." + "Try again".
- Success of a change elsewhere: toast on return "Maya Torres's booking is now Confirmed." (see below for toast a11y).

## 3. Booking detail

**h1:** "Maya Torres · Families" with chip, subtitle "Wednesday, December 9, 3:00 PM Eastern · Ref DBP-4K7Q2"

```
375px
┌───────────────────────────────┐
│ < All bookings                │
│ Maya Torres · Families        │
│ [⏳ Pending deposit]           │
│ Wed Dec 9, 3:00 PM ET · 60min │
│ Ref DBP-4K7Q2                 │
│                               │
│ [ Mark deposit paid ] (primary)│
│ [ Cancel booking ]  (secondary)│
│ ... (More actions ▾)          │
│                               │
│ Contact                       │
│ Email  maya@example.com  (link)│
│ Phone  (561) 555-0123  (link) │
│ Prefers: Text                 │
│                               │
│ Session                       │
│ Location  Downtown WPB        │
│ People    2 adults, 2 children│
│           0 pets              │
│ Names     Maya, Leo, Sofi, Max│
│                               │
│ Families details              │
│ Children's ages  3 and 7      │
│ Extended family  No           │
│                               │
│ Style & notes                 │
│ Style  Bright and airy        │
│ Must-haves  ...               │
│ Anything else ...             │
│ Heard about us  Instagram     │
│ Portfolio use  OK / Opted out │
│                               │
│ Payment                       │
│ Retainer $150 · Not yet paid  │
│ Held until Dec 7, 3:00 PM ET  │
│                               │
│ Policy                        │
│ Accepted v0.1-draft           │
│ Dec 4, 2026, 9:12 PM ET       │
│                               │
│ History                       │
│ Dec 4, 9:12 PM  Booked by     │
│  client (Pending deposit)     │
└───────────────────────────────┘
```

- **Layout:** 375px single column, sections as `h2` groups; at ≥1024px two columns (left: Contact, Session, Intake. Right: Payment, Policy, History), actions in a top bar.
- **Contact:** email is `mailto:`, phone `tel:`, both with 44px targets and visible text. Phone shown formatted, link target E.164.
- **Intake answers:** definition list (`dl`) with the same labels the client saw. Empty answers show "Not provided" in muted text. Sensitive notes (children's ages, accessibility) are plain text, never in the URL or page title. The tab title is "Booking DBP-4K7Q2 | Admin" (no names).
- **Payment:** retainer amount, "Not yet paid" or "Paid on Dec 5, 2026" (and who marked it), hold expiry for pending bookings. Link "Copy payment link" (copies the configured link).
- **History:** list of every status change: when, who (client, Daniella, system), from, to, optional note.
- **Actions** depend on status (shown as buttons, max one primary):

| Status | Actions available |
|---|---|
| Requested | **Approve request** (primary) · Decline |
| Pending deposit | **Mark deposit paid** (primary) · Cancel booking |
| Confirmed | **Mark completed** (primary, only once the session time has passed) · Cancel booking |
| Completed / Cancelled / Declined / Expired | none (read only), plus link "Back to bookings" |

  There is no Reschedule button in v1: Daniella applies the reschedule policy by hand (cancel with the note "Rescheduled" and rebook for the client). The "Rescheduled" chip stays in the design for when the tool arrives in v1.1.
- **Back:** "All bookings" link preserves the list filters (returns to the saved query string).

**States:** loading skeleton; not found "We can't find that booking." + "Back to bookings"; error "We couldn't load this booking." + "Try again".

**A11y:** headings in order (h1 name, h2 sections). The chip has real text. Action buttons are real `button`s; after an action, focus returns to the h1 and the toast announces the result.

## 4. Status actions and confirmation dialogs

Native `<dialog>` or an equivalent modal: `role="alertdialog"`, `aria-labelledby` heading, `aria-describedby` body, focus moves to the **safe** button ("Keep booking"), Esc closes, focus is trapped and returns to the triggering button on close, background inert. Buttons at least 48px, stacked on mobile, primary action last on desktop.

| Action | Dialog heading | Body | Buttons | Result toast |
|---|---|---|---|---|
| Mark deposit paid | Mark deposit as paid? | "{Name}'s {amount} retainer was received. Their booking becomes Confirmed and they'll get a confirmation email." | Mark as paid / Not yet | "Booking confirmed. Email sent to {first name}." |
| Approve request | Approve this request? | "{Name} will get an email with a link to pay the {amount} retainer. The time is held for 48 hours." | Approve / Not yet | "Request approved. Payment link sent." |
| Decline request | Decline this request? | "The time is released and {name} gets a polite email. You can add a note." + optional textarea "Note for the client (optional)" | Decline request / Keep request | "Request declined. {Name} has been emailed." |
| Mark completed | Mark session as completed? | "This moves it to Completed. You can't undo this." | Mark completed / Not yet | "Marked completed." |
| Cancel booking | Cancel this booking? | "This frees {Wed, Dec 9, 3:00 PM} so someone else can book it. {Name} gets a cancellation email. This can't be undone." + radio "Retainer": "Keep retainer" / "Refund retainer" (per policy table) + optional note | Cancel booking (destructive style: error color border, text "Cancel booking") / Keep booking | "Booking cancelled. The time is open again." |

- Every action: button shows "Working..." and is disabled during the request. On failure the dialog stays open with `role="alert"` message: "That didn't work and nothing was changed. Please try again." If the booking changed meanwhile (stale, 409): "This booking was updated by someone else. Reload to see the latest." + "Reload".
- Emails to the client on cancel or approve use the templates in `emails.md` (approve, deposit paid and cancel are short v1 transactional emails; copy for those is in the "Other transactional emails" section there).
- **Toasts:** `role="status"` region, visible 8 seconds minimum, dismissible, with pause on hover and focus, not the only place errors appear.

## 5. Blocked dates

**h1:** Blocked dates
**Intro:** Block days or hours when you're not available. Clients won't see these times.

```
375px
┌───────────────────────────────┐
│ Blocked dates                 │
│ Block days or hours when      │
│ you're not available.         │
│                               │
│ Add a block                   │
│ From date [Dec 24]            │
│ To date   [Dec 26]            │
│ [x] All day                   │
│ Start time [  ] End time [  ] │
│   (shown when All day is off) │
│ Reason (optional, private)    │
│ [Holiday travel___________]   │
│ [ Block these dates         ] │
│                               │
│ Upcoming blocks               │
│ Dec 24 to Dec 26 · All day    │
│ Holiday travel     [Remove]   │
│ Jan 9 · 8:00 to 11:00 AM      │
│ Dentist           [Remove]    │
└───────────────────────────────┘
```

- Labels: "From date", "To date", "All day" (checkbox, default on), "Start time", "End time", "Reason (optional, private)" with helper "Only you can see this." Button "Block these dates". Weather backup days use the reason field ("Weather backup").
- **Conflict check:** if existing active bookings fall in the range, before saving show a dialog: heading "Some bookings fall in this range", body "{N} bookings are already scheduled: {Maya Torres, Dec 24 3:00 PM; ...}. Blocking won't cancel them. You can still block, or go back to review them." Buttons "Block anyway" / "Go back". After saving the toast says "Dates blocked. {N} existing bookings were not changed."
- **Remove:** button "Remove block" with confirm dialog "Remove this block?" body "Clients will be able to book {Dec 24 to Dec 26} again." buttons "Remove block" / "Keep block".
- **Errors:** "Please pick a start date." · "The end date can't be before the start date." · "The end time must be after the start time." · "Please pick a date in the future" (only for fully past ranges).
- **States:** loading skeleton; empty list: "No blocked dates. Add one above when you need time off."; error "We couldn't load blocked dates." + "Try again". Success toast "Dates blocked. Clients won't see them."
- **A11y:** date inputs are native `type=date` and `type=time` (a native picker is the most accessible and mobile-friendly choice for one admin). Start/end time fields hidden (not just visually) when All day is checked. Remove buttons have accessible names "Remove block Dec 24 to Dec 26".

## 6. Add Holiday Minis slots (manually)

Needed because v1 has no mini-day generator (that is v1.1). Daniella adds mini days by hand.

**h1:** Add Holiday Minis slots
**Intro:** Create a mini-session day. We'll make back-to-back slots for you.

```
375px
┌───────────────────────────────┐
│ Add Holiday Minis slots       │
│ Date [Dec 6]                  │
│ Location [Phillips Point____] │
│ Theme (optional) [Winter__]   │
│ First start time [8:00 AM]    │
│ Number of slots [ 6 ]         │
│ Slot length   20 min          │
│ Buffer        10 min          │
│ (read-only, from settings)    │
│                               │
│ Preview                       │
│ 8:00, 8:30, 9:00, 9:30,       │
│ 10:00, 10:30 AM               │
│ Last session ends 10:50 AM    │
│                               │
│ [ Add these slots           ] │
│                               │
│ Upcoming mini days            │
│ Sat Dec 6 · 6 slots · 2 booked│
│ Phillips Point   [Remove]     │
└───────────────────────────────┘
```

- **Fields:** "Date", "Location", "Theme (optional)", "First start time", "Number of slots" (1 to 30). Slot length and buffer come from the Holiday Minis config and are shown read-only with helper "Change these in settings." (or "Ask your developer to change these" until a settings editor exists, v1.1).
- **Preview:** live list of generated start times and end of the last session (`aria-live="polite"`, updated on input after a short pause).
- **Add:** button "Add these slots". Result toast "6 Holiday Minis slots added for Saturday, December 6." Each slot becomes bookable immediately on the client calendar with the "X spots left" count.
- **Rules/errors:** "That date already has a mini day. Edit it instead." · "Please add a location." · "The first slot must be in the future." · "These slots overlap another booking at {time}. Choose another start time." · "Enter between 1 and 30 slots."
- **Remove:** "Remove mini day" is only enabled if no slot is booked. Otherwise helper "{N} slots are booked. Cancel those bookings first." Confirm dialog on remove: "Remove this mini day?" body "All {N} open slots will disappear for clients." buttons "Remove mini day" / "Keep it".
- **States:** loading, empty ("No mini days yet. Add one above."), error as other pages.
- **A11y:** same as Blocked dates. The preview is plain text, not a table.

## 7. CSV export

- Button "Export CSV" on the list (top right on desktop, below the title on mobile). Exports **the current filtered view** and the label shows it: "Export CSV (12 bookings)".
- While generating: button "Preparing..." (`aria-disabled`). Done: download starts, toast "Your CSV is ready. Check your downloads." Failure: "We couldn't create the file. Please try again."
- Empty filter result: button disabled with helper "Nothing to export."
- Helper under button (first time only, dismissible): "This file has client contact details. Store it somewhere private and delete it when you're done."
- Columns (suggested, UTC never: Eastern): Reference, Status, Session, Date, Start time (ET), End time (ET), Name, Email, Phone, People (adults, children, pets), Location, Deposit amount, Deposit paid (Yes/No), Policy version, Policy accepted at (ET), Intake extras, Notes, Created at (ET). Spreadsheet formula protection: cells starting with `=`, `+`, `-`, `@` are prefixed with a `'` (the frontend or server must do this).
- Filename `bookings-2026-12-01.csv`.

## Responsive and a11y summary
- Keyboard: every control reachable, visible focus ring, skip link "Skip to main content". Tables use real `th` with scope, `caption` visually hidden ("Bookings"). Dialogs follow the pattern in section 4.
- Phone and email are links. Chips contain text. Contrast per tokens. 200% zoom: table collapses to cards below 768px (CSS only).
- Session timeouts: a warning dialog is not required for v1; instead, on 401 the app preserves the current URL and returns there after sign in.
