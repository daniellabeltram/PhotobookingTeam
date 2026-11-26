import { describe, expect, it } from 'vitest';
import {
  buildBookingBody, clampStep, fingerprint, initialState, restoreState, selectDuration, selectSessionType, selectSlot,
  updateIntake, withIdempotencyKey,
} from '../../../src/booking/flow-state';
import { config, events, families, minis, slot } from './fixtures';

const filled = {
  fullName: ' Ana Rivera ', email: 'ana@example.com', phone: '(561) 555-0123', subjectsNames: 'Ana, Luis',
  adults: '2', children: '2', pets: '0', locationKind: 'suggested', locationOptionId: 'downtown-waterfront',
  'families.childrenAges': '6, 3', 'families.extendedFamily': 'no',
};

describe('flow state', () => {
  it('clears the chosen slot when the session type changes, and says so', () => {
    let s = selectSessionType(initialState(), families).state;
    s = selectSlot(s, slot, slot.localDate);
    const res = selectSessionType(s, events);
    expect(res.clearedSlot).toBe(true);
    expect(res.state.slot).toBeNull();
    expect(res.state.durationMin).toBe(120);
  });

  it('keeps the slot when the same type is chosen again', () => {
    let s = selectSessionType(initialState(), families).state;
    s = selectSlot(s, slot, slot.localDate);
    const res = selectSessionType(s, families);
    expect(res.clearedSlot).toBe(false);
    expect(res.state.slot).toEqual(slot);
  });

  it('changing the coverage length clears the time', () => {
    let s = selectSessionType(initialState(), events).state;
    s = selectSlot(s, slot, slot.localDate);
    expect(selectDuration(s, 180).slot).toBeNull();
    expect(selectDuration(s, 120).slot).toEqual(slot);
  });

  it('only lets the client reach steps they have the data for', () => {
    const s0 = initialState();
    expect(clampStep(s0, config, 4)).toBe(1);
    const s1 = selectSessionType(s0, families).state;
    expect(clampStep(s1, config, 4)).toBe(2);
    expect(clampStep(selectSlot(s1, slot, slot.localDate), config, 4)).toBe(4);
    expect(clampStep(selectSlot(s1, slot, slot.localDate), config, 99)).toBe(4);
  });

  it('keeps answers across back and forward navigation (restore round-trip)', () => {
    let s = selectSessionType(initialState(), families).state;
    s = selectSlot(s, slot, slot.localDate);
    s = updateIntake(s, filled);
    const restored = restoreState(JSON.parse(JSON.stringify(s)), config);
    expect(restored.intake['fullName']).toBe(' Ana Rivera ');
    expect(restored.slot).toEqual(slot);
    expect(restored.sessionTypeId).toBe('families');
  });

  it('restores a clean state from junk or an unknown type', () => {
    expect(restoreState(null, config).sessionTypeId).toBeNull();
    expect(restoreState({ v: 1, sessionTypeId: 'nope', slot }, config).slot).toBeNull();
    expect(restoreState({ v: 2 }, config).step).toBe(1);
  });
});

describe('booking request body', () => {
  const state = () => updateIntake(selectSlot(selectSessionType(initialState(), families).state, slot, slot.localDate), filled);

  it('builds the documented shape and normalises phone', () => {
    const body = buildBookingBody({ ...state(), policyAccepted: true }, families, 'v0.1-draft');
    expect(body.contact).toEqual({ fullName: 'Ana Rivera', email: 'ana@example.com', phone: '5615550123', preferredContact: 'email' });
    expect(body.people).toEqual({ adults: 2, children: 2, pets: 0 });
    expect(body.location).toEqual({ kind: 'suggested', optionId: 'downtown-waterfront' });
    expect(body.extra).toEqual({ families: { childrenAges: '6, 3', extendedFamily: false } });
    expect(body.policy).toEqual({ accepted: true, version: 'v0.1-draft' });
    expect(body.website).toBe('');
  });

  it('omits empty optional extras and children ages when there are no children', () => {
    const s = updateIntake(state(), { 'families.childrenAges': '', children: '0' });
    expect(buildBookingBody(s, families, 'v').extra).toEqual({ families: { extendedFamily: false } });
  });

  it('only sends portfolioOptOut when the feature is enabled (server rejects unknown fields)', () => {
    expect(buildBookingBody(state(), families, 'v', '', true).portfolioOptOut).toBe(false);
    expect('portfolioOptOut' in buildBookingBody(state(), families, 'v', '', false)).toBe(false);
  });

  it('minis send a mini slot id, no location and the short field set', () => {
    const miniSlot = { ...slot, miniSlotId: 'ms_2026-12-12_0800' };
    const s = updateIntake(selectSlot(selectSessionType(initialState(), minis).state, miniSlot, miniSlot.localDate, 'Phillips Point'), filled);
    const body = buildBookingBody(s, minis, 'v');
    expect(body.miniSlotId).toBe('ms_2026-12-12_0800');
    expect(body.location).toBeUndefined();
    expect(body.styleNotes).toBeUndefined();
    expect(body.contact.preferredContact).toBe('email');
  });

  it('events send the chosen length and typed extras', () => {
    let s = selectDuration(selectSessionType(initialState(), events).state, 180);
    s = updateIntake(selectSlot(s, slot, slot.localDate), {
      ...filled, locationKind: 'own', locationText: 'The Venue', 'events.eventName': 'Party', 'events.eventType': 'Birthday',
      'events.venueAddress': '1 Main St', 'events.eventStartTime': '15:00', 'events.eventEndTime': '18:00', 'events.guestCount': '40',
    });
    const body = buildBookingBody(s, events, 'v');
    expect(body.durationMin).toBe(180);
    expect(body.location).toEqual({ kind: 'own', text: 'The Venue' });
    expect(body.extra?.['events']).toMatchObject({ eventName: 'Party', guestCount: 40, eventStartTime: '15:00' });
  });
});

describe('idempotency key', () => {
  const base = () => updateIntake(selectSlot(selectSessionType(initialState(), families).state, slot, slot.localDate), filled);
  let n = 0;
  const mk = () => `key-${++n}`;

  it('is reused for a retry of the same attempt', () => {
    const s = base();
    const body = buildBookingBody(s, families, 'v');
    const first = withIdempotencyKey(s, body, mk);
    const again = withIdempotencyKey(first.state, buildBookingBody(first.state, families, 'v'), mk);
    expect(again.key).toBe(first.key);
  });

  it('changes when an answer or the slot changes', () => {
    const s = base();
    const first = withIdempotencyKey(s, buildBookingBody(s, families, 'v'), mk);
    const changed = updateIntake(first.state, { subjectsNames: 'Someone else' });
    const second = withIdempotencyKey(changed, buildBookingBody(changed, families, 'v'), mk);
    expect(second.key).not.toBe(first.key);
    const moved = selectSlot(second.state, { ...slot, startUtc: '2026-12-09T21:00:00.000Z' }, slot.localDate);
    expect(withIdempotencyKey(moved, buildBookingBody(moved, families, 'v'), mk).key).not.toBe(second.key);
  });

  it('ignores the honeypot value in the fingerprint', () => {
    const s = base();
    expect(fingerprint(buildBookingBody(s, families, 'v', 'x'))).toBe(fingerprint(buildBookingBody(s, families, 'v', '')));
  });
});
