import type { PublicConfig, PublicSessionType, Slot } from '../../../src/lib/types';

const base: Omit<PublicSessionType, 'id' | 'name' | 'durationMin' | 'price' | 'deposit'> = {
  included: [], kind: 'standard', bookingMode: 'instant', hasPaymentLink: true, includedPeople: null,
  extraPersonFeeCents: null, locationOptions: [{ id: 'downtown-waterfront', label: 'Downtown waterfront' }],
  allowOwnLocation: true, allowHelpMeChoose: true, commonFieldsProfile: 'full', intakeExtraFields: [],
  bookingHorizonDays: 180, nextMiniDates: null, maxPeople: null, description: 'd', bufferMin: 30,
};

export const families: PublicSessionType = {
  ...base, id: 'families', name: 'Families', durationMin: 60, maxPeople: 6, extraPersonFeeCents: 2500,
  price: { fromCents: 45000, unit: 'session', label: 'from $450' },
  deposit: { kind: 'flat', text: '$150.00', cardText: '$150 retainer holds your date', amountCents: 15000 },
  intakeExtraFields: [{ id: 'families.childrenAges', required: false }, { id: 'families.extendedFamily', required: true }],
};
export const couples: PublicSessionType = {
  ...base, id: 'couples', name: 'Couples', durationMin: 60, maxPeople: 2,
  price: { fromCents: 35000, unit: 'session', label: 'from $350' },
  deposit: { kind: 'flat', text: '$100.00', cardText: '$100 retainer', amountCents: 10000 },
  intakeExtraFields: [{ id: 'couples.occasion', required: true }, { id: 'couples.surpriseProposal', required: true }],
};
export const events: PublicSessionType = {
  ...base, id: 'events', name: 'Events', durationMin: 120, durationOptionsMin: [120, 180, 240], bookingMode: 'request',
  allowHelpMeChoose: false, locationOptions: [],
  price: { fromCents: 25000, unit: 'hour', label: 'from $250/hour' },
  deposit: { kind: 'percent', text: '50% of estimated total', cardText: '50% retainer after approval', percent: 50 },
  intakeExtraFields: [
    { id: 'events.eventName', required: true }, { id: 'events.eventType', required: true }, { id: 'events.venueAddress', required: true },
    { id: 'events.eventStartTime', required: true }, { id: 'events.eventEndTime', required: true }, { id: 'events.guestCount', required: true },
    { id: 'events.onsiteContactName', required: true }, { id: 'events.timeline', required: false },
  ],
};
export const minis: PublicSessionType = {
  ...base, id: 'holiday-minis', name: 'Holiday Minis', kind: 'mini', durationMin: 20, bufferMin: 10, commonFieldsProfile: 'short',
  locationOptions: [], allowOwnLocation: false, allowHelpMeChoose: false,
  price: { fromCents: 22500, unit: 'session', label: '$225' },
  deposit: { kind: 'full', text: 'paid in full', cardText: 'Paid in full to book' },
  intakeExtraFields: [{ id: 'minis.cardDeadline', required: false }],
  nextMiniDates: [{ date: '2026-12-12', spotsLeft: 4 }],
};

export const config: PublicConfig = {
  business: { name: 'Studio', contactEmail: 'hello@example.test', siteUrl: 'https://example.test', timezone: 'America/New_York' },
  scheduling: { minimumNoticeHours: 72, unpaidHoldHours: 48, requestResponseDays: 3 },
  features: { portfolioOptOutEnabled: true },
  privacy: { dataRetentionMonths: 24, privacyContactEmail: 'hello@example.test', lastUpdated: '2026-11-25' },
  policy: {
    version: 'v0.1-draft',
    summaryTemplate: 'A non-refundable retainer of {{depositText}} holds your date.\nReschedule free up to {{freeRescheduleDays}} days before.',
    summaryVariants: {
      request: 'This is a request. Daniella replies within {{requestResponseDays}} days. Retainer if approved: {{depositText}}.',
      full: 'Paid in full to book. Cancellations within {{lateCancelHours}} hours are not refunded.',
    },
    values: { freeRescheduleDays: 7, lateCancelHours: 48 },
  },
  intakeFields: [],
  sessionTypes: [families, couples, events, minis],
};

export const slot: Slot = {
  startUtc: '2026-12-09T20:00:00.000Z', endUtc: '2026-12-09T21:00:00.000Z', localDate: '2026-12-09',
  localTime: '15:00', label: '3:00 PM', rangeLabel: '3:00 – 4:00 PM ET',
};
