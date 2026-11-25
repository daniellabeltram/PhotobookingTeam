# 03 — Research Findings

How professional photographers handle online booking, intake forms, deposits and cancellations, and what clients expect.

**Researched:** November 2026
**Method:** Web search across photography-business publications (Fstoppers, ShootProof, Zenfolio, HoneyBook, SLR Lounge, PhotoShelter, Pixieset), scheduling-software vendors, individual photographers' published policies, Netlify documentation and forums, and Florida tax sources.

> **Caveats.** Much of this material comes from software vendors and individual photographers. It describes common practice, not a standard. Vendor statistics are self-reported. **None of this is legal or tax advice.** Have a Florida attorney review final policies and contracts, and a CPA confirm sales-tax treatment.

---

## 1. Online booking

**Findings**
- Self-booking (client picks an open slot directly) is a standard feature across photography scheduling tools: Acuity, Cal.com, YouCanBookMe, Setmore, Koalendar, SimplyBook.me, Zoho Bookings and others. [Cal.com][calcom-apps], [Koalendar][koalendar], [YouCanBookMe][ycbm]
- Manual scheduling leads to double bookings, missed appointments and long email threads. Those are the main problems booking tools say they solve. [SimplyBook.me][simplybook]
- Zenfolio argues that clients who want an instant answer will go to a photographer who offers online booking. That's a plausible argument, but no data backs it. [Zenfolio][zenfolio-sched]
- A HoneyBook study of 425 U.S. professional photographers found that **managing client bookings** was their biggest challenge. [Fit Small Business / HoneyBook study][honeybook-study]
- Mini-session photographers use scheduling tools to run back-to-back slots for holiday seasons. [Acuity case study][acuity-case]
- Some tools take payment as part of booking. Vendors say clients who have paid upfront are less likely to cancel at the last minute. [Cal.com][calcom-apps]

**Gap:** I found no independent (non-vendor) survey on what share of photography clients *expect* self-booking.

**Implications for the app**
- Self-booking with live availability is the baseline, not a differentiator.
- What makes this app different: it lives on Daniella's own domain, it's tailored to her five session types, the intake questions fit the shoot, and policy acceptance is built in.

## 2. Intake forms and questionnaires

**Findings**
- Start with **logistics** (when, where, how the session will go) before creative questions. [Zenfolio][zenfolio-q]
- The usual core questions are goals, preferred style, location, budget and must-have shots. [Cal.com][calcom-q]
- **Wardrobe** guidance matters most for family, engagement and portrait sessions, for example steering clients away from busy patterns. [ShootProof][shootproof-q]
- For families, ask about **schedules, naps and kids' ages** so timing works for everyone. Basic contact info and preferred contact method are always included. [Iris Works][iris]
- Ask early about **venue rules**, which matters for events. [HoneyBook][honeybook-q]
- **Keep it short.** Pick only the questions you truly need and put the important ones first. The form should be thorough but not overwhelming. [Picdrop][picdrop], [Unscripted][unscripted]
- Send the questionnaire **right after booking** and tailor it to the session type. [Cal.com][calcom-q]

**Implications for the app**
- One short shared form, plus a few conditional questions per session type (see `02-features.md`).
- Holiday Minis get the shortest form.
- Wardrobe and prep tips go in the confirmation and reminder emails rather than the form.

## 3. Deposits and retainers

**Findings**
- Fstoppers argues deposits are essential: without one, a client can walk away and the photographer has blocked a date for nothing. [Fstoppers][fstoppers-deposit]
- **Wording matters.** Many advisers recommend "non-refundable retainer" or "booking fee" over "deposit", because "deposit" can be read as refundable. [Aftershoot][aftershoot], [Narrative][narrative]
- **Amounts vary widely.** Sample contracts show 20%, 25% and 50% of the total, and also flat fees (for example $50, $100, $150). [Fstoppers – cancellation policy][fstoppers-cancel], [Kirstyn Alayne Photography policies][kirstyn]
- Mini sessions usually take the **full session fee or a fixed booking fee upfront** to hold the slot. Examples include a $150 fee for a 15-minute holiday slot and a $100 deposit on a $325 session. [Meghan Elizabeth Photography][meghan], [Asteria Photography][asteria]
- A "non-refundable" retainer may still have to be refunded if **the photographer** breaches, for example by not showing up. [PhotoShelter][photoshelter], [Narrative][narrative]

