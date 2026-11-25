// CSV guard, .ics, header and HTML safety, first-name greeting, money, config and the pinned policy hash.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { policies } from "../../../config/policies/index";
import { getConfig, getPolicy } from "../../../netlify/lib/config";
import { guardCell, quoteCell, toCsv } from "../../../netlify/lib/csv";
import { bookingRow, CSV_HEADERS } from "../../../netlify/lib/domain/csv-export";
import { buildIcs, escapeIcsText, foldLine, icsFilename } from "../../../netlify/lib/email/ics";
import { escapeHtml, firstNameOf, sanitizeHeader } from "../../../netlify/lib/email/sender";
import { renderAdminNewBooking } from "../../../netlify/lib/email/templates/admin";
import { renderClientEmail } from "../../../netlify/lib/email/templates/client";
import { bookingConfigSchema } from "../../../shared/config-schema";
import { computeAmountDue, formatUsd, resolvePaymentLink } from "../../../shared/money";
import { renderPolicySummary } from "../../../shared/policy-render";
import { generateReference, REFERENCE_RE } from "../../../shared/reference";
import { allowedActions, deriveFlags, waitingLabel } from "../../../shared/status";
import type { Booking } from "../../../shared/models";
import bookingConfig from "../../../config/booking.config";

const config = getConfig();

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: "DBP-ABCDEF", version: 1, status: "pending_deposit", sessionTypeId: "families", sessionTypeName: "Families", bookingMode: "instant",
    durationMin: 60, bufferMin: 30, startUtc: "2027-03-14T14:00:00.000Z", endUtc: "2027-03-14T15:00:00.000Z",
    busyStartUtc: "2027-03-14T13:30:00.000Z", busyEndUtc: "2027-03-14T15:30:00.000Z", localDate: "2027-03-14", localStartTime: "10:00", localEndTime: "11:00",
    timezone: "America/New_York", miniSlotId: null, location: { kind: "own", text: "Somewhere, FL" },
    contact: { fullName: "Pat Example", email: "pat@mail.test", phone: "5615550000", preferredContact: "email" },
    people: { adults: 2, children: 1, pets: 0 }, intake: { subjectsNames: "Pat; secret-note", styleNotes: "SECRET STYLE" }, portfolioOptOut: false,
    policyVersion: "v0.1-draft", policyAcceptedAt: "2027-02-01T14:00:00.000Z",
    pricing: { priceFromCents: 45000, priceUnit: "session", amountDueCents: 15000, amountDueKind: "deposit", paymentLinkUrl: "https://buy.stripe.com/test_x?client_reference_id=DBP-ABCDEF" },
    payment: null, createdAt: "2027-02-01T14:00:00.000Z", holdStartedAt: "2027-02-01T14:00:00.000Z", cancellation: null, decline: null,
    rescheduleCount: 0, lastRescheduledAt: null, icsSequence: 0, emails: {}, history: [], piiDeletedAt: null, ...over,
  };
}

