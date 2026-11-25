# Booking flow (client, v1)

Mobile first, designed at **375px**. Single column, max width 560px centered on larger screens. Tokens in `tokens.md`. All prices, lengths and deposits below are `[PLACEHOLDER]` values from `docs/04-booking-policies.md`; show whatever the config says (written `{price}`, `{deposit}` etc.).

## Global rules

- **Page:** `<html lang="en">`. One `h1` per step (the step heading). On every step change, move focus to the new `h1` (`tabindex="-1"`) and update `document.title` ("Choose your date | Daniella Beltram Photography").
- **Header:** small wordmark `[PLACEHOLDER logo]` linking to daniellabeltram.photography. No other navigation.
- **Step indicator:** text first, dots second. "Step 2 of 5 · Date and time". Rendered as `<ol>` with `aria-label="Booking progress"`; current item `aria-current="step"`. Completed steps show a check and are not clickable (Back button only), keeps it simple and safe.
- **Back:** every step except 1 has a text button "Back" at the top left (44px target) and the browser Back button works (each step is a history entry, `?step=` or a hash). Back never clears entries: session type, chosen slot and all intake answers are kept in memory (and `sessionStorage`, wrapped in try/catch) until the booking is sent or the tab closes. Changing session type on step 1 clears the chosen slot only (availability differs), and shows a note "We cleared your time because it belongs to a different session. Please pick again."
- **Buttons:** primary action at the bottom of the content, full width. While sending, label changes and the button is `aria-disabled` (not removed from the tab order): "Booking..." 
- **Errors:** inline beside the field plus an error summary at the top of the form after a failed submit. Summary is a `role="alert"` region with a heading and links to each field; focus moves to it.
- **Timezone:** always say "Eastern Time" next to times. Display `3:00 PM` format.
- **Offline / timeout (any step that calls the server):** banner, `role="alert"`: "We can't reach the server. Check your connection and try again." with button "Try again". Entered data stays.
- **Spam:** honeypot field (hidden from sighted users and AT: `aria-hidden`, `tabindex="-1"`, off-screen), no visible CAPTCHA in v1.

---

## Step 1: Session type

**h1:** Choose your session
**Intro:** Pick the experience that fits. You'll choose a date next.

```
375px
┌───────────────────────────────┐
│ [logo]  Daniella Beltram      │
│ Step 1 of 5 · Session         │
│ ●───○───○───○───○             │
│                               │
│ Choose your session           │
│ Pick the experience that      │
│ fits. You'll choose a date    │
│ next.                         │
│                               │
│ ┌───────────────────────────┐ │
│ │ [photo placeholder 16:9]  │ │
│ │ Families                  │ │
│ │ 60 min · from $450        │ │
│ │ $150 retainer holds       │ │
│ │ your date                 │ │
│ │ Best for: all ages, up to │ │
│ │ 6 people                  │ │
│ │ Includes: 1 location,     │ │
│ │ about 40 edited images    │ │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ Holiday Minis    [3 days  ]│ │
│ │ 20 min · $225 · paid in   │ │
│ │ full to book              │ │
│ │ ...                       │ │
│ └───────────────────────────┘ │
│  (Portraits, Couples, Events) │
│                               │
│ [ Continue                  ] │
└───────────────────────────────┘
```

- **Cards:** one per active type, order: Portraits, Couples, Families, Events, Holiday Minis (Minis first while the season is open). Photo is a `[PLACEHOLDER]` gray box with alt text empty (decorative) because the title says it all.
- **Card content:** name (h2), length, "from $X" (Events: "from $250 per hour, 2 hour minimum"), deposit line, "Best for", "Includes".
- **Deposit line:** "{deposit} retainer holds your date" · Holiday Minis: "Paid in full to book" · Events: "50% retainer after approval".
- **Events badge:** "Request to book". **Minis badge:** "Limited spots" (and "Sold out" if none).
- **Selecting:** tap a card selects it (selected style) and enables Continue. Cards are a `role="radiogroup"` with `role="radio"` items (arrow keys move, Space selects), group labelled by the h1. Selecting does not auto-advance (avoids accidental taps).
- **Button:** "Continue" (disabled until selected, uses `aria-disabled` plus helper "Choose a session to continue" read on focus).