**Implications for the app**
- Show the deposit amount on each session card and before the client agrees.
- Use the phrase **"non-refundable retainer applied to your session fee"** (placeholder wording; confirm with an attorney).
- v1 uses a payment link and manual "mark paid"; v1.1 moves to integrated checkout.

## 4. Cancellation and rescheduling

**Findings**
- **Tiered policies** are common: the retainer is always kept, and a growing share of the balance is owed the closer the cancellation is to the date. [Fstoppers – cancellation policy][fstoppers-cancel], [ShootProof cancellation toolkit][shootproof-cancel]
- Photographers often let the client **reschedule once** within a set window (for example two weeks) before the retainer is at risk. [Lesha Brewer cancellation policy][lesha]
- Some let the fee **transfer** to another person or service instead of refunding it. [Meghan Elizabeth Photography][meghan]
- Cancellation fees for minis are common (for example a $100 fee). [Pixieset – mini sessions][pixieset]
- A clear written policy, accepted upfront, is the main protection. [ShootProof cancellation toolkit][shootproof-cancel], [LegalZoom][legalzoom]

**Implications for the app**
- Store the policy **version** and **acceptance time** with each booking.
- Self-reschedule (v1.1) should apply the rules automatically: free outside the notice window, admin approval inside it.

## 5. Weather (important in South Florida)

**Findings**
- A Gulf Coast Florida photographer waits **30 minutes past start time**. If conditions haven't improved, the session counts as weather-affected and the client gets **one free reschedule**, or keeps the images captured with an adjusted fee. [Salt & Sun Photo by Hannah][saltsun]
- Others reschedule based on the **hourly forecast**, for example a chance of rain above about 30%. [PhotographyTalk forum][phototalk]
- Some keep a **standing backup day** (for example Sunday for Saturday shoots) and make the weather call **within 24 hours** of the session. [Cheri Wenger Design Photography][cheri], [Captured Image][captured]
- Severe weather (lightning, tropical storms, hurricanes) is always cancelled by the photographer. Light rain is often shot "rain or shine". [Shoott weather policy][shoott], [Hope Taylor][hopetaylor]
- Local context (general knowledge, not from the sources above): Atlantic hurricane season runs June 1 to November 30, and South Florida summers bring near-daily afternoon thunderstorms, so many outdoor sessions are scheduled for early morning or late-afternoon golden hour.

**Implications for the app**
- Weather reschedules are **free** and started by the photographer. Build an admin action for this (v1.1).
- Consider defaulting summer outdoor slots to early morning and golden hour.
- Explain the weather policy in plain language in the confirmation email.

## 6. Holiday mini sessions

**Findings**
- Typical length is **15–30 minutes**. [Pixieset][pixieset], [ShootProof mini-session guide][shootproof-minis]
- Minis are priced as **their own package** (shorter, fewer images, lower price), not as a discount on full sessions. [ExpertPhotography][expertphoto]
- Slots run **back-to-back with buffer time**, under **one theme and location**, with length and image count spelled out in writing. [SLR Lounge][slrlounge], [Zenfolio – mini sessions][zenfolio-minis]
- Full payment or a fixed fee upfront reduces no-shows. Booking opens early, around **mid-November** or earlier, so images are ready for holiday cards. [HoneyBook – mini sessions][honeybook-minis]

**Implications for the app**
- A "mini day" generator that creates back-to-back slots with buffers (v1.1). In v1, Daniella can add those slots by hand.
- Show "spots left" to create urgency.
- Collect payment upfront (or a large fixed retainer) for minis.

## 7. Confirmations and reminders

**Findings**
- Layered reminders are recommended: an email confirmation at booking, then reminders about 48 hours and 24 hours before. Email works for detailed prep information and SMS for short nudges. [Zocdoc][zocdoc], [Sinch][sinch]
- Vendors report strong results from reminders, such as an 84% "more likely to show up" survey figure and a 40% no-show reduction in one case study. These are **vendor numbers**, mostly from healthcare. [SimpleTexting][simpletexting], [Sinch][sinch]
- SMS reminders need **consent and an easy opt-out** under TCPA rules. [Mailchimp][mailchimp]

**Implications for the app**
- v1: confirmation email with an .ics calendar file.
- v1.1: automated email reminders.
- SMS waits until "Later" and must include a consent checkbox.

## 8. Netlify platform notes

