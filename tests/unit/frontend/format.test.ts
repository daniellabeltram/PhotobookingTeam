import { describe, expect, it } from 'vitest';
import { badgeFor, depositLine, durationLabel, firstName, isBookable, lengthAndPrice, peopleLabel, policySummaryLines, slotLong, slotShort } from '../../../src/booking/format';
import { addDaysYmd, addMonths, longDay, monthGrid, shortDay, weekdayIndex } from '../../../src/lib/calendar-math';
import { config, events, families, minis, slot } from './fixtures';

describe('formatting', () => {
  it('formats lengths and price lines from the API labels', () => {
    expect(durationLabel(60)).toBe('60 min');
    expect(durationLabel(120)).toBe('2 hours');
    expect(lengthAndPrice(families)).toBe('60 min · from $450');
    expect(lengthAndPrice(events, 180)).toBe('3 hours minimum · from $250/hour');
  });

  it('labels times in Eastern', () => {
    expect(slotShort(slot)).toBe('Wed, Dec 9 · 3:00 PM ET');
    expect(slotLong(slot)).toBe('Wednesday, December 9 at 3:00 PM Eastern');
  });

  it('badges and availability of cards', () => {
    expect(badgeFor(events)?.text).toBe('Request to book');
    expect(badgeFor(minis)?.text).toBe('Limited spots');
    expect(badgeFor(families)).toBeNull();
    const soldOut = { ...minis, nextMiniDates: [] };
    expect(badgeFor(soldOut)?.text).toBe('Sold out');
    expect(isBookable(soldOut)).toBe(false);
    expect(isBookable(minis)).toBe(true);
    expect(depositLine(families)).toBe('$150 retainer holds your date');
  });

  it('fills the policy summary from config values', () => {
    const lines = policySummaryLines(config, families);
    expect(lines).toEqual(['A non-refundable retainer of $150.00 holds your date.', 'Reschedule free up to 7 days before.']);
  });

  it('uses the policy variant for requests and paid-in-full types', () => {
    expect(policySummaryLines(config, events)).toEqual(['This is a request. Daniella replies within 3 days. Retainer if approved: 50% of estimated total.']);
    expect(policySummaryLines(config, minis)).toEqual(['Paid in full to book. Cancellations within 48 hours are not refunded.']);
  });

  it('small helpers', () => {
    expect(peopleLabel(2, 2, 1)).toBe('4 people, 1 pet');
    expect(peopleLabel(1, 0, 0)).toBe('1 person');
    expect(firstName('  Ana Maria Rivera')).toBe('Ana');
  });
});

describe('calendar math (device-zone independent)', () => {
  it('computes weekdays and names without Date parsing of local strings', () => {
    expect(weekdayIndex('2026-12-09')).toBe(3);
    expect(longDay('2026-12-09')).toBe('Wednesday, December 9');
    expect(shortDay('2027-03-14')).toBe('Sun, Mar 14');
  });
  it('adds days and months across DST changes and year ends', () => {
    expect(addDaysYmd('2027-03-13', 1)).toBe('2027-03-14');
    expect(addDaysYmd('2027-11-06', 2)).toBe('2027-11-08');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01');
  });
  it('builds a Sunday-first grid', () => {
    const weeks = monthGrid('2026-12-09');
    expect(weeks[0]?.[0]).toBeNull();
    expect(weeks[0]?.[2]).toBe('2026-12-01');
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});