**States**
- Loading: three skeleton cards, `aria-busy="true"` on the list, visually hidden text "Loading sessions".
- Empty (no active types or none open): heading "Bookings are paused right now", body "Please check back soon, or email {studio email} and we'll sort something out."
- Minis, not in season: Minis card hidden.
- Error: "We couldn't load the sessions. Please try again." + "Try again".

**A11y:** the whole card is the hit area; name, length, price, deposit all inside the radio's accessible name or description (`aria-describedby`). Badge text is real text. Keyboard: Tab to group, arrows to move.

---

## Step 2: Date and time

**h1:** Pick a date and time
**Summary strip (top, always visible):** "Families · 60 min · from $450" with link "Change" (back to step 1).
**Helper:** "All times are Eastern Time. Only open times are shown."

```
375px
┌───────────────────────────────┐
│ < Back                        │
│ Step 2 of 5 · Date and time   │
│ ●───●───○───○───○             │
│ Families · 60 min · from $450 │
│                  Change       │
│ Pick a date and time          │
│ All times are Eastern Time.   │
│                               │
│ <   December 2026   >         │
│ Su Mo Tu We Th Fr Sa          │
│        1  2  3  4  5          │
│  6  7  8 [9] 10 11 12         │
│ 13 14 15 16 17 18 19          │
│ (open days: bold + dot;       │
│  unavailable: grey, no dot)   │
│                               │
│ Wednesday, December 9         │
│ 3 times available             │
│ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │7:30AM│ │8:00AM│ │5:00PM│    │
│ └──────┘ └──────┘ └──────┘    │
│                               │
│ [ Continue                  ] │
└───────────────────────────────┘
```

- **Calendar:** month grid, week starts Sunday. Open days: bold number plus a dot under it; unavailable days: muted number, no dot, `aria-disabled`. Today is outlined, selected day filled primary with white text and a check. Month navigation: "Previous month" and "Next month" buttons (44px), previous disabled at the current month and next disabled beyond the booking window. Past dates and days inside the minimum notice are unavailable.
- **Time list:** appears below the calendar after a day is chosen (focus stays on the day; the list is announced). Buttons 48px high, 3 columns on 375px, label `7:30 AM`. Selected time: filled primary plus check. Times are a `role="radiogroup"` labelled "Available times on Wednesday, December 9, Eastern Time".
- **Holiday Minis:** the calendar shows only mini days. Day heading adds "6 spots left" (and "Last spot!" at 1). Time buttons show a tiny second line "6 left" is not needed per slot; show the day count only. Auto-select the first mini day if there is only one. Minis flow is the fastest: step 2 shows a summary "Holiday Minis · 20 min · $225, paid in full" and the date and times in a single scroll with no month switching if only one month is open.
- **Events:** subtitle "This is a request. Daniella will confirm within {2 business days} `[PLACEHOLDER]`." Times are start times; duration picker (select) "How long do you need? (2 hours minimum)" with 2, 3, 4, 5, 6 hours, and slots are re-queried per duration.
- **Button:** "Continue" (disabled until a time is picked). After selecting a time, a live summary appears above the button: "You chose Wednesday, December 9 at 3:00 PM Eastern."

**States**
- Loading: calendar skeleton, `aria-busy`. Day times load on day select: list shows "Loading times..." in `role="status"`.
- Empty month: below the grid, "No openings in {Month}. Try {next month with openings}." as a button "See {Month}". If the entire window is empty: heading "No openings right now", body "New dates are added often. Email {studio email} and Daniella will help you find a time." and button "Back to sessions".
- Day has no times left (became full while open): "That day just filled up. Please pick another date."
- Error loading: "We couldn't load available times. Please try again." + "Try again".
- Back from step 3 keeps the chosen date, time and month shown.
- The time is **not held** until step 4 submit (v1 simplification); say nothing but handle slot-just-taken at submit (below).

