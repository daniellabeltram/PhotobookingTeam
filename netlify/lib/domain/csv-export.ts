// CSV columns for GET /api/admin/export.csv (docs/api.md, story 016). Rows with deleted PII keep the booking
// facts and leave every personal column blank.
import { formatCompactEt } from "../../../shared/datetime";
import type { Booking, IntakeValue } from "../../../shared/models";
import { toCsv } from "../csv";

export const CSV_HEADERS = [
  "Reference", "Status", "Session type", "Date (ET)", "Start (ET)", "End (ET)", "Length (min)", "Client name", "Email", "Phone",
  "Preferred contact", "Adults", "Children", "Pets", "Names photographed", "Location", "Style notes", "Must-have shots",
  "Anything to know", "Heard about us", "Portfolio opt-out", "Couples: occasion", "Couples: surprise proposal",
  "Families: children's ages", "Families: extended family", "Events: name", "Events: type", "Events: venue address",
  "Events: start", "Events: end", "Events: guest count", "Events: on-site contact", "Events: on-site phone", "Events: timeline",
  "Minis: card deadline", "Policy version", "Policy accepted at (ET)", "Amount due", "Amount paid", "Paid on",
  "Reschedule count", "Created at (ET)",
];

const text = (v: IntakeValue | undefined): string => (v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));
const dollars = (cents: number): string => (cents / 100).toFixed(2);

function locationText(b: Booking): string {
  switch (b.location.kind) {
    case "suggested":
    case "mini_day":
      return b.location.label;
    case "own":
      return b.location.text;
    case "help_me_choose":
      return "Help me choose";
    case "removed":
      return "";
  }
}

export function bookingRow(b: Booking): string[] {
  const i = b.intake ?? {};
  const c = b.contact;
  return [
    b.id,
    b.status,
    b.sessionTypeName,
    b.localDate,
    b.localStartTime,
    b.localEndTime,
    String(b.durationMin),
    c?.fullName ?? "",
    c?.email ?? "",
    c?.phone ?? "",
    c?.preferredContact ?? "",
    b.people ? String(b.people.adults) : "",
    b.people ? String(b.people.children) : "",
    b.people ? String(b.people.pets) : "",
    text(i["subjectsNames"]),
    locationText(b),
    text(i["styleNotes"]),
    text(i["mustHaveShots"]),
    text(i["anythingElse"]),
    text(i["heardAbout"]),
    text(b.portfolioOptOut),
    text(i["couples.occasion"]),
    text(i["couples.surpriseProposal"]),
    text(i["families.childrenAges"]),
    text(i["families.extendedFamily"]),
    text(i["events.eventName"]),
    text(i["events.eventType"]),
    text(i["events.venueAddress"]),
    text(i["events.eventStartTime"]),
    text(i["events.eventEndTime"]),
    text(i["events.guestCount"]),
    text(i["events.onsiteContactName"]),
    text(i["events.onsiteContactPhone"]),
    text(i["events.timeline"]),
    text(i["minis.cardDeadline"]),
    b.policyVersion,
    formatCompactEt(b.policyAcceptedAt),
    dollars(b.pricing.amountDueCents),
    b.payment ? dollars(b.payment.amountCents) : "",
    b.payment?.receivedOn ?? "",
    String(b.rescheduleCount),
    formatCompactEt(b.createdAt),
  ];
}

export const bookingsToCsv = (bookings: Booking[]): string => toCsv([CSV_HEADERS, ...bookings.map(bookingRow)]);
