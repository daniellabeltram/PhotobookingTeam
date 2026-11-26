// Pure availability rules (story 002): buffers, notice, horizon, cap, blocks, minis.
import { describe, expect, it } from "vitest";
import { computeAvailability, type AvailabilityParams } from "../../../netlify/lib/domain/availability";
import { nearestAlternatives } from "../../../netlify/lib/domain/alternatives";
import { gapConflict } from "../../../netlify/lib/domain/overlap";
import { getConfig } from "../../../netlify/lib/config";
import { addMinutes, etLocalToUtc } from "../../../shared/datetime";
import type { BlockedTime, DayLedger, LedgerEntry } from "../../../shared/models";

const config = getConfig();
const type = (id: string) => config.sessionTypes.find((t) => t.id === id)!;
const NOW = "2026-12-01T14:00:00.000Z"; // Tue 09:00 ET
const DATE = "2026-12-09"; // a Wednesday, winter windows 07:00-09:30 and 15:30-17:45

function entry(id: string, date: string, from: string, minutes: number, buffer = 30, cap = true): LedgerEntry {
  const start = etLocalToUtc(date, from)!;
  const end = addMinutes(start, minutes);
  return {
    bookingId: id, sessionTypeId: "x", kind: "standard", startUtc: start, endUtc: end,
    busyStartUtc: addMinutes(start, -buffer), busyEndUtc: addMinutes(end, buffer),
    countsTowardDailyCap: cap, miniSlotId: null, createdAt: NOW, verified: true,
  };
}
const ledger = (date: string, entries: LedgerEntry[], miniDay: DayLedger["miniDay"] = null): Map<string, DayLedger> =>
  new Map([[date, { date, updatedAt: NOW, entries, miniDay }]]);

function run(over: Partial<AvailabilityParams> & { typeId?: string; date?: string }) {
  const t = type(over.typeId ?? "portraits");
  const date = over.date ?? DATE;
  return computeAvailability({
    config, type: t, durationMin: t.durationMin, from: date, to: date, nowIso: NOW, ledgers: new Map(), blocks: [], ...over,
  });
}
const times = (r: ReturnType<typeof run>) => r.days[0]!.slots.map((s) => s.localTime);

describe("buffers (story 002 #3)", () => {
  it("an existing 10:00-11:00 booking: a later 120-minute event may start exactly at 11:00 + 30, not before", () => {
    // Events use the venue window (09:00-22:00), buffer 30
    const t = times(run({ typeId: "events", durationMin: 120, ledgers: ledger(DATE, [entry("DBP-AAAAAA", DATE, "10:00", 60)]) }));
    expect(t).toContain("11:30");
    expect(t).not.toContain("11:00");
    expect(t).not.toContain("10:00");
    expect(t.some((x) => x < "10:00")).toBe(false); // nothing before 10:00 fits a 2 hour session plus the buffer
  });

  it("a 60-minute session ending exactly at (start - buffer) is offered; one minute closer is not", () => {
    const a = { startUtc: "2026-12-09T15:00:00.000Z", endUtc: "2026-12-09T16:00:00.000Z", bufferMin: 30 };
    const touching = { startUtc: "2026-12-09T13:30:00.000Z", endUtc: "2026-12-09T14:30:00.000Z", bufferMin: 30 }; // ends 30 min before
    const tooClose = { startUtc: "2026-12-09T13:31:00.000Z", endUtc: "2026-12-09T14:31:00.000Z", bufferMin: 30 };
    expect(gapConflict(a, touching)).toBe(false);
    expect(gapConflict(a, tooClose)).toBe(true);
    const after = { startUtc: "2026-12-09T16:30:00.000Z", endUtc: "2026-12-09T17:30:00.000Z", bufferMin: 30 };
    expect(gapConflict(a, after)).toBe(false);
    expect(gapConflict(a, { ...after, startUtc: "2026-12-09T16:29:00.000Z" })).toBe(true);
  });

  it("the larger of the two buffers applies between different types (minis 10, standard 30)", () => {
    const mini = { startUtc: "2026-12-09T15:00:00.000Z", endUtc: "2026-12-09T15:20:00.000Z", bufferMin: 10 };
    const standard = { startUtc: "2026-12-09T15:40:00.000Z", endUtc: "2026-12-09T16:40:00.000Z", bufferMin: 30 };
    expect(gapConflict(mini, standard)).toBe(true); // only 20 minutes apart, needs 30
    expect(gapConflict(mini, { ...standard, startUtc: "2026-12-09T15:50:00.000Z", endUtc: "2026-12-09T16:50:00.000Z" })).toBe(false);
  });

  it("an existing 07:00 portrait removes 07:30 and 08:00 and keeps 08:30 (winter morning window)", () => {
    const r = run({ ledgers: ledger(DATE, [entry("DBP-AAAAAA", DATE, "07:00", 60)]) });
    expect(times(r)).toEqual(["08:30", "15:30", "16:00", "16:30"]);
  });

  it("a slot of ANOTHER type is blocked by the same rule", () => {
    const r = run({ typeId: "couples", ledgers: ledger(DATE, [entry("DBP-AAAAAA", DATE, "07:00", 60)]) });
    expect(times(r)).toEqual(["08:30", "15:30", "16:00", "16:30"]);
  });

  it("cancelled bookings are not in the ledger, so they free their slot", () => {
    expect(times(run({}))).toContain("07:00");
  });
});