**A11y: keyboard calendar** (ARIA grid pattern)
- Calendar is `role="grid"` with a caption (the month name, `aria-live="polite"` so month changes are announced). One tab stop in the grid (roving `tabindex`).
- Arrow Left/Right: previous/next day. Up/Down: previous/next week. Home/End: start/end of week. PageUp/PageDown: previous/next month (Shift for year not needed). Enter or Space selects. Arrow movement across unavailable days is allowed (they are focusable with `aria-disabled="true"`), selection is not.
- Each day's accessible name: "Saturday, December 6, 3 times available" or "Sunday, December 7, unavailable". Selected: `aria-selected="true"`.
- After selecting a day, a polite live region says "3 times available on Wednesday, December 9" and Tab from the grid goes to the first time button.
- Do not rely on the dot; the accessible name carries availability. Reduced motion: no month slide animation.

---

## Step 3: Intake

**h1:** Tell us about your session
**Intro:** A few quick questions so Daniella can plan the perfect shoot. Takes about 2 minutes.
**Summary strip:** "Families · Wed, Dec 9, 3:00 PM ET" with "Change".

```
375px
┌───────────────────────────────┐
│ < Back                        │
│ Step 3 of 5 · Your details    │
│ ●───●───●───○───○             │
│ Families · Wed Dec 9, 3:00 PM │
│                               │
│ Tell us about your session    │
│                               │
│ About you                     │
│ Full name                     │
│ [___________________________] │
│ Email                         │
│ [___________________________] │
│ Mobile phone                  │
│ [___________________________] │
│ We'll only text about your    │
│ session.                      │
│ Best way to reach you         │
│ (•) Email ( ) Text ( ) Call   │
│                               │
│ Your session                  │
│ Who's being photographed?     │
│ [___________________________] │
│ How many people?              │
│ Adults [ 2 ] Children [ 2 ]   │
│ Pets [ 0 ]   (steppers)       │
│ Where would you like to meet? │
│ (•) Pick a favorite spot      │
│ ( ) Enter my own              │
│ ( ) Help me choose            │
│ [ select: spots ▾ ]           │
│ ... type-specific fields ...  │
│ Style and mood (optional)     │
│ [_ multi-line _]              │
│                               │
│ [ Continue                  ] │
└───────────────────────────────┘
```

### Fields

Labels above fields. Optional fields end in "(optional)". Required fields are not starred. Inputs 16px+, correct `type`, `autocomplete` tokens.

**Group "About you"** (fieldset + legend)

| Field | Type / attributes | Label | Helper | Error messages |
|---|---|---|---|---|
| Full name | text, `autocomplete="name"`, max 100 | Full name | | "Please enter your name." |
| Email | `type=email`, `autocomplete="email"` | Email | "Your confirmation goes here." | Empty: "Please enter your email." Invalid: "That email doesn't look right. Check for typos." |
| Mobile phone | `type=tel`, `inputmode=tel`, `autocomplete="tel"` | Mobile phone | "In case we need to reach you on the day." | "Please enter a phone number we can reach, like (561) 555-0123." |
| Preferred contact | radios | Best way to reach you | | "Please choose one." (default: Email preselected) |

**Group "Your session"**

| Field | Type | Label | Helper | Error |
|---|---|---|---|---|
| Names | textarea 2 rows, max 300 | Who's being photographed? | "First names are perfect." | "Please tell us who's coming." |
| Counts | 3 number steppers (adults min 0, children min 0, pets min 0), total people shown "4 people" | Adults / Children / Pets | Shows limit for session type, e.g. "Up to 6 people. Extra people are $25 each." (Families) | "This session fits up to {max} people. Please lower the number or email us for a larger group." / "Please add at least one person." |
| Location choice | radios | Where would you like to meet? | | "Please choose an option." |
| - Favorite spot | select, options from config `[PLACEHOLDER]`: Downtown West Palm Beach waterfront, Palm Beach Island (Worth Avenue area), Local beach (sunrise sessions), My home | Choose a spot | "Beach sessions are best near sunrise." | "Please pick a spot." |
| - My own | text | Address or place name | "Some venues need a permit. That fee is yours." | "Please enter a location." |
| - Help me choose | (no field) | | "Great, Daniella will suggest her favorites after you book." | |
| Style notes | textarea | Style and mood (optional) | "Bright and airy, golden hour, candid, editorial... anything goes." | |
| Must-have shots | textarea | Must-have photos or groupings (optional) | "Grandma with all the grandkids, a special place..." | |
| Anything else | textarea | Anything else we should know? (optional) | "Shy kids, mobility needs, sensory needs, allergies. Anything that helps." | |
| Referral | select | How did you hear about us? (optional) | | |
| Portfolio opt-out | checkbox | Please don't share my photos in Daniella's portfolio or marketing (optional) | "You can change your mind later." `[PLACEHOLDER pending Daniella decision]` | |

