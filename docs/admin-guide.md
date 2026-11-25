# Admin guide: managing bookings

**Who this is for:** Daniella.
**What you'll be able to do:** sign in, read the booking list, approve or decline event requests, record deposits, change a booking's status, reschedule, resend emails, block dates, add Holiday Minis slots, export a spreadsheet file and delete a client's details on request.

Times on the admin page are Eastern Time (ET) and shown in 12-hour format. Money amounts in examples are placeholders (`[PLACEHOLDER]`) until you confirm your prices.

> **Private information:** the admin page shows client names, phone numbers, emails and sometimes children's ages. Sign out when you step away, and never send exported files by email.

---

## Words you'll see

| Word on the screen | What it means |
|---|---|
| **Requested** | An event request waiting for your approval. The time is held for it. |
| **Pending deposit** | The booking is held, but the retainer hasn't been received yet. |
| **Confirmed** | The retainer is in (or you waived it), and the session is booked. |
| **Completed** | The session has taken place. |
| **Cancelled** | The booking was cancelled. The time is free again. |
| **Declined** | You turned down an event request. The time is free again. |
| **Rescheduled** | The booking was moved to another time at least once. |
| **Retainer** | The amount that holds a client's date. Shown as "deposit" in some button names. |

---

## 1. Sign in

You'll be able to sign in to the admin page with your email, password and second-factor code.

1. Go to `/admin/` on the booking website (for example `https://book.daniellabeltram.photography/admin/`).
2. Type your admin email address.
3. Type your password.
4. If your account has a second factor turned on, type the 6-digit code from your authenticator app. Each code works once, and changes every 30 seconds.
5. Select **Sign in**. You land on the **Bookings** page.

**Sign out:** select **Sign out** in the top right.

**If something goes wrong**
- *"That email and password don't match. Please try again."* Check the spelling of both. The message is the same whether the email or password is wrong, on purpose.
- *"Too many attempts. Please wait 10 minutes and try again."* Wait 10 minutes. Then try again.
- *"You were signed out to keep things safe."* You were idle for an hour, or signed in for 12 hours. Sign in again. You return to the page you were on.
- *You forgot your password.* Ask your developer to help you make a new one with the offline password tool, or use the steps in `docs/operations.md` section 3, step 4.

---

## 2. Read the booking list and use the filters

You'll be able to find any booking, and see what needs your attention first.

1. On the **Bookings** page, look at the summary at the top. It shows how many requests are waiting, how many upcoming bookings are pending a deposit, and how many deposits are overdue.
2. The list shows upcoming bookings first, soonest on top. Each row shows the date and time, the client's name, the session type and the status.
3. To see only some bookings, open **Filters** (on a phone, tap **Filters**):
   - **Status:** pick one or more of Requested, Pending deposit, Confirmed, Completed, Cancelled, Declined or Rescheduled.
   - **Type:** pick one session type.
   - **From** and **To:** pick a date range.
4. Select **Apply**. To clear everything, select **Clear filters**.
5. To see past bookings, pick a date range in the past. Past bookings show newest first.
6. Select any row to open the booking. Select **All bookings** at the top of the booking to come back. Your filters stay as you left them.

Each row can show small flags:

| Flag | What it means |
|---|---|
| Waiting 2 days 5 h | How long an event request has waited for your reply. |
| Reply overdue | An event request has waited longer than the reply time you promised. See "What the flags mean" below. |
| Deposit overdue | A booking is still waiting for its retainer after the hold time. See "What the flags mean" below. |
| Session time passed | The session start time is past, but the booking isn't completed yet. |
| Email not sent | An email to the client failed. You can resend it (step 9). |
| Surprise proposal | The client said this is a surprise proposal. Plan discreetly. |
| Location: help me choose | The client wants location ideas from you. |

**If something goes wrong**
- *"We couldn't load bookings. Please try again."* Select **Try again**. If it still fails, wait a few minutes and reload the page.
- *"No bookings match these filters."* Select **Clear filters**.

---

## 3. Approve or decline an event request

Event bookings don't confirm straight away. You decide first. You'll be able to approve a request so the client gets a retainer link, or decline it so the time is released.

1. On the list, filter by **Status: Requested**, or open the request from the "need your attention" count.
2. Open the request and read the event name, venue, start and end times, guest count and timeline.
3. To approve, select **Approve request**.
   - A dialog names the client, the event and the time. Select **Approve** to confirm, or **Not yet** to go back.
   - The client gets an email with the retainer amount and a payment link. The time is held until the retainer is received.
4. To decline, select **Decline request**.
   - Optionally type a short note for the client. It appears in the email in plain text.
   - Leave **Email the client** ticked to send the polite decline email. Untick it to send nothing.
   - Select **Decline request** to confirm.
   - The time is released at once, and the client can choose another time.
