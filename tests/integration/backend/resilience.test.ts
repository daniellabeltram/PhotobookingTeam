// Failure paths (code review S1-S6): a failed release heals, cross-date reschedule leaves both ledgers right, the BUSY
// path, the same-start undo, a hanging email provider, and post-commit bookkeeping that cannot become a 5xx.
import { describe, expect, it } from "vitest";
import { freshApp } from "../../helpers/app";
import { buildBookingBody, firstOpenSlot, newKey, type Api } from "../../helpers/builders";
import type { KvStore, SetResult, WriteCondition } from "../../../netlify/lib/store/kv";
import type { DayLedger } from "../../../shared/models";
import { CLIENT } from "../../helpers/seed";

const FROM = "2026-12-01";
const TO = "2027-01-15";

type Switches = { failLedgerWrites: boolean; failBookingWrites: boolean; failIdemUpdates: boolean };

async function setup(env: Record<string, string | undefined> = {}) {
  const app = await freshApp(env);
  const api = app.api();
  const admin = app.api();
  expect((await admin.login()).status).toBe(200);
  const svcMod = await import("../../../netlify/lib/services");
  const svc = svcMod.getServices();
  const real = svc.store;
  const sw: Switches = { failLedgerWrites: false, failBookingWrites: false, failIdemUpdates: false };
  const store: KvStore = {
    get: (k) => real.get(k),
    list: (p) => real.list(p),
    delete: (k) => real.delete(k),
    async set<T>(k: string, v: T, c?: WriteCondition): Promise<SetResult> {
      if (sw.failLedgerWrites && k.startsWith("days/")) return { ok: false }; // every compare-and-swap loses
      if (sw.failBookingWrites && k.startsWith("bookings/") && c && "onlyIfMatch" in c) return { ok: false };
      if (sw.failIdemUpdates && k.startsWith("idem/") && !(c && "onlyIfNew" in c)) throw new Error("idem store down");
      return real.set(k, v, c);
    },
  };
  svcMod.setServicesForTest({ store });
  return { app, api, admin, svc: svcMod.getServices(), svcMod, sw, real };
}
const ref = (r: { body: any }) => r.body.data.reference as string;
const detail = async (admin: Api, id: string) => (await admin.get(`/api/admin/bookings/${id}`)).body.data;
const ledger = async (real: KvStore, date: string) => (await real.get<DayLedger>(`days/${date}`))?.value ?? null;

