// POST /api/bookings end to end against the memory and file drivers (stories 004, 005, 006, 007, 008, 017, 020).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBookingBody, findOverlaps, firstOpenSlot, newKey, type Api } from "../../helpers/builders";
import { freshApp } from "../../helpers/app";
import { ADMIN_EMAIL, CLIENT, OTHER_CLIENT } from "../../helpers/seed";

const FROM = "2026-12-01";
const TO = "2027-01-15";

async function setup(env: Record<string, string | undefined> = {}) {
  const app = await freshApp(env);
  const api = app.api();
  const admin = app.api();
  const svcMod = await import("../../../netlify/lib/services");
  const svc = svcMod.getServices();
  const emails = svc.email as unknown as { sent: any[]; failNext(n: number): void; clear(): void };
  return { app, api, admin, svc, emails, svcMod };
}
const login = async (admin: Api) => expect((await admin.login()).status).toBe(200);

function eventsBody(slot: { startUtc: string }, over: Record<string, unknown> = {}, durationMin = 120) {
  return {
    sessionTypeId: "events",
    startUtc: slot.startUtc,
    durationMin,
    contact: { fullName: CLIENT.fullName, email: CLIENT.email, phone: CLIENT.phone, preferredContact: "email" },
    subjectsNames: "The guests",
    people: { adults: 10, children: 0, pets: 0 },
    location: { kind: "own", text: "A venue, West Palm Beach" },
    extra: {
      events: {
        eventName: "Test Party", eventType: "birthday", venueAddress: "1 Clematis St, West Palm Beach",
        eventStartTime: "18:00", eventEndTime: "20:00", guestCount: 20, onsiteContactName: "Pat", onsiteContactPhone: "5615550100",
      },
    },
    policy: { accepted: true, version: "v0.1-draft" },
    ...over,
  };
}

describe("idempotency (story 004 #6, 007 #4)", () => {
  it("a retry with the same key and body returns the same 201, one booking, one set of emails", async () => {
    const { api, admin, emails } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const body = buildBookingBody({ type: "portraits", slot });
    const key = newKey();
    const a = await api.createBooking(body, key);
    const b = await api.createBooking(body, key);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body).toEqual(a.body);
    expect(emails.sent.map((m) => m.kind).sort()).toEqual(["admin_new_booking", "booking_received"]);
    await login(admin);
    expect((await admin.get("/api/admin/bookings?view=all")).body.data.total).toBe(1);
  });
  it("the same key with different answers is 422 IDEMPOTENCY_KEY_REUSED", async () => {
    const { api } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const key = newKey();
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot }), key)).status).toBe(201);
    const other = await api.createBooking(buildBookingBody({ type: "portraits", slot, contact: { fullName: "Someone Else" } }), key);
    expect(other.status).toBe(422);
    expect(other.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });
  it("a failed attempt releases the key, so the corrected form can reuse it", async () => {
    const { api } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const key = newKey();
    const bad = buildBookingBody({ type: "portraits", slot, contact: { email: "nope" } });
    expect((await api.createBooking(bad, key)).status).toBe(400);
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot }), key)).status).toBe(201);
  });
  it("a missing or malformed Idempotency-Key is a 400 with header.idempotencyKey", async () => {
    const { api } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    for (const key of [null, "not-a-uuid"]) {
      const r = await api.createBooking(buildBookingBody({ type: "portraits", slot }), key);
      expect(r.status).toBe(400);
      expect(r.body.error.details.fieldErrors["header.idempotencyKey"]).toBeTruthy();
    }
  });
});

