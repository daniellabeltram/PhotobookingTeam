# Emails and calendar file (v1)

Plain-text friendly: short paragraphs, no tables, links written out in full too. Send both an HTML version (simple, single column, tokens from `tokens.md`) and a text version. HTML has real text, alt text on images, and 16px+ type. Values in `{braces}` come from config or the booking. `[PLACEHOLDER]` marks business values still waiting on Daniella.

**Sender:** "Daniella Beltram Photography" `[PLACEHOLDER: address from Daniella]`. Reply-to is Daniella. All times "Eastern Time" in the same format as the confirmation screen and admin.

## 1. Client confirmation email (booking made, deposit due)

**Subject:** Your {session} session is booked: {Wed, Dec 9} at {3:00 PM}
**Preheader:** One quick step to hold your date.

```
Hi {first name},

Thank you for booking with me. I'm so excited to photograph you!

YOUR SESSION
{Families} session ({60} min)
{Wednesday, December 9, 2026} at {3:00 PM} Eastern Time
Where: {Downtown West Palm Beach waterfront}
Booking reference: {DBP-4K7Q2}

ONE QUICK STEP: HOLD YOUR DATE
Your time is held for {48 hours} `[PLACEHOLDER]`. To keep it, pay your
{$150} retainer here:
{payment link}
The retainer goes toward your session fee. Once I receive it, I'll send
a final "you're confirmed" note. (Already paid? Thank you, I'll confirm
within a day.)

ADD IT TO YOUR CALENDAR
The invite is attached (.ics). Open it to add the session.

WHAT TO WEAR AND BRING
{tips for the session type, 3 to 5 bullets, see below}

NEED TO CHANGE SOMETHING?
Reschedule free up to {7} days before your session by replying to this
email. Weather reschedules are always free; I'll decide by
{9:00 AM on the day} and let you know.
Policies you agreed to (version {v0.1-draft}): {link}

See you soon,
Daniella
Daniella Beltram Photography
West Palm Beach, Florida
daniellabeltram.photography
```

**Variants (swap the highlighted blocks)**
- **Holiday Minis:** Subject "Your Holiday Mini is booked: {Sat, Dec 6} at {8:00 AM}". Block "ONE QUICK STEP": "Mini sessions are paid in full to book. Your spot is held for {48 hours}. Pay {$225} here: {link}". Add: "Minis run on a tight schedule, so please arrive 5 minutes early. Rain date: {Dec 13} `[PLACEHOLDER]`."
- **Events (request received, no payment yet):** Subject "We got your event request for {Sat, Jan 17}". Replace the booking and deposit blocks with: "I've received your request for {event name} on {date} at {time} Eastern Time. I'll reply within {2 business days} `[PLACEHOLDER]`. If it's a yes, I'll send a link for the {50%} retainer to lock in your date. Your time isn't confirmed until then."
- **Retainer paid (sent when Daniella marks deposit paid, or on approved flow):** see section 3.

### What to wear and bring (by session type) `[PLACEHOLDER copy for Daniella to edit]`

**Portraits**
- Choose 2 outfits you feel like yourself in. Solid colors and simple textures photograph best.
- Comfortable shoes you can walk in (we may move around).
- Bring water, lip balm and a hairbrush or small mirror.

**Couples**
- Coordinate, don't match: pick colors that sit well together, like cream and olive.
- Wear something you can move and hug in.
- Eat something light beforehand so you're relaxed.

**Families**
- Pick one color palette (2 to 4 colors) and let everyone choose within it. Skip large logos.
- Bring snacks and a favorite toy for little ones, plus water.
- Plan for naps and meals before the session so everyone is in a good mood.

**Events**
- Share your timeline and must-have moments by reply so I can plan.
- Tell me about any decor or details you want captured, ideally the day before.
- Name one person on site who can help me find people and VIPs.

**Holiday Minis**
- Dress for the theme ({theme}), with simple colors that match the set.
- Arrive 5 minutes early, ready to go. Sessions are short and sweet.
- Bring anything that makes kids smile, like a favorite toy or a small treat.

