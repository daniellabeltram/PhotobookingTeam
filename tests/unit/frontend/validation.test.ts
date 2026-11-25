import { describe, expect, it } from 'vitest';
import { emptyIntake } from '../../../src/booking/intake-model';
import { mapServerErrors, normalizePhone, validateIntake } from '../../../src/booking/validation';
import { config, couples, events, families, minis } from './fixtures';

const good = () => ({
  ...emptyIntake(), fullName: 'Ana Rivera', email: 'ana@example.com', phone: '5615550123', subjectsNames: 'Ana',
  adults: '2', children: '0', pets: '0', locationKind: 'help_me_choose', 'families.extendedFamily': 'no',
});

describe('normalizePhone', () => {
  it('accepts 10 US digits in common formats and international numbers', () => {
    expect(normalizePhone('(561) 555-0123')).toBe('5615550123');
    expect(normalizePhone('561.555.0123')).toBe('5615550123');
    expect(normalizePhone('+1 561 555 0123')).toBe('+15615550123');
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });
  it('rejects short, long and lettered numbers', () => {
    for (const bad of ['555-0123', '12345678901234', 'call me', '']) expect(normalizePhone(bad)).toBeNull();
  });
});

describe('validateIntake', () => {
  it('passes a complete Families form', () => {
    expect(validateIntake(good(), families, config)).toEqual({});
  });

  it('requires the common fields with friendly messages', () => {
    const e = validateIntake(emptyIntake(), families, config);
    expect(e['fullName']).toBe('Please enter your name.');
    expect(e['email']).toBe('Please enter your email.');
    expect(e['phone']).toContain('phone number');
    expect(e['subjectsNames']).toBeDefined();
    expect(e['locationKind']).toBe('Please choose an option.');
  });

  it('rejects an email without a domain', () => {
    expect(validateIntake({ ...good(), email: 'ana@' }, families, config)['email']).toContain("doesn't look right");
  });

  it('children ages are optional for Families', () => {
    expect(validateIntake({ ...good(), children: '2', 'families.childrenAges': '' }, families, config)).toEqual({});
  });

  it('enforces the max people for Couples but allows extra people for Families', () => {
    const many = { ...good(), adults: '3' };
    expect(validateIntake(many, couples, config)['adults']).toContain('up to 2 people');
    expect(validateIntake({ ...many, adults: '8', 'families.extendedFamily': 'yes' }, families, config)['adults']).toBeUndefined();
  });

  it('needs at least one person', () => {
    expect(validateIntake({ ...good(), adults: '0', children: '0' }, families, config)['adults']).toBe('Please add at least one person.');
  });

  it('checks the chosen location branch only', () => {
    expect(validateIntake({ ...good(), locationKind: 'own', locationText: '' }, families, config)['locationText']).toBeDefined();
    expect(validateIntake({ ...good(), locationKind: 'suggested', locationOptionId: '' }, families, config)['locationOptionId']).toBeDefined();
    expect(validateIntake({ ...good(), locationKind: 'help_me_choose' }, families, config)['locationText']).toBeUndefined();
  });

  it('Couples need occasion and the surprise answer', () => {
    const e = validateIntake({ ...good(), adults: '2' }, couples, config);
    expect(e['couples.occasion']).toBeDefined();
    expect(e['couples.surpriseProposal']).toBeDefined();
  });

  it('Events validate times and guest count', () => {
    const base = {
      ...good(), locationKind: 'own', locationText: 'Venue', 'events.eventName': 'Party', 'events.eventType': 'Birthday',
      'events.venueAddress': '1 Main', 'events.eventStartTime': '15:00', 'events.eventEndTime': '15:00', 'events.guestCount': '0',
    };
    const e = validateIntake(base, events, config);
    expect(e['events.eventEndTime']).toBe('End time must be after start time.');
    expect(e['events.guestCount']).toBeDefined();
    expect(validateIntake({ ...base, 'events.eventEndTime': '18:00', 'events.guestCount': '40' }, events, config)).toEqual({});
  });

  it('Minis ask for no location and no preferred contact', () => {
    const e = validateIntake({ ...emptyIntake(), fullName: 'A', email: 'a@b.co', phone: '5615550123', subjectsNames: 'A', adults: '1', preferredContact: '' }, minis, config);
    expect(e).toEqual({});
  });
});

describe('mapServerErrors', () => {
  it('maps API paths to form keys and collects unknown ones', () => {
    const m = mapServerErrors({ 'contact.email': 'bad', 'extra.events.guestCount': 'too few', 'people.adults': 'x', 'header.idempotencyKey': 'missing' });
    expect(m['email']).toBe('bad');
    expect(m['events.guestCount']).toBe('too few');
    expect(m['adults']).toBe('x');
    expect(m['_form']).toBe('missing');
  });
});
