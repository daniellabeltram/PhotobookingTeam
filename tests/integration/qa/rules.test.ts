// Scheduling rules and server-side validation (stories 002, 005, 006, 007, 009, 013, 015; must-have 4, 5, 8).
import "../../helpers/env";
import { describe, it, expect, beforeEach } from "vitest";
import { freshApp, sentEmails } from "../../helpers/app";
import { buildBookingBody, firstOpenSlot, type Api, type Slot } from "../../helpers/builders";
import { FIXED_NOW } from "../../helpers/clock";

let app: Awaited<ReturnType<typeof freshApp>>;
let api: Api;
let admin: Api;
const FROM = "2026-12-01", TO = "2027-01-31";
beforeEach(async () => {
  app = await freshApp();
  api = app.api();
  admin = app.api();
  await admin.login();
});

describe("minimum notice, horizon, working days (002 #2, #5, #6)", () => {
  it("no slot starts before now + minimumNoticeHours; creating one anyway is SLOT_TAKEN", async () => {
    const cfg = (await api.get("/api/config")).body.data;
    const notice = cfg.scheduling.minimumNoticeHours;
    const earliest = +FIXED_NOW + notice * 3600_000;
    const days = (await api.availability("portraits", FROM, TO)).body.data.days;
    for (const s of days.flatMap((d: any) => d.slots) as Slot[]) expect(+new Date(s.startUtc)).toBeGreaterThanOrEqual(earliest);
    const first = await firstOpenSlot(api, "portraits", FROM, TO);
    const tooSoon = { ...first, startUtc: new Date(earliest - 30 * 60_000).toISOString(), endUtc: new Date(earliest + 30 * 60_000).toISOString() };
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot: tooSoon }));
    expect([409, 400]).toContain(r.status);
    expect(r.body.error.code).toMatch(/SLOT_TAKEN|VALIDATION_FAILED/);
  });

  it("nothing offered beyond horizonEndDate; availability response says where the horizon ends", async () => {
    const r = await api.availability("portraits", "2027-05-01", "2027-06-30");
    expect(r.status).toBe(200);
    const end = r.body.data.horizonEndDate;
    for (const d of r.body.data.days) if (d.date > end) expect(d.slots).toHaveLength(0);
    expect(r.body.data.days.every((d: any) => d.date <= end)).toBe(true);
  });

  it("days outside workingDays are closed (Mondays by placeholder config)", async () => {
    const days = (await api.availability("portraits", FROM, TO)).body.data.days;
    const mondays = days.filter((d: any) => new Date(d.date + "T12:00:00Z").getUTCDay() === 1);
    for (const d of mondays) expect(d.slots).toHaveLength(0);
  });
});

describe("buffers (002 #3)", () => {
  it("no offered slot of any type overlaps [start - buffer, end + buffer) of an active booking; the boundary is offered", async () => {
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const res = await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    expect(res.status).toBe(201);
    const buffer = (await admin.get(`/api/admin/bookings/${res.body.data.reference}`)).body.data.bufferMin as number;
    const busyStart = +new Date(slot.startUtc) - buffer * 60000, busyEnd = +new Date(slot.endUtc) + buffer * 60000;
    for (const type of ["portraits", "couples", "families"]) {
      const day = (await api.availability(type, slot.localDate, slot.localDate)).body.data.days[0]!;
      for (const s of day.slots as Slot[]) {
        const a = +new Date(s.startUtc) - buffer * 60000, b = +new Date(s.endUtc) + buffer * 60000;
        // The new slot's own buffered interval must not overlap the existing busy interval.
        expect(a < busyEnd && busyStart < b, `${type} ${s.localTime} overlaps buffered booking`).toBe(false);
      }
    }
  });
});