Referral options: Instagram, Google, A friend or family, Previous client, Other.

**Conditional groups** (inserted after "Your session" counts and location; each in its own fieldset with legend)

| Session | Fields |
|---|---|
| **Portraits** | none extra. (Max 2 people.) |
| **Couples** | "What's the occasion?" select: Engagement, Anniversary, Just because, Other (required). "Is this a surprise proposal?" radio Yes / No (required), helper when Yes: "Lovely! We'll keep it between us. Daniella will only message you, not your partner." |
| **Families** | "Children's ages" text (required if children > 0), helper "For example: 3 and 7." error "Please tell us your children's ages." "Will pets join?" is covered by the Pets count (no extra field). "Will extended family join?" radio Yes / No (required), helper "Groups over 6 are $25 per extra person." |
| **Events** | "Event name" text (required). "Type of event" select: Birthday, Shower, Corporate, Celebration, Other (required). "Venue name and address" text (required). "Start time" and "End time" time fields (required, helper "Your session starts and ends at these times.", error "End time must be after start time."). "Expected guests" number (required). "On-site contact name and phone" text (optional). "Timeline or must-have moments" textarea (optional), helper "Cake cutting at 4, toast at 5..." The date/time chosen in step 2 prefills start time. |
| **Holiday Minis** | **Short form only.** Hide: Pets stepper reduces to "Pets (optional)", hide Preferred contact (default Email), hide Style, Must-have shots, Referral and Portfolio opt-out under a disclosure "More details (optional)". Add: "Do you need your photos by a card deadline?" text (optional), helper "We'll do our best to get them to you in time." Locations are fixed (mini day location, shown as text, not a choice). |

**Behavior**
- Validate on blur, show the error inline; re-validate on input once an error is showing. On Continue with errors: error summary at top ("Please fix 2 things to continue"), focus goes to the summary, each link jumps to the field. Server validation errors map to the same fields.
- Preserved on Back. Fields are not cleared when switching location choice (hidden fields keep values but are not submitted).
- Button: "Continue". 

**States**
- Loading: none (all local). Saving draft is local only.
- Error (offline/timeout): global banner as above, not applicable until step 4 submit.
- Success: advances to step 4.

**A11y:** each group is a `fieldset` with `legend`; radios grouped; steppers are real `type=number` inputs with visible - and + buttons labelled "Fewer adults"/"More adults" (44px) that update a polite live total "4 people". Errors: `aria-invalid="true"`, `aria-describedby` pointing to helper and error ids, error text starts with an icon (decorative) plus text, not color only. Conditional fields appearing: announce via `aria-live="polite"` region "Questions for Families sessions added." (only on change). Use `autocomplete` tokens (name, email, tel, street-address). Honeypot hidden from AT.

---

## Step 4: Policies

**h1:** Almost done. Please review our policies
**Intro:** Here's what to expect. No surprises.

```
375px
┌───────────────────────────────┐
│ < Back                        │
│ Step 4 of 5 · Policies        │
│ ●───●───●───●───○             │
│                               │
│ Almost done. Please review    │
│ our policies                  │
│                               │
│ Your booking                  │
│ ┌───────────────────────────┐ │
│ │ Families, 60 min          │ │
│ │ Wed, December 9, 3:00 PM  │ │
│ │ Eastern Time              │ │
│ │ Downtown West Palm Beach  │ │
│ │ 4 people                  │ │
│ │ From $450                 │ │
│ │ Retainer due: $150        │ │
│ └───────────────────────────┘ │
│  Edit details                 │
│                               │
│ Before you book              │
│ - A $150 retainer holds your  │
│   date and goes toward your   │
│   session fee. It's           │
│   non-refundable.             │
│ - Reschedule once for free up │
│   to 7 days before.           │
│ - Weather reschedules are     │
│   always free.                │
│ - Cancelling within 48 hours  │
│   forfeits the retainer and   │
│   50% of the balance.         │
│ [v Read the full policies]    │
│                               │
│ [ ] I have read and agree to  │
│     the booking, cancellation │
│     and weather policies.     │
│                               │
│ [ Book my session           ] │
└───────────────────────────────┘
```

