// Display strings for the booking flow. Times come from the API's ready-made labels (Eastern Time).
import type { PublicConfig, PublicSessionType, Slot } from '../lib/types';
import { shortDay, longDay } from '../lib/calendar-math';

export function durationLabel(min: number): string {
  if (min >= 60 && min % 60 === 0) {
    const hours = min / 60;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return `${min} min`;
}

export function lengthAndPrice(type: PublicSessionType, durationMin?: number | null): string {
  const length = durationMin ?? type.durationMin;
  const lengthText = type.durationOptionsMin ? `${durationLabel(length)} minimum` : durationLabel(length);
  return `${lengthText} · ${type.price.label}`;
}

export function depositLine(type: PublicSessionType): string {
  switch (type.deposit.kind) {
    case 'full': return 'Paid in full to book';
    case 'none': return 'No deposit needed';
    default:
      return type.bookingMode === 'request'
        ? `${type.deposit.text} deposit, due only if Daniella approves`
        : `${type.deposit.text} deposit holds your date`;
  }
}

export function badgeFor(type: PublicSessionType): { text: string } | null {
  if (type.bookingMode === 'request') return { text: 'Request to book' };
  if (type.kind === 'mini') {
    const dates = type.nextMiniDates;
    return dates && dates.length === 0 ? { text: 'Sold out' } : { text: 'Limited spots' };
  }
  return null;
}

export function miniDatesLine(type: PublicSessionType): string | null {
  if (type.kind !== 'mini' || !type.nextMiniDates) return null;
  if (type.nextMiniDates.length === 0) return 'No mini dates open right now';
  return `Next dates: ${type.nextMiniDates.map((d) => shortDay(d.date)).join(', ')}`;
}

export function isBookable(type: PublicSessionType): boolean {
  return !(type.kind === 'mini' && type.nextMiniDates !== null && type.nextMiniDates.length === 0);
}

/** "Wed, Dec 9 · 3:00 PM ET" */
export function slotShort(slot: Slot): string {
  return `${shortDay(slot.localDate)} · ${slot.label} ET`;
}

/** "Wednesday, December 9 at 3:00 PM Eastern" */
export function slotLong(slot: Slot): string {
  return `${longDay(slot.localDate)} at ${slot.label} Eastern`;
}

export function peopleLabel(adults: number, children: number, pets: number): string {
  const total = adults + children;
  const people = `${total} ${total === 1 ? 'person' : 'people'}`;
  return pets > 0 ? `${people}, ${pets} ${pets === 1 ? 'pet' : 'pets'}` : people;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

/** Fills {{placeholders}} in the policy summary from the type and policy values. */
export function renderPolicySummary(config: PublicConfig, type: PublicSessionType): string[] {
  const values: Record<string, string> = {
    depositText: type.deposit.text,
    unpaidHoldHours: String(config.scheduling.unpaidHoldHours),
  };
  for (const [k, v] of Object.entries(config.policy.values)) values[k] = String(v);
  const filled = config.policy.summaryTemplate.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) => values[key] ?? m);
  return filled.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

export function documentTitle(step: string): string {
  return `${step} | Daniella Beltram Photography`;
}

/** What to wear and bring: copy from docs/design/emails.md [PLACEHOLDER copy for Daniella to edit]. */
export const TIPS: Record<string, string[]> = {
  portraits: [
    'Choose 2 outfits you feel like yourself in. Solid colors and simple textures photograph best.',
    'Comfortable shoes you can walk in (we may move around).',
    'Bring water, lip balm and a hairbrush or small mirror.',
  ],
  couples: [
    "Coordinate, don't match: pick colors that sit well together, like cream and olive.",
    'Wear something you can move and hug in.',
    "Eat something light beforehand so you're relaxed.",
  ],
  families: [
    'Pick one color palette (2 to 4 colors) and let everyone choose within it. Skip large logos.',
    'Bring snacks and a favorite toy for little ones, plus water.',
    'Plan for naps and meals before the session so everyone is in a good mood.',
  ],
  events: [
    'Share your timeline and must-have moments by reply so Daniella can plan.',
    'Tell her about any decor or details you want captured, ideally the day before.',
    'Name one person on site who can help find people and VIPs.',
  ],
  'holiday-minis': [
    'Dress for the theme, with simple colors that match the set.',
    'Arrive 5 minutes early, ready to go. Sessions are short and sweet.',
    'Bring anything that makes kids smile, like a favorite toy or a small treat.',
  ],
};
