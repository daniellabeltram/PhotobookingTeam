// Pure availability engine (architecture section 9, ADR 0006). No I/O: callers pass ledgers and blocks.
import {
  addDays,
  addMinutes,
  datesInRange,
  etDateOf,
  etLocalToUtc,
  etTimeOf,
  formatRangeEt,
  formatTime,
  hmToMinutes,
  isoWeekdayEt,
  minutesToHm,
  monthOf,
  todayEt,
} from "../../../shared/datetime";
import type { AvailabilityDay, Slot } from "../../../shared/api-types";
import type { BookingConfig, SessionType } from "../../../shared/config-schema";
import type { BlockedTime, DayLedger } from "../../../shared/models";
import { entryInterval, gapConflict, miniSlotInterval, plainOverlap } from "./overlap";

export interface AvailabilityParams {
  config: BookingConfig;
  type: SessionType;
  durationMin: number;
  from: string;
  to: string;
  nowIso: string;
  ledgers: Map<string, DayLedger>;
  blocks: BlockedTime[];
  /** Admin reschedule: no notice, no horizon. */
  ignoreNoticeAndHorizon?: boolean;
  /** Admin reschedule: the booking's own entries do not block. */
  excludeBookingId?: string;
  /** Public availability: also find the first open date from today through the horizon. */
  scanFirstOpen?: boolean;
}
export interface AvailabilityResult {
  days: AvailabilityDay[];
  horizonEndDate: string;
  firstOpenDate: string | null;
}

export function makeSlot(startUtc: string, endUtc: string, miniSlotId?: string): Slot {
  const slot: Slot = {
    startUtc,
    endUtc,
    localDate: etDateOf(startUtc),
    localTime: etTimeOf(startUtc),
    label: formatTime(startUtc),
    rangeLabel: formatRangeEt(startUtc, endUtc),
  };
  if (miniSlotId) slot.miniSlotId = miniSlotId;
  return slot;
}

/** Start times on the slot grid inside each window, in ET wall-clock terms (ADR 0006 "Slot grid"). */
export function gridForWindows(
  date: string,
  windows: { start: string; end: string }[],
  durationMin: number,
  intervalMin: number,
): { startUtc: string; endUtc: string }[] {
  const out = new Map<string, { startUtc: string; endUtc: string }>();
  for (const w of windows) {
    const endMin = hmToMinutes(w.end);
    for (let m = hmToMinutes(w.start); m < endMin; m += intervalMin) {
      const startUtc = etLocalToUtc(date, minutesToHm(m));
      if (!startUtc) continue; // inside the spring-forward gap
      const endUtc = addMinutes(startUtc, durationMin);
      const endLocal = etTimeOf(endUtc);
      if (etDateOf(endUtc) !== date || hmToMinutes(endLocal) > endMin) continue;
      out.set(startUtc, { startUtc, endUtc });
    }
  }
  return [...out.values()].sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}

export function windowsFor(config: BookingConfig, type: SessionType, date: string): { start: string; end: string }[] {
  if (!type.windowSet) return [];
  const sets = config.scheduling.windowSets[type.windowSet] ?? [];
  const month = monthOf(date);
  return sets.find((s) => s.months.includes(month))?.windows ?? [];
}

export const noticeHoursFor = (config: BookingConfig, type: SessionType): number =>
  type.minimumNoticeHours ?? config.scheduling.minimumNoticeHours;

export function blockedBy(blocks: BlockedTime[], startUtc: string, endUtc: string): boolean {
  return blocks.some((b) => plainOverlap(startUtc, endUtc, b.startUtc, b.endUtc));
}

export function computeAvailability(p: AvailabilityParams): AvailabilityResult {
  const today = todayEt(p.nowIso);
  const horizonEndDate = addDays(today, p.type.bookingHorizonDays);
  const noticeEdge = addMinutes(p.nowIso, noticeHoursFor(p.config, p.type) * 60);
  const interval = p.config.scheduling.slotIntervalMin;

  const dayFor = (date: string): AvailabilityDay => {
    const ledger = p.ledgers.get(date);
    const entries = (ledger?.entries ?? []).filter((e) => e.bookingId !== p.excludeBookingId);

    if (p.type.kind === "mini") {
      const mini = ledger?.miniDay;
      if (!mini || mini.slots.length === 0) return { date, status: "closed", slots: [] };
      const free = mini.slots.filter((s) => s.bookingId === null);
      const bookable = free.filter(
        (s) => (p.ignoreNoticeAndHorizon || s.startUtc >= noticeEdge) && s.startUtc > p.nowIso && !blockedBy(p.blocks, s.startUtc, s.endUtc),
      );
      const status = bookable.length > 0 ? "open" : free.length === 0 ? "full" : "closed";
      return {
        date,
        status,
        slots: bookable.map((s) => makeSlot(s.startUtc, s.endUtc, s.id)),
        mini: { location: mini.location, theme: mini.theme, spotsLeft: bookable.length, totalSpots: mini.slots.length },
      };
    }

    if (!p.config.scheduling.workingDays.includes(isoWeekdayEt(date))) return { date, status: "closed", slots: [] };
    const windows = windowsFor(p.config, p.type, date);
    let candidates = gridForWindows(date, windows, p.durationMin, interval);
    candidates = candidates.filter((c) => c.startUtc > p.nowIso && (p.ignoreNoticeAndHorizon || c.startUtc >= noticeEdge));
    candidates = candidates.filter((c) => !blockedBy(p.blocks, c.startUtc, c.endUtc));
    if (candidates.length === 0) return { date, status: "closed", slots: [] };

    const capReached =
      p.type.countsTowardDailyCap && entries.filter((e) => e.countsTowardDailyCap).length >= p.config.scheduling.maxSessionsPerDay;
    if (capReached) return { date, status: "full", slots: [] };

    const buffer = p.type.bufferMin;
    const miniSlots = ledger?.miniDay?.slots ?? [];
    const open = candidates.filter((c) => {
      const mine = { startUtc: c.startUtc, endUtc: c.endUtc, bufferMin: buffer };
      return !entries.some((e) => gapConflict(mine, entryInterval(e))) && !miniSlots.some((s) => gapConflict(mine, miniSlotInterval(s)));
    });
    return open.length > 0
      ? { date, status: "open", slots: open.map((c) => makeSlot(c.startUtc, c.endUtc)) }
      : { date, status: "full", slots: [] };
  };

  // Range clamp: never before today; never past the horizon unless ignored.
  const from = p.from < today ? today : p.from;
  const to = p.ignoreNoticeAndHorizon || p.to <= horizonEndDate ? p.to : horizonEndDate;
  const days = from <= to ? datesInRange(from, to).map(dayFor) : [];

  let firstOpenDate: string | null = null;
  if (p.scanFirstOpen) {
    for (const d of datesInRange(today, horizonEndDate)) {
      if (dayFor(d).status === "open") {
        firstOpenDate = d;
        break;
      }
    }
  } else {
    firstOpenDate = days.find((d) => d.status === "open")?.date ?? null;
  }
  return { days, horizonEndDate, firstOpenDate };
}
