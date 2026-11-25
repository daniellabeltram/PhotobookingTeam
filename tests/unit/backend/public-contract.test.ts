// Front-end facing details of GET /api/config: bufferMin, per-type policy summaries, and the booking schema
// working with the PUBLIC session type shape (null fees), which is what the browser holds.
import { describe, expect, it } from "vitest";
import { getCatalogue, getConfig, getPolicy } from "../../../netlify/lib/config";
import { freshApp } from "../../helpers/app";
import { depositSummaryText } from "../../../shared/money";
import { renderPolicySummary } from "../../../shared/policy-render";
import { buildBookingSchema, type BookingSchemaType } from "../../../shared/schemas/booking";
import type { PublicConfig, PublicSessionType } from "../../../shared/api-types";

const config = getConfig();
const policy = getPolicy(config.policyVersion)!;

describe("GET /api/config additions", () => {
  it("every session type carries bufferMin; Holiday Minis has 10 (the admin minis form spaces slots by duration + buffer)", async () => {
    const app = await freshApp();
    const data = (await app.api().get("/api/config")).body.data as PublicConfig;
    for (const t of data.sessionTypes) expect(typeof t.bufferMin).toBe("number");
    const minis = data.sessionTypes.find((t) => t.id === "holiday-minis")!;
    expect(minis.bufferMin).toBe(10);
    expect(minis.durationMin + minis.bufferMin).toBe(30);
    expect(data.sessionTypes.find((t) => t.id === "portraits")!.bufferMin).toBe(30);
  });
  it("sends the policy summary variants", async () => {
    const app = await freshApp();
    const data = (await app.api().get("/api/config")).body.data as PublicConfig;
    expect(Object.keys(data.policy.summaryVariants).sort()).toEqual(["full", "request"]);
    const doc = (await app.api().get("/api/policies/v0.1-draft")).body.data;
    expect(doc.summaryVariants).toEqual(data.policy.summaryVariants);
  });
});

