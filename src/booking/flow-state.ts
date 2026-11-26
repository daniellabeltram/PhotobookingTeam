// Pure booking-flow state and request building. No DOM, so it is unit-tested directly.
import type { BookingRequestBody, PublicConfig, PublicSessionType, Slot } from '../lib/types';
import { emptyIntake, type IntakeAnswers } from './intake-model';
import { normalizePhone } from './validation';

export type StepNo = 1 | 2 | 3 | 4 | 5;

export type FlowState = {
  v: 1;
  step: StepNo;
  sessionTypeId: string | null;
  durationMin: number | null;
  slot: Slot | null;
  selectedDate: string | null;
  /** Mini day location/theme shown instead of the location question. */
  miniLabel: string | null;
  month: string | null;
  intake: IntakeAnswers;
  policyAccepted: boolean;
  idempotency: { key: string; fingerprint: string } | null;
};

export const STEP_TITLES: Record<StepNo, string> = {
  1: 'Session',
  2: 'Date and time',
  3: 'Your details',
  4: 'Policies',
  5: 'Done',
};

export function initialState(): FlowState {
  return {
    v: 1, step: 1, sessionTypeId: null, durationMin: null, slot: null,
    selectedDate: null, miniLabel: null, month: null, intake: emptyIntake(), policyAccepted: false, idempotency: null,
  };
}

export function findType(config: PublicConfig, id: string | null): PublicSessionType | null {
  return config.sessionTypes.find((t) => t.id === id) ?? null;
}

export function defaultDuration(type: PublicSessionType): number {
  return type.durationOptionsMin?.[0] ?? type.durationMin;
}

/**
 * Picking a (different) session type clears the chosen time and any type-specific answers
 * that no longer apply. Returns whether a time was cleared so the UI can say so.
 */
export function selectSessionType(state: FlowState, type: PublicSessionType): { state: FlowState; clearedSlot: boolean } {
  if (state.sessionTypeId === type.id) return { state, clearedSlot: false };
  const clearedSlot = state.slot !== null;
  return {
    clearedSlot,
    state: {
      ...state,
      sessionTypeId: type.id,
      durationMin: defaultDuration(type),
      slot: null,
      selectedDate: null,
      miniLabel: null,
      month: null,
      policyAccepted: false,
      idempotency: null,
    },
  };
}

export function selectDuration(state: FlowState, durationMin: number): FlowState {
  if (state.durationMin === durationMin) return state;
  return { ...state, durationMin, slot: null, selectedDate: null, miniLabel: null, policyAccepted: false };
}

export function selectSlot(state: FlowState, slot: Slot, date: string, miniLabel: string | null = null): FlowState {
  return { ...state, slot, selectedDate: date, miniLabel };
}

export function updateIntake(state: FlowState, patch: IntakeAnswers): FlowState {
  return { ...state, intake: { ...state.intake, ...patch } };
}

/** The earliest step the client may be on, given what has been chosen so far. */
export function highestAllowedStep(state: FlowState, config: PublicConfig): StepNo {
  const type = findType(config, state.sessionTypeId);
  if (!type) return 1;
  if (!state.slot) return 2;
  return 4;
}

export function clampStep(state: FlowState, config: PublicConfig, wanted: number): StepNo {
  const max = highestAllowedStep(state, config);
  const n = Math.min(Math.max(Math.trunc(wanted) || 1, 1), 4) as StepNo;
  return n > max ? max : n;
}

function boolOrUndef(v: string | undefined): boolean | undefined {
  if (v === 'yes' || v === 'true') return true;
  if (v === 'no' || v === 'false') return false;
  return undefined;
}

function opt(v: string | undefined): string | undefined {
  const t = (v ?? '').trim();
  return t === '' ? undefined : t;
}

