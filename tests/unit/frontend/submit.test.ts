// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingResult } from '../../../src/lib/types';

vi.mock('../../../src/lib/api', async (orig) => ({
  ...((await orig()) as Record<string, unknown>),
  createBooking: vi.fn(),
  getConfig: vi.fn(),
}));

import { ApiError, createBooking } from '../../../src/lib/api';
import { BookingApp } from '../../../src/booking/app';
import { initialState, selectSessionType, selectSlot, updateIntake } from '../../../src/booking/flow-state';
import { submitBooking } from '../../../src/booking/submit';
import type { FlowCtx, StoredConfirmation } from '../../../src/booking/context';
import { config, families, slot } from './fixtures';

const mocked = vi.mocked(createBooking);

const result: BookingResult = {
  reference: 'DBP-7K3F9Q', status: 'pending_deposit', bookingMode: 'instant', sessionTypeId: 'families', sessionTypeName: 'Families',
  durationMin: 60, startUtc: slot.startUtc, endUtc: slot.endUtc, display: { date: 'Wednesday, December 9, 2026', timeRange: '3:00 – 4:00 PM ET' },
  locationLabel: '12 Palm Way (home)', amountDue: { cents: 15000, label: '$150.00', kind: 'deposit', dueNow: true },
  paymentLinkUrl: null, holdHours: 48, requestResponseDays: null, emailSent: true,
};

function readyState() {
  let s = selectSlot(selectSessionType(initialState(), families).state, slot, slot.localDate);
  s = updateIntake(s, {
    fullName: 'Ana Rivera', email: 'ana@example.com', phone: '5615550123', subjectsNames: 'Ana, Luis', adults: '2', children: '0',
    locationKind: 'help_me_choose', 'families.extendedFamily': 'no',
  });
  return { ...s, policyAccepted: true };
}

function fakeCtx(): FlowCtx & { confirmations: StoredConfirmation[] } {
  const ctx = {
    config, type: families, state: readyState(), confirmation: null, pendingErrors: null, notice: null, confirmations: [] as StoredConfirmation[],
    update(fn: (s: ReturnType<typeof readyState>) => ReturnType<typeof readyState>) { ctx.state = fn(ctx.state); },
    go: vi.fn(), rerender: vi.fn(), reloadConfig: vi.fn(), restart: vi.fn(),
    setConfirmation(c: StoredConfirmation) { ctx.confirmations.push(c); },
  };
  return ctx as unknown as FlowCtx & { confirmations: StoredConfirmation[] };
}

const err = (status: number, code: string, details: Record<string, unknown> = {}, retryAfter: number | null = null) =>
  new ApiError(status, code, `${code} message`, details, retryAfter);

beforeEach(() => { mocked.mockReset(); window.sessionStorage.clear(); });

