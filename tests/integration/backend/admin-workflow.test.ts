// Admin bookings, reschedule, blocks, mini days, list, CSV, delete client data (stories 003, 011-016, 020).
import { describe, expect, it } from "vitest";
import { freshApp } from "../../helpers/app";
import { buildBookingBody, firstOpenSlot, newKey, parseCsv, type Api } from "../../helpers/builders";
import { CLIENT, OTHER_CLIENT } from "../../helpers/seed";

const FROM = "2026-12-01";
const TO = "2027-01-15";

async function setup(env: Record<string, string | undefined> = {}) {
  const app = await freshApp(env);
  const api = app.api();
  const admin = app.api();
  expect((await admin.login()).status).toBe(200);
  const svcMod = await import("../../../netlify/lib/services");
  const svc = svcMod.getServices();
  const emails = svc.email as unknown as { sent: any[]; clear(): void };
  return { app, api, admin, svc, svcMod, emails };
}

function eventsBody(slot: { startUtc: string }, durationMin = 120, over: Record<string, unknown> = {}) {
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
        eventName: "Test Party", eventType: "birthday", venueAddress: "1 Clematis St", eventStartTime: "18:00", eventEndTime: "20:00",
        guestCount: 20, onsiteContactName: "Pat", onsiteContactPhone: "5615550100",
      },
    },
    policy: { accepted: true, version: "v0.1-draft" },
    ...over,
  };
}
const getRef = (r: { body: any }) => r.body.data.reference as string;
const detailOf = async (admin: Api, ref: string) => (await admin.get(`/api/admin/bookings/${ref}`)).body.data;

describe("Events request flow (story 020)", () => {
  it("approve -> pending_deposit with the link and an .ics; deposit overdue counts from approval", async () => {
    const { api, admin, emails, svcMod } = await setup();
    const slot = await firstOpenSlot(api, "events", FROM, TO, 120);
    const ref = getRef(await api.createBooking(eventsBody(slot)));
    let d = await detailOf(admin, ref);
    expect(d.status).toBe("requested");
    expect(d.allowedActions).toEqual(["approve", "decline", "reschedule", "resend_email"]);
    emails.clear();
    const res = await admin.patch(`/api/admin/bookings/${ref}`, { action: "approve", expectedVersion: d.version });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toEqual({ kind: "approved", status: "sent" });
    d = res.body.data.booking;
    expect(d.status).toBe("pending_deposit");
    expect(d.timestamps.approvedAt).toBe(d.timestamps.holdStartedAt);
    expect(d.history.at(-1)).toMatchObject({ by: "admin", action: "approve", fromStatus: "requested", toStatus: "pending_deposit" });
    const mail = emails.sent.find((m) => m.kind === "approved");
    expect(mail.subject).toBe(`Your event is approved — ${ref}`);
    expect(mail.text).toContain(`client_reference_id=${ref}`);
    expect(mail.attachments).toHaveLength(1);
    // time passes: 49 hours after approval it is overdue, and that is only a flag
    const { steppingClock } = await import("../../../netlify/lib/clock");
    const clock = steppingClock(svcMod.getServices().clock.now());
    svcMod.setServicesForTest({ clock });
    clock.advanceMinutes(47 * 60);
    expect(await admin.login().then(() => detailOf(admin, ref))).toMatchObject({ status: "pending_deposit" });
    expect((await detailOf(admin, ref)).flags).not.toContain("deposit_overdue");
    clock.advanceMinutes(2 * 60);
    await admin.login();
    const late = await detailOf(admin, ref);
    expect(late.flags).toContain("deposit_overdue");
    expect(late.status).toBe("pending_deposit"); // never released automatically
  });
  it("decline frees the slot at once, emails the message as plain text, and a second decline is a conflict", async () => {
    const { api, admin, emails } = await setup();
    const slot = await firstOpenSlot(api, "events", FROM, TO, 120);
    const ref = getRef(await api.createBooking(eventsBody(slot)));
    const d = await detailOf(admin, ref);
    emails.clear();
    const res = await admin.patch(`/api/admin/bookings/${ref}`, { action: "decline", expectedVersion: d.version, messageToClient: "Sorry <b>so</b> much", note: "internal" });
    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe("declined");
    const mail = emails.sent.find((m) => m.kind === "declined");
    expect(mail.text).toContain("Sorry <b>so</b> much");
    expect(mail.html).toContain("Sorry &lt;b&gt;so&lt;/b&gt; much");
    expect(mail.html).not.toContain("<b>so");
    expect(mail.text).not.toContain("internal");
    expect(mail.attachments).toBeUndefined();
    const again = await admin.patch(`/api/admin/bookings/${ref}`, { action: "decline", expectedVersion: d.version });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe("This request was already handled (now: Declined). Reload to see the latest");
    expect(again.body.error.details).toMatchObject({ currentStatus: "declined" });
    const avail = (await api.availability("events", slot.localDate, slot.localDate, 120)).body.data.days[0]!;
    expect(avail.slots.map((s) => s.startUtc)).toContain(slot.startUtc);
  });
  it("decline with notifyClient false sends nothing; approve on a declined booking is INVALID_TRANSITION", async () => {
    const { api, admin, emails } = await setup();
    const slot = await firstOpenSlot(api, "events", FROM, TO, 120);
    const ref = getRef(await api.createBooking(eventsBody(slot)));
    const d = await detailOf(admin, ref);
    emails.clear();
    const res = await admin.patch(`/api/admin/bookings/${ref}`, { action: "decline", expectedVersion: d.version, notifyClient: false });
    expect(res.body.data.email).toBeNull();
    expect(emails.sent).toHaveLength(0);
    const bad = await admin.patch(`/api/admin/bookings/${ref}`, { action: "approve", expectedVersion: res.body.data.booking.version });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe("INVALID_TRANSITION");
    expect(bad.body.error.details.currentStatus).toBe("declined");
  });
  it("a request cannot be marked paid, confirmed without payment, cancelled or completed (story 020 #21)", async () => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "events", FROM, TO, 120);
    const ref = getRef(await api.createBooking(eventsBody(slot)));
    const v = (await detailOf(admin, ref)).version;
    for (const body of [
      { action: "mark_paid", amountCents: 100, receivedOn: "2026-12-01" },
      { action: "confirm_without_payment", note: "x" },
      { action: "cancel", reason: "other" },
      { action: "complete" },
    ]) {
      const r = await admin.patch(`/api/admin/bookings/${ref}`, { ...body, expectedVersion: v });
      expect(r.status, JSON.stringify(body)).toBe(422);
    }
    expect((await detailOf(admin, ref)).status).toBe("requested");
  });
});

