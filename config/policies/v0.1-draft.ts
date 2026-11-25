// Policy version v0.1-draft. NEVER EDIT a published version: add a new file and a new policyVersion.
// A test pins this file's SHA-256 in hashes.json. [PLACEHOLDER] Everything below is draft wording from
// docs/04-booking-policies.md and needs Daniella's approval and an attorney's review before launch.
import type { PolicyVersion } from "../../shared/config-schema";

export const v0_1_draft: PolicyVersion = {
  version: "v0.1-draft",
  effectiveDate: "2026-11-25",
  summaryTemplate:
    "A non-refundable retainer of {{depositText}} holds your date and goes toward your session fee. " +
    "You can reschedule once for free up to {{freeRescheduleDays}} days before your session. Weather reschedules are always free. " +
    "Cancellations within {{lateCancelHours}} hours forfeit the retainer and 50% of the balance. " +
    "Your time is held for {{unpaidHoldHours}} hours until the retainer is received.",
  values: {
    freeRescheduleDays: 7, // [PLACEHOLDER]
    lateCancelHours: 48, // [PLACEHOLDER]
  },
  sections: [
    {
      heading: "Retainer",
      paragraphs: [
        "A non-refundable retainer is due to secure your date and time. It is applied to your session fee. It is not an extra charge.",
        "Your booking stays pending until the retainer is received. If it isn't received within 48 hours, the booking may be cancelled and the time released.",
        "The remaining balance is due on or before the session date. Holiday Minis are paid in full at booking.",
        "If Daniella Beltram Photography has to cancel and can't offer a suitable new date, the retainer is refunded in full.",
      ],
    },
    {
      heading: "Rescheduling",
      paragraphs: [
        "More than 7 days before your session: one free reschedule, and the retainer moves to the new date.",
        "Between 7 days and 48 hours before: one reschedule with a $50 rebooking fee.",
        "Less than 48 hours before: treated as a cancellation, except for illness or emergency at Daniella's discretion.",
        "The new date must be within 90 days of the original date. Holiday Minis can swap to another open mini slot that season if one is available.",
      ],
    },
    {
      heading: "Cancellation",
      paragraphs: [
        "More than 7 days before: the retainer is kept and there is no further charge, or it can be applied as a credit toward a session within 6 months.",
        "Between 7 days and 48 hours before: the retainer is kept.",
        "Less than 48 hours before, or a no-show: the retainer is kept, plus 50% of the remaining balance. Events cancelled within 30 days: the same.",
        "Sessions start and end at the booked time. If you are more than 15 minutes late the session may be shortened. After 30 minutes it counts as a no-show.",
      ],
    },
    {
      heading: "Weather",
      paragraphs: [
        "Daniella makes the weather call by 9:00 a.m. on the day of the session (or the evening before for sunrise sessions), using the hourly forecast.",
        "Weather reschedules are always free and don't count as your one free reschedule.",
        "Sessions go ahead in light clouds or a passing drizzle. We reschedule for lightning, steady rain, a tropical-storm or hurricane watch, or an hourly chance of rain above about 40%.",
        "Holiday Minis have one rain date announced in advance.",
      ],
    },
    {
      heading: "If Daniella has to cancel",
      paragraphs: [
        "If Daniella has to cancel because of illness, emergency or equipment failure, you can choose a new date at no charge or get a full refund of everything paid. Liability is limited to the amount paid.",
      ],
    },
    {
      heading: "Images and usage",
      paragraphs: [
        "Your edited online gallery is delivered within 2 to 3 weeks (Holiday Minis within 7 days). Image counts are approximate.",
        "You receive a personal-use license to print and share your images. Daniella keeps the copyright and may use images for her portfolio and marketing unless you opt out on the intake form.",
      ],
    },
    {
      heading: "Children, pets and accessibility",
      paragraphs: [
        "A parent or guardian must be present for anyone under 18. Pets are welcome in Family sessions and minis when noted on the intake form.",
        "Please note any accessibility needs on the intake form so locations and posing can be planned.",
      ],
    },
    {
      heading: "Privacy",
      paragraphs: [
        "Information from the intake form is used only to plan and deliver your session and to contact you about it. It is never sold. See the privacy notice for details.",
      ],
    },
  ],
};
