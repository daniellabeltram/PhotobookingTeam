// Business configuration (ADR 0007). Every number here is a [PLACEHOLDER] taken from
// docs/04-booking-policies.md until Daniella confirms it. Change values here, never in code.
// Events are request mode (Daniella's decision, 2026-11-25).
import type { BookingConfigInput } from "../shared/config-schema";

// [PLACEHOLDER] suggested locations from docs/04 (replace with Daniella's favorites)
const outdoorLocations = [
  { id: "downtown-waterfront", label: "Downtown West Palm Beach / waterfront" },
  { id: "palm-beach-island", label: "Palm Beach Island (Worth Avenue area)" },
  { id: "local-beach", label: "Local beach (sunrise sessions)" },
  { id: "client-home", label: "Client's home (lifestyle sessions)" },
];

// [PLACEHOLDER] Payment links are obviously fake test URLs until Daniella has a payment provider account.
const link = (slug: string) => `https://buy.stripe.com/test_placeholder_${slug}`;

const config = {
  business: {
    name: "Daniella Beltram Photography",
    siteUrl: "https://daniellabeltram.photography",
    contactEmail: "hello@daniellabeltram.photography", // [PLACEHOLDER]
    timezone: "America/New_York",
  },
  email: {
    fromName: "Daniella Beltram Photography", // [PLACEHOLDER]
    fromAddress: "bookings@daniellabeltram.photography", // [PLACEHOLDER] must be a domain verified with the email provider
    replyTo: "hello@daniellabeltram.photography", // [PLACEHOLDER]
    adminNotificationEmail: "hello@daniellabeltram.photography", // [PLACEHOLDER]
  },
  scheduling: {
    slotIntervalMin: 30,
    minimumNoticeHours: 72, // [PLACEHOLDER]
    maxSessionsPerDay: 3, // [PLACEHOLDER] non-mini bookings only
    unpaidHoldHours: 48, // [PLACEHOLDER] flag only in v1, nothing is released automatically
    requestResponseDays: 2, // [PLACEHOLDER] Events reply time, calendar days
    workingDays: [2, 3, 4, 5, 6, 7], // [PLACEHOLDER] Tue to Sun (ISO weekdays)
    windowSets: {
      // [PLACEHOLDER] fixed windows near sunrise and sunset, by month (story 002 notes)
      outdoor: [
        {
          months: [11, 12, 1, 2, 3],
          windows: [
            { start: "07:00", end: "09:30" },
            { start: "15:30", end: "17:45" },
          ],
        },
        {
          months: [4, 5, 6, 7, 8, 9, 10],
          windows: [
            { start: "06:45", end: "09:15" },
            { start: "17:30", end: "19:45" },
          ],
        },
      ],
      // [PLACEHOLDER] Events happen at venues, so daytime and evening hours
      venue: [{ months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], windows: [{ start: "09:00", end: "22:00" }] }],
    },
  },
  sessionTypes: [
    {
      id: "portraits",
      name: "Portraits",
      description: "Individual, senior, headshot or maternity portraits.", // [PLACEHOLDER]
      included: ["1 location", "Up to 2 outfits", "About 25 edited digital images"], // [PLACEHOLDER]
      kind: "standard",
      active: true,
      bookingMode: "instant",
      durationMin: 60, // [PLACEHOLDER]
      bufferMin: 30, // [PLACEHOLDER]
      windowSet: "outdoor",
      bookingHorizonDays: 183, // [PLACEHOLDER] about 6 months
      priceFromCents: 35000, // [PLACEHOLDER]
      priceUnit: "session",
      deposit: { kind: "flat", amountCents: 10000 }, // [PLACEHOLDER]
      depositPaymentLink: link("portraits"),
      maxPeople: 2, // [PLACEHOLDER]
      locationOptions: outdoorLocations,
      allowOwnLocation: true,
      allowHelpMeChoose: true,
      intakeExtraFields: [],
      commonFieldsProfile: "full",
      whatToBringText: [
        "Choose 2 outfits you feel like yourself in. Solid colors and simple textures photograph best.",
        "Comfortable shoes you can walk in (we may move around).",
        "Bring water, lip balm and a hairbrush or small mirror.",
      ].join("\n"), // [PLACEHOLDER] copy for Daniella to edit (docs/design/emails.md)
      countsTowardDailyCap: true,
    },
    {
      id: "couples",
      name: "Couples",
      description: "Engagement, anniversary or just-because sessions for two.", // [PLACEHOLDER]
      included: ["1 location", "Up to 2 outfits", "About 35 edited images"], // [PLACEHOLDER]
      kind: "standard",
      active: true,
      bookingMode: "instant",
      durationMin: 60, // [PLACEHOLDER]
      bufferMin: 30,
      windowSet: "outdoor",
      bookingHorizonDays: 183,
      priceFromCents: 40000, // [PLACEHOLDER]
      priceUnit: "session",
      deposit: { kind: "flat", amountCents: 10000 }, // [PLACEHOLDER]
      depositPaymentLink: link("couples"),
      maxPeople: 2,
      locationOptions: outdoorLocations,
      allowOwnLocation: true,
      allowHelpMeChoose: true,
      intakeExtraFields: [
        { id: "couples.occasion", required: true },
        { id: "couples.surpriseProposal", required: true },
      ],
      commonFieldsProfile: "full",
      whatToBringText: [
        "Coordinate, don't match: pick colors that sit well together, like cream and olive.",
        "Wear something you can move and hug in.",
        "Eat something light beforehand so you're relaxed.",
      ].join("\n"),
      countsTowardDailyCap: true,
    },
    {
      id: "families",
      name: "Families",
      description: "Relaxed family sessions, including little ones and pets.", // [PLACEHOLDER]
      included: ["1 location", "About 40 edited images"], // [PLACEHOLDER]
      kind: "standard",
      active: true,
      bookingMode: "instant",
      durationMin: 60,
      bufferMin: 30,
      windowSet: "outdoor",
      bookingHorizonDays: 183,
      priceFromCents: 45000, // [PLACEHOLDER]
      priceUnit: "session",
      deposit: { kind: "flat", amountCents: 15000 }, // [PLACEHOLDER]
      depositPaymentLink: link("families"),
      maxPeople: 6, // [PLACEHOLDER] up to 6 included
      extraPersonFeeCents: 2500, // [PLACEHOLDER] per extra person
      locationOptions: outdoorLocations,
      allowOwnLocation: true,
      allowHelpMeChoose: true,
      intakeExtraFields: [
        { id: "families.childrenAges", required: false }, // required by a rule when children > 0
        { id: "families.extendedFamily", required: true },
      ],
      commonFieldsProfile: "full",
      whatToBringText: [
        "Pick one color palette (2 to 4 colors) and let everyone choose within it. Skip large logos.",
        "Bring snacks and a favorite toy for little ones, plus water.",
        "Plan for naps and meals before the session so everyone is in a good mood.",
      ].join("\n"),
      countsTowardDailyCap: true,
    },
    {
      id: "events",
      name: "Events",
      description: "Birthdays, showers, corporate and small celebrations. Daniella reviews every request.", // [PLACEHOLDER]
      included: ["Edited images from your event, number varies"], // [PLACEHOLDER]
      kind: "standard",
      active: true,
      bookingMode: "request", // Daniella's decision 2026-11-25
      durationMin: 120, // [PLACEHOLDER] minimum coverage
      durationOptionsMin: [120, 180, 240, 300, 360], // [PLACEHOLDER]
      bufferMin: 30,
      windowSet: "venue",
      bookingHorizonDays: 365, // [PLACEHOLDER] up to 12 months
      priceFromCents: 25000, // [PLACEHOLDER] per hour
      priceUnit: "hour",
      deposit: { kind: "percent", percent: 50 }, // [PLACEHOLDER] of the estimated total
      depositPaymentLink: link("events"), // [PLACEHOLDER] "client chooses the amount" link (ADR 0005)
      maxPeople: null,
      locationOptions: [],
      allowOwnLocation: true,
      allowHelpMeChoose: false,
      intakeExtraFields: [
        { id: "events.eventName", required: true },
        { id: "events.eventType", required: true },
        { id: "events.venueAddress", required: true },
        { id: "events.eventStartTime", required: true },
        { id: "events.eventEndTime", required: true },
        { id: "events.guestCount", required: true },
        { id: "events.onsiteContactName", required: true },
        { id: "events.onsiteContactPhone", required: true },
        { id: "events.timeline", required: false },
      ],
      commonFieldsProfile: "full",
      whatToBringText: [
        "Share your timeline and must-have moments by reply so I can plan.",
        "Tell me about any decor or details you want captured, ideally the day before.",
        "Name one person on site who can help me find people and VIPs.",
      ].join("\n"),
      countsTowardDailyCap: true,
    },
    {
      id: "holiday-minis",
      name: "Holiday Minis",
      description: "Short, themed holiday sessions on set mini days.", // [PLACEHOLDER]
      included: ["Themed setup", "About 10 edited images"], // [PLACEHOLDER]
      kind: "mini",
      active: true,
      bookingMode: "instant",
      durationMin: 20, // [PLACEHOLDER]
      bufferMin: 10, // [PLACEHOLDER]
      bookingHorizonDays: 183,
      priceFromCents: 22500, // [PLACEHOLDER]
      priceUnit: "session",
      deposit: { kind: "full" }, // [PLACEHOLDER] paid in full at booking
      depositPaymentLink: link("holiday-minis"),
      maxPeople: 5, // [PLACEHOLDER] up to 5 plus pets
      locationOptions: [],
      allowOwnLocation: false,
      allowHelpMeChoose: false,
      intakeExtraFields: [{ id: "minis.cardDeadline", required: false }],
      commonFieldsProfile: "short",
      whatToBringText: [
        "Dress for the theme, with simple colors that match the set.",
        "Arrive 5 minutes early, ready to go. Sessions are short and sweet.",
        "Bring anything that makes kids smile, like a favorite toy or a small treat.",
      ].join("\n"),
      countsTowardDailyCap: false,
    },
  ],
  policyVersion: "v0.1-draft",
  privacy: {
    dataRetentionMonths: 24, // [PLACEHOLDER] Daniella decides
    privacyContactEmail: "hello@daniellabeltram.photography", // [PLACEHOLDER]
    lastUpdated: "2026-11-25",
  },
  features: { portfolioOptOutEnabled: true }, // [PLACEHOLDER] decision pending
  limits: {
    bookingRateLimit: { max: 5, windowMinutes: 60 }, // [PLACEHOLDER]
    availabilityRateLimit: { max: 300, windowMinutes: 10 },
    loginFailureLimit: { max: 5, windowMinutes: 10 },
  },
  admin: { sessionIdleMinutes: 60, sessionMaxHours: 12 },
} satisfies BookingConfigInput;

export default config;