describe("status changes (story 013)", () => {
  it("mark paid: payment recorded, confirmed email with a CONFIRMED .ics (SEQUENCE 1); a double submit makes one change", async () => {
    const { api, admin, emails } = await setup();
    const slot = await firstOpenSlot(api, "families", FROM, TO);
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "families", slot })));
    const d = await detailOf(admin, ref);
    expect(d.allowedActions).toEqual(["mark_paid", "confirm_without_payment", "cancel", "reschedule", "resend_email"]);
    emails.clear();
    const body = { action: "mark_paid", expectedVersion: d.version, amountCents: 15000, receivedOn: "2026-12-01", method: "Stripe", note: "ok" };
    const rs = await Promise.all([admin.patch(`/api/admin/bookings/${ref}`, body), admin.patch(`/api/admin/bookings/${ref}`, body)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    const after = await detailOf(admin, ref);
    expect(after.status).toBe("confirmed");
    expect(after.payment).toMatchObject({ amountCents: 15000, receivedOn: "2026-12-01", method: "Stripe" });
    expect(after.history.filter((h: any) => h.toStatus === "confirmed")).toHaveLength(1);
    const mails = emails.sent.filter((m) => m.kind === "confirmed");
    expect(mails).toHaveLength(1);
    const ics = Buffer.from(mails[0].attachments[0].contentBase64, "base64").toString("utf8");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("SEQUENCE:1");
    expect(mails[0].subject).toMatch(/^You're confirmed: /);
  });
  it("mark paid validation: date not in the future, amount required; confirm without payment needs a note", async () => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "couples", FROM, TO);
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "couples", slot })));
    const v = (await detailOf(admin, ref)).version;
    const future = await admin.patch(`/api/admin/bookings/${ref}`, { action: "mark_paid", expectedVersion: v, amountCents: 100, receivedOn: "2026-12-02" });
    expect(future.status).toBe(400);
    expect(future.body.error.details.fieldErrors.receivedOn).toMatch(/future/);
    expect((await admin.patch(`/api/admin/bookings/${ref}`, { action: "mark_paid", expectedVersion: v, receivedOn: "2026-12-01" })).status).toBe(400);
    expect((await admin.patch(`/api/admin/bookings/${ref}`, { action: "confirm_without_payment", expectedVersion: v })).status).toBe(400);
    expect((await admin.patch(`/api/admin/bookings/${ref}`, { action: "confirm_without_payment", expectedVersion: v, note: "paid cash" })).status).toBe(200);
  });
  it("cancel: reason required, slot freed, client emailed by default, notifyClient false is silent", async () => {
    const { api, admin, emails } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const a = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot })));
    const d = await detailOf(admin, a);
    expect((await admin.patch(`/api/admin/bookings/${a}`, { action: "cancel", expectedVersion: d.version })).status).toBe(400);
    emails.clear();
    const res = await admin.patch(`/api/admin/bookings/${a}`, { action: "cancel", expectedVersion: d.version, reason: "deposit_not_received", note: "no payment" });
    expect(res.body.data.booking).toMatchObject({ status: "cancelled", cancellation: { reason: "deposit_not_received" } });
    expect(emails.sent.map((m) => m.kind)).toEqual(["cancelled"]);
    const slot2 = await firstOpenSlot(api, "portraits", FROM, TO);
    expect(slot2.startUtc).toBe(slot.startUtc); // freed
    const b = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot: slot2, contact: { email: OTHER_CLIENT.email } })));
    emails.clear();
    const q = await admin.patch(`/api/admin/bookings/${b}`, { action: "cancel", expectedVersion: (await detailOf(admin, b)).version, reason: "other", notifyClient: false });
    expect(q.body.data.email).toBeNull();
    expect(emails.sent).toHaveLength(0);
  });
  it("complete is offered and accepted only after the start time has passed", async () => {
    const { api, admin, svcMod } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot })));
    let d = await detailOf(admin, ref);
    d = (await admin.patch(`/api/admin/bookings/${ref}`, { action: "confirm_without_payment", expectedVersion: d.version, note: "ok" })).body.data.booking;
    expect(d.allowedActions).not.toContain("complete");
    expect((await admin.patch(`/api/admin/bookings/${ref}`, { action: "complete", expectedVersion: d.version })).status).toBe(422);
    const { steppingClock } = await import("../../../netlify/lib/clock");
    const clock = steppingClock(slot.startUtc);
    clock.advanceMinutes(90);
    svcMod.setServicesForTest({ clock });
    await admin.login();
    d = await detailOf(admin, ref);
    expect(d.allowedActions).toContain("complete");
    expect(d.flags).toContain("session_time_passed");
    const done = await admin.patch(`/api/admin/bookings/${ref}`, { action: "complete", expectedVersion: d.version });
    expect(done.body.data.booking.status).toBe("completed");
  });
  it("a stale expectedVersion is VERSION_CONFLICT with the current version and status, and nothing changes", async () => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot })));
    const d = await detailOf(admin, ref);
    const r = await admin.patch(`/api/admin/bookings/${ref}`, { action: "cancel", expectedVersion: d.version - 1, reason: "other" });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: "VERSION_CONFLICT", message: "This booking changed. Reload to see the latest", details: { currentVersion: d.version, currentStatus: "pending_deposit" } });
    expect((await detailOf(admin, ref)).status).toBe("pending_deposit");
  });
  it("unknown fields, unknown actions and malformed references are rejected; ids are case-insensitive", async () => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot })));
    expect((await admin.patch(`/api/admin/bookings/${ref}`, { action: "approve", expectedVersion: 1, status: "confirmed" })).status).toBe(400);
    expect((await admin.patch(`/api/admin/bookings/${ref}`, { action: "teleport", expectedVersion: 1 })).status).toBe(400);
    expect((await admin.get("/api/admin/bookings/not-a-ref")).status).toBe(404);
    expect((await admin.get("/api/admin/bookings/DBP-ZZZZZZ")).status).toBe(404);
    expect((await admin.get(`/api/admin/bookings/${ref.toLowerCase()}`)).status).toBe(200);
  });
});