describe("concurrency: zero double bookings (story 004 #1, #2, #7, #8)", () => {
  const drivers: [string, () => Record<string, string>][] = [
    ["memory", () => ({ STORE_DRIVER: "memory" })],
    ["file", () => ({ STORE_DRIVER: "file", DATA_DIR: mkdtempSync(join(tmpdir(), "dbp-race-")) })],
  ];
  it.each(drivers)("20 parallel creates for one slot: exactly 1 success, 19 SLOT_TAKEN with alternatives (%s)", async (_n, env) => {
    const { api, admin } = await setup(env());
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        api.createBooking(buildBookingBody({ type: "portraits", slot, contact: { email: `client${i}@example.test`, fullName: `Client Number${i}` } }), newKey(), { ip: `10.1.0.${i}` }),
      ),
    );
    const ok = results.filter((r) => r.status === 201);
    const taken = results.filter((r) => r.status === 409);
    expect(ok).toHaveLength(1);
    expect(taken).toHaveLength(19);
    expect(results.filter((r) => r.status >= 500)).toHaveLength(0);
    for (const r of taken) {
      expect(r.body.error.code).toBe("SLOT_TAKEN");
      expect(Array.isArray(r.body.error.details.alternatives)).toBe(true);
      expect(r.body.error.details.alternatives.length).toBeLessThanOrEqual(3);
      expect(r.body.error.details.alternatives.some((a: any) => a.startUtc === slot.startUtc)).toBe(false);
    }
    await login(admin);
    const list = (await admin.get("/api/admin/bookings?view=all&pageSize=100")).body.data;
    expect(list.total).toBe(1);
    expect(findOverlaps(list.items, 30)).toEqual([]);
  });

  it("overlapping slots of DIFFERENT types submitted together: only one booking (story 004 #2)", async () => {
    const { api } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const rs = await Promise.all([
      api.createBooking(buildBookingBody({ type: "portraits", slot }), newKey(), { ip: "10.2.0.1" }),
      api.createBooking(buildBookingBody({ type: "couples", slot }), newKey(), { ip: "10.2.0.2" }),
      api.createBooking(buildBookingBody({ type: "families", slot }), newKey(), { ip: "10.2.0.3" }),
    ]);
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(2);
  });

  it("two families race for the same mini slot: one wins and spots left drops by exactly one (story 004 #8)", async () => {
    const { api, admin } = await setup();
    await login(admin);
    const made = await admin.post("/api/admin/mini-days/2026-12-12/slots", { location: "Phillips Point", theme: "Winter", startTimes: ["08:00", "08:30", "09:00"] });
    expect(made.status).toBe(201);
    const before = (await api.availability("minis", "2026-12-12", "2026-12-12")).body.data.days[0]!;
    expect(before.mini!.spotsLeft).toBe(3);
    const slot = before.slots[0]!;
    const rs = await Promise.all(
      [1, 2].map((i) => api.createBooking(buildBookingBody({ type: "minis", slot, contact: { email: `mini${i}@example.test` } }), newKey(), { ip: `10.3.0.${i}` })),
    );
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    const after = (await api.availability("minis", "2026-12-12", "2026-12-12")).body.data.days[0]!;
    expect(after.mini!.spotsLeft).toBe(2);
    expect(after.slots.map((s) => s.miniSlotId)).not.toContain(slot.miniSlotId);
  });

  it("the same time on a day that already reached the daily cap is refused (cap under concurrency)", async () => {
    const { api, svcMod } = await setup();
    const slots = [
      await firstOpenSlot(api, "events", FROM, "2026-12-12", 120, 0),
    ];
    const svc = svcMod.getServices();
    svcMod.setServicesForTest({ config: { ...svc.config, scheduling: { ...svc.config.scheduling, maxSessionsPerDay: 1 } } });
    const day = slots[0]!.localDate;
    const avail = (await api.availability("events", day, day, 120)).body.data.days[0]!;
    // pick two start times 4 hours apart (no buffer overlap) on the same date
    const first = avail.slots[0]!;
    const second = avail.slots.find((s) => s.startUtc >= new Date(Date.parse(first.startUtc) + 4 * 3600_000).toISOString())!;
    const rs = await Promise.all([
      api.createBooking(buildBookingBody({ type: "events", slot: first, durationMin: 120, override: eventsBody(first) }), newKey(), { ip: "10.4.0.1" }),
      api.createBooking(buildBookingBody({ type: "events", slot: second, durationMin: 120, override: eventsBody(second) }), newKey(), { ip: "10.4.0.2" }),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});

describe("conflict response (story 004 #1, #3, #5)", () => {
  it("SLOT_TAKEN lists up to 3 alternatives, same date first, closest first", async () => {
    const { api } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot }))).status).toBe(201);
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot, contact: { email: OTHER_CLIENT.email } }));
    expect(r.status).toBe(409);
    const alts = r.body.error.details.alternatives as { localDate: string; startUtc: string }[];
    expect(alts.length).toBe(3);
    const gaps = alts.map((a) => Math.abs(Date.parse(a.startUtc) - Date.parse(slot.startUtc)));
    const sameDate = alts.filter((a) => a.localDate === slot.localDate).length;
    expect(alts.slice(0, sameDate).every((a) => a.localDate === slot.localDate)).toBe(true);
    if (sameDate === alts.length) expect(gaps).toEqual([...gaps].sort((x, y) => x - y));
  });
  it("a time that is not on the grid, in the past, inside the notice period or blocked is SLOT_TAKEN", async () => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const offGrid = new Date(Date.parse(slot.startUtc) + 7 * 60_000).toISOString();
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot: { ...slot, startUtc: offGrid } }))).body.error.code).toBe("SLOT_TAKEN");
    const soon = "2026-12-02T14:00:00.000Z"; // inside the 72 hour notice
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot: { ...slot, startUtc: soon } }))).body.error.code).toBe("SLOT_TAKEN");
    await login(admin);
    expect((await admin.post("/api/admin/blocks", { kind: "all_day", startDate: slot.localDate, endDate: slot.localDate, label: null })).status).toBe(201);
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot }))).body.error.code).toBe("SLOT_TAKEN");
  });
  it("cancelling frees the slot for the next client (story 013 #4)", async () => {
    const { api, admin } = await setup();
    await login(admin);
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const ref = (await api.createBooking(buildBookingBody({ type: "portraits", slot }))).body.data.reference;
    const d = (await admin.get(`/api/admin/bookings/${ref}`)).body.data;
    expect((await admin.patch(`/api/admin/bookings/${ref}`, { action: "cancel", expectedVersion: d.version, reason: "client_cancelled", notifyClient: false })).status).toBe(200);
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot, contact: { email: OTHER_CLIENT.email } }))).status).toBe(201);
  });
});