- **Booking summary card:** read-only, with a text button "Edit details" (goes to step 3) and "Change date" (step 2). Shows exactly what was chosen. Times with "Eastern Time".
- **Summary bullets:** generated from config values, so numbers always match the full text (docs/04 summary). Template: "A non-refundable **{deposit}** retainer holds your date and goes toward your session fee. You can reschedule once for free up to **{7} days** before your session. Weather reschedules are always free. Cancellations within **{48 hours}** forfeit the retainer and {50%} of the balance."
- **Variants:** Holiday Minis: "Holiday Minis are **paid in full** (${price}) to book. If weather stops us, you'll get the rain date. Swapping to another open slot is possible, but no refunds." `[PLACEHOLDER]` Events: "This is a request. You won't be charged now. If Daniella approves, you'll get a link for the **{50%}** retainer. Cancelling within 30 days of the event forfeits the retainer and 50% of the balance."
- **Full text:** disclosure button "Read the full policies" (`aria-expanded`), expands inline (not a new tab) with the complete versioned text, plus link "Open in a new page" (opens policy page, `rel="noopener"`, labelled "(opens in new tab)"). Also a link "Privacy notice".
- **Checkbox:** unchecked by default, 24px box with a 44px label hit area. Label (full sentence): "I have read and agree to the booking, cancellation and weather policies."
- **Error (not checked):** "Please agree to the policies to book your session." Linked via `aria-describedby`; focus moves to the checkbox.
- **Button:** "Book my session" (Events: "Send my request"; Minis: "Book my mini"). Sending: "Booking..." and the button stays focusable but ignores taps (`aria-disabled`, prevents double submits; an idempotency key is sent by the app).
- **Under button, small:** "Next, you'll get a link to pay your retainer. Your time is held for 48 hours." `[PLACEHOLDER hours]` (Events: "Daniella will reply within 2 business days." Minis: "Next, you'll pay in full to secure your spot.")
- The policy version and the acceptance time are stored (not shown).

**States**
- Sending: button "Booking...", form inert except the status. `role="status"` "Booking your session...".
- **Slot just taken (server 409):** same step stays, replaced at the top by an alert, and the checkbox and details are kept:

```
┌───────────────────────────────┐
│ ⚠ That time was just booked   │
│ Someone grabbed it a moment   │
│ ago. Here are the closest     │
│ open times:                   │
│ ┌────────┐ ┌────────┐         │
│ │Dec 9   │ │Dec 9   │         │
│ │4:30 PM │ │5:00 PM │         │
│ └────────┘ └────────┘         │
│ ┌────────┐                    │
│ │Dec 10  │   [ See all dates ]│
│ │3:00 PM │                    │
│ └────────┘                    │
└───────────────────────────────┘
```
  Heading: "That time was just booked". Body: "Someone grabbed it a moment ago. Here are the closest open times:" Up to 4 alternatives as buttons "Wed, Dec 9 · 4:30 PM". Tapping one swaps the slot, updates the summary, shows "Time updated to Wed, Dec 9 at 4:30 PM ET." in `role="status"`, and focus returns to the "Book my session" button (the checkbox stays checked; client taps again). "See all dates" returns to step 2. If no alternatives: "No other times are open on nearby days. Pick another date" + button "Choose another date".
- **Other server errors:** "Something went wrong and your booking wasn't saved. Nothing was charged. Please try again." + "Try again". The idempotency key makes a retry safe. If the response was lost (timeout): "We're not sure if that went through. Check your email for a confirmation before trying again." plus "Try again".
- **Rate limited:** "You've tried a few times. Please wait a minute and try again."
- **Validation (server):** shows an error summary and returns to step 3 with errors on fields.

**A11y:** the summary card is a `dl`. The checkbox is a native input. The alert for slot taken is `role="alert"` and takes focus. The expand/collapse is a button with `aria-expanded` and `aria-controls`. No time limit on this page.