5. Check the result message at the top of the page. It says what happened, and whether the email was sent.

Requests don't expire on their own. A request stays on the list until you approve or decline it, so check the **Waiting** and **Reply overdue** flags regularly.

**If something goes wrong**
- *"This request was already handled (now: Declined). Reload to see the latest."* Someone else, or another tab, changed it first. Reload the page. Nothing was changed by your action.
- *A declined request can't be approved.* Ask the client to book again. The time may already be taken.
- *"Email not sent" appears after you approve.* The status still changed. Open the booking and select **Resend approval email**. It sends one email.

---

## 4. Mark a deposit paid (retainer received)

You'll be able to record that a retainer arrived, so the booking becomes Confirmed.

1. Open the booking. Its status is **Pending deposit**.
2. Select **Mark deposit paid**.
3. Check the amount. It is filled in with the amount due. Change it only if the amount received was different.
4. Check the date received. It defaults to today.
5. Optionally, type how it was paid (for example "card through payment link") and a note.
6. Select **Mark as paid** to confirm.
7. The booking becomes **Confirmed**, and the client gets a confirmation email with a calendar file.

Payments are received in your payment provider. Find the booking reference (for example `DBP-4K7Q2`) there to match the payment to the booking.

**If something goes wrong**
- *The client paid but the booking still says Pending deposit.* Check the payment provider using the booking reference. Then mark it paid as in steps 2 to 6.
- *The client says they paid, but you can't find the payment.* Don't mark it paid until you've confirmed it in your payment provider.

---

## 5. Confirm, cancel, complete or reschedule a booking

### Confirm without payment

Use this only if you decided to waive the retainer or the client paid another way.

1. Open a booking that is **Pending deposit**.
2. Select **Confirm without payment**.
3. Type a note saying why (this is required).
4. Select **Confirm**. The booking becomes **Confirmed**, and the client gets a confirmation email.

### Cancel a booking

Cancelling frees the time for someone else to book.

1. Open the booking. It must be **Pending deposit** or **Confirmed**.
2. Select **Cancel booking**.
3. A dialog names the client and the time. Choose a reason: **Client cancelled**, **Deposit not received**, **Photographer cancelled** or **Other**.
4. Choose whether to keep the retainer, following the cancellation policy in `docs/04-booking-policies.md`. Money refunds are made in your payment provider, not in the app.
5. Optionally, type a note.
6. Leave **Email the client** ticked to tell the client. Untick it to send nothing.
7. Select **Cancel booking** to confirm. Select **Keep booking** to go back.

Cancelled bookings can't be reopened. Ask the client to book again.

### Mark a session completed

1. Open a **Confirmed** booking whose start time has passed. The **Mark completed** button appears only after that time.
2. Select **Mark completed**, then confirm.

This can't be undone.

### Reschedule a booking

Use this for a client's request or a weather move. It keeps the same booking and status.

1. Open the booking and select **Reschedule**.
2. Choose a reason: **Client request**, **Weather** or **Photographer**.
3. Pick an open time. Only times that really are free are shown.
4. Optionally, leave **Email the client** ticked to send the new time with an updated calendar file. The calendar file replaces the old event in the client's calendar. It doesn't add a second one.
5. Select **Reschedule** to confirm.

The history on the booking records the old time, the new time, the reason and who made the change.

> *Developers: reschedule is planned as Priority P1. If it isn't in this release, use cancel with the note "Rescheduled" and ask the client to book again.* `[CONFIRM before release]`

**If something goes wrong**
- *"That time was just booked."* Someone booked it a moment before you. Pick another time. The list of times refreshes.
- *"This booking changed. Reload to see the latest."* The booking was changed elsewhere. Reload the page, check it, then try again.
- *"That didn't work and nothing was changed."* A network problem stopped the change. Check the status shown, then try again.

---

## 6. Resend an email

You'll be able to send a client the latest email again, for example after a failed send.

1. Open the booking. Look for the **Email not sent** flag or a message saying the email failed.
2. Select **Resend [name of email]**, for example **Resend confirmation email**.
3. Check the result message. It confirms when the email was sent.

Resending sends one email only.

**If something goes wrong**
- *The email fails again.* Check the client's email address on the booking, using the **Email** link on the detail page. If it's wrong, tell your developer. Editing client details isn't in v1.

---

## 7. Block dates and times

You'll be able to make days or hours unavailable, for holidays, personal days or a weather backup day. Clients never see the reason you enter.

1. Open **Blocked dates** from the top menu.
2. Enter a **From date** and a **To date**. For one day, use the same date for both.
3. Leave **All day** ticked to block the whole day(s). To block only some hours on one day, untick **All day**, then enter a **Start time** and an **End time**.
4. Optionally, type a reason. Only you can see it. For example: "Weather backup".
5. Select **Block these dates**.
6. If existing bookings fall in the range, a warning lists them. Blocking **won't cancel them**. Select **Block anyway** to continue, or **Go back** to review them first.
7. The block appears under **Upcoming blocks**.