describe("reschedule (story 014)", () => {
  async function pickOther(admin: Api, typeId: string, ref: string, notStart: string, durationMin?: number) {
    const q = `/api/admin/availability?type=${typeId}&from=2026-12-02&to=2026-12-20&excludeBookingId=${ref}${durationMin ? `&durationMin=${durationMin}` : ""}`;
    const days = (await admin.get(q)).body.data.days as { status: string; slots: any[] }[];
    return days.flatMap((d) => d.slots).filter((s) => s.startUtc !== notStart);
  }
  it("moves the booking, frees the old time, takes the new one, records history and emails an updated .ics", async () => {
    const { api, admin, emails } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot })));
    const d = await detailOf(admin, ref);
    await admin.patch(`/api/admin/bookings/${ref}`, { action: "confirm_without_payment", expectedVersion: d.version, note: "ok" });
    const v = (await detailOf(admin, ref)).version;
    const target = (await pickOther(admin, "portraits", ref, slot.startUtc))[0]!; // notice and horizon are ignored for admin: may be sooner
    emails.clear();
    const res = await admin.post(`/api/admin/bookings/${ref}/reschedule`, { expectedVersion: v, startUtc: target.startUtc, reason: "weather", note: "storm" });
    expect(res.status).toBe(200);
    const b = res.body.data.booking;
    expect(b).toMatchObject({ status: "confirmed", startUtc: target.startUtc, rescheduleCount: 1, localStartTime: target.localTime });
    expect(b.history.at(-1)).toMatchObject({ action: "reschedule", reason: "weather", fromStartUtc: slot.startUtc, toStartUtc: target.startUtc });
    expect(b.flags).toContain("rescheduled");
    const mail = emails.sent.find((m) => m.kind === "rescheduled");
    const ics = Buffer.from(mail.attachments[0].contentBase64, "base64").toString("utf8");
    expect(ics).toContain("SEQUENCE:2");
    expect(ics).toContain(`UID:${ref}@daniellabeltram.photography`);
    // the old time is free again for a client, and the new one is gone
    const pub = (await api.availability("portraits", slot.localDate, slot.localDate)).body.data.days[0]!;
    expect(pub.slots.map((s) => s.startUtc)).toContain(slot.startUtc);
    if (target.localDate === slot.localDate) expect(pub.slots.map((s) => s.startUtc)).not.toContain(target.startUtc);
    expect((await admin.get("/api/admin/bookings?rescheduled=true&view=all")).body.data.items.map((i: any) => i.id)).toEqual([ref]);
  });
  it("a taken time is 409 SLOT_TAKEN with alternatives and the booking keeps its original time", async () => {
    const { api, admin } = await setup();
    const s1 = await firstOpenSlot(api, "portraits", FROM, TO, undefined, 0);
    const s2 = await firstOpenSlot(api, "couples", FROM, TO, undefined, 3);
    const a = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot: s1 })));
    await api.createBooking(buildBookingBody({ type: "couples", slot: s2, contact: { email: OTHER_CLIENT.email } }));
    const v = (await detailOf(admin, a)).version;
    const r = await admin.post(`/api/admin/bookings/${a}/reschedule`, { expectedVersion: v, startUtc: s2.startUtc, reason: "client_request" });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("SLOT_TAKEN");
    expect(Array.isArray(r.body.error.details.alternatives)).toBe(true);
    const after = await detailOf(admin, a);
    expect(after.startUtc).toBe(s1.startUtc);
    expect(after.version).toBe(v);
  });
  it("a reschedule must pick a different time; stale versions conflict; closed bookings cannot move", async () => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot })));
    const v = (await detailOf(admin, ref)).version;
    expect((await admin.post(`/api/admin/bookings/${ref}/reschedule`, { expectedVersion: v, startUtc: slot.startUtc, reason: "weather" })).status).toBe(400);
    expect((await admin.post(`/api/admin/bookings/${ref}/reschedule`, { expectedVersion: v + 5, startUtc: slot.startUtc, reason: "weather" })).status).toBe(409);
    await admin.patch(`/api/admin/bookings/${ref}`, { action: "cancel", expectedVersion: v, reason: "other", notifyClient: false });
    const other = (await pickOther(admin, "portraits", ref, slot.startUtc))[0]!;
    const r = await admin.post(`/api/admin/bookings/${ref}/reschedule`, { expectedVersion: v + 1, startUtc: other.startUtc, reason: "weather" });
    expect(r.status).toBe(422);
  });
  it("a request stays a request: wording, no .ics, still waiting; Events may change length and the estimate follows", async () => {
    const { api, admin, emails } = await setup();
    const slot = await firstOpenSlot(api, "events", FROM, TO, 120);
    const ref = getRef(await api.createBooking(eventsBody(slot)));
    const d = await detailOf(admin, ref);
    expect(d.pricing.amountDue.cents).toBe(25000);
    const target = (await pickOther(admin, "events", ref, slot.startUtc, 180))[0]!;
    emails.clear();
    const r = await admin.post(`/api/admin/bookings/${ref}/reschedule`, { expectedVersion: d.version, startUtc: target.startUtc, durationMin: 180, reason: "client_request" });
    expect(r.status).toBe(200);
    expect(r.body.data.booking).toMatchObject({ status: "requested", durationMin: 180 });
    expect(r.body.data.booking.pricing.amountDue.cents).toBe(37500);
    expect(r.body.data.booking.timestamps.requestedAt).toBe(d.timestamps.requestedAt);
    const mail = emails.sent.find((m) => m.kind === "rescheduled");
    expect(mail.attachments).toBeUndefined();
    expect(mail.text).toContain("still a request");
  });
  it("same start, longer session: the ledger entry grows with it (no stale entry, no double hold)", async () => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "events", FROM, TO, 120);
    const ref = getRef(await api.createBooking(eventsBody(slot)));
    const d = await detailOf(admin, ref);
    const r = await admin.post(`/api/admin/bookings/${ref}/reschedule`, { expectedVersion: d.version, startUtc: slot.startUtc, durationMin: 240, reason: "client_request", notifyClient: false });
    expect(r.status).toBe(200);
    const { getServices } = await import("../../../netlify/lib/services");
    const ledger = (await getServices().store.get<any>(`days/${slot.localDate}`))!.value;
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0].endUtc).toBe(r.body.data.booking.endUtc);
  });
  it("a Holiday Mini moves only to another free mini slot", async () => {
    const { api, admin } = await setup();
    await admin.post("/api/admin/mini-days/2026-12-12/slots", { location: "Phillips Point", theme: "Winter", startTimes: ["08:00", "08:30", "09:00"] });
    const day = (await api.availability("minis", "2026-12-12", "2026-12-12")).body.data.days[0]!;
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "minis", slot: day.slots[0]! })));
    const v = (await detailOf(admin, ref)).version;
    const free = (await admin.get(`/api/admin/availability?type=holiday-minis&from=2026-12-12&to=2026-12-12&excludeBookingId=${ref}`)).body.data.days[0].slots;
    expect(free.map((s: any) => s.miniSlotId)).toEqual(["ms_2026-12-12_0830", "ms_2026-12-12_0900"]);
    expect((await admin.post(`/api/admin/bookings/${ref}/reschedule`, { expectedVersion: v, startUtc: free[0].startUtc, reason: "photographer" })).status).toBe(400); // slot id missing
    const r = await admin.post(`/api/admin/bookings/${ref}/reschedule`, { expectedVersion: v, startUtc: free[0].startUtc, miniSlotId: free[0].miniSlotId, reason: "photographer", notifyClient: false });
    expect(r.status).toBe(200);
    const spots = (await api.availability("minis", "2026-12-12", "2026-12-12")).body.data.days[0]!;
    expect(spots.mini!.spotsLeft).toBe(2);
    expect(spots.slots.map((s) => s.miniSlotId)).toEqual(["ms_2026-12-12_0800", "ms_2026-12-12_0900"]);
  });
});