---

## Step 5: Confirmation

**h1 (instant types):** You're booked, {first name}!  (one exclamation mark)
**h1 (Events request):** Request sent
**h1 (Minis, after payment):** Your mini is booked

```
375px
┌───────────────────────────────┐
│ Step 5 of 5 · Done            │
│ ●───●───●───●───●             │
│                               │
│ ✓ You're booked, Maya!        │
│ A confirmation is on its way  │
│ to maya@example.com.          │
│                               │
│ ┌───────────────────────────┐ │
│ │ Families session          │ │
│ │ Wednesday, December 9     │ │
│ │ 3:00 PM Eastern Time      │ │
│ │ (60 min)                  │ │
│ │ Downtown West Palm Beach  │ │
│ │ Reference: DBP-4K7Q2      │ │
│ └───────────────────────────┘ │
│                               │
│ Next step: secure your date   │
│ Pay your $150 retainer within │
│ 48 hours to keep this time.   │
│ [ Pay my retainer           ] │
│                               │
│ [ Add to calendar (.ics)    ] │
│                               │
│ What to wear and bring        │
│ - Solid, coordinating colors  │
│ - Comfortable shoes you can   │
│   walk in                     │
│ - Water for little ones       │
│ Need to change something?     │
│ Reply to your email or write  │
│ {studio email}.               │
└───────────────────────────────┘
```

- **Content order:** heading and email note, booking card, next step (deposit) card, add to calendar, tips, help line.
- **Booking card** is a `dl`: Session, Date, Time (with "Eastern Time"), Length, Location (or "Daniella will suggest spots by email" for Help me choose), Reference. Reference is selectable text with a button "Copy reference".
- **Deposit block (Pending deposit):** heading "Next step: secure your date". Body: "Your time is held for 48 hours `[PLACEHOLDER]`. Pay your {deposit} retainer to confirm it. It goes toward your session fee." Button "Pay my retainer" (opens the payment link in a new tab, labelled "(opens in new tab)"). Small: "Paid already? Daniella will confirm within a day."
  - Minis: "Pay {price} to secure your spot." Button "Pay now". Holding note the same.
  - If the payment link is missing (config problem): "Daniella will email your payment link shortly." (no button).
- **Events request variant:** card heading "Your request is with Daniella". Body: "She'll reply within 2 business days `[PLACEHOLDER]`. If it's a yes, you'll get a link for your retainer. Your time isn't confirmed until then." No payment button.
- **Add to calendar:** button "Add to calendar" downloads the `.ics` (see emails.md). Also stated "(.ics file)". Title/description identical to the email's.
- **Tips:** short list tailored by session type (see emails.md). Keep to 3 bullets on screen with link "More tips are in your email".
- **Not-in-flow:** no Back button here. Link "Book another session" (text link) resets state. Browser Back from here goes to step 4 and shows "This booking is already made. Start a new booking?" with button "Start a new booking" (prevents duplicates).
- **Reload:** the page can be reloaded using the reference (stored in URL `?ref=` is **not** used, avoid PII; confirmation state kept in `sessionStorage`; if empty: heading "Looking for your booking?" body "Check your email for your confirmation and reference number." button "Book a session").
- **Email failed (server could not send):** a notice "We couldn't send your email just yet. Save your reference: DBP-4K7Q2. Daniella has your booking." role="status". The booking is still valid.

**States**
- Loading: none beyond step 4 sending.
- Success: this page. A11y: `h1` receives focus on arrival; a polite status "Booking confirmed" is announced; the check icon is decorative (`aria-hidden`), the heading says it all. Links open in new tabs have visible text "(opens in new tab)". The buttons are 48px. The page has no auto-redirects or time limits.

---

## Copy quick reference

| Where | Text |
|---|---|
| Primary buttons | Continue · Book my session · Send my request · Book my mini · Pay my retainer · Add to calendar |
| Secondary | Back · Change · Edit details · Try again · See all dates |
| Generic error | "Something went wrong. Please try again." |
| Required empty | "Please enter your {thing}." |
| Offline | "We can't reach the server. Check your connection and try again." |
| Tone | Warm, short, confident. Max one exclamation mark per screen. Never "Submit". |