**Findings**
- Netlify Forms counts verified submissions across all forms on a site per billing period. [Netlify docs][netlify-forms]
- Legacy free plans allowed **100 submissions per site per month**. A third-party pricing page says forms became unlimited on Netlify's newer credit-based plans in April 2026, but I couldn't verify that on Netlify's own pages. [Netlify forum][netlify-forum-100], [Splitforms][splitforms]
- If an account goes over its plan limits, its sites can be **paused**, and paused sites don't receive form submissions. [Splitforms review][splitforms-review]

**Implications for the app**
- Don't rely on Netlify Forms for bookings. Use **Netlify Functions plus a real data store**, so availability can be checked atomically and bookings aren't lost to quota limits.
- Before launch, confirm current Function, Blobs and Forms limits on Netlify's pricing page.

## 9. Florida sales tax (flag for your CPA)

**Findings**
- Photography as a service isn't on Florida's list of specifically taxed services. **Purely electronic delivery** of images is generally not taxable. [Florida Sales Tax blog][fl-tax-blog], [Bastian Accounting guide][bastian]
- **Physical deliverables** (prints, albums, USB drives) are taxable. Under Rule 12A-1.041, sitting fees can become taxable when they're part of a sale of tangible goods. [Fla. Admin. Code R. 12A-1.041][fl-rule]

**Implications for the app**
- v1 takes deposits only. Have a CPA confirm whether deposits or session fees need sales tax when prints are included, before turning on integrated checkout.

---

## Summary: what clients expect

1. **See real availability and book on the spot**, from a phone.
2. **Clear pricing and what's included** before committing.
3. **A short form** that only asks what matters for *their* session.
4. **Policies in plain language**, shown before payment, not buried.
5. **Immediate confirmation** with a calendar invite, location details and what to wear.
6. **Reminders** before the session.
7. **Easy rescheduling**, especially for weather.

---

## Sources

[fstoppers-deposit]: https://fstoppers.com/business/deposits-are-not-optional-and-photographers-who-not-require-them-are-working-901592
[fstoppers-cancel]: https://fstoppers.com/business/fstoppers-answers-what-your-cancellation-policy-4507
[aftershoot]: https://aftershoot.com/?p=128689
[narrative]: https://narrative.so/blog/should-photographers-refund-the-deposit-from-a-canceled-wedding
[shootproof-cancel]: https://www.shootproof.com/blog/photography-cancellation-policy-toolkit-protecting-your-time-and-your-bottom-line/
[photoshelter]: https://blog.photoshelter.com/2020/03/advice-on-handling-contract-cancellations-for-photographers/
[legalzoom]: https://www.legalzoom.com/articles/why-you-need-a-wedding-photography-contract
[kirstyn]: https://sites.google.com/view/kirstyn-alayne-photography/policies
[lesha]: https://leshabrewer.zenfolio.com/cancellation-policy
[zenfolio-q]: https://zenfolio.com/blog/photography-session-success-essential-questions/
[shootproof-q]: https://shootproof.com/blog/what-questions-should-i-ask-my-photography-clients
[honeybook-q]: https://www.honeybook.com/blog/photography-client-questionnaire
[calcom-q]: https://cal.com/blog/photography-client-questionnaire-the-essential-questions-to-ask
[picdrop]: https://www.picdrop.com/web/articles/photography-questionnaire-ideas-essential-questions-for-clients
[iris]: https://www.iris-works.com/questions-portrait-questionnaire
[unscripted]: https://www.unscriptedphotographers.com/blog/top-photography-questionnaire-tips
[calcom-apps]: https://cal.com/blog/photography-online-booking-apps-tips-tools-and-technologies
[koalendar]: https://koalendar.com/blog/best-booking-software-for-photographers
[ycbm]: https://youcanbook.me/booking-software-for-photographers
[simplybook]: https://simplybook.me/online-scheduler-for-events-and-entertainment-services/online-scheduling-software-for-photographers
[zenfolio-sched]: https://zenfolio.com/blog/photography-scheduling-booking/
[honeybook-study]: https://fitsmallbusiness.com/honeybook-study/
[acuity-case]: https://acuityscheduling.com/learn/mrodphotos-booking-software-case-study
[saltsun]: https://saltandsunphotobyhannah.mypixieset.com/blog/what-happens-if-it-rains/
[phototalk]: https://www.photographytalk.com/forum/photography-general-discussion/165543-weather-reschedules-for-outdoor-photo-shoots
[cheri]: https://cheriwengerdesignphotography.zenfolio.com/the-policies
[captured]: https://capturedimage.zenfolio.com/when-the-weather-gets-in-the-way
[shoott]: https://www.shoott.com/policies/weather
[hopetaylor]: https://hopetaylor.com/2015/06/04/rescheduling-sessions-how-to-decide
[pixieset]: https://blog.pixieset.com/blog/photography-mini-sessions/
[shootproof-minis]: https://shootproof.com/blog/complete-mini-sessions
[expertphoto]: https://expertphotography.com/mini-sessions
[slrlounge]: https://slrlounge.com/photography-mini-sessions-10-tips-for-success/
[zenfolio-minis]: https://zenfolio.com/blog/get-started-with-photography-mini-sessions/
[honeybook-minis]: https://www.honeybook.com/blog/photography-mini-sessions
[meghan]: https://meghanelizabethphotography.bigcartel.com/product/holiday-mini-session-in-studio-325
[asteria]: https://asteriaphotography.bigcartel.com/product/weekday-mini-sessions-deposit
[zocdoc]: https://zocdoc.com/resources/blog/article/appointment-reminder-templates-that-reduce-no-shows-text-email
[sinch]: https://sinch.com/engage/resources/business-messaging/how-to-reduce-no-show-appointments/
[simpletexting]: https://simpletexting.com/blog/patient-no-show-text-reminders/
[mailchimp]: https://mailchimp.com/es/resources/sms-appointment-reminder/
[netlify-forms]: https://docs.netlify.com/manage/forms/usage-and-billing/
[netlify-forum-100]: https://answers.netlify.com/t/the-100-submissions-on-the-free-plane-are-per-month/20932/2
[splitforms]: https://splitforms.com/netlify-forms-pricing
[splitforms-review]: https://splitforms.com/reviews/netlify-forms
[fl-tax-blog]: https://floridasalestax.com/florida-tax-law-blog/2014/june/photography-in-florida-beware-the-sales-tax
[bastian]: https://bastianaccounting.notion.site/Florida-D-1f4d1b3f614981d59088c1bd96e7e5db
[fl-rule]: https://www.law.cornell.edu/regulations/florida/Fla-Admin-Code-Ann-R-12A-1-041