describe("validation (story 005 #4, 006 #4)", () => {
  it("rejects unknown fields, fields of other session types, and a missing policy acceptance", async () => {
    const { api } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const base = buildBookingBody({ type: "portraits", slot });
    const unknown = await api.createBooking({ ...base, isAdmin: true });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.details.fieldErrors.isAdmin).toBe("Unknown field");
    const other = await api.createBooking({ ...base, extra: { events: { guestCount: 5 } } });
    expect(other.status).toBe(400);
    expect(other.body.error.details.fieldErrors["extra.events"]).toBe("Unknown field");
    const noPolicy = await api.createBooking({ ...base, policy: { accepted: false, version: "v0.1-draft" } });
    expect(noPolicy.status).toBe(400);
    expect(noPolicy.body.error.details.fieldErrors["policy.accepted"]).toBe("Please accept the policies to book");
    const noPolicyAtAll = await api.createBooking({ ...base, policy: undefined });
    expect(noPolicyAtAll.status).toBe(400);
  });
  it("field-level messages: email, phone, counts, lengths, minimum one person, Couples maximum", async () => {
    const { api } = await setup();
    const slot = await firstOpenSlot(api, "couples", FROM, TO);
    const base = buildBookingBody({ type: "couples", slot });
    const r = await api.createBooking({
      ...base,
      contact: { fullName: "x".repeat(101), email: "no-at-sign", phone: "123", preferredContact: "carrier-pigeon" },
      people: { adults: 3, children: -1, pets: 1.5 },
      styleNotes: "y".repeat(1001),
    });
    expect(r.status).toBe(400);
    const f = r.body.error.details.fieldErrors;
    expect(f["contact.email"]).toBe("Enter an email like name@example.com");
    expect(f["contact.phone"]).toMatch(/10-digit/);
    expect(f["contact.fullName"]).toMatch(/under 100/);
    expect(f["contact.preferredContact"]).toBeTruthy();
    expect(f["people.children"]).toBeTruthy();
    expect(f["people.pets"]).toBeTruthy();
    expect(f["styleNotes"]).toMatch(/under 1000/);
    const tooMany = await api.createBooking({ ...base, people: { adults: 3, children: 0, pets: 0 } });
    expect(tooMany.body.error.details.fieldErrors["people.adults"]).toBe("This session is for up to 2 people");
    const none = await api.createBooking({ ...base, people: { adults: 0, children: 0, pets: 2 } });
    expect(none.body.error.details.fieldErrors["people.adults"]).toBe("At least one person is needed");
  });
  it("Families may exceed the included people (an extra fee applies); children's ages are optional", async () => {
    const { api } = await setup();
    const slot = await firstOpenSlot(api, "families", FROM, TO);
    const base = buildBookingBody({ type: "families", slot });
    const r = await api.createBooking({ ...base, people: { adults: 4, children: 4, pets: 0 }, extra: { families: { extendedFamily: true } } });
    expect(r.status).toBe(201);
  });
  it("Events: end after start, guests at least 1, a length from the list, own location text", async () => {
    const { api } = await setup();
    const slot = await firstOpenSlot(api, "events", FROM, TO, 120);
    const evBad = eventsBody(slot);
    (evBad.extra as any).events.eventEndTime = "17:00";
    (evBad.extra as any).events.guestCount = 0;
    const r = await api.createBooking(evBad);
    expect(r.status).toBe(400);
    expect(r.body.error.details.fieldErrors["extra.events.eventEndTime"]).toBe("The event must end after it starts");
    expect(r.body.error.details.fieldErrors["extra.events.guestCount"]).toBeTruthy();
    expect((await api.createBooking(eventsBody(slot, { durationMin: 150 }))).body.error.details.fieldErrors.durationMin).toBeTruthy();
    expect((await api.createBooking(eventsBody(slot, { durationMin: undefined }))).body.error.details.fieldErrors.durationMin).toBeTruthy();
    expect((await api.createBooking(eventsBody(slot, { location: { kind: "help_me_choose" } }))).body.error.details.fieldErrors.location).toBeTruthy();
  });
  it("an old policy version is 409 POLICY_VERSION_CHANGED with the current one", async () => {
    const { api } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot, policyVersion: "v0.0-old" }));
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("POLICY_VERSION_CHANGED");
    expect(r.body.error.details.currentVersion).toBe("v0.1-draft");
  });
  it("unknown or inactive session type is 422; body limits and content types are enforced", async () => {
    const { api } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const r = await api.createBooking({ ...buildBookingBody({ type: "portraits", slot }), sessionTypeId: "weddings" });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe("SESSION_TYPE_UNAVAILABLE");
    const big = await api.call("POST", "/api/bookings", { rawBody: JSON.stringify({ pad: "x".repeat(40_000) }), idempotencyKey: newKey() });
    expect(big.status).toBe(413);
    const text = await api.call("POST", "/api/bookings", { rawBody: "hello", headers: { "content-type": "text/plain" }, idempotencyKey: newKey() });
    expect(text.status).toBe(400);
    const broken = await api.call("POST", "/api/bookings", { rawBody: "{not json", idempotencyKey: newKey() });
    expect(broken.status).toBe(400);
    expect((await api.get("/api/bookings")).status).toBe(405);
  });
  it("stores the policy version and a SERVER timestamp, not a client one", async () => {
    const { api, admin } = await setup();
    await login(admin);
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const ref = (await api.createBooking({ ...buildBookingBody({ type: "portraits", slot }), policyAcceptedAt: "1999-01-01T00:00:00.000Z" })).body;
    expect(ref.error.details.fieldErrors.policyAcceptedAt).toBe("Unknown field");
    const ok = (await api.createBooking(buildBookingBody({ type: "portraits", slot }))).body.data.reference;
    const d = (await admin.get(`/api/admin/bookings/${ok}`)).body.data;
    expect(d.policy.version).toBe("v0.1-draft");
    expect(d.policy.acceptedAt).toBe("2026-12-01T14:00:00.000Z"); // FAKE_NOW
  });
});

