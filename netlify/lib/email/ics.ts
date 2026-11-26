// Calendar file (ADR 0004, docs/design/emails.md section 4): RFC 5545, CRLF, lines folded at 75 octets,
// text escaped, times in UTC form (so DST needs no VTIMEZONE). No client phone, email or intake answers.
import { toIcsUtc } from "../../../shared/datetime";
import type { BookingConfig } from "../../../shared/config-schema";
import type { Booking } from "../../../shared/models";

export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds a content line at 75 octets without splitting a UTF-8 character. */
export function foldLine(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = Buffer.byteLength(ch, "utf8");
    if (bytes + size > limit) {
      parts.push(current);
      current = " ";
      bytes = 1;
      limit = 75;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n");
}

/**
 * Location wording for client emails and the .ics. Preset labels are ours and safe to print. Text the client typed is
 * NEVER echoed (an email from our domain must not be a way to deliver a stranger's words, review M-1): they get
 * "the location you gave us". Admin still shows the full text.
 */
export const OWN_LOCATION_PHRASE = "the location you gave us";
export function locationText(b: Booking): string {
  switch (b.location.kind) {
    case "suggested":
      return b.location.label;
    case "own":
      return OWN_LOCATION_PHRASE;
    case "mini_day":
      return b.location.label;
    case "help_me_choose":
      return "Location to be confirmed. Daniella will email suggestions";
    case "removed":
      return "";
  }
}

export function icsSummary(b: Booking, config: BookingConfig): string {
  const name = config.business.name;
  if (b.sessionTypeId === "holiday-minis") return `Holiday Mini with ${name}`;
  if (b.sessionTypeId === "events") return `Event photography with ${name}`;
  return `${b.sessionTypeName} session with ${name}`;
}

export function icsFilename(b: Booking): string {
  return `daniella-beltram-photography-${b.localDate}.ics`;
}

export function buildIcs(b: Booking, config: BookingConfig, nowIso: string): string {
  const host = new URL(config.business.siteUrl).hostname;
  const tentative = b.status === "pending_deposit" || b.status === "requested";
  const description = [
    `Your ${b.sessionTypeName} session with ${config.business.name}.`,
    `Booking reference: ${b.id}`,
    "",
    "Arrive a few minutes early. Times are Eastern.",
    "Weather: I decide by 9:00 AM on the day and will email you.",
    `Need to change something? Reply to your confirmation email or write ${config.email.replyTo}.`,
    "",
    new URL(config.business.siteUrl).hostname,
  ].join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Daniella Beltram Photography//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@${host}`,
    `SEQUENCE:${b.icsSequence}`,
    `DTSTAMP:${toIcsUtc(nowIso)}`,
    `DTSTART:${toIcsUtc(b.startUtc)}`,
    `DTEND:${toIcsUtc(b.endUtc)}`,
    `SUMMARY:${escapeIcsText(icsSummary(b, config))}`,
    `LOCATION:${escapeIcsText(locationText(b))}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `STATUS:${tentative ? "TENTATIVE" : "CONFIRMED"}`,
    `ORGANIZER;CN="${config.business.name.replace(/["\r\n]/g, "")}":mailto:${config.email.fromAddress}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT24H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText("Your session with Daniella is tomorrow")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
