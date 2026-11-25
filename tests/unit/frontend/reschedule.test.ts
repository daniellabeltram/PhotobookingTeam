// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Availability, BookingDetail } from '../../../src/lib/types';
import { config, events, slot } from './fixtures';

vi.mock('../../../src/lib/api', async (orig) => ({
  ...((await orig()) as Record<string, unknown>),
  adminAvailability: vi.fn(),
  getConfig: vi.fn(),
  rescheduleBooking: vi.fn(),
}));

import { adminAvailability, getConfig, rescheduleBooking } from '../../../src/lib/api';
import { openReschedule } from '../../../src/admin/reschedule';

const avail = (date: string): Availability => ({
  sessionTypeId: 'events', durationMin: 180, timezone: 'America/New_York', from: date, to: date, horizonEndDate: '2027-05-27', firstOpenDate: date,
  days: [{ date, status: 'open', slots: [slot] }],
});

const booking = {
  id: 'DBP-7K3F9Q', version: 3, status: 'confirmed', sessionTypeId: 'events', durationMin: 180, localDate: '2026-12-09',
  display: { date: 'Wednesday, December 9, 2026', timeRange: '3:00 – 6:00 PM ET', createdAt: 'x' }, contact: { fullName: 'Maya Torres' },
} as unknown as BookingDetail;

const hooks = { holdHours: 48, done: vi.fn(), reload: vi.fn() };
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.replaceChildren();
  vi.mocked(adminAvailability).mockReset().mockResolvedValue(avail('2026-12-09'));
  vi.mocked(getConfig).mockReset().mockResolvedValue({ ...config, sessionTypes: [events] });
  vi.mocked(rescheduleBooking).mockReset();
});

describe('reschedule dialog', () => {
  it('loads open times as soon as it opens, with the booking length', async () => {
    openReschedule(booking, document.body, hooks);
    await tick();
    expect(adminAvailability).toHaveBeenCalled();
    const first = vi.mocked(adminAvailability).mock.calls[0]?.[0];
    expect(first).toMatchObject({ type: 'events', from: '2026-12-09', to: '2026-12-09', excludeBookingId: 'DBP-7K3F9Q', durationMin: 180 });
    expect(document.querySelectorAll('.time-btn').length).toBe(1);
  });

  it('reloads once the config shows the type has length options, and offers the length picker', async () => {
    openReschedule(booking, document.body, hooks);
    await tick();
    await tick();
    expect(vi.mocked(adminAvailability).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(document.querySelector('#rs-duration')).not.toBeNull();
  });

  it('ignores a slow answer for an older request (stale-response guard)', async () => {
    let release: (a: Availability) => void = () => undefined;
    vi.mocked(adminAvailability)
      .mockImplementationOnce(() => new Promise<Availability>((r) => { release = r; }))
      .mockResolvedValue({ ...avail('2026-12-09'), days: [{ date: '2026-12-09', status: 'open', slots: [slot, { ...slot, label: '4:00 PM' }] }] });
    openReschedule(booking, document.body, hooks);
    await tick();
    await tick(); // the config answer triggers a second, faster request
    expect(document.querySelectorAll('.time-btn').length).toBe(2);
    release(avail('2026-12-09')); // the old answer arrives late with one slot
    await tick();
    expect(document.querySelectorAll('.time-btn').length).toBe(2);
  });
});