describe("a failed release heals (S1)", () => {
  it("cancel while the ledger cannot be written: the change stands, the slot stays held, and repeating the cancel releases it", async () => {
    const { api, admin, sw, real } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const id = ref(await api.createBooking(buildBookingBody({ type: "portraits", slot })));
    const d = await detail(admin, id);
    sw.failLedgerWrites = true;
    const first = await admin.patch(`/api/admin/bookings/${id}`, { action: "cancel", expectedVersion: d.version, reason: "other", notifyClient: false });
    expect(first.status).toBe(200); // the cancel is saved even though the release failed
    expect(first.body.data.booking.status).toBe("cancelled");
    sw.failLedgerWrites = false;
    expect((await ledger(real, slot.localDate))!.entries.map((e) => e.bookingId)).toEqual([id]); // still held
    const times = (await api.availability("portraits", slot.localDate, slot.localDate)).body.data.days[0]!.slots.map((s) => s.startUtc);
    expect(times).not.toContain(slot.startUtc);
    // Daniella (or her browser) repeats the cancel: a conflict, and the release is retried
    const again = await admin.patch(`/api/admin/bookings/${id}`, { action: "cancel", expectedVersion: d.version, reason: "other", notifyClient: false });
    expect(again.status).toBe(409);
    expect((await ledger(real, slot.localDate))!.entries).toEqual([]);
    const after = (await api.availability("portraits", slot.localDate, slot.localDate)).body.data.days[0]!.slots.map((s) => s.startUtc);
    expect(after).toContain(slot.startUtc);
  });
  it("decline gets the same retry", async () => {
    const { api, admin, sw, real } = await setup();
    const slot = await firstOpenSlot(api, "events", FROM, TO, 120);
    const body = {
      sessionTypeId: "events", startUtc: slot.startUtc, durationMin: 120,
      contact: { fullName: CLIENT.fullName, email: CLIENT.email, phone: CLIENT.phone, preferredContact: "email" },
      subjectsNames: "Guests", people: { adults: 10, children: 0, pets: 0 }, location: { kind: "own", text: "A venue" },
      extra: { events: { eventName: "P", eventType: "party", venueAddress: "1 St", eventStartTime: "18:00", eventEndTime: "20:00", guestCount: 5, onsiteContactName: "n", onsiteContactPhone: "5615550100" } },
      policy: { accepted: true, version: "v0.1-draft" },
    };
    const id = ref(await api.createBooking(body));
    const d = await detail(admin, id);
    sw.failLedgerWrites = true;
    expect((await admin.patch(`/api/admin/bookings/${id}`, { action: "decline", expectedVersion: d.version, notifyClient: false })).status).toBe(200);
    sw.failLedgerWrites = false;
    expect((await ledger(real, slot.localDate))!.entries).toHaveLength(1);
    expect((await admin.patch(`/api/admin/bookings/${id}`, { action: "decline", expectedVersion: d.version })).status).toBe(409);
    expect((await ledger(real, slot.localDate))!.entries).toHaveLength(0);
  });
});

describe("reschedule across dates leaves both ledgers right (S6)", () => {
  it("the old date loses the entry, the new date has exactly one, and the booking agrees with both", async () => {
    const { api, admin, real } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const id = ref(await api.createBooking(buildBookingBody({ type: "portraits", slot })));
    const d = await detail(admin, id);
    const days = (await admin.get(`/api/admin/availability?type=portraits&from=${slot.localDate}&to=2026-12-22&excludeBookingId=${id}`)).body.data.days as { date: string; slots: any[] }[];
    const target = days.find((x) => x.date > slot.localDate && x.slots.length > 0)!.slots[0]!;
    expect(target.localDate).not.toBe(slot.localDate);
    const r = await admin.post(`/api/admin/bookings/${id}/reschedule`, { expectedVersion: d.version, startUtc: target.startUtc, reason: "client_request", notifyClient: false });
    expect(r.status).toBe(200);
    const oldL = await ledger(real, slot.localDate);
    const newL = await ledger(real, target.localDate);
    expect(oldL!.entries.filter((e) => e.bookingId === id)).toEqual([]);
    expect(newL!.entries.filter((e) => e.bookingId === id)).toHaveLength(1);
    expect(newL!.entries[0]).toMatchObject({ startUtc: target.startUtc, endUtc: target.endUtc });
    expect(r.body.data.booking).toMatchObject({ startUtc: target.startUtc, localDate: target.localDate });
    // and both dates behave: the old time is bookable again, the new one is not
    const oldTimes = (await api.availability("portraits", slot.localDate, slot.localDate)).body.data.days[0]!.slots.map((s) => s.startUtc);
    const newTimes = (await api.availability("portraits", target.localDate, target.localDate)).body.data.days[0]!.slots.map((s) => s.startUtc);
    expect(oldTimes).toContain(slot.startUtc);
    expect(newTimes).not.toContain(target.startUtc);
  });
  it("when the booking write fails, the NEW date's entry is undone and the old time is kept (S1/S3)", async () => {
    const { api, admin, sw, real } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const id = ref(await api.createBooking(buildBookingBody({ type: "portraits", slot })));
    const d = await detail(admin, id);
    const days = (await admin.get(`/api/admin/availability?type=portraits&from=${slot.localDate}&to=2026-12-22&excludeBookingId=${id}`)).body.data.days as { date: string; slots: any[] }[];
    const target = days.find((x) => x.date > slot.localDate && x.slots.length > 0)!.slots[0]!;
    sw.failBookingWrites = true;
    const r = await admin.post(`/api/admin/bookings/${id}/reschedule`, { expectedVersion: d.version, startUtc: target.startUtc, reason: "weather", notifyClient: false });
    sw.failBookingWrites = false;
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe("BUSY");
    expect((await ledger(real, target.localDate))?.entries ?? []).toEqual([]);
    expect((await ledger(real, slot.localDate))!.entries.map((e) => e.startUtc)).toEqual([slot.startUtc]);
    expect((await detail(admin, id)).startUtc).toBe(slot.startUtc);
  });
  it("same start, longer session, booking write fails: the OLD entry is put back (S3)", async () => {
    const { api, admin, sw, real } = await setup();
    const slot = await firstOpenSlot(api, "events", FROM, TO, 120);
    const body = {
      sessionTypeId: "events", startUtc: slot.startUtc, durationMin: 120,
      contact: { fullName: CLIENT.fullName, email: CLIENT.email, phone: CLIENT.phone, preferredContact: "email" },
      subjectsNames: "Guests", people: { adults: 10, children: 0, pets: 0 }, location: { kind: "own", text: "A venue" },
      extra: { events: { eventName: "P", eventType: "party", venueAddress: "1 St", eventStartTime: "18:00", eventEndTime: "20:00", guestCount: 5, onsiteContactName: "n", onsiteContactPhone: "5615550100" } },
      policy: { accepted: true, version: "v0.1-draft" },
    };
    const id = ref(await api.createBooking(body));
    const d = await detail(admin, id);
    const before = (await ledger(real, slot.localDate))!.entries[0]!;
    sw.failBookingWrites = true;
    const r = await admin.post(`/api/admin/bookings/${id}/reschedule`, { expectedVersion: d.version, startUtc: slot.startUtc, durationMin: 240, reason: "client_request", notifyClient: false });
    sw.failBookingWrites = false;
    expect(r.status).toBe(503);
    const after = (await ledger(real, slot.localDate))!.entries;
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ startUtc: before.startUtc, endUtc: before.endUtc, busyEndUtc: before.busyEndUtc });
    expect((await detail(admin, id)).durationMin).toBe(120);
  });
});