describe("blocked times (story 015)", () => {
  it("validates, hides nothing in the public view, warns about overlaps, and deleting restores", async () => {
    const { api, admin } = await setup();
    const post = (b: object) => admin.post("/api/admin/blocks", b);
    expect((await post({ kind: "all_day", startDate: "2026-12-10", endDate: "2026-12-09" })).body.error.details.fieldErrors.endDate).toBe("The end must be after the start");
    expect((await post({ kind: "all_day", startDate: "2026-11-01", endDate: "2026-11-02" })).body.error.details.fieldErrors.endDate).toBe("That time has already passed");
    expect((await post({ kind: "time_range", startDate: "2026-12-10", endDate: "2026-12-11", startTime: "10:00", endTime: "11:00" })).status).toBe(400);
    expect((await post({ kind: "time_range", startDate: "2026-12-10", endDate: "2026-12-10", startTime: "11:00", endTime: "10:00" })).status).toBe(400);
    expect((await post({ kind: "all_day", startDate: "2026-12-10", endDate: "2028-01-10" })).status).toBe(400);
    expect((await post({ kind: "all_day", startDate: "2026-12-10", endDate: "2026-12-10", color: "red" })).status).toBe(400);
    const saved = await post({ kind: "all_day", startDate: "2026-12-24", endDate: "2026-12-26", label: "Family trip" });
    expect(saved.status).toBe(201);
    expect(saved.body.data.block).toMatchObject({ kind: "all_day", display: "Thu, Dec 24 – Sat, Dec 26, 2026 (all day)", label: "Family trip" });
    const day = (await api.availability("portraits", "2026-12-24", "2026-12-26")).body.data.days;
    expect(day.every((x) => x.status === "closed")).toBe(true);
    expect(JSON.stringify(day)).not.toContain("Family trip");
    expect((await admin.del(`/api/admin/blocks/${saved.body.data.block.id}`)).status).toBe(204);
    expect((await admin.del(`/api/admin/blocks/${saved.body.data.block.id}`)).status).toBe(404);
    expect((await admin.del("/api/admin/blocks/not-an-id")).status).toBe(404);
    expect((await api.availability("portraits", "2026-12-24", "2026-12-24")).body.data.days[0]!.status).not.toBe("closed");
  });
  it("a time range in the spring-forward gap is refused; one around it is stored as entered in ET (story 015 #7)", async () => {
    const { admin } = await setup({ FAKE_NOW: "2027-02-01T09:00:00-05:00" });
    const gap = await admin.post("/api/admin/blocks", { kind: "time_range", startDate: "2027-03-14", endDate: "2027-03-14", startTime: "02:30", endTime: "04:00" });
    expect(gap.status).toBe(400);
    expect(gap.body.error.details.fieldErrors.startTime).toMatch(/clocks change/);
    const ok = await admin.post("/api/admin/blocks", { kind: "time_range", startDate: "2027-03-14", endDate: "2027-03-14", startTime: "15:00", endTime: "18:00", label: null });
    expect(ok.status).toBe(201);
    expect(ok.body.data.block).toMatchObject({ startTime: "15:00", endTime: "18:00", startUtc: "2027-03-14T19:00:00.000Z", endUtc: "2027-03-14T22:00:00.000Z" });
    expect(ok.body.data.block.display).toBe("Sun, Mar 14, 2027, 3:00 PM – 6:00 PM ET");
  });
  it("the list shows upcoming blocks only unless includePast=true", async () => {
    const { admin } = await setup();
    await admin.post("/api/admin/blocks", { kind: "all_day", startDate: "2026-12-24", endDate: "2026-12-24" });
    expect((await admin.get("/api/admin/blocks")).body.data.items).toHaveLength(1);
    expect((await admin.get("/api/admin/blocks?includePast=true")).body.data.items).toHaveLength(1);
  });
});