describe('submitBooking outcomes', () => {
  it('returns ok and stores the confirmation', async () => {
    mocked.mockResolvedValueOnce(result);
    const ctx = fakeCtx();
    expect(await submitBooking(ctx, '')).toEqual({ kind: 'ok' });
    expect(ctx.confirmations[0]?.result.reference).toBe('DBP-7K3F9Q');
    expect(ctx.confirmations[0]?.firstName).toBe('Ana');
    expect(mocked.mock.calls[0]?.[1]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('SLOT_TAKEN returns the alternatives', async () => {
    const alt = { ...slot, localTime: '16:00' };
    mocked.mockRejectedValueOnce(err(409, 'SLOT_TAKEN', { alternatives: [alt] }));
    const o = await submitBooking(fakeCtx(), '');
    expect(o.kind).toBe('slot_taken');
    expect(o.kind === 'slot_taken' && o.alternatives).toEqual([alt]);
  });

  it('POLICY_VERSION_CHANGED asks to reload the policy', async () => {
    mocked.mockRejectedValueOnce(err(409, 'POLICY_VERSION_CHANGED', { currentVersion: 'v2' }));
    expect((await submitBooking(fakeCtx(), '')).kind).toBe('policy_changed');
  });

  it('retries REQUEST_IN_PROGRESS with the same Idempotency-Key', async () => {
    mocked.mockRejectedValueOnce(err(409, 'REQUEST_IN_PROGRESS', {}, 0)).mockResolvedValueOnce(result);
    const o = await submitBooking(fakeCtx(), '');
    expect(o.kind).toBe('ok');
    expect(mocked).toHaveBeenCalledTimes(2);
    expect(mocked.mock.calls[1]?.[1]).toBe(mocked.mock.calls[0]?.[1]);
  });

  it('NETWORK and TIMEOUT mean "not sure it went through"', async () => {
    mocked.mockRejectedValueOnce(err(0, 'NETWORK'));
    expect((await submitBooking(fakeCtx(), '')).kind).toBe('not_sure');
    mocked.mockRejectedValueOnce(err(0, 'TIMEOUT'));
    expect((await submitBooking(fakeCtx(), '')).kind).toBe('not_sure');
  });

  it('maps VALIDATION_FAILED field errors back to form keys', async () => {
    mocked.mockRejectedValueOnce(err(400, 'VALIDATION_FAILED', { fieldErrors: { 'contact.email': 'bad' } }));
    const o = await submitBooking(fakeCtx(), '');
    expect(o.kind === 'invalid_intake' && o.errors['email']).toBe('bad');
  });

  it('does not call the API when the form is invalid', async () => {
    const ctx = fakeCtx();
    ctx.update((s) => updateIntake(s, { email: 'nope' }));
    expect((await submitBooking(ctx, '')).kind).toBe('invalid_intake');
    expect(mocked).not.toHaveBeenCalled();
  });
});

describe('BookingApp persistence', () => {
  it('setConfirmation clears the flow key and keeps no location or contact data', () => {
    const app = new BookingApp(document.createElement('main'), config);
    app.update((s) => updateIntake(selectSlot(selectSessionType(s, families).state, slot, slot.localDate), { fullName: 'Ana Rivera', email: 'ana@example.com' }));
    expect(window.sessionStorage.getItem('dbp.flow.v1')).toContain('ana@example.com');
    app.setConfirmation({ result, firstName: 'Ana' });
    expect(window.sessionStorage.getItem('dbp.flow.v1')).toBeNull();
    const stored = window.sessionStorage.getItem('dbp.confirmation.v1') ?? '';
    expect(stored).toContain('DBP-7K3F9Q');
    expect(stored).not.toContain('Palm Way');
    expect(stored).not.toContain('ana@example.com');
    // later edits must not bring the answers back
    app.update((s) => updateIntake(s, { fullName: 'Again' }));
    expect(window.sessionStorage.getItem('dbp.flow.v1')).toBeNull();
  });

  it('start() drops an old confirmation unless the page is on step 5', () => {
    window.sessionStorage.setItem('dbp.confirmation.v1', JSON.stringify({ result, firstName: '' }));
    window.location.hash = '#step-1';
    const main = document.createElement('main');
    const app = new BookingApp(main, config);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    app.start();
    expect(app.confirmation).toBeNull();
    expect(window.sessionStorage.getItem('dbp.confirmation.v1')).toBeNull();
  });
});

describe('Events start time prefill', () => {
  it('prefills the event start time from the chosen slot on the intake step', async () => {
    const { renderIntakeStep } = await import('../../../src/booking/steps/intake');
    const { events } = await import('./fixtures');
    const ctx = fakeCtx();
    ctx.update(() => selectSlot(selectSessionType(initialState(), events).state, slot, slot.localDate));
    (ctx as unknown as { type: typeof events }).type = events;
    const el = renderIntakeStep(ctx);
    expect(ctx.state.intake['events.eventStartTime']).toBe('15:00');
    expect((el.querySelector('input[type=time]') as HTMLInputElement).value).toBe('15:00');
  });
});
