// Time handling for the whole app (ADR 0006). This is the ONLY file that imports Luxon.
// Rules: every business time is America/New_York; instants are UTC ISO strings with milliseconds
// and a trailing Z; ET dates are "YYYY-MM-DD"; ET wall-clock times are "HH:mm" (24 h).
import { DateTime } from "luxon";

export const ZONE = "America/New_York";

/** A source of "now" as a UTC ISO string. Server code injects one so tests can pin time. */
export interface Clock {
  now(): string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function et(instantIso: string): DateTime {
  return DateTime.fromISO(instantIso, { setZone: true }).setZone(ZONE).setLocale("en-US");
}

// ---- validation and normalisation ----
export function isValidDate(value: string): boolean {
  return DATE_RE.test(value) && DateTime.fromISO(value, { zone: "utc" }).isValid;
}
export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}
/** Normalises any ISO instant with an offset to "2026-12-05T22:30:00.000Z". Null when not an instant. */
export function normalizeInstant(value: string): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null; // an instant must carry its offset
  const dt = DateTime.fromISO(value, { setZone: true });
  if (!dt.isValid) return null;
  return dt.toUTC().toISO();
}
export function instantMs(instantIso: string): number {
  return DateTime.fromISO(instantIso, { setZone: true }).toMillis();
}

// ---- now, dates ----
export function nowUtc(clock?: Clock): string {
  return clock ? clock.now() : DateTime.utc().toISO()!;
}
export function todayEt(nowIso: string): string {
  return et(nowIso).toFormat("yyyy-LL-dd");
}
export function etDateOf(instantIso: string): string {
  return et(instantIso).toFormat("yyyy-LL-dd");
}
export function etTimeOf(instantIso: string): string {
  return et(instantIso).toFormat("HH:mm");
}
/** Mon=1 ... Sun=7 for an ET calendar date. */
export function isoWeekdayEt(date: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return DateTime.fromISO(date, { zone: ZONE }).weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}
export function addDays(date: string, days: number): string {
  return DateTime.fromISO(date, { zone: "utc" }).plus({ days }).toFormat("yyyy-LL-dd");
}
export function daysBetween(a: string, b: string): number {
  return Math.round(DateTime.fromISO(b, { zone: "utc" }).diff(DateTime.fromISO(a, { zone: "utc" }), "days").days);
}
export function monthOf(date: string): number {
  return DateTime.fromISO(date, { zone: "utc" }).month;
}
export function datesInRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---- wall clock <-> instant ----
/**
 * ET wall-clock date and time to a UTC instant. Returns null when that local time does not exist
 * (inside the spring-forward gap). An ambiguous fall-back time maps to the EARLIER instant (EDT).
 */
export function etLocalToUtc(date: string, time: string): string | null {
  if (!isValidDate(date) || !isValidTime(time)) return null;
  let dt = DateTime.fromISO(`${date}T${time}`, { zone: ZONE });
  if (!dt.isValid) return null;
  const wall = `${date} ${time}`;
  if (dt.toFormat("yyyy-LL-dd HH:mm") !== wall) return null;
  const earlier = dt.minus({ hours: 1 });
  if (earlier.toFormat("yyyy-LL-dd HH:mm") === wall) dt = earlier;
  return dt.toUTC().toISO();
}
export function addMinutes(instantIso: string, minutes: number): string {
  return DateTime.fromISO(instantIso, { setZone: true }).toUTC().plus({ minutes }).toISO()!;
}
export function minutesBetween(aIso: string, bIso: string): number {
  return Math.round((instantMs(bIso) - instantMs(aIso)) / 60000);
}
/** "HH:mm" to minutes after midnight. */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
export function minutesToHm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ---- display (en-US, 12-hour clock, "ET" label) ----
/** "Saturday, December 5, 2026" */
export function formatDateLong(instantIso: string): string {
  return et(instantIso).toFormat("cccc, LLLL d, yyyy");
}
/** "Sat, Dec 5, 2026" */
export function formatDateMedium(instantIso: string): string {
  return et(instantIso).toFormat("ccc, LLL d, yyyy");
}
/** "Sat, Dec 5" */
export function formatDateShort(instantIso: string): string {
  return et(instantIso).toFormat("ccc, LLL d");
}
/** "5:30 PM" */
export function formatTime(instantIso: string): string {
  return et(instantIso).toFormat("h:mm a");
}
/** "5:30 – 6:30 PM ET", or "11:30 AM – 12:30 PM ET" when the halves differ. */
export function formatRangeEt(startIso: string, endIso: string): string {
  const s = et(startIso);
  const e = et(endIso);
  const sameHalf = s.toFormat("a") === e.toFormat("a");
  const left = sameHalf ? s.toFormat("h:mm") : s.toFormat("h:mm a");
  return `${left} – ${e.toFormat("h:mm a")} ET`;
}
/** "Sat, Dec 5 · 5:30 PM ET" */
export function formatDateTimeShortEt(instantIso: string): string {
  return `${formatDateShort(instantIso)} · ${formatTime(instantIso)} ET`;
}
/** "Nov 25, 2026 · 3:12 PM ET" */
export function formatDateTimeLabel(instantIso: string): string {
  return `${et(instantIso).toFormat("LLL d, yyyy")} · ${formatTime(instantIso)} ET`;
}
/** "2026-11-25 15:12", for CSV (ET). */
export function formatCompactEt(instantIso: string): string {
  return et(instantIso).toFormat("yyyy-LL-dd HH:mm");
}
/** "3:00 PM" for an ET wall-clock "15:00". */
export function formatHm(hm: string): string {
  return DateTime.fromISO(`2000-01-01T${hm}`, { zone: "utc" }).setLocale("en-US").toFormat("h:mm a");
}
/** "Thu, Dec 24" for an ET calendar date. */
export function formatDateStringShort(date: string): string {
  return DateTime.fromISO(date, { zone: "utc" }).setLocale("en-US").toFormat("ccc, LLL d");
}
/** "Thu, Dec 24, 2026" for an ET calendar date. */
export function formatDateStringMedium(date: string): string {
  return DateTime.fromISO(date, { zone: "utc" }).setLocale("en-US").toFormat("ccc, LLL d, yyyy");
}
/** "Dec 5, 2026" for an ET calendar date. */
export function formatDateStringPlain(date: string): string {
  return DateTime.fromISO(date, { zone: "utc" }).setLocale("en-US").toFormat("LLL d, yyyy");
}
/** "20261205T223000Z" for the .ics file. */
export function toIcsUtc(instantIso: string): string {
  return DateTime.fromISO(instantIso, { setZone: true }).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}