describe("mini days (story 003)", () => {
  it("creates slots, names each rejection, and creates the rest in the same save", async () => {
    const { api, admin } = await setup();
    await admin.post("/api/admin/blocks", { kind: "time_range", startDate: "2026-12-12", endDate: "2026-12-12", startTime: "09:00", endTime: "09:20" });
    const made = await admin.post("/api/admin/mini-days/2026-12-12/slots", {
      location: "Phillips Point", theme: "Winter", startTimes: ["08:00", "08:30", "08:30", "08:45", "09:00", "25:00", "2026-11-01T00:00"],
    });
    expect(made.status).toBe(201);
    expect(made.body.data.created).toEqual(["08:00", "08:30"]);
    const codes = Object.fromEntries(made.body.data.rejected.map((r: any) => [r.startTime, r.code]));
    expect(codes).toMatchObject({ "08:45": "OVERLAPS_MINI_SLOT", "09:00": "OVERLAPS_BLOCK", "25:00": "INVALID_TIME" });
    expect(made.body.data.rejected.find((r: any) => r.startTime === "08:30" && r.code === "DUPLICATE")).toBeTruthy();
    expect(made.body.data.miniDay.slots.map((s: any) => s.rangeLabel)).toEqual(["8:00 – 8:20 AM ET", "8:30 – 8:50 AM ET"]);
    // clients see the two spots, with the label
    const day = (await api.availability("minis", "2026-12-12", "2026-12-12")).body.data.days[0]!;
    expect(day.mini).toEqual({ location: "Phillips Point", theme: "Winter", spotsLeft: 2, totalSpots: 2 });
    expect((await api.get("/api/config")).body.data.sessionTypes.find((t: any) => t.id === "holiday-minis").nextMiniDates).toEqual([{ date: "2026-12-12", spotsLeft: 2 }]);
  });
  it("all rejected is 409 SLOT_TAKEN with details.rejected; a past time is IN_PAST; a booking overlap is named; a new day needs a location", async () => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "portraits", "2026-12-05", "2026-12-12");
    await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    const t = slot.localTime;
    const hit = await admin.post(`/api/admin/mini-days/${slot.localDate}/slots`, { location: "X", startTimes: [t] });
    expect(hit.status).toBe(409);
    expect(hit.body.error.code).toBe("SLOT_TAKEN");
    expect(hit.body.error.details.rejected[0].code).toBe("OVERLAPS_BOOKING");
    expect((await admin.post("/api/admin/mini-days/2026-12-01/slots", { location: "X", startTimes: ["07:00"] })).body.error.details.rejected[0].code).toBe("IN_PAST");
    expect((await admin.post("/api/admin/mini-days/2026-12-13/slots", { startTimes: ["08:00"] })).status).toBe(400);
    expect((await admin.post("/api/admin/mini-days/not-a-date/slots", { location: "X", startTimes: ["08:00"] })).status).toBe(404);
  });
  it("an existing mini day keeps its location; a booking blocks slot and day removal; an open slot can go", async () => {
    const { api, admin } = await setup();
    await admin.post("/api/admin/mini-days/2026-12-12/slots", { location: "Phillips Point", theme: "Winter", startTimes: ["08:00", "08:30"] });
    const clash = await admin.post("/api/admin/mini-days/2026-12-12/slots", { location: "Elsewhere", startTimes: ["09:00"] });
    expect(clash.status).toBe(400);
    expect(clash.body.error.details.fieldErrors.location).toBe("That date already has a mini day. Edit it instead.");
    expect((await admin.post("/api/admin/mini-days/2026-12-12/slots", { startTimes: ["09:00"] })).status).toBe(201);
    const day = (await api.availability("minis", "2026-12-12", "2026-12-12")).body.data.days[0]!;
    await api.createBooking(buildBookingBody({ type: "minis", slot: day.slots[0]! }));
    const list = (await admin.get("/api/admin/mini-days")).body.data.items[0];
    expect(list).toMatchObject({ date: "2026-12-12", totalSpots: 3, booked: 1 });
    const booked = list.slots.find((s: any) => s.bookingId);
    expect((await admin.del(`/api/admin/mini-days/2026-12-12/slots/${booked.id}`)).body.error.code).toBe("MINI_DAY_HAS_BOOKINGS");
    const wholeDay = await admin.del("/api/admin/mini-days/2026-12-12");
    expect(wholeDay.status).toBe(409);
    expect(wholeDay.body.error.details).toEqual({ booked: 1 });
    const free = list.slots.find((s: any) => !s.bookingId);
    expect((await admin.del(`/api/admin/mini-days/2026-12-12/slots/${free.id}`)).status).toBe(204);
    expect((await admin.del(`/api/admin/mini-days/2026-12-12/slots/${free.id}`)).status).toBe(404);
    expect((await admin.del("/api/admin/mini-days/2026-12-20")).status).toBe(404);
  });
});