describe("notice, horizon and range", () => {
  it("notice: a slot exactly at now + 72 h is offered; one minute earlier is not", () => {
    const start = "2026-12-04T20:30:00.000Z"; // Fri 15:30 ET
    const exactNow = addMinutes(start, -72 * 60);
    const r = run({ date: "2026-12-04", nowIso: exactNow });
    expect(times(r)).toContain("15:30");
    const r2 = run({ date: "2026-12-04", nowIso: addMinutes(exactNow, 1) });
    expect(times(r2)).not.toContain("15:30");
  });

  it("horizon: the last day is today + bookingHorizonDays; later days are not returned", () => {
    const r = computeAvailability({ config, type: type("portraits"), durationMin: 60, from: "2027-05-30", to: "2027-06-10", nowIso: NOW, ledgers: new Map(), blocks: [] });
    expect(r.horizonEndDate).toBe("2027-06-02"); // 2026-12-01 + 183 days
    expect(r.days[r.days.length - 1]!.date).toBe("2027-06-02");
  });

  it("ignoreNoticeAndHorizon (admin reschedule) allows a sooner time but never the past", () => {
    const r = computeAvailability({
      config, type: type("portraits"), durationMin: 60, from: "2026-11-30", to: "2026-12-02", nowIso: NOW, ledgers: new Map(), blocks: [], ignoreNoticeAndHorizon: true,
    });
    expect(r.days.map((d) => d.date)).toEqual(["2026-12-01", "2026-12-02"]);
    expect(r.days[1]!.slots.length).toBeGreaterThan(0);
    expect(r.days[0]!.slots.every((s) => s.startUtc > NOW)).toBe(true);
  });

  it("non-working days (Monday) are closed", () => {
    const r = run({ date: "2026-12-07" });
    expect(r.days[0]).toMatchObject({ date: "2026-12-07", status: "closed", slots: [] });
  });

  it("firstOpenDate (scan) is the first open date from today", () => {
    const r = computeAvailability({ config, type: type("portraits"), durationMin: 60, from: "2027-01-01", to: "2027-01-05", nowIso: NOW, ledgers: new Map(), blocks: [], scanFirstOpen: true });
    expect(r.firstOpenDate).toBe("2026-12-04"); // Tue 12-01 + 72 h notice -> Fri 12-04 afternoon
  });
});

describe("daily cap and blocks", () => {
  it("max_sessions_per_day reached: the day is full for standard types", () => {
    const entries = [entry("DBP-AAAAAA", DATE, "07:00", 60), entry("DBP-BBBBBB", DATE, "15:30", 60), entry("DBP-CCCCCC", DATE, "09:00", 30, 0)];
    const r = run({ ledgers: ledger(DATE, entries) });
    expect(r.days[0]!.status).toBe("full");
  });
  it("the booking being rescheduled does not count against the cap or block its own time", () => {
    const entries = [entry("DBP-AAAAAA", DATE, "07:00", 60)];
    const r = run({ ledgers: ledger(DATE, entries), excludeBookingId: "DBP-AAAAAA", ignoreNoticeAndHorizon: true });
    expect(times(r)).toContain("07:00");
  });
  const block = (startDate: string, endDate: string, startUtc: string, endUtc: string): BlockedTime => ({
    id: "blk_aaaaaaaa", kind: "all_day", startDate, endDate, startTime: null, endTime: null, startUtc, endUtc, label: "secret", createdAt: NOW,
  });
  it("an all-day block closes the date (and does not leak that it is a block)", () => {
    const r = run({ blocks: [block(DATE, DATE, etLocalToUtc(DATE, "00:00")!, etLocalToUtc("2026-12-10", "00:00")!)] });
    expect(r.days[0]).toEqual({ date: DATE, status: "closed", slots: [] });
  });
  it("a time-range block removes only the slots it overlaps (block uses the session, not the buffer)", () => {
    const b = block(DATE, DATE, etLocalToUtc(DATE, "07:30")!, etLocalToUtc(DATE, "08:30")!);
    expect(times(run({ blocks: [b] }))).toEqual(["08:30", "15:30", "16:00", "16:30"]); // 08:30 starts exactly when the block ends
  });
});