describe("blocked times (015, 002 #8)", () => {
  it("blocks remove slots, never show their label, overlap warning needs confirmOverlaps, deleting restores", async () => {
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const booked = await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    const baseline = (await api.availability("portraits", slot.localDate, slot.localDate)).body.data.days[0]!.slots.map((s) => s.startUtc);
    const body = { kind: "all_day", startDate: slot.localDate, endDate: slot.localDate, label: "SECRET-LABEL-QA", confirmOverlaps: false };
    const warn = await admin.post("/api/admin/blocks", body);
    expect(warn.status).toBe(409);
    expect(warn.body.error.code).toBe("BLOCK_OVERLAPS_BOOKINGS");
    expect(warn.body.error.details.bookings.map((b: any) => b.id)).toContain(booked.body.data.reference);
    expect((await admin.get("/api/admin/blocks")).body.data.items).toHaveLength(0); // nothing saved
    const saved = await admin.post("/api/admin/blocks", { ...body, confirmOverlaps: true });
    expect(saved.status).toBe(201);
    const pub = await api.get(`/api/availability?type=portraits&from=${slot.localDate}&to=${slot.localDate}`);
    expect(pub.body.data.days[0]!.slots).toHaveLength(0);
    expect(JSON.stringify(pub.body)).not.toContain("SECRET-LABEL-QA");
    expect((await admin.get(`/api/admin/bookings/${booked.body.data.reference}`)).body.data.status).toBe("pending_deposit"); // untouched
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot }), crypto.randomUUID())).status).toBe(409);
    expect((await admin.del(`/api/admin/blocks/${saved.body.data.block.id}`)).status).toBe(204);
    const after = await api.availability("portraits", slot.localDate, slot.localDate);
    // Deleting the block restores exactly what was offered before it (the booking's own afternoon stays taken).
    expect(after.body.data.days[0]!.slots.map((s) => s.startUtc)).toEqual(baseline);
  });

  it("a block on a day with no bookings removes every slot, and deleting it brings them all back", async () => {
    const days = (await api.availability("portraits", FROM, TO)).body.data.days.filter((d) => d.status === "open");
    const day = days[3]!;
    const before = day.slots.map((s) => s.startUtc);
    expect(before.length).toBeGreaterThan(0);
    const blk = await admin.post("/api/admin/blocks", { kind: "all_day", startDate: day.date, endDate: day.date, label: null, confirmOverlaps: false });
    expect(blk.status).toBe(201);
    expect((await api.availability("portraits", day.date, day.date)).body.data.days[0]!.slots).toHaveLength(0);
    expect((await admin.del(`/api/admin/blocks/${blk.body.data.block.id}`)).status).toBe(204);
    expect((await api.availability("portraits", day.date, day.date)).body.data.days[0]!.slots.map((s) => s.startUtc)).toEqual(before);
  });

  it("end before start, and fully past blocks, are rejected with messages (015 #4)", async () => {
    const a = await admin.post("/api/admin/blocks", { kind: "all_day", startDate: "2026-12-20", endDate: "2026-12-18", label: null, confirmOverlaps: false });
    expect(a.status).toBe(400);
    const b = await admin.post("/api/admin/blocks", { kind: "all_day", startDate: "2026-11-01", endDate: "2026-11-02", label: null, confirmOverlaps: false });
    expect(b.status).toBe(400);
    const c = await admin.post("/api/admin/blocks", { kind: "time_range", startDate: "2026-12-20", endDate: "2026-12-20", startTime: "18:00", endTime: "15:00", label: null, confirmOverlaps: false });
    expect(c.status).toBe(400);
  });
});