/** Builds the POST /api/bookings body. Assumes the intake already passed validation. */
export function buildBookingBody(
  state: FlowState,
  type: PublicSessionType,
  policyVersion: string,
  honeypot = '',
  portfolioEnabled = true,
): BookingRequestBody {
  const a = state.intake;
  const slot = state.slot;
  if (!slot) throw new Error('No slot chosen');
  const short = type.commonFieldsProfile === 'short';
  const t = (k: string): string => (a[k] ?? '').trim();

  const body: BookingRequestBody = {
    sessionTypeId: type.id,
    startUtc: slot.startUtc,
    durationMin: state.durationMin ?? type.durationMin,
    contact: {
      fullName: t('fullName'),
      email: t('email'),
      phone: normalizePhone(t('phone')) ?? t('phone'),
      preferredContact: short ? 'email' : (t('preferredContact') as 'email' | 'call' | 'text'),
    },
    subjectsNames: t('subjectsNames'),
    people: { adults: Number(a['adults']), children: Number(a['children']), pets: Number(a['pets']) },
    policy: { accepted: state.policyAccepted, version: policyVersion },
    website: honeypot,
  };
  if (type.kind === 'mini') {
    body.miniSlotId = slot.miniSlotId ?? null;
  } else {
    const kind = t('locationKind');
    if (kind === 'suggested') body.location = { kind: 'suggested', optionId: t('locationOptionId') };
    else if (kind === 'own') body.location = { kind: 'own', text: t('locationText') };
    else body.location = { kind: 'help_me_choose' };
  }
  body.anythingElse = t('anythingElse');
  body.heardAbout = t('heardAbout');
  if (!short) {
    body.styleNotes = t('styleNotes');
    body.mustHaveShots = t('mustHaveShots');
    // The server rejects unknown fields, so only send this when the feature is on.
    if (portfolioEnabled) body.portfolioOptOut = a['portfolioOptOut'] === 'true';
  }

  const extra: Record<string, Record<string, string | number | boolean | null>> = {};
  const put = (group: string, key: string, value: string | number | boolean | null | undefined): void => {
    if (value === undefined) return;
    (extra[group] ??= {})[key] = value;
  };
  for (const f of type.intakeExtraFields) {
    const [group = '', key = ''] = f.id.split('.');
    const raw = a[f.id] ?? '';
    switch (f.id) {
      case 'couples.surpriseProposal':
      case 'families.extendedFamily':
        put(group, key, boolOrUndef(raw));
        break;
      case 'events.guestCount':
        put(group, key, raw.trim() === '' ? undefined : Number(raw));
        break;
      case 'events.onsiteContactPhone': {
        const v = opt(raw);
        put(group, key, v ? (normalizePhone(v) ?? v) : undefined);
        break;
      }
      case 'families.childrenAges':
        if (Number(a['children']) > 0) put(group, key, opt(raw));
        break;
      default:
        put(group, key, opt(raw));
    }
  }
  if (Object.keys(extra).length > 0) body.extra = extra;
  return body;
}

/** A stable string of what would be sent; the Idempotency-Key changes only when this changes. */
export function fingerprint(body: BookingRequestBody): string {
  const { website: _website, ...rest } = body;
  void _website;
  return JSON.stringify(rest);
}

export function newKey(): string {
  return crypto.randomUUID();
}

/**
 * Same attempt (same slot and answers) -> same key, so retries are safe.
 * Any change -> a fresh key, as docs/api.md requires.
 */
export function withIdempotencyKey(
  state: FlowState,
  body: BookingRequestBody,
  makeKey: () => string = newKey,
): { state: FlowState; key: string } {
  const fp = fingerprint(body);
  if (state.idempotency && state.idempotency.fingerprint === fp) {
    return { state, key: state.idempotency.key };
  }
  const key = makeKey();
  return { state: { ...state, idempotency: { key, fingerprint: fp } }, key };
}

/** Defensive restore from sessionStorage: anything odd falls back to a fresh state. */
export function restoreState(raw: unknown, config: PublicConfig): FlowState {
  const base = initialState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<FlowState>;
  if (r.v !== 1) return base;
  const type = findType(config, r.sessionTypeId ?? null);
  const intake = emptyIntake();
  if (r.intake && typeof r.intake === 'object') {
    for (const k of Object.keys(intake)) {
      const v = (r.intake as Record<string, unknown>)[k];
      if (typeof v === 'string') intake[k] = v;
    }
  }
  const slot = r.slot && typeof r.slot === 'object' && typeof r.slot.startUtc === 'string' ? r.slot : null;
  const state: FlowState = {
    ...base,
    sessionTypeId: type?.id ?? null,
    durationMin: type ? (typeof r.durationMin === 'number' ? r.durationMin : defaultDuration(type)) : null,
    slot: type ? slot : null,
    selectedDate: type && slot && typeof r.selectedDate === 'string' ? r.selectedDate : null,
    miniLabel: type && slot && typeof r.miniLabel === 'string' ? r.miniLabel : null,
    month: typeof r.month === 'string' ? r.month : null,
    intake,
    policyAccepted: r.policyAccepted === true,
    idempotency:
      r.idempotency && typeof r.idempotency.key === 'string' && typeof r.idempotency.fingerprint === 'string'
        ? r.idempotency
        : null,
  };
  state.step = clampStep(state, config, typeof r.step === 'number' ? r.step : 1);
  return state;
}