**For all outdoor sessions:** Sunscreen and bug spray before you arrive, a light layer for breezy evenings on the water, and sunglasses for the walk (we'll take them off for photos). If it's very hot, bring a small towel.

## 2. Daniella's notification email (new booking)

**Subject:** New booking: {Maya Torres}, {Families}, {Wed Dec 9} {3:00 PM}
(For requests: "New request: {name}, {Events}, {date}. Needs your reply".)

```
New booking, pending deposit.

{Maya Torres}
{Families}, {60} min
{Wednesday, December 9, 2026} at {3:00 PM} Eastern Time
Location: {Downtown West Palm Beach waterfront}
People: {2 adults, 2 children, 0 pets}

CONTACT
Email: {maya@example.com}
Phone: {(561) 555-0123} (prefers {text})

THEIR NOTES
Style: {Bright and airy}
Must-haves: {Grandma with all the grandkids}
Anything else: {Leo is shy at first}

PAYMENT
Retainer {$150} due by {Fri Dec 11, 3:00 PM ET}. Not paid yet.
Policies accepted: v{0.1-draft} on {Dec 9, 2026, 9:12 PM ET}

Open in admin: {link to booking detail}
```

- Keep PII in the email to a minimum. Include only the fields shown; children's ages, accessibility and health-related notes stay in admin behind the login. The email is a pointer, not a data copy.
- A copy of the client's `.ics` is also attached.
- **Request variant:** first line "New request. Approve or decline in admin." The CTA reads "Review this request: {link}".

## 3. Other transactional emails (short, v1 minimum)

| Event | Subject | Body (text) |
|---|---|---|
| Deposit received, booking confirmed | You're confirmed: {Wed, Dec 9} at {3:00 PM} | "Hi {first name}, your {amount} retainer arrived. You're confirmed! {session}, {date and time} Eastern Time, {location}. Your calendar invite is attached. Tips for what to wear are in your first email. See you soon, Daniella" |
| Request approved | Good news: your event is approved | "Hi {first name}, I'd love to photograph {event name}. To lock in {date and time} Eastern Time, please pay the {amount} retainer here: {link}. I'll hold the time for {48 hours}. Daniella" |
| Request declined | About your event request | "Hi {first name}, thank you for thinking of me. I'm not able to take {date} at {time}. {Optional note from Daniella.} I'd be happy to look at another date: just reply and let me know. Daniella" |
| Hold expired (unpaid) | We released your {session} time | "Hi {first name}, we didn't receive the retainer in time, so I've released {date and time}. Want to try again? You can book again here: {booking page}. Daniella" |
| Cancelled by Daniella | Your {session} on {date} was cancelled | "Hi {first name}, your session on {date and time} Eastern Time has been cancelled. {Note.} {Retainer outcome: 'Your retainer has been refunded.' or 'Your retainer stays on file per our policy.'} Questions? Just reply. Daniella" |

(Reminders, reschedule links and weather emails are v1.1.)

## 4. Calendar file (.ics)

- **File name:** `daniella-beltram-photography-{YYYY-MM-DD}.ics`
- **Time:** `DTSTART;TZID=America/New_York` with a full `VTIMEZONE` (or UTC with `Z`, per the architect), so the time is right in every calendar, DST included. End = start + session length (no buffer).
- **SUMMARY (title):** `{Families} session with Daniella Beltram Photography`  (Minis: `Holiday Mini with Daniella Beltram Photography`; Events: `{Event name}: photography with Daniella Beltram`)
- **LOCATION:** `{Downtown West Palm Beach waterfront, West Palm Beach, FL}` (for "Help me choose": `Location to be confirmed. Daniella will email suggestions`; for "My own": the address given).
- **DESCRIPTION** (use `\n` for line breaks):
```
Your {Families} session with Daniella Beltram Photography.
Booking reference: {DBP-4K7Q2}

Arrive a few minutes early. Times are Eastern.
Weather: I decide by {9:00 AM} on the day and will email you.
Need to change something? Reply to your confirmation email or write {studio email}.

What to wear: {one-line tip, e.g. coordinating solid colors, comfortable shoes}.
daniellabeltram.photography
```
- **ORGANIZER:** the studio address. **UID:** the booking id + `@daniellabeltram.photography` (stable, so a later update replaces rather than duplicates). **STATUS:** `TENTATIVE` while pending deposit, `CONFIRMED` after deposit (the confirmed email sends an updated file with `SEQUENCE:1`). **VALARM:** one reminder 24 hours before (`TRIGGER:-PT24H`, `ACTION:DISPLAY`, description "Your session with Daniella is tomorrow").
- No client phone, email or intake answers in the file.
- Same time in the email, `.ics`, confirmation screen and admin. All the same helper formats it.
