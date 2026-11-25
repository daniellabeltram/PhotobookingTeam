// Client-side validation. It mirrors the server rules (ADR 0007, story 005) as a convenience;
// the server stays authoritative and its field errors are mapped back with mapServerErrors().
import type { PublicConfig, PublicSessionType } from '../lib/types';
import { DEFAULT_MAX, CATALOGUE_ID, totalPeople, type IntakeAnswers } from './intake-model';

export type FieldErrors = Record<string, string>;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Returns digits-only (US, 10 digits) or "+digits" (8-15), or null when invalid. */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s().-]/g, '');
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned;
  if (/^\d{10}$/.test(cleaned)) return cleaned;
  if (/^1\d{10}$/.test(cleaned)) return cleaned.slice(1);
  return null;
}

export function maxLength(config: PublicConfig | null, key: string): number {
  const catId = CATALOGUE_ID[key] ?? key;
  const fromConfig = config?.intakeFields.find((f) => f.id === catId)?.maxLength;
  return fromConfig ?? DEFAULT_MAX[key] ?? 1000;
}

function isWholeNumber(v: string): boolean {
  return /^\d+$/.test(v.trim());
}

function timeToMinutes(t: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function maxPeopleMessage(max: number): string {
  return `This session fits up to ${max} people. Please lower the number or email us for a larger group.`;
}

/** Which extra field ids this type asks (from config), keyed to required flag. */
export function extraFieldMap(type: PublicSessionType): Map<string, boolean> {
  return new Map(type.intakeExtraFields.map((f) => [f.id, f.required]));
}

export function validateIntake(
  a: IntakeAnswers,
  type: PublicSessionType,
  config: PublicConfig | null,
): FieldErrors {
  const e: FieldErrors = {};
  const short = type.commonFieldsProfile === 'short';
  const val = (k: string): string => (a[k] ?? '').trim();
  const tooLong = (k: string): boolean => val(k).length > maxLength(config, k);

  if (!val('fullName')) e['fullName'] = 'Please enter your name.';
  else if (tooLong('fullName')) e['fullName'] = `Please keep your name under ${maxLength(config, 'fullName')} characters.`;

  if (!val('email')) e['email'] = 'Please enter your email.';
  else if (!EMAIL_RE.test(val('email')) || tooLong('email')) e['email'] = "That email doesn't look right. Check for typos.";

  if (!val('phone') || !normalizePhone(val('phone'))) {
    e['phone'] = 'Please enter a phone number we can reach, like (561) 555-0123.';
  }

  if (!short && !['email', 'call', 'text'].includes(val('preferredContact'))) {
    e['preferredContact'] = 'Please choose one.';
  }

  if (!val('subjectsNames')) e['subjectsNames'] = "Please tell us who's coming.";
  else if (tooLong('subjectsNames')) e['subjectsNames'] = `Please keep this under ${maxLength(config, 'subjectsNames')} characters.`;

  for (const k of ['adults', 'children', 'pets']) {
    if (!isWholeNumber(a[k] ?? '') || Number(a[k]) > 50) e[k] = 'Please enter a whole number from 0 to 50.';
  }
  if (!e['adults'] && !e['children']) {
    const total = totalPeople(a);
    if (total < 1) e['adults'] = 'Please add at least one person.';
    else if (type.maxPeople !== null && type.extraPersonFeeCents === null && total > type.maxPeople) {
      e['adults'] = maxPeopleMessage(type.maxPeople);
    }
  }

  if (type.kind !== 'mini') {
    const kind = val('locationKind');
    if (!kind) e['locationKind'] = 'Please choose an option.';
    else if (kind === 'suggested' && !type.locationOptions.some((o) => o.id === val('locationOptionId'))) {
      e['locationOptionId'] = 'Please pick a spot.';
    } else if (kind === 'own') {
      if (!val('locationText')) e['locationText'] = 'Please enter a location.';
      else if (tooLong('locationText')) e['locationText'] = `Please keep this under ${maxLength(config, 'locationText')} characters.`;
    }
  }

  for (const k of ['styleNotes', 'mustHaveShots', 'anythingElse', 'heardAbout']) {
    if (tooLong(k)) e[k] = `Please keep this under ${maxLength(config, k)} characters.`;
  }

  const extras = extraFieldMap(type);
  const req = (id: string): boolean => extras.get(id) === true;
  const has = (id: string): boolean => extras.has(id);

  if (has('couples.occasion') && req('couples.occasion') && !val('couples.occasion')) e['couples.occasion'] = 'Please choose one.';
  if (has('couples.surpriseProposal') && req('couples.surpriseProposal') && !val('couples.surpriseProposal')) {
    e['couples.surpriseProposal'] = 'Please choose one.';
  }
  if (has('families.childrenAges')) {
    const needs = req('families.childrenAges') || Number(a['children']) > 0;
    if (needs && Number(a['children']) > 0 && !val('families.childrenAges')) {
      e['families.childrenAges'] = "Please tell us your children's ages.";
    } else if (tooLong('families.childrenAges')) {
      e['families.childrenAges'] = `Please keep this under ${maxLength(config, 'families.childrenAges')} characters.`;
    }
  }
  if (has('families.extendedFamily') && req('families.extendedFamily') && !val('families.extendedFamily')) {
    e['families.extendedFamily'] = 'Please choose one.';
  }

  const needText: [string, string][] = [
    ['events.eventName', 'Please enter the event name.'],
    ['events.eventType', 'Please choose the type of event.'],
    ['events.venueAddress', 'Please enter the venue name and address.'],
  ];
  for (const [id, msg] of needText) {
    if (!has(id)) continue;
    if (req(id) && !val(id)) e[id] = msg;
    else if (tooLong(id)) e[id] = `Please keep this under ${maxLength(config, id)} characters.`;
  }
  if (has('events.eventStartTime') || has('events.eventEndTime')) {
    const s = timeToMinutes(val('events.eventStartTime'));
    const en = timeToMinutes(val('events.eventEndTime'));
    if (req('events.eventStartTime') && s === null) e['events.eventStartTime'] = 'Please enter a start time.';
    if (req('events.eventEndTime') && en === null) e['events.eventEndTime'] = 'Please enter an end time.';
    if (s !== null && en !== null && en <= s) e['events.eventEndTime'] = 'End time must be after start time.';
  }
  if (has('events.guestCount')) {
    const g = val('events.guestCount');
    if (!isWholeNumber(g) || Number(g) < 1) {
      if (req('events.guestCount') || g) e['events.guestCount'] = 'Please enter the number of guests (1 or more).';
    }
  }
  if (has('events.onsiteContactPhone') && val('events.onsiteContactPhone') && !normalizePhone(val('events.onsiteContactPhone'))) {
    e['events.onsiteContactPhone'] = 'Please enter a phone number like (561) 555-0123.';
  }
  for (const id of ['events.onsiteContactName', 'events.timeline']) {
    if (has(id) && tooLong(id)) e[id] = `Please keep this under ${maxLength(config, id)} characters.`;
  }
  return e;
}

/** Ordered list of keys for "first invalid field" focus and the error summary. */
export const FIELD_ORDER = [
  'fullName', 'email', 'phone', 'preferredContact', 'subjectsNames', 'adults', 'children', 'pets',
  'locationKind', 'locationOptionId', 'locationText',
  'couples.occasion', 'couples.surpriseProposal',
  'families.childrenAges', 'families.extendedFamily',
  'events.eventName', 'events.eventType', 'events.venueAddress', 'events.eventStartTime', 'events.eventEndTime',
  'events.guestCount', 'events.onsiteContactName', 'events.onsiteContactPhone', 'events.timeline',
  'styleNotes', 'mustHaveShots', 'anythingElse', 'heardAbout',
];

export function orderedErrorKeys(errors: FieldErrors): string[] {
  const known = FIELD_ORDER.filter((k) => errors[k]);
  const rest = Object.keys(errors).filter((k) => !FIELD_ORDER.includes(k));
  return [...known, ...rest];
}

/** Turns server `fieldErrors` paths into our flat keys. Unknown paths are returned under "_form". */
export function mapServerErrors(serverErrors: Record<string, string>): FieldErrors {
  const out: FieldErrors = {};
  const direct: Record<string, string> = {
    'contact.fullName': 'fullName', 'contact.email': 'email', 'contact.phone': 'phone',
    'contact.preferredContact': 'preferredContact', subjectsNames: 'subjectsNames',
    'people.adults': 'adults', 'people.children': 'children', 'people.pets': 'pets', people: 'adults',
    location: 'locationKind', 'location.kind': 'locationKind', 'location.optionId': 'locationOptionId',
    'location.text': 'locationText', styleNotes: 'styleNotes', mustHaveShots: 'mustHaveShots',
    anythingElse: 'anythingElse', heardAbout: 'heardAbout', portfolioOptOut: 'portfolioOptOut',
    'policy.accepted': 'policyAccepted',
  };
  for (const [path, message] of Object.entries(serverErrors)) {
    if (direct[path]) out[direct[path]] = message;
    else if (path.startsWith('extra.')) out[path.slice('extra.'.length)] = message;
    else out['_form'] = out['_form'] ? `${out['_form']} ${message}` : message;
  }
  return out;
}