describe("spam protection (story 017)", () => {
  it("honeypot filled: the same 201 shape, nothing stored, no email, no slot reserved", async () => {
    const { api, admin, emails } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const real = await api.createBooking(buildBookingBody({ type: "portraits", slot: { ...slot, startUtc: slot.startUtc } , override: { website: "http://spam.test" } }));
    expect(real.status).toBe(201);
    expect(real.body.data.reference).toMatch(/^DBP-/);
    expect(Object.keys(real.body.data).sort()).toEqual(
      ["amountDue", "bookingMode", "display", "durationMin", "emailSent", "endUtc", "holdHours", "locationLabel", "paymentLinkUrl", "reference", "requestResponseDays", "sessionTypeId", "sessionTypeName", "startUtc", "status"].sort(),
    );
    expect(emails.sent).toHaveLength(0);
    await login(admin);
    expect((await admin.get("/api/admin/bookings?view=all")).body.data.total).toBe(0);
    // the slot is still free for a real client
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot }))).status).toBe(201);
  });
  it("more than the limit from one visitor is 429 with Retry-After and the contact line; others are unaffected", async () => {
    const { api } = await setup({ RATE_LIMIT_DISABLED: undefined });
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const bad = { ...buildBookingBody({ type: "portraits", slot }), contact: { fullName: "x", email: "bad", phone: "1", preferredContact: "email" } };
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await api.createBooking(bad, newKey(), { ip: "10.9.9.9" })).status);
    expect(statuses.slice(0, 5)).toEqual([400, 400, 400, 400, 400]);
    expect(statuses[5]).toBe(429);
    const limited = await api.createBooking(bad, newKey(), { ip: "10.9.9.9" });
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(limited.body.error.message).toMatch(/contact Daniella at hello@/);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot }), newKey(), { ip: "10.9.9.10" })).status).toBe(201);
  });
  it("the site-wide daily cap refuses further bookings with RATE_LIMITED and creates nothing (review M5)", async () => {
    const { api, admin, svcMod } = await setup({ RATE_LIMIT_DISABLED: undefined });
    const svc = svcMod.getServices();
    svcMod.setServicesForTest({
      config: { ...svc.config, limits: { ...svc.config.limits, bookingGlobalLimit: { max: 2, windowMinutes: 1440 }, bookingRateLimit: { max: 50, windowMinutes: 60 } } },
    });
    const a = await firstOpenSlot(api, "portraits", FROM, TO, undefined, 0);
    const b = await firstOpenSlot(api, "couples", FROM, TO, undefined, 3);
    const c = await firstOpenSlot(api, "families", FROM, TO, undefined, 6);
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot: a }), newKey(), { ip: "10.5.0.1" })).status).toBe(201);
    expect((await api.createBooking(buildBookingBody({ type: "couples", slot: b }), newKey(), { ip: "10.5.0.2" })).status).toBe(201);
    const third = await api.createBooking(buildBookingBody({ type: "families", slot: c }), newKey(), { ip: "10.5.0.3" });
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe("RATE_LIMITED");
    await login(admin);
    expect((await admin.get("/api/admin/bookings?view=all")).body.data.total).toBe(2);
  });
});

