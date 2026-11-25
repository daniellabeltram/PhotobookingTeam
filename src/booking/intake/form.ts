// Shared plumbing for the intake form: values live in flow state, errors are shown per field.
import type { PublicConfig, PublicSessionType } from '../../lib/types';
import type { FlowCtx } from '../context';
import { updateIntake } from '../flow-state';
import { validateIntake, type FieldErrors } from '../validation';
import type { IntakeAnswers } from '../intake-model';

export type FieldBinding = {
  setError: (message: string | null) => void;
  focus: () => void;
};

export type Form = {
  ctx: FlowCtx;
  type: PublicSessionType;
  config: PublicConfig;
  answers: () => IntakeAnswers;
  get: (key: string) => string;
  set: (key: string, value: string) => void;
  register: (key: string, binding: FieldBinding) => void;
  /** Called from input handlers. Re-checks fields that already show an error. */
  input: (key: string, value: string) => void;
  /** Called from blur handlers. Shows the error for this field if it has one. */
  blur: (key: string) => void;
  errors: () => FieldErrors;
  showAll: (errors: FieldErrors) => void;
  focusKey: (key: string) => void;
  has: (id: string) => boolean;
  required: (id: string) => boolean;
};

export function createForm(ctx: FlowCtx, type: PublicSessionType): Form {
  const bindings = new Map<string, FieldBinding>();
  const shown = new Set<string>();
  const answers = (): IntakeAnswers => ctx.state.intake;
  const extras = new Map(type.intakeExtraFields.map((f) => [f.id, f.required]));

  const errors = (): FieldErrors => validateIntake(answers(), type, ctx.config);

  function paint(keys: Iterable<string>): void {
    const errs = errors();
    for (const k of [...keys]) {
      const b = bindings.get(k);
      const msg = errs[k] ?? null;
      b?.setError(msg);
      if (!msg) shown.delete(k);
    }
  }

  return {
    ctx, type, config: ctx.config, answers,
    get: (k) => answers()[k] ?? '',
    set(k, v) { ctx.update((s) => updateIntake(s, { [k]: v })); },
    register(k, b) { bindings.set(k, b); },
    input(k, v) {
      ctx.update((s) => updateIntake(s, { [k]: v }));
      if (shown.size > 0) paint(shown);
    },
    blur(k) {
      shown.add(k);
      paint([k]);
      if (!errors()[k]) shown.delete(k);
    },
    errors,
    showAll(errs) {
      for (const k of Object.keys(errs)) shown.add(k);
      for (const [k, b] of bindings) b.setError(errs[k] ?? null);
    },
    focusKey(k) { bindings.get(k)?.focus(); },
    has: (id) => extras.has(id),
    required: (id) => extras.get(id) === true,
  };
}

export function usd(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}
