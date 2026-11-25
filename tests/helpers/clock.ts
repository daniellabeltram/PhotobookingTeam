// Fixed clock and calendar constants shared by integration and e2e tests (QA-owned).
// "Now" is a Tuesday morning in EST. With the placeholder minimumNoticeHours = 72 the first
// bookable instant is Friday 2026-12-04 09:00 ET.
export const FIXED_NOW_ISO = "2026-12-01T09:00:00-05:00";
export const FIXED_NOW = new Date(FIXED_NOW_ISO);

/** DST dates in America/New_York that the regression suite must cover (ADR 0006). */
export const DST_START_2027 = "2027-03-14"; // spring forward: 2:00-3:00 AM does not exist
export const DST_END_2027 = "2027-11-07"; // fall back: 1:00-2:00 AM happens twice
export const DST_START_WEEK = ["2027-03-13", "2027-03-14", "2027-03-15"];
export const DST_END_WEEK = ["2027-11-06", "2027-11-07", "2027-11-08"];

/** A clock "now" for tests that need to be close to a DST date (still inside every horizon). */
export const NOW_BEFORE_DST_START = "2027-02-01T09:00:00-05:00";
export const NOW_BEFORE_DST_END = "2027-10-01T09:00:00-04:00";

const ET = "America/New_York";

/** ET calendar date (YYYY-MM-DD) of an instant. Uses Intl only, so tests do not depend on Luxon. */
export function etDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return p; // en-CA => YYYY-MM-DD
}

/** ET wall clock "HH:mm" of an instant. */
export function etTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: ET, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const h = parts.find((x) => x.type === "hour")!.value;
  const m = parts.find((x) => x.type === "minute")!.value;
  return `${h}:${m}`;
}

/** ET UTC offset in hours for an instant (-5 or -4). */
export function etOffsetHours(iso: string | Date): number {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const local = etDate(d) + "T" + etTime(d) + ":00Z";
  return Math.round((new Date(local).getTime() - Math.floor(d.getTime() / 60000) * 60000) / 3600000);
}

/** "Saturday, December 6" style label as the calendar uses for accessible names. */
export function longDayLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(new Date(date + "T12:00:00Z"));
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMinutesHHmm(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