describe("list, filters, summary (story 011)", () => {
  it("default view, filters AND together, paging, search, summary ignores filters", async () => {
    const { api, admin } = await setup();
    const p = await firstOpenSlot(api, "portraits", FROM, TO, undefined, 0);
    const c = await firstOpenSlot(api, "couples", FROM, TO, undefined, 3);
    const e = await firstOpenSlot(api, "events", FROM, TO, 120, 6);
    const refP = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot: p, contact: { fullName: "Alpha Tester", email: "alpha@mail.test" } })));
    getRef(await api.createBooking(buildBookingBody({ type: "couples", slot: c, contact: { fullName: "Beta Tester", email: "beta@mail.test" } })));
    getRef(await api.createBooking(eventsBody(e)));
    const all = (await admin.get("/api/admin/bookings")).body.data;
    expect(all.total).toBe(3);
    expect(all.items.map((i: any) => i.startUtc)).toEqual([...all.items.map((i: any) => i.startUtc)].sort()); // soonest first
    expect(all.summary).toEqual({ upcomingPendingDeposit: 2, depositOverdue: 0, requestsWaiting: 1, replyOverdue: 0 });
    const ev = all.items.find((i: any) => i.status === "requested");
    expect(ev.waitingLabel).toBe("Waiting < 1 h");
    expect(ev.waitingSince).toBeTruthy();
    expect((await admin.get("/api/admin/bookings?status=requested")).body.data.total).toBe(1);
    expect((await admin.get("/api/admin/bookings?status=requested,confirmed&type=events")).body.data.total).toBe(1);
    expect((await admin.get("/api/admin/bookings?type=couples,portraits&status=pending_deposit")).body.data.total).toBe(2);
    expect((await admin.get(`/api/admin/bookings?from=${p.localDate}&to=${p.localDate}`)).body.data.items.map((i: any) => i.id)).toContain(refP);
    expect((await admin.get("/api/admin/bookings?q=ALPHA")).body.data.items.map((i: any) => i.id)).toEqual([refP]);
    expect((await admin.get("/api/admin/bookings?q=beta@mail")).body.data.total).toBe(1);
    expect((await admin.get("/api/admin/bookings?status=cancelled")).body.data.total).toBe(0);
    expect((await admin.get("/api/admin/bookings?view=past")).body.data.total).toBe(0);
    const paged = (await admin.get("/api/admin/bookings?pageSize=2&page=2")).body.data;
    expect(paged).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(paged.items).toHaveLength(1);
    expect(paged.summary.requestsWaiting).toBe(1);
    expect((await admin.get("/api/admin/bookings?status=bogus")).status).toBe(400);
    expect((await admin.get("/api/admin/bookings?pageSize=500")).status).toBe(400);
    expect((await admin.get("/api/admin/bookings?flag=nope")).status).toBe(400);
  });
  it("flag filters: email_not_sent, deposit_overdue, reply_overdue", async () => {
    const { api, admin, emails, svcMod } = await setup();
    const p = await firstOpenSlot(api, "portraits", FROM, TO, undefined, 0);
    const e = await firstOpenSlot(api, "events", FROM, TO, 120, 6);
    (emails as any).failNext(2);
    const refP = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot: p })));
    const refE = getRef(await api.createBooking(eventsBody(e)));
    expect((await admin.get("/api/admin/bookings?flag=email_not_sent")).body.data.items.map((i: any) => i.id)).toEqual([refP]);
    const { steppingClock } = await import("../../../netlify/lib/clock");
    const clock = steppingClock(svcMod.getServices().clock.now());
    svcMod.setServicesForTest({ clock });
    clock.advanceMinutes(3 * 24 * 60);
    await admin.login();
    expect((await admin.get("/api/admin/bookings?flag=deposit_overdue")).body.data.items.map((i: any) => i.id)).toEqual([refP]);
    expect((await admin.get("/api/admin/bookings?flag=reply_overdue")).body.data.items.map((i: any) => i.id)).toEqual([refE]);
    expect((await admin.get("/api/admin/bookings")).body.data.summary).toMatchObject({ depositOverdue: 1, replyOverdue: 1, requestsWaiting: 1 });
  });
  it("detail lists every intake field for the type in order, null for unanswered, with the policy and history", async () => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "families", FROM, TO);
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "families", slot })));
    const d = await detailOf(admin, ref);
    expect(d.intake.map((i: any) => i.id)).toEqual(["subjectsNames", "styleNotes", "mustHaveShots", "anythingElse", "heardAbout", "families.childrenAges", "families.extendedFamily"]);
    expect(d.intake.find((i: any) => i.id === "mustHaveShots").value).toBeNull();
    expect(d.intake.find((i: any) => i.id === "families.childrenAges")).toMatchObject({ label: "Children's ages", value: CLIENT.childrenAges });
    expect(d.policy).toMatchObject({ version: "v0.1-draft", url: "/policies.html?version=v0.1-draft" });
    expect(d.pricing.paymentLinkUrl).toContain(`client_reference_id=${ref}`);
    expect(d.history).toHaveLength(1);
    expect(d.emails.booking_received.status).toBe("sent");
    expect(d.display.createdAt).toBe("Dec 1, 2026 · 9:00 AM ET");
  });
});

