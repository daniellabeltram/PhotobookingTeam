// Temporary shim until shared/datetime.ts (ADR 0006) lands; then this file only re-exports it.
// Everything here is America/New_York and independent of the device zone.

export const ZONE = 'America/New_York';

const etDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "YYYY-MM-DD" in Eastern Time for the given instant (ISO string). */
export function todayEt(nowIso: string = new Date().toISOString()): string {
  return etDateFormat.format(new Date(nowIso));
}