describe("Holiday Minis", () => {
  const miniDay = (booked: boolean): DayLedger["miniDay"] => ({
    location: "Phillips Point", theme: "Winter", createdAt: NOW,
    slots: ["08:00", "08:30", "09:00"].map((hm, i) => {
      const start = etLocalToUtc("2026-12-12", hm)!;
      const end = addMinutes(start, 20);
      return { id: `ms_2026-12-12_${hm.replace(":", "")}`, startUtc: start, endUtc: end, busyStartUtc: addMinutes(start, -10), busyEndUtc: addMinutes(end, 10), bookingId: booked || i === 0 ? "DBP-AAAAAA" : null };
    }),
  });
  it("lists free slots with spotsLeft and totals; ignores working days and windows", () => {
    const r = run({ typeId: "holiday-minis", date: "2026-12-12", ledgers: ledger("2026-12-12", [], miniDay(false)) });
    expect(r.days[0]!.status).toBe("open");
    expect(r.days[0]!.mini).toEqual({ location: "Phillips Point", theme: "Winter", spotsLeft: 2, totalSpots: 3 });
    expect(r.days[0]!.slots.map((s) => s.miniSlotId)).toEqual(["ms_2026-12-12_0830", "ms_2026-12-12_0900"]);
  });
  it("all booked is 'full'", () => {
    const r = run({ typeId: "holiday-minis", date: "2026-12-12", ledgers: ledger("2026-12-12", [], miniDay(true)) });
    expect(r.days[0]!.status).toBe("full");
  });
  it("mini slots at 30-minute spacing fit back to back (duration 20 + buffer 10)", () => {
    const d = miniDay(false)!;
    for (let i = 0; i < d.slots.length - 1; i++) {
      const a = d.slots[i]!;
      const b = d.slots[i + 1]!;
      expect(gapConflict({ startUtc: a.startUtc, endUtc: a.endUtc, bufferMin: 10 }, { startUtc: b.startUtc, endUtc: b.endUtc, bufferMin: 10 })).toBe(false);
    }
  });
  it("a mini slot (booked or not) blocks standard sessions around it", () => {
    const r = run({ date: "2026-12-12", ledgers: ledger("2026-12-12", [], miniDay(false)) });
    expect(times(r)).not.toContain("07:30"); // 08:00 mini - 30 min gap
    expect(times(r)).not.toContain("08:00");
  });
});

describe("alternatives", () => {
  it("returns the 3 nearest slots, same date first", () => {
    const requested = etLocalToUtc(DATE, "07:30")!;
    const alts = nearestAlternatives({
      config, type: type("portraits"), durationMin: 60, requestedStartUtc: requested, nowIso: NOW,
      ledgers: ledger(DATE, [entry("DBP-AAAAAA", DATE, "07:30", 60)]), blocks: [],
    });
    expect(alts).toHaveLength(3);
    expect(alts.every((s) => s.localDate === DATE)).toBe(true);
    expect(alts.map((s) => s.localTime)).toEqual(["15:30", "16:00", "16:30"].sort((a, b) => Math.abs(parse(a) - parse("07:30")) - Math.abs(parse(b) - parse("07:30"))));
  });
  it("returns [] when nothing is open nearby", () => {
    const alts = nearestAlternatives({
      config, type: type("portraits"), durationMin: 60, requestedStartUtc: etLocalToUtc("2027-04-01", "07:00")!, nowIso: NOW, ledgers: new Map(),
      blocks: [{ id: "blk_aaaaaaaa", kind: "all_day", startDate: "2027-03-01", endDate: "2027-05-01", startTime: null, endTime: null, startUtc: etLocalToUtc("2027-03-01", "00:00")!, endUtc: etLocalToUtc("2027-05-02", "00:00")!, label: null, createdAt: NOW }],
    });
    expect(alts).toEqual([]);
  });
});
const parse = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