describe("CSV export (story 016)", () => {
  async function csv(app: any, admin: Api, query = "") {
    const res: Response = await app.transport(new Request(`http://localhost:5173/api/admin/export.csv${query}`, { headers: { cookie: admin.cookie } }));
    return { res, bytes: new Uint8Array(await res.arrayBuffer()) };
  }
  it("format: BOM, CRLF, every field quoted, documented header order, file name, formula guard", async () => {
    const { app, api, admin } = await setup();
    const p = await firstOpenSlot(api, "portraits", FROM, TO, undefined, 0);
    await api.createBooking(buildBookingBody({ type: "portraits", slot: p, contact: { fullName: "=HYPERLINK(\"http://evil.test\",\"x\")", phone: "+15615550123", email: "csv@mail.test" }, override: { anythingElse: "@SUM(A1:A2), \"quoted\"\nnewline" } }));
    const { res, bytes } = await csv(app, admin);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="bookings-2026-12-01.csv"');
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toContain('"Reference","Status","Session type","Date (ET)"');
    expect(text).toContain("\r\n");
    const rows = parseCsv(text);
    const header = rows[0]!;
    const row = rows[1]!;
    expect(row).toHaveLength(header.length);
    expect(row[header.indexOf("Client name")]).toBe("'=HYPERLINK(\"http://evil.test\",\"x\")");
    expect(row[header.indexOf("Phone")]).toBe("'+15615550123");
    expect(row[header.indexOf("Anything to know")]).toBe("'@SUM(A1:A2), \"quoted\"\nnewline");
    expect(row[header.indexOf("Status")]).toBe("pending_deposit");
    expect(row[header.indexOf("Amount due")]).toBe("100.00");
    expect(row[header.indexOf("Created at (ET)")]).toBe("2026-12-01 09:00");
    expect(row[header.indexOf("Policy version")]).toBe("v0.1-draft");
    expect(row[header.indexOf("Couples: occasion")]).toBe("");
  });
  it("exports ALL matching rows past one page, honors the filters, and a no-match file is header only", async () => {
    const { app, api, admin } = await setup();
    for (let i = 0; i < 3; i++) {
      const s = await firstOpenSlot(api, "portraits", FROM, TO, undefined, i * 3);
      await api.createBooking(buildBookingBody({ type: "portraits", slot: s }), newKey(), { ip: `10.7.0.${i}` });
    }
    const text = (b: Uint8Array) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(b);
    expect(parseCsv(text((await csv(app, admin, "?pageSize=1")).bytes))).toHaveLength(4); // header + 3 rows
    expect(parseCsv(text((await csv(app, admin, "?type=couples")).bytes))).toHaveLength(1);
    expect((await csv(app, admin, "?status=nope")).res.status).toBe(400);
    const anon = await app.transport(new Request("http://localhost:5173/api/admin/export.csv"));
    expect(anon.status).toBe(401);
  });
  it("a deleted booking exports no personal data (story 012 #7)", async () => {
    const { app, api, admin } = await setup();
    const s = await firstOpenSlot(api, "portraits", FROM, TO);
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot: s })));
    const d = await detailOf(admin, ref);
    const c = await admin.patch(`/api/admin/bookings/${ref}`, { action: "cancel", expectedVersion: d.version, reason: "other", notifyClient: false });
    await admin.post(`/api/admin/bookings/${ref}/delete-client-data`, { confirmReference: ref, expectedVersion: c.body.data.booking.version });
    const body = new TextDecoder().decode((await csv(app, admin, "?view=all&status=cancelled")).bytes);
    expect(body).toContain(ref);
    for (const needle of [CLIENT.fullName, CLIENT.email, CLIENT.phone, CLIENT.subjectsNames, "QA-STYLE-NOTE"]) expect(body).not.toContain(needle);
  });
});

describe("delete client data (story 012 #7)", () => {
  it("only closed bookings; the reference must be typed; everything personal goes, facts stay", async () => {
    const { api, admin } = await setup();
    const s = await firstOpenSlot(api, "portraits", FROM, TO);
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot: s })));
    let d = await detailOf(admin, ref);
    const active = await admin.post(`/api/admin/bookings/${ref}/delete-client-data`, { confirmReference: ref, expectedVersion: d.version });
    expect(active.status).toBe(422);
    expect(active.body.error.code).toBe("INVALID_TRANSITION");
    d = (await admin.patch(`/api/admin/bookings/${ref}`, { action: "confirm_without_payment", expectedVersion: d.version, note: "private note" })).body.data.booking;
    d = (await admin.patch(`/api/admin/bookings/${ref}`, { action: "cancel", expectedVersion: d.version, reason: "other", note: "secret reason", notifyClient: false })).body.data.booking;
    expect(d.allowedActions).toContain("delete_client_data");
    expect((await admin.post(`/api/admin/bookings/${ref}/delete-client-data`, { confirmReference: "DBP-WRONG1", expectedVersion: d.version })).status).toBe(400);
    expect((await admin.post(`/api/admin/bookings/${ref}/delete-client-data`, { confirmReference: ref, expectedVersion: d.version - 1 })).status).toBe(409);
    const ok = await admin.post(`/api/admin/bookings/${ref.toLowerCase()}/delete-client-data`, { confirmReference: ref.toLowerCase(), expectedVersion: d.version });
    expect(ok.status).toBe(200);
    const b = ok.body.data.booking;
    expect(b).toMatchObject({ contact: null, people: null, intake: [], location: { kind: "removed" }, status: "cancelled", sessionTypeId: "portraits", policy: { version: "v0.1-draft" } });
    expect(b.piiDeletedAt).toBeTruthy();
    expect(b.flags).toContain("pii_deleted");
    expect(b.allowedActions).toEqual([]);
    expect(b.cancellation.note).toBeNull();
    expect(b.history.every((h: any) => h.note === null)).toBe(true);
    expect(JSON.stringify(b)).not.toMatch(/secret reason|private note|Quillfeather|zelda/i);
    const listed = (await admin.get("/api/admin/bookings?view=all&status=cancelled")).body.data.items[0];
    expect(listed.clientName).toBeNull();
    expect((await admin.post(`/api/admin/bookings/${ref}/resend-email`, { kind: "cancelled" })).status).toBe(422);
  });
  it("payment method and note are wiped too (review L4)", async () => {
    const { api, admin } = await setup();
    const s = await firstOpenSlot(api, "portraits", FROM, TO);
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot: s })));
    let d = await detailOf(admin, ref);
    d = (await admin.patch(`/api/admin/bookings/${ref}`, { action: "mark_paid", expectedVersion: d.version, amountCents: 10000, receivedOn: "2026-12-01", method: "Zelle from Zelda", note: "memo" })).body.data.booking;
    d = (await admin.patch(`/api/admin/bookings/${ref}`, { action: "cancel", expectedVersion: d.version, reason: "other", notifyClient: false })).body.data.booking;
    const ok = await admin.post(`/api/admin/bookings/${ref}/delete-client-data`, { confirmReference: ref, expectedVersion: d.version });
    expect(ok.body.data.booking.payment).toMatchObject({ amountCents: 10000, method: null, note: null });
  });
});

