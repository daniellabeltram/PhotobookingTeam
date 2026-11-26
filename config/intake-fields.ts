// Intake field catalogue (ADR 0007). One definition drives the form, the server validation,
// the admin detail labels and the CSV columns. Lengths here are the same on client and server.
import type { IntakeFieldDef } from "../shared/config-schema";

export const intakeFields: IntakeFieldDef[] = [
  // ---- common ----
  { id: "contact.fullName", label: "Full name", input: "text", maxLength: 100 },
  { id: "contact.email", label: "Email", input: "email", maxLength: 254 },
  { id: "contact.phone", label: "Mobile phone", input: "tel", maxLength: 20, helpText: "10 US digits, or start with + and the country code" },
  {
    id: "contact.preferredContact",
    label: "Preferred way to reach you",
    input: "select",
    options: [
      { value: "email", label: "Email" },
      { value: "call", label: "Phone call" },
      { value: "text", label: "Text message" },
    ],
  },
  { id: "subjectsNames", label: "Names of everyone being photographed", input: "text", maxLength: 500 },
  { id: "people.adults", label: "Adults", input: "number", min: 0, max: 50 },
  { id: "people.children", label: "Children", input: "number", min: 0, max: 50 },
  { id: "people.pets", label: "Pets", input: "number", min: 0, max: 50 },
  { id: "location", label: "Location", input: "select" },
  { id: "styleNotes", label: "Style notes (mood or vibe)", input: "textarea", maxLength: 1000 },
  { id: "mustHaveShots", label: "Must-have shots or groupings", input: "textarea", maxLength: 1000 },
  { id: "anythingElse", label: "Anything Daniella should know", input: "textarea", maxLength: 1000 },
  { id: "heardAbout", label: "How did you hear about us?", input: "text", maxLength: 200 },
  { id: "portfolioOptOut", label: "Please don't use my images in your portfolio", input: "checkbox" },

  // ---- couples ----
  {
    id: "couples.occasion",
    label: "Occasion",
    input: "select",
    options: [
      { value: "engagement", label: "Engagement" },
      { value: "anniversary", label: "Anniversary" },
      { value: "just_because", label: "Just because" },
      { value: "other", label: "Other" },
    ],
  },
  { id: "couples.surpriseProposal", label: "Is this a surprise proposal?", input: "checkbox" },

  // ---- families ----
  { id: "families.childrenAges", label: "Children's ages", input: "text", maxLength: 200, helpText: "Ages only, please" },
  { id: "families.extendedFamily", label: "Is extended family joining?", input: "checkbox" },

  // ---- events ----
  { id: "events.eventName", label: "Event name", input: "text", maxLength: 150 },
  { id: "events.eventType", label: "Event type", input: "text", maxLength: 100 },
  { id: "events.venueAddress", label: "Venue address", input: "text", maxLength: 300 },
  { id: "events.eventStartTime", label: "Event start time", input: "time" },
  { id: "events.eventEndTime", label: "Event end time", input: "time" },
  { id: "events.guestCount", label: "Number of guests", input: "number", min: 1, max: 5000 },
  { id: "events.onsiteContactName", label: "On-site contact name", input: "text", maxLength: 100 },
  { id: "events.onsiteContactPhone", label: "On-site contact phone", input: "tel", maxLength: 20 },
  { id: "events.timeline", label: "Timeline or must-have moments", input: "textarea", maxLength: 2000 },

  // ---- holiday minis ----
  { id: "minis.cardDeadline", label: "Holiday card deadline", input: "date" },
];
