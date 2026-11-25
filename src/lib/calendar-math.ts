// Pure calendar arithmetic on "YYYY-MM-DD" strings. No time zones involved:
// every value is a date label, never an instant.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type YMD = { y: number; m: number; d: number };

export function parseYmd(date: string): YMD {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  return { y, m, d };
}

export function ymd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function toUtcMs({ y, m, d }: YMD): number {
  return Date.UTC(y, m - 1, d);
}

export function addDaysYmd(date: string, days: number): string {
  const dt = new Date(toUtcMs(parseYmd(date)) + days * 86_400_000);
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayIndex(date: string): number {
  return new Date(toUtcMs(parseYmd(date))).getUTCDay();
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function lastOfMonth(date: string): string {
  const { y, m } = parseYmd(date);
  return ymd(y, m, daysInMonth(y, m));
}

export function addMonths(date: string, delta: number): string {
  const { y, m } = parseYmd(date);
  const idx = y * 12 + (m - 1) + delta;
  return ymd(Math.floor(idx / 12), (idx % 12) + 1, 1);
}

export function monthName(date: string): string {
  return MONTHS[parseYmd(date).m - 1] ?? '';
}

export function monthTitle(date: string): string {
  return `${monthName(date)} ${parseYmd(date).y}`;
}

/** "Wednesday, December 9" */
export function longDay(date: string): string {
  return `${WEEKDAYS[weekdayIndex(date)]}, ${monthName(date)} ${parseYmd(date).d}`;
}

/** "Wednesday, December 9, 2026" */
export function longDayYear(date: string): string {
  return `${longDay(date)}, ${parseYmd(date).y}`;
}

/** "Wed, Dec 9" */
export function shortDay(date: string): string {
  return `${WEEKDAYS_SHORT[weekdayIndex(date)]}, ${monthName(date).slice(0, 3)} ${parseYmd(date).d}`;
}

export function compareYmd(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isValidYmd(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { y, m, d } = parseYmd(date);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** Weeks (Sunday first) covering the month; cells outside the month are null. */
export function monthGrid(anyDateInMonth: string): (string | null)[][] {
  const first = firstOfMonth(anyDateInMonth);
  const { y, m } = parseYmd(first);
  const total = daysInMonth(y, m);
  const lead = weekdayIndex(first);
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(ymd(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const WEEKDAY_NAMES = WEEKDAYS;
export const WEEKDAY_ABBR = WEEKDAYS_SHORT;