| Topic | Sources |
|---|---|
| Deposits and cancellations | [Fstoppers – deposits][fstoppers-deposit] · [Fstoppers – cancellation][fstoppers-cancel] · [Aftershoot][aftershoot] · [Narrative][narrative] · [ShootProof toolkit][shootproof-cancel] · [PhotoShelter][photoshelter] · [LegalZoom][legalzoom] · [Kirstyn Alayne][kirstyn] · [Lesha Brewer][lesha] |
| Intake forms | [Zenfolio][zenfolio-q] · [ShootProof][shootproof-q] · [HoneyBook][honeybook-q] · [Cal.com][calcom-q] · [Picdrop][picdrop] · [Iris Works][iris] · [Unscripted][unscripted] |
| Online booking | [Cal.com][calcom-apps] · [Koalendar][koalendar] · [YouCanBookMe][ycbm] · [SimplyBook.me][simplybook] · [Zenfolio][zenfolio-sched] · [HoneyBook study][honeybook-study] · [Acuity case study][acuity-case] |
| Weather | [Salt & Sun Photo][saltsun] · [PhotographyTalk][phototalk] · [Cheri Wenger][cheri] · [Captured Image][captured] · [Shoott][shoott] · [Hope Taylor][hopetaylor] |
| Mini sessions | [Pixieset][pixieset] · [ShootProof][shootproof-minis] · [ExpertPhotography][expertphoto] · [SLR Lounge][slrlounge] · [Zenfolio][zenfolio-minis] · [HoneyBook][honeybook-minis] · [Meghan Elizabeth][meghan] · [Asteria][asteria] |
| Reminders | [Zocdoc][zocdoc] · [Sinch][sinch] · [SimpleTexting][simpletexting] · [Mailchimp][mailchimp] |
| Netlify | [Netlify docs][netlify-forms] · [Netlify forum][netlify-forum-100] · [Splitforms pricing][splitforms] · [Splitforms review][splitforms-review] |
| Florida tax | [Florida Sales Tax blog][fl-tax-blog] · [Bastian Accounting][bastian] · [Fla. Admin. Code R. 12A-1.041][fl-rule] |