describe("resend email (story 008 #5, #6)", () => {
  it("needs a failed email or an explicit kind that fits the status; sends exactly one", async () => {
    const { api, admin, emails } = await setup();
    const s = await firstOpenSlot(api, "portraits", FROM, TO);
    const ref = getRef(await api.createBooking(buildBookingBody({ type: "portraits", slot: s })));
    expect((await admin.post(`/api/admin/bookings/${ref}/resend-email`, {})).status).toBe(400); // nothing failed
    expect((await admin.post(`/api/admin/bookings/${ref}/resend-email`, { kind: "declined" })).status).toBe(422); // does not fit pending_deposit
    emails.clear();
    const r = await admin.post(`/api/admin/bookings/${ref}/resend-email`, { kind: "booking_received" });
    expect(r.body.data).toEqual({ kind: "booking_received", status: "sent" });
    expect(emails.sent).toHaveLength(1);
    expect((await admin.post(`/api/admin/bookings/${ref}/resend-email`, { kind: "mystery" })).status).toBe(400);
  });
});

describe("logs hold no personal data (story 017 #6, review M3)", () => {
  it("malformed JSON, a rejected booking, a Resend 422 that echoes the address, and admin work log codes only", async () => {
    const lines: string[] = [];
    const app = await freshApp({ LOG_LEVEL: "debug" });
    const { setLogSink } = await import("../../../netlify/lib/log");
    setLogSink((l) => lines.push(l));
    try {
      const { ResendEmailSender } = await import("../../../netlify/lib/email/resend");
      const { setServicesForTest, getServices } = await import("../../../netlify/lib/services");
      getServices();
      setServicesForTest({
        email: new ResendEmailSender({
          apiKey: "re_fake",
          fromName: "X",
          fromAddress: "x@mail.test",
          fetchImpl: async () => new Response(JSON.stringify({ message: `Invalid \`to\` field: ${CLIENT.email} (${CLIENT.fullName})` }), { status: 422 }),
        }),
      });
      const api = app.api();
      const admin = app.api();
      await admin.login();
      await api.call("POST", "/api/bookings", { rawBody: `{"contact": {"fullName": "${CLIENT.fullName}", "email": ${CLIENT.email}`, idempotencyKey: newKey() }); // broken JSON with PII in it
      const slot = await firstOpenSlot(api, "families", FROM, TO);
      const bad = await api.createBooking({ ...buildBookingBody({ type: "families", slot }), contact: { fullName: CLIENT.fullName, email: "not-an-email", phone: CLIENT.phone, preferredContact: "email" } });
      expect(bad.status).toBe(400);
      const ok = await api.createBooking(buildBookingBody({ type: "families", slot }));
      expect(ok.status).toBe(201);
      expect(ok.body.data.emailSent).toBe(false); // the 422 was swallowed and recorded
      const ref = getRef(ok);
      const d = await detailOf(admin, ref);
      await admin.patch(`/api/admin/bookings/${ref}`, { action: "cancel", expectedVersion: d.version, reason: "other", note: CLIENT.anythingElse, notifyClient: false });
      await admin.get("/api/admin/export.csv");
      await admin.get(`/api/admin/bookings?q=${encodeURIComponent("Quillfeather")}`);
      await admin.get(`/api/admin/bookings/${ref}`);
      await api.get("/api/admin/bookings/DBP-NOPE00");
    } finally {
      setLogSink(null);
    }
    const text = lines.join("\n");
    expect(lines.length).toBeGreaterThan(5);
    for (const needle of ["Quillfeather", "Zelda", "zelda", "example.test", CLIENT.phone, "QA-STYLE-NOTE", "QA-ANYTHING-ELSE", "Pippa", "buy.stripe", "pbkdf2", "re_fake"]) {
      expect(text, `log leaked ${needle}`).not.toContain(needle);
    }
    expect(text).toContain('"providerStatus":422');
    expect(text).not.toMatch(/DBP-[A-Z0-9]{6}.*route|"route":"[^"]*DBP-/); // references never appear in a route label
    const allowed = new Set(["level", "msg", "ts", "requestId", "fn", "route", "status", "code", "bookingId", "durationMs", "count", "reason", "driver", "kind", "honeypot", "providerStatus", "errorName", "rule"]);
    for (const line of lines) for (const k of Object.keys(JSON.parse(line))) expect(allowed.has(k), `unexpected log key ${k}`).toBe(true);
  });
  it("an unexpected error logs only the error class name and answers a generic 500", async () => {
    const lines: string[] = [];
    const app = await freshApp({ LOG_LEVEL: "debug" });
    const { setLogSink } = await import("../../../netlify/lib/log");
    setLogSink((l) => lines.push(l));
    try {
      const { setServicesForTest, getServices } = await import("../../../netlify/lib/services");
      const svc = getServices();
      setServicesForTest({ store: { ...svc.store, list: async () => { throw new Error(`boom for ${CLIENT.email}`); }, get: svc.store.get.bind(svc.store), set: svc.store.set.bind(svc.store), delete: svc.store.delete.bind(svc.store) } });
      const admin = app.api();
      await admin.login();
      const r = await admin.get("/api/admin/bookings");
      expect(r.status).toBe(500);
      expect(r.body.error).toEqual({ code: "INTERNAL", message: "Something went wrong on our side. Please try again." });
    } finally {
      setLogSink(null);
    }
    const text = lines.join("\n");
    expect(text).toContain('"errorName":"Error"');
    expect(text).not.toContain("boom");
    expect(text).not.toContain(CLIENT.email);
  });
});
