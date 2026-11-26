// The only date/time entry point for the UI (ADR 0006). Business times come from the API as
// ready-made ET labels; the helpers below come from shared/datetime.ts (the only Luxon importer).
import { todayEt as sharedTodayEt } from '../../shared/datetime';

export {
  ZONE, addDays, daysBetween, etDateOf, etTimeOf, formatDateLong, formatTime, formatRangeEt,
  formatDateTimeShortEt, formatDateStringShort, formatDateStringPlain, isValidDate, isValidTime,
} from '../../shared/datetime';

/** Today's date in Eastern Time ("YYYY-MM-DD"). */
export function todayEt(nowIso: string = new Date().toISOString()): string {
  return sharedTodayEt(nowIso);
}

export { formatDateTimeLabel, formatDateMedium, addMinutes, formatHm, hmToMinutes, minutesToHm, formatDateStringMedium, daysBetween as daysBetweenDates } from '../../shared/datetime';