describe("CSV", () => {
  it("guards formula starts (= + - @ tab CR), quotes every field and doubles quotes", () => {
    for (const bad of ["=1+1", "+1", "-2", "@SUM(A1)", "\t=x", "\r=x"]) expect(guardCell(bad)).toBe(`'${bad}`);
    expect(guardCell("normal")).toBe("normal");
    expect(quoteCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(quoteCell("=cmd")).toBe(`"'=cmd"`);
  });
  it("starts with a BOM, uses CRLF, and a header-only file for no rows", () => {
    const csv = toCsv([["a", "b"], ["1", "2"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('﻿"a","b"\r\n"1","2"\r\n');
  });
  it("has the 42 documented columns and a row of the same width", () => {
    expect(CSV_HEADERS).toHaveLength(42);
    expect(CSV_HEADERS.slice(0, 3)).toEqual(["Reference", "Status", "Session type"]);
    expect(bookingRow(booking())).toHaveLength(CSV_HEADERS.length);
  });
  it("a booking with deleted client data has blank personal columns", () => {
    const row = bookingRow(booking({ contact: null, intake: null, people: null, location: { kind: "removed" }, piiDeletedAt: "2027-03-01T00:00:00.000Z" }));
    const personal = ["Client name", "Email", "Phone", "Names photographed", "Location", "Style notes"].map((h) => row[CSV_HEADERS.indexOf(h)]);
    expect(personal).toEqual(["", "", "", "", "", ""]);
    expect(row[0]).toBe("DBP-ABCDEF");
  });
});

describe(".ics", () => {
  const b = booking();
  const ics = buildIcs(b, config, "2027-02-01T15:00:00.000Z");
  it("is RFC-shaped: CRLF, UTC times, stable UID, status, alarm", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0");
    expect(ics).toContain("UID:DBP-ABCDEF@daniellabeltram.photography");
    expect(ics).toContain("DTSTART:20270314T140000Z"); // 10:00 EDT on the DST day
    expect(ics).toContain("DTEND:20270314T150000Z");
    expect(ics).toContain("STATUS:TENTATIVE");
    expect(ics).toContain("TRIGGER:-PT24H");
    expect(ics).toContain("SEQUENCE:0");
    const confirmed = buildIcs(booking({ status: "confirmed", icsSequence: 1 }), config, "2027-02-01T15:00:00.000Z");
    expect(confirmed).toContain("STATUS:CONFIRMED");
    expect(confirmed).toContain("SEQUENCE:1");
    expect(icsFilename(b)).toBe("daniella-beltram-photography-2027-03-14.ics");
  });
  it("holds no client phone, email or intake text", () => {
    for (const secret of ["5615550000", "pat@mail.test", "Pat Example", "SECRET STYLE", "secret-note"]) expect(ics).not.toContain(secret);
  });
  it("the same instant shows 9:00 AM ET on 2027-11-07 (EST) and the .ics time matches", () => {
    const fall = booking({ localDate: "2027-11-07", startUtc: "2027-11-07T14:00:00.000Z", endUtc: "2027-11-07T15:00:00.000Z" });
    expect(buildIcs(fall, config, "2027-10-01T00:00:00.000Z")).toContain("DTSTART:20271107T140000Z");
  });
  it("escapes text and folds long lines at 75 octets without splitting characters", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const folded = foldLine("DESCRIPTION:" + "é".repeat(100)).split("\r\n");
    for (const line of folded) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    expect(folded.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(folded.join("").replace(/ /g, "")).toBe("DESCRIPTION:" + "é".repeat(100));
  });
});

describe("email safety (M5)", () => {
  it("sanitizeHeader strips CR LF and control characters, U+2028/2029/0085, and cuts to 80 characters", () => {
    expect(sanitizeHeader("Hi\r\nBcc: x@y.test")).toBe("Hi Bcc: x@y.test");
    expect(sanitizeHeader("a b c\u0085d\u0000e")).toBe("a b c d e");
    expect(sanitizeHeader("x".repeat(200)).length).toBeLessThanOrEqual(80);
  });
  it("escapeHtml escapes the five characters", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });
  it("greets by first name only, at most 30 characters, dropping links and addresses", () => {
    expect(firstNameOf("Pat Example")).toBe("Pat");
    expect(firstNameOf("https://evil.test/win Pat")).toBe("there");
    expect(firstNameOf("www.evil.test")).toBe("there");
    expect(firstNameOf("evil.test")).toBe("there");
    expect(firstNameOf("a@b.test")).toBe("there");
    expect(firstNameOf("")).toBe("there");
    expect(firstNameOf("A".repeat(60))).toHaveLength(30);
    expect(firstNameOf("Pat<script>")).toBe("Patscript");
  });
  it("client emails never repeat free text, and an HTML name is escaped", () => {
    const b = booking({ contact: { fullName: "<b>Pat</b> Example", email: "pat@mail.test", phone: "5615550000", preferredContact: "email" } });
    const type = config.sessionTypes.find((t) => t.id === "families")!;
    for (const kind of ["booking_received", "request_received", "approved", "declined", "confirmed", "cancelled", "rescheduled"] as const) {
      const out = renderClientEmail(kind, { config, booking: b, type, baseUrl: "https://book.example.org" });
      for (const s of ["SECRET STYLE", "secret-note", "5615550000", "pat@mail.test"]) {
        expect(out.text).not.toContain(s);
        expect(out.html).not.toContain(s);
      }
      expect(out.html).not.toContain("<b>");
      expect(out.subject).not.toMatch(/[\r\n]/);
    }
  });
  it("Daniella's notice is minimal: reference, type, time, name, admin link only", () => {
    const type = config.sessionTypes.find((t) => t.id === "families")!;
    const out = renderAdminNewBooking({ config, booking: booking(), type, baseUrl: "https://book.example.org" });
    const all = out.subject + out.text + out.html;
    expect(out.text).toContain("DBP-ABCDEF");
    expect(out.text).toContain("https://book.example.org/admin/#/bookings/DBP-ABCDEF");
    for (const s of ["pat@mail.test", "5615550000", "SECRET STYLE", "secret-note", "Somewhere, FL", "Bright"]) expect(all).not.toContain(s);
  });
});

describe("money and status", () => {
  it("amount due: flat, percent of an hourly estimate, full, none", () => {
    const t = (id: string) => config.sessionTypes.find((x) => x.id === id)!;
    expect(computeAmountDue(t("families"), 60)).toMatchObject({ amountCents: 15000, kind: "deposit" });
    expect(computeAmountDue(t("events"), 180)).toEqual({ amountCents: 37500, kind: "estimated_deposit", estimatedTotalCents: 75000 });
    expect(computeAmountDue(t("holiday-minis"), 20)).toMatchObject({ amountCents: 22500, kind: "full" });
    expect(computeAmountDue({ ...t("families"), deposit: { kind: "none" } }, 60).kind).toBe("none");
    expect(formatUsd(123456)).toBe("$1,234.56");
  });
  it("payment links: Stripe gets the reference, others don't, none-deposit has none, override wins", () => {
    const t = config.sessionTypes.find((x) => x.id === "families")!;
    expect(resolvePaymentLink(t, 60, "DBP-ABCDEF")).toContain("client_reference_id=DBP-ABCDEF");
    expect(resolvePaymentLink({ ...t, depositPaymentLink: "https://pay.test/x" }, 60, "DBP-ABCDEF")).toBe("https://pay.test/x");
    expect(resolvePaymentLink({ ...t, depositPaymentLink: null }, 60, "DBP-ABCDEF")).toBeNull();
    expect(resolvePaymentLink({ ...t, depositPaymentLink: { "120": "https://pay.test/two-hours" } }, 120, "DBP-ABCDEF")).toBe("https://pay.test/two-hours");
    expect(resolvePaymentLink({ ...t, deposit: { kind: "none" } }, 60, "DBP-ABCDEF")).toBeNull();
    expect(resolvePaymentLink(t, 60, "DBP-ABCDEF", "https://override.test/p")).toBe("https://override.test/p");
    expect(resolvePaymentLink({ ...t, depositPaymentLink: "http://insecure.test/x" as never }, 60, "DBP-ABCDEF")).toBeNull();
  });
  it("references are DBP- plus 6 safe characters and not sequential", () => {
    const refs = new Set(Array.from({ length: 200 }, generateReference));
    expect(refs.size).toBe(200);
    for (const r of refs) expect(r).toMatch(REFERENCE_RE);
  });
  it("allowed actions follow the transition table and the clock", () => {
    const now = "2027-03-01T00:00:00.000Z";
    expect(allowedActions(booking({ status: "requested" }), now)).toEqual(["approve", "decline", "reschedule", "resend_email"]);
    expect(allowedActions(booking({ status: "requested", startUtc: "2027-02-01T00:00:00.000Z" }), now)).not.toContain("approve");
    expect(allowedActions(booking(), now)).toEqual(["mark_paid", "confirm_without_payment", "cancel", "reschedule", "resend_email"]);
    expect(allowedActions(booking({ status: "confirmed" }), now)).not.toContain("complete");
    expect(allowedActions(booking({ status: "confirmed" }), "2027-03-15T00:00:00.000Z")).toContain("complete");
    expect(allowedActions(booking({ status: "cancelled" }), now)).toEqual(["delete_client_data", "resend_email"]);
    expect(allowedActions(booking({ status: "cancelled", piiDeletedAt: now }), now)).toEqual([]);
  });
  it("flags: deposit overdue counts from holdStartedAt, reply overdue from requestedAt, email not sent from the latest client email", () => {
    const s = { unpaidHoldHours: 48, requestResponseDays: 2 };
    const created = "2027-02-01T14:00:00.000Z";
    expect(deriveFlags(booking(), "2027-02-03T13:59:00.000Z", s)).not.toContain("deposit_overdue");
    expect(deriveFlags(booking(), "2027-02-03T14:00:00.000Z", s)).toContain("deposit_overdue");
    const req = booking({ status: "requested", holdStartedAt: null, requestedAt: created });
    expect(deriveFlags(req, "2027-02-03T14:00:00.000Z", s)).toContain("reply_overdue");
    const failed = booking({ emails: { booking_received: { status: "failed", at: "2027-02-01T14:00:01.000Z", attempts: 1 }, admin_new_booking: { status: "sent", at: "2027-02-01T14:00:02.000Z", attempts: 1 } } });
    expect(deriveFlags(failed, "2027-02-01T15:00:00.000Z", s)).toContain("email_not_sent");
    const fixed = booking({ emails: { booking_received: { status: "sent", at: "2027-02-01T16:00:00.000Z", attempts: 2 } } });
    expect(deriveFlags(fixed, "2027-02-01T17:00:00.000Z", s)).not.toContain("email_not_sent");
  });
  it("waiting labels", () => {
    expect(waitingLabel("2027-02-01T00:00:00.000Z", "2027-02-03T05:30:00.000Z")).toBe("Waiting 2 days 5 h");
    expect(waitingLabel("2027-02-01T00:00:00.000Z", "2027-02-01T05:30:00.000Z")).toBe("Waiting 5 h");
    expect(waitingLabel("2027-02-01T00:00:00.000Z", "2027-02-01T00:30:00.000Z")).toBe("Waiting < 1 h");
    expect(waitingLabel("2027-02-01T00:00:00.000Z", "2027-02-02T00:00:00.000Z")).toBe("Waiting 1 day");
  });
});

describe("config (ADR 0007)", () => {
  it("the real config validates, Events are request mode, and minis never count toward the cap", () => {
    expect(() => bookingConfigSchema.parse(bookingConfig)).not.toThrow();
    expect(config.sessionTypes.find((t) => t.id === "events")?.bookingMode).toBe("request");
    expect(config.sessionTypes.filter((t) => t.kind === "mini").every((t) => !t.countsTowardDailyCap)).toBe(true);
  });
  it("rejects a window that would let a busy interval cross midnight", () => {
    const bad = structuredClone(bookingConfig) as unknown as typeof bookingConfig;
    (bad.scheduling.windowSets.venue as { windows: { end: string }[] }[])[0]!.windows[0]!.end = "23:50";
    expect(() => bookingConfigSchema.parse(bad)).toThrow();
  });
  it("rejects unknown keys, non-https payment links and unknown window sets", () => {
    const base = structuredClone(bookingConfig) as unknown as Record<string, unknown>;
    expect(() => bookingConfigSchema.parse({ ...base, surprise: 1 })).toThrow();
    const http = structuredClone(bookingConfig) as unknown as typeof bookingConfig;
    (http.sessionTypes[0] as { depositPaymentLink: string }).depositPaymentLink = "http://insecure.test/pay";
    expect(() => bookingConfigSchema.parse(http)).toThrow();
    const noset = structuredClone(bookingConfig) as unknown as typeof bookingConfig;
    (noset.sessionTypes[0] as { windowSet: string }).windowSet = "nope";
    expect(() => bookingConfigSchema.parse(noset)).toThrow();
  });
  it("a policy version file never changes: its SHA-256 is pinned in hashes.json", () => {
    const pinned = JSON.parse(readFileSync("config/policies/hashes.json", "utf8")) as Record<string, string>;
    expect(Object.keys(pinned).sort()).toEqual(Object.keys(policies).sort());
    for (const [version, hash] of Object.entries(pinned)) {
      const file = readFileSync(`config/policies/${version}.ts`);
      expect(createHash("sha256").update(file).digest("hex"), `${version} was edited; add a new version instead`).toBe(hash);
    }
  });
  it("the current policy exists; the summary fills from config values (story 006 #2)", () => {
    const policy = getPolicy(config.policyVersion)!;
    const type = config.sessionTypes.find((t) => t.id === "families")!;
    const text = renderPolicySummary(policy.summaryTemplate, { ...policy.values, depositText: "$150", unpaidHoldHours: config.scheduling.unpaidHoldHours });
    expect(text).toContain("$150");
    expect(text).toContain(`${policy.values.freeRescheduleDays} days`);
    expect(text).not.toContain("{{");
    expect(type.deposit.kind).toBe("flat");
    expect(getPolicy("v9.9")).toBeNull();
    expect(getPolicy("__proto__")).toBeNull();
  });
});