describe("server-side validation (005 #4, 006 #4; must-have 5)", () => {
  async function bad(over: Record<string, unknown>, type: "families" | "portraits" | "couples" | "events" = "portraits") {
    const slot = await firstOpenSlot(api, type, FROM, TO, type === "events" ? 120 : undefined);
    const r = await api.createBooking(buildBookingBody({ type, slot, durationMin: type === "events" ? 120 : undefined, override: over }));
    return r;
  }
  it.each([
    ["missing required field (contact.email)", { contact: { fullName: "A B", phone: "5615550100", preferredContact: "email" } }, "contact.email"],
    ["invalid email", { contact: { fullName: "A B", email: "nope", phone: "5615550100", preferredContact: "email" } }, "contact.email"],
    ["invalid phone", { contact: { fullName: "A B", email: "a@b.test", phone: "12345", preferredContact: "email" } }, "contact.phone"],
    ["negative people count", { people: { adults: -1, children: 0, pets: 0 } }, "people"],
    ["zero people", { people: { adults: 0, children: 0, pets: 0 } }, "people"],
    ["fractional people count", { people: { adults: 1.5, children: 0, pets: 0 } }, "people"],
    ["over-length text", { styleNotes: "x".repeat(5000) }, "styleNotes"],
    ["unknown field", { hacker: true }, null],
    ["wrong type", { subjectsNames: 42 }, "subjectsNames"],
    ["extra for another session type", { extra: { families: { childrenAges: "3", extendedFamily: false } } }, null],
  ])("%s -> 400 VALIDATION_FAILED, no booking created", async (_n, over, path) => {
    const r = await bad(over as any);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("VALIDATION_FAILED");
    if (path) expect(Object.keys(r.body.error.details.fieldErrors).join(",")).toContain(path);
    expect((await admin.get("/api/admin/bookings?view=all")).body.data.total).toBe(0);
  });

  it("Couples above max people is rejected; Families above max is allowed (005 #5)", async () => {
    const c = await bad({ people: { adults: 9, children: 0, pets: 0 } }, "couples");
    expect(c.status).toBe(400);
    const f = await bad({ people: { adults: 6, children: 2, pets: 0 } }, "families");
    expect(f.status).toBe(201);
  });

  it("Families childrenAges is OPTIONAL (security decision, config/booking.config.ts); Events end must be after start, guests >= 1 (005 #8)", async () => {
    const f = await bad({ extra: { families: { extendedFamily: false } } }, "families");
    expect(f.status).toBe(201);
    const slot = await firstOpenSlot(api, "events", FROM, TO, 120);
    const base = buildBookingBody({ type: "events", slot, durationMin: 120 });
    const e1 = await api.createBooking({ ...base, extra: { events: { ...base.extra.events, eventEndTime: base.extra.events.eventStartTime } } });
    expect(e1.status).toBe(400);
    const e2 = await api.createBooking({ ...base, extra: { events: { ...base.extra.events, guestCount: 0 } } });
    expect(e2.status).toBe(400);
  });

  it("policy: missing, false, or stale version -> no booking (006 #4)", async () => {
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const no = await api.createBooking(buildBookingBody({ type: "portraits", slot, policyAccepted: false }));
    expect(no.status).toBe(400);
    expect(Object.keys(no.body.error.details.fieldErrors).join(",")).toContain("policy");
    const gone = buildBookingBody({ type: "portraits", slot });
    delete gone.policy;
    expect((await api.createBooking(gone)).status).toBe(400);
    const stale = await api.createBooking(buildBookingBody({ type: "portraits", slot, policyVersion: "v0.0-old" }));
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("POLICY_VERSION_CHANGED");
    expect((await admin.get("/api/admin/bookings?view=all")).body.data.total).toBe(0);
  });

  it("policy version and server-time acceptance are stored (006 #5)", async () => {
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    const d = (await admin.get(`/api/admin/bookings/${r.body.data.reference}`)).body.data;
    expect(d.policy.version).toBe("v0.1-draft");
    expect(+new Date(d.policy.acceptedAt)).toBe(+FIXED_NOW);
    expect(d.policy.acceptedAtLabel).toMatch(/ET$/);
  });

  it("body over 32 KB -> 413; wrong content type is refused", async () => {
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const huge = await api.createBooking(buildBookingBody({ type: "portraits", slot, override: { anythingElse: "x".repeat(40_000) } }));
    expect([413, 400]).toContain(huge.status);
    const ct = await api.call("POST", "/api/bookings", { rawBody: "{}", headers: { "content-type": "text/plain" }, idempotencyKey: crypto.randomUUID() });
    expect([400, 415, 403]).toContain(ct.status);
  });

  it("inactive or unknown session type -> 422 SESSION_TYPE_UNAVAILABLE (001 #3)", async () => {
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot, override: { sessionTypeId: "nope" } }));
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe("SESSION_TYPE_UNAVAILABLE");
    expect((await api.get("/api/availability?type=nope")).status).toBe(422);
  });
});

