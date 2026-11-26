import type { BookingResult, PublicConfig, PublicSessionType } from '../lib/types';
import type { FlowState, StepNo } from './flow-state';
import type { FieldErrors } from './validation';

export type StoredConfirmation = { result: BookingResult; firstName: string };

export interface FlowCtx {
  readonly config: PublicConfig;
  readonly state: FlowState;
  readonly type: PublicSessionType | null;
  readonly confirmation: StoredConfirmation | null;
  /** Server field errors waiting to be shown on the intake step. */
  pendingErrors: FieldErrors | null;
  /** One-shot message shown at the top of the next step. */
  notice: string | null;
  update(fn: (s: FlowState) => FlowState): void;
  go(step: StepNo): void;
  /** Re-renders the current step without adding a history entry. */
  rerender(): void;
  setConfirmation(c: StoredConfirmation): void;
  reloadConfig(): Promise<void>;
  /** Clears everything and returns to step 1. */
  restart(): void;
}
