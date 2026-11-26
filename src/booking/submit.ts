// Sends the booking. Retries safely with the same Idempotency-Key and turns API errors into outcomes the UI can show.
import { ApiError, createBooking } from '../lib/api';
import type { Slot } from '../lib/types';
import type { FlowCtx } from './context';
import { buildBookingBody, withIdempotencyKey, newKey } from './flow-state';
import { firstName } from './format';
import { mapServerErrors, validateIntake, type FieldErrors } from './validation';

export type SubmitOutcome =
  | { kind: 'ok' }
  | { kind: 'invalid_intake'; errors: FieldErrors }
  | { kind: 'slot_taken'; alternatives: Slot[]; message: string }
  | { kind: 'policy_changed' }
  | { kind: 'rate_limited'; message: string }
  | { kind: 'busy' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'not_sure' }
  | { kind: 'failed'; message: string };

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

export async function submitBooking(ctx: FlowCtx, honeypot: string): Promise<SubmitOutcome> {
  const type = ctx.type;
  if (!type || !ctx.state.slot) return { kind: 'failed', message: 'Please choose a session and time first.' };

  const errs = validateIntake(ctx.state.intake, type, ctx.config);
  if (Object.keys(errs).length > 0) return { kind: 'invalid_intake', errors: errs };

  const body = buildBookingBody(ctx.state, type, ctx.config.policy.version, honeypot, ctx.config.features.portfolioOptOutEnabled);
  const keyed = withIdempotencyKey(ctx.state, body);
  if (keyed.state !== ctx.state) ctx.update(() => keyed.state);

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await createBooking(body, keyed.key);
      ctx.setConfirmation({ result, firstName: firstName(ctx.state.intake['fullName'] ?? '') });
      return { kind: 'ok' };
    } catch (err) {
      if (!(err instanceof ApiError)) return { kind: 'failed', message: 'Something went wrong and your booking was not saved. Nothing was charged. Please try again.' };
      switch (err.code) {
        case 'REQUEST_IN_PROGRESS':
          await sleep((err.retryAfter ?? 1) * 1000);
          continue;
        case 'SLOT_TAKEN': {
          const alts = err.details['alternatives'];
          return { kind: 'slot_taken', alternatives: Array.isArray(alts) ? (alts as Slot[]) : [], message: err.message };
        }
        case 'POLICY_VERSION_CHANGED':
          return { kind: 'policy_changed' };
        case 'VALIDATION_FAILED':
          return { kind: 'invalid_intake', errors: mapServerErrors(err.fieldErrors()) };
        case 'RATE_LIMITED':
          return { kind: 'rate_limited', message: err.message };
        case 'BUSY':
          return { kind: 'busy' };
        case 'IDEMPOTENCY_KEY_REUSED':
          // Answers changed under the same key: start a fresh attempt.
          ctx.update((s) => ({ ...s, idempotency: { key: newKey(), fingerprint: '' } }));
          return { kind: 'failed', message: 'Something went wrong. Please try again.' };
        case 'SESSION_TYPE_UNAVAILABLE':
          return { kind: 'unavailable', message: err.message };
        case 'NETWORK':
        case 'TIMEOUT':
          return { kind: 'not_sure' };
        default:
          return { kind: 'failed', message: 'Something went wrong and your booking was not saved. Nothing was charged. Please try again.' };
      }
    }
  }
  return { kind: 'busy' };
}
