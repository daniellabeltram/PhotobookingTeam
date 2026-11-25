// PRIMARY double-booking check (story 004 #1, #2, #7, #8, #9; must-have 2). Also the in-process twin of the
// preview launch-gate in docs/operations.md section 6. Handlers are called directly with memory drivers.
import "../../helpers/env";
import { describe, it, expect, beforeEach } from "vitest";
import { freshApp } from "../../helpers/app";
import { buildBookingBody, findOverlaps, firstOpenSlot, newKey, type Api, type Slot } from "../../helpers/builders";
import { OTHER_CLIENT } from "../../helpers/seed";

let app: Awaited<ReturnType<typeof freshApp>>;
let api: Api;
const FROM = "2026-12-01", TO = "2027-01-15";

beforeEach(async () => {
  app = await freshApp();
  api = app.api();
});

async function adminList(): Promise<any[]> {
  const admin = app.api();
  expect((await admin.login()).status).toBe(200);
  const r = await admin.get("/api/admin/bookings?view=all&pageSize=100");
  expect(r.status).toBe(200);
  return r.body.data.items;
}

describe("concurrent creates", () => {
  it("20 parallel creates for one Families slot -> exactly 1 x 201, 19 x SLOT_TAKEN, no 5xx", async () => {
    const slot = await firstOpenSlot(api, "families", FROM, TO);
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        app.api().createBooking(buildBookingBody({ type: "families", slot, contact: { fullName: `Racer ${i}`, email: `racer${i}@example.test`, phone: "5615550100" } }), newKey()),
      ),
    );
    const codes = results.map((r) => r.status);
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(19);
    expect(codes.filter((c) => c >= 500)).toHaveLength(0);
    const losers = results.filter((r) => r.status === 409);
    for (const l of losers) {
      expect(l.body.error.code).toBe("SLOT_TAKEN");
      expect(l.body.error.details.alternatives.length).toBeLessThanOrEqual(3);
      expect(l.body.error.details.alternatives.map((a: any) => a.startUtc)).not.toContain(slot.startUtc);
    }
    const items = (await adminList()).filter((b) => b.startUtc === slot.startUtc);
    expect(items).toHaveLength(1);
  });

  it("alternatives are the nearest open times, same date first, closest first (004 #1)", async () => {
    const slot = await firstOpenSlot(api, "families", FROM, TO);
    expect((await api.createBooking(buildBookingBody({ type: "families", slot }))).status).toBe(201);
    const lose = await app.api().createBooking(buildBookingBody({ type: "families", slot, contact: { ...OTHER_CLIENT } }));
    expect(lose.status).toBe(409);
    const alts: any[] = lose.body.error.details.alternatives;
    expect(alts.length).toBeGreaterThan(0);
    const dist = alts.map((a) => (a.localDate === slot.localDate ? 0 : 1e12) + Math.abs(+new Date(a.startUtc) - +new Date(slot.startUtc)));
    expect([...dist].sort((a, b) => a - b)).toEqual(dist);
  });

  it("overlapping slots of DIFFERENT types submitted together -> only one booking (004 #2)", async () => {
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const couples = (await api.availability("couples", slot.localDate, slot.localDate)).body.data.days[0].slots.find((s: any) => s.startUtc === slot.startUtc);
    expect(couples, "Couples must offer the same start (same window, same grid)").toBeTruthy();
    const [a, b] = await Promise.all([
      app.api().createBooking(buildBookingBody({ type: "portraits", slot })),
      app.api().createBooking(buildBookingBody({ type: "couples", slot: couples! })),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  it("slots that overlap only through the buffer also conflict (004 #2 + buffers)", async () => {
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const day = (await api.availability("portraits", slot.localDate, slot.localDate)).body.data.days[0].slots;
    const end = +new Date(slot.endUtc);
    const next = day.find((s: any) => +new Date(s.startUtc) >= end && +new Date(s.startUtc) - end < 30 * 60000);
    if (!next) return; // grid has no slot inside the buffer: nothing to prove here (buffers.test covers the boundary)
    const [a, b] = await Promise.all([app.api().createBooking(buildBookingBody({ type: "portraits", slot })), app.api().createBooking(buildBookingBody({ type: "portraits", slot: next }))]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  it("20 parallel creates over 5 distinct slots keep the invariant: no two active bookings overlap (004 #9)", async () => {
    const slots: Slot[] = [];
    for (let i = 0; i < 5; i++) slots.push(await firstOpenSlot(api, "portraits", FROM, TO, undefined, i));
    await Promise.all(Array.from({ length: 20 }, (_, i) => app.api().createBooking(buildBookingBody({ type: "portraits", slot: slots[i % 5] }), newKey())));
    const items = await adminList();
    const admin = app.api();
    await admin.login();
    const detail = await Promise.all(items.map((b) => admin.get(`/api/admin/bookings/${b.id}`).then((r) => ({ ...b, bufferMin: r.body.data.bufferMin }))));
    const overlaps = detail.flatMap((d) => findOverlaps([d, ...detail.filter((o) => o.id !== d.id)], d.bufferMin)).filter(([x, y]) => x !== y);
    expect(overlaps).toEqual([]);
  });

  it("daily cap holds under concurrency (maxSessionsPerDay)", async () => {
    const day = (await api.availability("portraits", FROM, TO)).body.data.days.find((d: any) => d.status === "open" && d.slots.length >= 5)!;
    expect(day, "need a day with >= 5 slots").toBeTruthy();
    // Pick 5 slots on that day that do not overlap each other (every other slot with buffers), try them all at once.
    const picks = day.slots.filter((_: any, i: number) => i % 3 === 0).slice(0, 5);
    const rs = await Promise.all(picks.map((s: any) => app.api().createBooking(buildBookingBody({ type: "portraits", slot: s }), newKey())));
    const ok = rs.filter((r) => r.status === 201).length;
    const cfg = (await api.get("/api/config")).body.data;
    void cfg;
    expect(ok).toBeLessThanOrEqual(3); // placeholder maxSessionsPerDay = 3 (docs/04); update if Daniella changes it
    expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
  });
});

describe("Holiday Minis race (004 #8)", () => {
  it("two families, one mini slot: one wins and spotsLeft drops by exactly one", async () => {
    const admin = app.api();
    await admin.login();
    const created = await admin.post("/api/admin/mini-days/2026-12-12/slots", { location: "Phillips Point", theme: "Winter", startTimes: ["08:00", "08:30", "09:00"] });
    expect(created.status).toBe(201);
    const before = (await api.availability("minis", "2026-12-12", "2026-12-12")).body.data.days[0];
    expect(before.mini!.spotsLeft).toBe(3);
    const slot = before.slots[0];
    expect(slot.miniSlotId).toBeTruthy();
    const rs = await Promise.all([1, 2, 3, 4].map((i) => app.api().createBooking(buildBookingBody({ type: "minis", slot, contact: { email: `fam${i}@example.test` } }), newKey())));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(3);
    const after = (await api.availability("minis", "2026-12-12", "2026-12-12")).body.data.days[0];
    expect(after.mini!.spotsLeft).toBe(2);
  });
});