To free the time again, select **Remove** next to the block, then confirm **Remove block**. Clients can then book those times again.

**If something goes wrong**
- *"Please pick a start date."* or *"The end date can't be before the start date."* Check the dates and try again.
- *"The end time must be after the start time."* Check the times.

---

## 8. Add Holiday Minis slots

You'll be able to create a day of mini sessions, with one bookable slot for each start time. The slot length and buffer come from the settings your developer set.

1. Open **Add minis slots** from the top menu.
2. Enter the **Date**.
3. Enter the **Location**, for example "Phillips Point".
4. Optionally, enter a **Theme**, for example "Winter".
5. Enter the **First start time**, for example 8:00 AM.
6. Enter the **Number of slots** (1 to 30).
7. Check the **Preview**. It lists every start time and when the last session ends.
8. Select **Add these slots**. Each slot is bookable straight away, and clients see "[n] spots left".

To remove a mini day, open it under **Upcoming mini days** and select **Remove mini day**. This is only possible when no slot is booked. If clients have booked, first cancel those bookings (step 5).

**If something goes wrong**
- *"These slots overlap another booking at 10:00 AM. Choose another start time."* Change the first start time or the number of slots.
- *"That date already has a mini day. Edit it instead."* Open that mini day to change it.
- *"The first slot must be in the future."* Pick a later date or time.

---

## 9. Export a CSV file

You'll be able to download a spreadsheet of bookings, for your records or a backup.

1. On the **Bookings** page, set the filters you want. The export uses the filters you see on screen. For a full backup, clear all filters first.
2. Select **Export CSV**. The button shows how many bookings it will include.
3. Wait for the message "Your CSV is ready. Check your downloads."
4. Open the file in Excel, Google Sheets or Numbers. The file is named like `bookings-2026-12-01.csv`.

**Keep the file private.** It holds client contact details and children's details. Store it in a private folder on your own computer or drive. Don't email it or post it in a shared folder, and delete old copies when you no longer need them.

**If something goes wrong**
- *"We couldn't create the file. Please try again."* Select **Export CSV** again.
- *The button says "Nothing to export."* No bookings match the filters.

---

## 10. Delete client data

You'll be able to remove a client's personal details, for example after a privacy request. The booking record stays, with its date, type, status and amounts.

1. Open the booking. This is only possible for a **Cancelled**, **Completed** or **Declined** booking.
2. Select **Delete client data**.
3. Type the booking reference (for example `DBP-4K7Q2`) to confirm.
4. Select **Delete client data**.

The name, email, phone, intake answers, location and notes are removed. This **can't be undone**.

**If something goes wrong**
- *The button isn't there.* The booking is still active. Cancel or complete it first.

---

## What the flags mean

### Deposit overdue

A booking is **Pending deposit**, and its hold time has run out without the retainer arriving. The hold time is the `unpaid_hold_hours` setting `[PLACEHOLDER: 48 hours]`. For a normal booking, it counts from when the client booked. For an approved event, it counts from when you approved it.

Nothing happens automatically. The time stays held until you act.

What to do:
1. Check your payment provider for the booking reference.
2. If the retainer arrived, mark it paid (step 4).
3. If it didn't, cancel the booking with the reason **Deposit not received** (step 5). The time is then free for others.

### Reply overdue

An event request has waited longer than the reply time you promised clients, `request_response_days` `[PLACEHOLDER]`. The request stays **Requested** and the time stays held, until you approve or decline it.

What to do: approve or decline the request (step 3).

---

## Change prices or policies

Prices, session lengths, deposits, payment links and policy wording are stored in the app's configuration files, not in the admin page. In v1 a developer makes these changes. Editing an admin screen for these values is planned for v1.1.

Each change needs a new release. Batch several changes together, because each production release uses Netlify plan credits.

1. Write down the change you want, for example "Portraits: $375 instead of $350", and the date it should take effect. Keep the value and the old value in a note.
2. Send the change to your developer. For policy wording, send the full new text. Don't ask for a published policy to be edited, because each published version is kept as it was agreed. New wording gets a new version number.
3. The developer updates the configuration and opens a pull request for you to review.
4. Approve the merge to `main` when you're happy with it. Nothing goes live without your approval.
5. Netlify deploys the change. Watch **Deploys** until it shows **Published**.
6. Check the booking page on your phone. Confirm the new price, deposit and policy text appear.

**If something goes wrong**
- *The new price is wrong on the live site.* Open **Deploys** in Netlify, choose the previous good deploy and select **Publish deploy**. This takes the site back to the last version within seconds. Then ask your developer to fix it.
- *Bookings made before the change still show the old policy.* That's intended. Each booking keeps the policy version the client accepted.