describe("BUSY path (S2, S6)", () => {
  it("a ledger that keeps losing the race is 503 BUSY, nothing is stored, and the same key works once it recovers", async () => {
    const { api, admin, sw, real } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const key = newKey();
    sw.failLedgerWrites = true;
    const busy = await api.createBooking(buildBookingBody({ type: "portraits", slot }), key);
    expect(busy.status).toBe(503);
    expect(busy.body.error.code).toBe("BUSY");
    sw.failLedgerWrites = false;
    expect(await real.list("bookings/")).toEqual([]);
    const ok = await api.createBooking(buildBookingBody({ type: "portraits", slot }), key); // "retry with the same Idempotency-Key"
    expect(ok.status).toBe(201);
    expect((await admin.get("/api/admin/bookings?view=all")).body.data.total).toBe(1);
  });
  it("a 16-parallel mini launch never double-books; BUSY answers are retried with the same key until everyone has a slot", async () => {
    const { api, admin } = await setup();
    const times = Array.from({ length: 16 }, (_, i) => `${String(8 + Math.floor((i * 30) / 60)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`);
    expect((await admin.post("/api/admin/mini-days/2026-12-12/slots", { location: "Phillips Point", theme: "Winter", startTimes: times })).status).toBe(201);
    const slots = (await api.availability("minis", "2026-12-12", "2026-12-12")).body.data.days[0]!.slots;
    expect(slots).toHaveLength(16);
    const jobs = slots.map((slot, i) => ({ slot, key: newKey(), body: buildBookingBody({ type: "minis", slot, contact: { email: `mini${i}@example.test` } }) }));
    let results = await Promise.all(jobs.map((j, i) => api.createBooking(j.body, j.key, { ip: `10.8.0.${i}` })));
    expect(results.every((r) => r.status === 201 || r.status === 503)).toBe(true); // BUSY is allowed, errors are not
    for (let round = 0; round < 6 && results.some((r) => r.status === 503); round++) {
      results = await Promise.all(results.map((r, i) => (r.status === 201 ? r : api.createBooking(jobs[i]!.body, jobs[i]!.key, { ip: `10.8.0.${i}` }))));
    }
    expect(results.map((r) => r.status)).toEqual(Array(16).fill(201));
    expect(new Set(results.map((r) => r.body.data.reference)).size).toBe(16);
    expect((await api.availability("minis", "2026-12-12", "2026-12-12")).body.data.days[0]!.mini).toMatchObject({ spotsLeft: 0, totalSpots: 16 });
    expect((await admin.get("/api/admin/bookings?view=all&pageSize=100")).body.data.total).toBe(16);
  });
});

