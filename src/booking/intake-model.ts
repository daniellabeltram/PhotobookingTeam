// Flat intake answers. Every value is a string so the whole thing serialises to sessionStorage as-is.
// Keys that contain a dot are the type-specific catalogue ids (docs/api.md, ADR 0007).

export type IntakeAnswers = Record<string, string>;

export const COMMON_KEYS = [
  'fullName', 'email', 'phone', 'preferredContact', 'subjectsNames',
  'adults', 'children', 'pets',
  'locationKind', 'locationOptionId', 'locationText',
  'styleNotes', 'mustHaveShots', 'anythingElse', 'heardAbout', 'portfolioOptOut',
] as const;

export const EXTRA_KEYS = [
  'couples.occasion', 'couples.surpriseProposal',
  'families.childrenAges', 'families.extendedFamily',
  'events.eventName', 'events.eventType', 'events.venueAddress',
  'events.eventStartTime', 'events.eventEndTime', 'events.guestCount',
  'events.onsiteContactName', 'events.onsiteContactPhone', 'events.timeline',
  'minis.cardDeadline',
] as const;

export const ALL_KEYS: readonly string[] = [...COMMON_KEYS, ...EXTRA_KEYS];

/** Default max lengths (ADR 0007). The public config can override them. */
export const DEFAULT_MAX: Record<string, number> = {
  fullName: 100, email: 254, phone: 40, subjectsNames: 500, locationText: 300,
  styleNotes: 1000, mustHaveShots: 1000, anythingElse: 1000, heardAbout: 200,
  'families.childrenAges': 200, 'events.eventName': 150, 'events.eventType': 100,
  'events.venueAddress': 300, 'events.onsiteContactName': 100, 'events.onsiteContactPhone': 40,
  'events.timeline': 2000,
};

/** Maps our flat key to the catalogue id used in GET /api/config `intakeFields`. */
export const CATALOGUE_ID: Record<string, string> = {
  fullName: 'contact.fullName', email: 'contact.email', phone: 'contact.phone',
  subjectsNames: 'subjectsNames', styleNotes: 'styleNotes', mustHaveShots: 'mustHaveShots',
  anythingElse: 'anythingElse', heardAbout: 'heardAbout',
};

export function emptyIntake(): IntakeAnswers {
  const a: IntakeAnswers = {};
  for (const k of ALL_KEYS) a[k] = '';
  a['preferredContact'] = 'email';
  a['adults'] = '1';
  a['children'] = '0';
  a['pets'] = '0';
  a['locationKind'] = '';
  a['portfolioOptOut'] = 'false';
  return a;
}

export function totalPeople(a: IntakeAnswers): number {
  return (Number(a['adults']) || 0) + (Number(a['children']) || 0);
}