describe("emails after the commit (story 008)", () => {
  it("instant booking: client email with .ics to a bare address, minimal notice to Daniella", async () => {
    const { api, emails } = await setup();
    const slot = await firstOpenSlot(api, "families", FROM, TO);
    const r = await api.createBooking(buildBookingBody({ type: "families", slot }));
    expect(r.body.data.emailSent).toBe(true);
    const client = emails.sent.find((m) => m.kind === "booking_received");
    const admin = emails.sent.find((m) => m.kind === "admin_new_booking");
    expect(client.to).toBe(CLIENT.email);
    expect(client.subject).toMatch(/^Your Families session is booked: /);
    expect(client.attachments).toHaveLength(1);
    expect(client.attachments[0].filename).toMatch(/^daniella-beltram-photography-\d{4}-\d{2}-\d{2}\.ics$/);
    const ics = Buffer.from(client.attachments[0].contentBase64, "base64").toString("utf8");
    expect(ics).toContain("STATUS:TENTATIVE");
    expect(ics).toContain(`UID:${r.body.data.reference}@daniellabeltram.photography`);
    expect(client.text).toContain(r.body.data.reference);
    expect(client.text).toContain("Hi Zelda,");
    expect(client.text).not.toContain("Quillfeather");
    expect(client.text).not.toContain("QA-STYLE-NOTE");
    expect(admin.to).toBe("hello@daniellabeltram.photography");
    expect(admin.attachments).toBeUndefined();
    expect(admin.text).not.toContain(CLIENT.email);
    expect(admin.text).not.toContain(CLIENT.phone);
    expect(admin.text).toContain(`/admin/#/bookings/${r.body.data.reference}`);
  });
  it("Events request: request wording, no payment link, no .ics, 'New event request' notice (story 020 #5, #6)", async () => {
    const { api, emails } = await setup();
    const slot = await firstOpenSlot(api, "events", FROM, TO, 120);
    const r = await api.createBooking(eventsBody(slot));
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ status: "requested", bookingMode: "request", paymentLinkUrl: null, holdHours: null, requestResponseDays: 2 });
    expect(r.body.data.amountDue).toMatchObject({ kind: "estimated_deposit", dueNow: false, cents: 25000 }); // 50% of 2 hours x $250
    const client = emails.sent.find((m) => m.kind === "request_received");
    expect(client.subject).toBe(`We received your event request — ${r.body.data.reference}`);
    expect(client.attachments).toBeUndefined();
    expect(client.text).not.toMatch(/buy\.stripe|Pay retainer/);
    expect(client.text).toContain("not confirmed yet");
    expect(emails.sent.find((m) => m.kind === "admin_new_booking").subject).toBe(`New event request — needs your approval — ${r.body.data.reference}`);
  });
  it("an email failure never rolls the booking back: 201, emailSent false, flagged, and Resend clears it (story 008 #5, #6)", async () => {
    const { api, admin, emails } = await setup();
    await login(admin);
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    emails.failNext(2);
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    expect(r.status).toBe(201);
    expect(r.body.data.emailSent).toBe(false);
    const ref = r.body.data.reference;
    const d = (await admin.get(`/api/admin/bookings/${ref}`)).body.data;
    expect(d.flags).toContain("email_not_sent");
    expect(d.emails.booking_received.status).toBe("failed");
    const resend = await admin.post(`/api/admin/bookings/${ref}/resend-email`, {});
    expect(resend.status).toBe(200);
    expect(resend.body.data).toEqual({ kind: "booking_received", status: "sent" });
    expect((await admin.get(`/api/admin/bookings/${ref}`)).body.data.flags).not.toContain("email_not_sent");
    expect(emails.sent.filter((m) => m.kind === "booking_received")).toHaveLength(1);
  });
});