describe("policy summary wording per type (story 006 #2, 009, 020)", () => {
  const values = (typeId: string) => {
    const t = config.sessionTypes.find((x) => x.id === typeId)!;
    return { ...policy.values, depositText: depositSummaryText(t), unpaidHoldHours: config.scheduling.unpaidHoldHours, requestResponseDays: config.scheduling.requestResponseDays };
  };
  it("retainer types: the hold is a request to pay, and nothing is promised to be released automatically", () => {
    const text = renderPolicySummary(policy.summaryTemplate, values("families"));
    expect(text).toContain("$150");
    expect(text).toContain("within 48 hours");
    expect(text).toMatch(/may be released/);
    expect(text).not.toMatch(/\{\{|held for/);
  });
  it("Events (request): reply time, no payment now, no hold before approval", () => {
    const text = renderPolicySummary(policy.summaryVariants.request, values("events"));
    expect(text).toContain("reply within 2 days");
    expect(text).toContain("No payment is due now");
    expect(text).toContain("50% of the estimated total");
    expect(text).not.toMatch(/\{\{/);
    expect(text.split("If she approves")[0]).not.toMatch(/48 hours/); // the hold starts at approval
  });
  it("Holiday Minis (paid in full): says so, with the price wording", () => {
    const text = renderPolicySummary(policy.summaryVariants.full, values("holiday-minis"));
    expect(text).toContain("paid in full at booking");
    expect(text).toContain("the full session fee");
    expect(text).not.toMatch(/\{\{|retainer/);
  });
  it("changing a deposit in config changes the summary (no hand-typed numbers)", () => {
    const t = config.sessionTypes.find((x) => x.id === "families")!;
    const changed = renderPolicySummary(policy.summaryTemplate, { ...values("families"), depositText: depositSummaryText({ ...t, deposit: { kind: "flat", amountCents: 20000 } }) });
    expect(changed).toContain("$200");
    expect(changed).not.toContain("$150");
  });
});

describe("booking schema with the public session type (null fees)", () => {
  const catalogue = getCatalogue();
  const publicType = (id: string): PublicSessionType & BookingSchemaType => {
    const t = config.sessionTypes.find((x) => x.id === id)!;
    return {
      ...t,
      price: { fromCents: t.priceFromCents, unit: t.priceUnit, label: "" },
      deposit: { kind: t.deposit.kind, text: "", cardText: "" },
      hasPaymentLink: true,
      maxPeople: t.maxPeople,
      includedPeople: t.includedPeople ?? null,
      extraPersonFeeCents: t.extraPersonFeeCents ?? null, // what GET /api/config sends
      nextMiniDates: null,
    } as unknown as PublicSessionType & BookingSchemaType;
  };
  const body = (typeId: string, people: { adults: number; children: number; pets: number }, extra: Record<string, unknown> = {}) => ({
    sessionTypeId: typeId,
    startUtc: "2026-12-09T13:00:00.000Z",
    contact: { fullName: "Pat Example", email: "pat@mail.test", phone: "5615550100", preferredContact: "email" },
    subjectsNames: "Pat",
    people,
    location: { kind: "help_me_choose" },
    portfolioOptOut: false,
    policy: { accepted: true, version: "v0.1-draft" },
    ...extra,
  });
  const parse = (typeId: string, b: object, type: BookingSchemaType) =>
    buildBookingSchema({ type, catalogue, portfolioOptOutEnabled: true }).safeParse(b);

  it("null extraPersonFeeCents means 'no fee': Couples are limited to 2 people", () => {
    const r = parse("couples", body("couples", { adults: 3, children: 0, pets: 0 }, { extra: { couples: { occasion: "other", surpriseProposal: false } } }), publicType("couples"));
    expect(r.success).toBe(false);
    expect(r.success ? "" : JSON.stringify(r.error.issues)).toContain("This session is for up to 2 people");
  });
  it("undefined and null are treated the same", () => {
    const base = publicType("couples");
    const withUndefined = { ...base, extraPersonFeeCents: undefined } as BookingSchemaType;
    const withNull = { ...base, extraPersonFeeCents: null } as BookingSchemaType;
    const b = body("couples", { adults: 3, children: 0, pets: 0 }, { extra: { couples: { occasion: "other", surpriseProposal: false } } });
    expect(parse("couples", b, withUndefined).success).toBe(false);
    expect(parse("couples", b, withNull).success).toBe(false);
  });
  it("a numeric fee allows more than maxPeople (Families), and a null maxPeople has no limit (Events)", () => {
    const fam = parse("families", body("families", { adults: 5, children: 4, pets: 0 }, { extra: { families: { extendedFamily: false } } }), publicType("families"));
    expect(fam.success).toBe(true);
    const ev = publicType("events");
    expect(ev.maxPeople).toBeNull();
    const r = parse(
      "events",
      body("events", { adults: 300, children: 0, pets: 0 }, {
        durationMin: 120,
        location: { kind: "own", text: "A venue" },
        extra: { events: { eventName: "E", eventType: "t", venueAddress: "a", eventStartTime: "18:00", eventEndTime: "20:00", guestCount: 5, onsiteContactName: "n", onsiteContactPhone: "5615550100" } },
      }),
      ev,
    );
    expect(r.success).toBe(false); // adults is capped at 50 by the catalogue, not by maxPeople
    expect(JSON.stringify(r.success ? [] : r.error.issues)).not.toContain("up to");
  });
  it("Portraits keep their limit of 2 whichever way the fee is spelled", () => {
    const b = body("portraits", { adults: 2, children: 1, pets: 0 });
    expect(parse("portraits", b, publicType("portraits")).success).toBe(false);
    expect(parse("portraits", b, { ...publicType("portraits"), extraPersonFeeCents: undefined } as BookingSchemaType).success).toBe(false);
  });
});
