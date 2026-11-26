// ADR 0006: DST days, gaps, ambiguity, notice and horizon boundaries, display strings.
import { describe, expect, it } from "vitest";
import { computeAvailability, gridForWindows } from "../../../netlify/lib/domain/availability";
import { getConfig } from "../../../netlify/lib/config";
import {
  addDays,
  daysBetween,
  etDateOf,
  etLocalToUtc,
  etTimeOf,
  formatDateLong,
  formatDateTimeLabel,
  formatRangeEt,
  formatTime,
  normalizeInstant,
  toIcsUtc,
  todayEt,
} from "../../../shared/datetime";

const cfg = getConfig();
const venue = cfg.scheduling.windowSets.venue![0]!.windows;
const outdoorWinter = cfg.scheduling.windowSets.outdoor![0]!.windows;

describe("etLocalToUtc", () => {
  it("returns null for a time inside the spring-forward gap (2027-03-14 02:30)", () => {
    expect(etLocalToUtc("2027-03-14", "02:00")).toBeNull();
    expect(etLocalToUtc("2027-03-14", "02:30")).toBeNull();
    expect(etLocalToUtc("2027-03-14", "03:00")).toBe("2027-03-14T07:00:00.000Z"); // EDT, UTC-4
    expect(etLocalToUtc("2027-03-14", "01:30")).toBe("2027-03-14T06:30:00.000Z"); // EST, UTC-5
  });
  it("maps an ambiguous fall-back time to the EARLIER instant (EDT) on 2027-11-07", () => {
    expect(etLocalToUtc("2027-11-07", "01:30")).toBe("2027-11-07T05:30:00.000Z"); // EDT, UTC-4
    expect(etLocalToUtc("2027-11-07", "02:00")).toBe("2027-11-07T07:00:00.000Z"); // EST, UTC-5
  });
  it("rejects malformed input", () => {
    expect(etLocalToUtc("2027-02-30", "10:00")).toBeNull();
    expect(etLocalToUtc("2027-03-14", "25:00")).toBeNull();
  });
});

describe("slot grid on DST days", () => {
  const slots = (date: string, windows: { start: string; end: string }[], dur: number) =>
    gridForWindows(date, windows, dur, 30).map((s) => etTimeOf(s.startUtc));

  it("2027-03-14 (spring forward): same wall-clock slots as an ordinary day, none in 2:00-3:00, none twice", () => {
    const dst = slots("2027-03-14", venue, 120);
    const ordinary = slots("2027-03-16", venue, 120);
    expect(dst).toEqual(ordinary);
    expect(new Set(dst).size).toBe(dst.length);
    expect(dst.some((t) => t >= "01:00" && t < "03:00")).toBe(false);
  });
  it("2027-11-07 (fall back): same wall-clock slots as an ordinary day, none duplicated", () => {
    const dst = slots("2027-11-07", venue, 120);
    const ordinary = slots("2027-11-09", venue, 120);
    expect(dst).toEqual(ordinary);
    expect(new Set(dst).size).toBe(dst.length);
  });
  it("a window that crosses the gap drops only the nonexistent start times", () => {
    const across = slots("2027-03-14", [{ start: "01:00", end: "04:00" }], 30);
    expect(across).toEqual(["01:00", "01:30", "03:00", "03:30"]);
  });
  it("the same instant formats to the same ET time on the DST days (EST before, EDT after)", () => {
    const start = etLocalToUtc("2027-03-14", "09:00")!;
    expect(formatTime(start)).toBe("9:00 AM");
    expect(etDateOf(start)).toBe("2027-03-14");
    const fall = etLocalToUtc("2027-11-07", "09:00")!;
    expect(formatTime(fall)).toBe("9:00 AM");
    expect(fall).toBe("2027-11-07T14:00:00.000Z"); // EST again, UTC-5
  });
  it("availability on both DST dates returns the ordinary-day slot times (engine level)", () => {
    const type = cfg.sessionTypes.find((t) => t.id === "events")!;
    for (const [now, date, ordinary] of [
      ["2027-02-01T09:00:00-05:00", "2027-03-14", "2027-03-16"],
      ["2027-10-01T09:00:00-04:00", "2027-11-07", "2027-11-09"],
    ] as const) {
      const res = computeAvailability({ config: cfg, type, durationMin: 120, from: date, to: addDays(ordinary, 0), nowIso: normalizeInstant(now)!, ledgers: new Map(), blocks: [] });
      const times = (d: string) => res.days.find((x) => x.date === d)!.slots.map((s) => s.localTime);
      expect(times(date)).toEqual(times(ordinary));
      expect(times(date).length).toBeGreaterThan(0);
    }
  });
});

describe("calendar arithmetic and display", () => {
  it("todayEt follows Eastern time, not UTC", () => {
    expect(todayEt("2026-12-02T03:30:00.000Z")).toBe("2026-12-01");
    expect(todayEt("2026-12-02T05:00:00.000Z")).toBe("2026-12-02");
  });
  it("addDays and daysBetween cross DST without drifting", () => {
    expect(addDays("2027-03-13", 2)).toBe("2027-03-15");
    expect(daysBetween("2027-11-06", "2027-11-08")).toBe(2);
  });
  it("formats the way the API documents it", () => {
    expect(formatRangeEt("2026-12-05T22:30:00.000Z", "2026-12-05T23:30:00.000Z")).toBe("5:30 – 6:30 PM ET");
    expect(formatRangeEt("2026-12-05T16:30:00.000Z", "2026-12-05T18:30:00.000Z")).toBe("11:30 AM – 1:30 PM ET");
    expect(formatDateLong("2026-12-02T12:00:00.000Z")).toBe("Wednesday, December 2, 2026");
    expect(formatDateTimeLabel("2026-11-25T20:12:00.000Z")).toBe("Nov 25, 2026 · 3:12 PM ET");
    expect(toIcsUtc("2026-12-05T22:30:00.000Z")).toBe("20261205T223000Z");
  });
  it("normalizeInstant needs an offset and keeps the instant", () => {
    expect(normalizeInstant("2026-12-01T09:00:00-05:00")).toBe("2026-12-01T14:00:00.000Z");
    expect(normalizeInstant("2026-12-01T09:00:00")).toBeNull();
    expect(normalizeInstant("nope")).toBeNull();
  });
  it("outdoor winter windows produce the documented grid", () => {
    expect(gridForWindows("2026-12-02", outdoorWinter, 60, 30).map((s) => etTimeOf(s.startUtc))).toEqual(["07:00", "07:30", "08:00", "08:30", "15:30", "16:00", "16:30"]);
  });
});