describe("one time everywhere, across DST (invariant)", () => {
  it.each([
    ["2027-03-14", "2027-02-01T09:00:00-05:00"],
    ["2027-11-07", "2027-10-01T09:00:00-04:00"],
  ])("the 201, the email, the .ics and admin agree on %s", async (date, now) => {
    const { api, admin, emails } = await setup({ FAKE_NOW: now });
    await login(admin);
    const slot = await firstOpenSlot(api, "portraits", date, date);
    expect(slot.localDate).toBe(date);
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    expect(r.status).toBe(201);
    const created = r.body.data;
    const detail = (await admin.get(`/api/admin/bookings/${created.reference}`)).body.data;
    const client = emails.sent.find((m) => m.kind === "booking_received");
    const ics = Buffer.from(client.attachments[0].contentBase64, "base64").toString("utf8");
    expect(detail.display.timeRange).toBe(created.display.timeRange);
    expect(detail.display.date).toBe(created.display.date);
    expect(client.text).toContain(created.display.timeRange);
    expect(client.text).toContain(created.display.date);
    expect(slot.rangeLabel).toBe(created.display.timeRange);
    const compact = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    expect(ics).toContain(`DTSTART:${compact(created.startUtc)}`);
    expect(ics).toContain(`DTEND:${compact(created.endUtc)}`);
    expect(detail.localStartTime).toBe(slot.localTime);
  });
});

describe("handler-level environment guard (H1)", () => {
  it("answers a generic 500 and logs only a rule code when the environment is unsafe", async () => {
    const lines: string[] = [];
    const { setLogSink } = await import("../../../netlify/lib/log");
    setLogSink((l) => lines.push(l));
    try {
      const app = await freshApp({ APP_ENV: "production", FAKE_NOW: "2026-12-01T09:00:00-05:00" });
      const { setLogSink: sink } = await import("../../../netlify/lib/log");
      sink((l) => lines.push(l));
      const r = await app.api().get("/api/config");
      expect(r.status).toBe(500);
      expect(r.body.error.code).toBe("INTERNAL");
      expect(JSON.stringify(r.body)).not.toMatch(/FAKE_NOW|production|rule/i);
    } finally {
      setLogSink(null);
    }
    expect(lines.join("\n")).toContain('"rule"');
    expect(ADMIN_EMAIL).toBeTruthy();
  });
});
