// Pure overlap rules shared by availability and reserve().
// DECISION (2026-11-25, see knowledge folder): the buffer is the minimum GAP between two sessions, and the
// gap between a pair is the larger of their two buffers. That matches story 002 #3 ("a slot ending exactly
// at 10:00 - B is offered") and makes minis fit back to back at duration + buffer (docs/api.md, mini days).
import type { LedgerEntry, MiniSlot } from "../../../shared/models";

export interface Interval {
  startUtc: string;
  endUtc: string;
  bufferMin: number;
}

const ms = (iso: string) => Date.parse(iso);

export function gapConflict(a: Interval, b: Interval): boolean {
  const gap = Math.max(a.bufferMin, b.bufferMin) * 60_000;
  return ms(a.startUtc) < ms(b.endUtc) + gap && ms(b.startUtc) < ms(a.endUtc) + gap;
}

/** Plain overlap of [start, end), used for blocked times (blocks ignore buffers). */
export function plainOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return ms(aStart) < ms(bEnd) && ms(bStart) < ms(aEnd);
}

export function bufferOf(x: { startUtc: string; busyStartUtc: string }): number {
  return Math.round((ms(x.startUtc) - ms(x.busyStartUtc)) / 60_000);
}
export const entryInterval = (e: LedgerEntry): Interval => ({ startUtc: e.startUtc, endUtc: e.endUtc, bufferMin: bufferOf(e) });
export const miniSlotInterval = (s: MiniSlot): Interval => ({ startUtc: s.startUtc, endUtc: s.endUtc, bufferMin: bufferOf(s) });