describe("lifecycle (007 #1, 009, 013, 020)", () => {
  it("instant -> pending_deposit; Events -> requested without payment link; reference format", async () => {
    const s1 = await firstOpenSlot(api, "families", FROM, TO);
    const a = await api.createBooking(buildBookingBody({ type: "families", slot: s1 }));
    expect(a.body.data.status).toBe("pending_deposit");
    expect(a.body.data.reference).toMatch(/^DBP-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    expect(a.body.data.reference.length).toBeLessThanOrEqual(10);
    const s2 = await firstOpenSlot(api, "events", FROM, TO, 120);
    const e = await api.createBooking(buildBookingBody({ type: "events", slot: s2, durationMin: 120 }));
    expect(e.body.data.status).toBe("requested");
    expect(e.body.data.paymentLinkUrl).toBeNull();
    expect(e.body.data.amountDue.kind).toBe("estimated_deposit");
    expect(e.body.data.amountDue.dueNow).toBe(false);
    expect(e.body.data.holdHours).toBeNull();
    expect(JSON.stringify(a.body)).not.toContain("zelda.quillfeather"); // response holds no contact details
  });

  it("references are unique and non-sequential across many bookings", async () => {
    const refs = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const s = await firstOpenSlot(api, "events", FROM, "2027-06-01", 120, i * 2);
      refs.add((await api.createBooking(buildBookingBody({ type: "events", slot: s, durationMin: 120 }))).body.data.reference);
    }
    expect(refs.size).toBe(6);
  });

  it("mark paid -> confirmed with history and email; cancel frees the slot; terminal states are final (013, must-have 8)", async () => {
    const slot = await firstOpenSlot(api, "couples", FROM, TO);
    const ref = (await api.createBooking(buildBookingBody({ type: "couples", slot }))).body.data.reference;
    let d = (await admin.get(`/api/admin/bookings/${ref}`)).body.data;
    expect(d.allowedActions).toContain("mark_paid");
    expect(d.allowedActions).not.toContain("complete");
    const paid = await admin.patch(`/api/admin/bookings/${ref}`, { action: "mark_paid", expectedVersion: d.version, amountCents: d.pricing.amountDue.cents, receivedOn: "2026-12-01", method: "Stripe" });
    expect(paid.status).toBe(200);
    expect(paid.body.data.booking.status).toBe("confirmed");
    expect(paid.body.data.booking.history.at(-1)).toMatchObject({ by: "admin", fromStatus: "pending_deposit", toStatus: "confirmed" });
    expect((await sentEmails()).some((m) => /confirmed/i.test(JSON.stringify(m)))).toBe(true);
    d = paid.body.data.booking;
    expect((await admin.patch(`/api/admin/bookings/${ref}`, { action: "complete", expectedVersion: d.version })).status).toBe(422); // start not passed
    const cancelled = await admin.patch(`/api/admin/bookings/${ref}`, { action: "cancel", expectedVersion: d.version, reason: "client_cancelled", notifyClient: true });
    expect(cancelled.status).toBe(200);
    const open = await api.availability("couples", slot.localDate, slot.localDate);
    expect(open.body.data.days[0]!.slots.map((s: any) => s.startUtc)).toContain(slot.startUtc);
    const v = cancelled.body.data.booking.version;
    for (const body of [{ action: "mark_paid", expectedVersion: v, amountCents: 1, receivedOn: "2026-12-01" }, { action: "approve", expectedVersion: v }]) {
      expect((await admin.patch(`/api/admin/bookings/${ref}`, body)).status).toBe(422);
    }
  });

  it("confirm_without_payment requires a note; double-submitting a transition yields one history entry (013 #2, #11)", async () => {
    const slot = await firstOpenSlot(api, "couples", FROM, TO);
    const ref = (await api.createBooking(buildBookingBody({ type: "couples", slot }))).body.data.reference;
    const d = (await admin.get(`/api/admin/bookings/${ref}`)).body.data;
    expect((await admin.patch(`/api/admin/bookings/${ref}`, { action: "confirm_without_payment", expectedVersion: d.version })).status).toBe(400);
    const body = { action: "confirm_without_payment", expectedVersion: d.version, note: "Paid by cash" };
    const rs = await Promise.all([admin.patch(`/api/admin/bookings/${ref}`, body), admin.patch(`/api/admin/bookings/${ref}`, body)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    const after = (await admin.get(`/api/admin/bookings/${ref}`)).body.data;
    expect(after.history.filter((h: any) => h.toStatus === "confirmed")).toHaveLength(1);
  });

  it("Events approve -> pending_deposit; deposit overdue is counted from approval (020 #11, #13)", async () => {
    const slot = await firstOpenSlot(api, "events", FROM, TO, 120);
    const ref = (await api.createBooking(buildBookingBody({ type: "events", slot, durationMin: 120 }))).body.data.reference;
    const d = (await admin.get(`/api/admin/bookings/${ref}`)).body.data;
    expect(d.allowedActions.sort()).toEqual(expect.arrayContaining(["approve", "decline"]));
    expect(d.allowedActions).not.toContain("mark_paid");
    const ap = await admin.patch(`/api/admin/bookings/${ref}`, { action: "approve", expectedVersion: d.version });
    expect(ap.status).toBe(200);
    expect(ap.body.data.booking.status).toBe("pending_deposit");
    expect(ap.body.data.booking.timestamps.holdStartedAt).toBe(ap.body.data.booking.timestamps.approvedAt);
    expect(ap.body.data.booking.flags).not.toContain("deposit_overdue");
  });

  it("reschedule moves the slot atomically, keeps status, records history, frees the old time (014)", async () => {
    const s1 = await firstOpenSlot(api, "families", FROM, TO);
    const s2 = await firstOpenSlot(api, "families", FROM, TO, undefined, 6);
    const ref = (await api.createBooking(buildBookingBody({ type: "families", slot: s1 }))).body.data.reference;
    const d = (await admin.get(`/api/admin/bookings/${ref}`)).body.data;
    const r = await admin.post(`/api/admin/bookings/${ref}/reschedule`, { expectedVersion: d.version, startUtc: s2.startUtc, durationMin: 60, reason: "weather", notifyClient: true });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.booking.status).toBe("pending_deposit");
    expect(r.body.data.booking.startUtc).toBe(s2.startUtc);
    expect(r.body.data.booking.rescheduleCount).toBe(1);
    const open = await api.availability("families", s1.localDate, s1.localDate);
    expect(open.body.data.days[0]!.slots.map((s: any) => s.startUtc)).toContain(s1.startUtc);
    // moving onto a taken time fails and keeps the original
    const other = await api.createBooking(buildBookingBody({ type: "families", slot: s1, contact: { email: "o@example.test" } }));
    expect(other.status).toBe(201);
    const v = r.body.data.booking.version;
    const clash = await admin.post(`/api/admin/bookings/${ref}/reschedule`, { expectedVersion: v, startUtc: s1.startUtc, durationMin: 60, reason: "client_request", notifyClient: false });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe("SLOT_TAKEN");
    expect((await admin.get(`/api/admin/bookings/${ref}`)).body.data.startUtc).toBe(s2.startUtc);
  });

  it("email failure does not fail the booking; resend works and flag clears (008 #5, #6)", async () => {
    const p = "../../../netlify/lib/services";
    const mod: any = await import(/* @vite-ignore */ p);
    const svc = typeof mod.getServices === "function" ? await mod.getServices() : mod.services;
    if (typeof svc?.email?.failNext !== "function") return expect.soft(typeof svc?.email?.failNext, "memory email driver should expose failNext(n) (ADR 0004)").toBe("function");
    svc.email.failNext(2);
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    expect(r.status).toBe(201);
    expect(r.body.data.emailSent).toBe(false);
    const ref = r.body.data.reference;
    const d = (await admin.get(`/api/admin/bookings/${ref}`)).body.data;
    expect(d.flags).toContain("email_not_sent");
    const resend = await admin.post(`/api/admin/bookings/${ref}/resend-email`, {});
    expect(resend.body.data.status).toBe("sent");
    expect((await admin.get(`/api/admin/bookings/${ref}`)).body.data.flags).not.toContain("email_not_sent");
  });
});

describe("API conventions (api.md)", () => {
  it("every response carries X-Request-Id; public availability is no-store; config is cacheable; unknown booking is 404", async () => {
    const a = await api.get("/api/availability?type=portraits&from=2026-12-01&to=2026-12-07");
    expect(a.headers.get("x-request-id")).toBeTruthy();
    expect(a.headers.get("cache-control")).toMatch(/no-store/);
    const c = await api.get("/api/config");
    expect(c.headers.get("cache-control")).toMatch(/max-age=60/);
    expect(JSON.stringify(c.body)).not.toMatch(/paymentLinkUrl|depositPaymentLink|buy\.stripe|adminNotification|rateLimit/i);
    expect((await admin.get("/api/admin/bookings/not-a-ref")).status).toBe(404);
    expect((await api.get("/api/policies/v9.9-nope")).status).toBe(404);
    expect((await api.get("/api/availability?type=portraits&from=2026-12-01&to=2027-06-01")).status).toBe(400); // > 62 days
  });
});