describe("a slow email provider never makes a 5xx after the commit (S4)", () => {
  it("a hanging provider is 'failed, flagged' within about 4 seconds, with a 201 and a resend offered", async () => {
    const { api, admin, svcMod } = await setup();
    svcMod.setServicesForTest({ email: { send: () => new Promise(() => undefined) } }); // never answers
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const t0 = Date.now();
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    const took = Date.now() - t0;
    expect(r.status).toBe(201);
    expect(r.body.data.emailSent).toBe(false);
    expect(took).toBeGreaterThanOrEqual(3400);
    expect(took).toBeLessThan(6000);
    const d = await detail(admin, ref(r));
    expect(d.flags).toContain("email_not_sent");
    expect(d.emails.booking_received.status).toBe("failed");
  }, 15000);
});

describe("idempotency (nice to have)", () => {
  it("a retry gets its stored 201 even when the visitor is now rate limited", async () => {
    const { api } = await setup({ RATE_LIMIT_DISABLED: undefined });
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const key = newKey();
    const body = buildBookingBody({ type: "portraits", slot });
    const first = await api.createBooking(body, key, { ip: "10.6.0.1" });
    expect(first.status).toBe(201);
    const bad = { ...body, contact: { fullName: "x", email: "bad", phone: "1", preferredContact: "email" } };
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await api.createBooking(bad, newKey(), { ip: "10.6.0.1" })).status);
    expect(codes).toContain(429); // this visitor is limited now
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot }), newKey(), { ip: "10.6.0.1" })).status).toBe(429);
    const replay = await api.createBooking(body, key, { ip: "10.6.0.1" });
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(first.body);
  });
  it("a different body under the same key is not a replay (still limited)", async () => {
    const { api } = await setup({ RATE_LIMIT_DISABLED: undefined });
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const key = newKey();
    await api.createBooking(buildBookingBody({ type: "portraits", slot }), key, { ip: "10.6.0.2" });
    const bad = { ...buildBookingBody({ type: "portraits", slot }), contact: { fullName: "x", email: "bad", phone: "1", preferredContact: "email" } };
    for (let i = 0; i < 5; i++) await api.createBooking(bad, newKey(), { ip: "10.6.0.2" });
    const other = await api.createBooking(buildBookingBody({ type: "portraits", slot, contact: { fullName: "Another Person" } }), key, { ip: "10.6.0.2" });
    expect(other.status).toBe(429);
  });
  it("bookkeeping that fails after the commit is logged, not a 500: the client still gets the 201", async () => {
    const { api, admin, sw } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    sw.failIdemUpdates = true;
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    sw.failIdemUpdates = false;
    expect(r.status).toBe(201);
    expect(r.body.data.reference).toMatch(/^DBP-/);
    expect((await admin.get("/api/admin/bookings?view=all")).body.data.total).toBe(1);
  });
});
