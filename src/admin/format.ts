import type { AdminAction, BookingDetail, CancellationReason } from '../lib/types';

export const ACTION_LABEL: Record<AdminAction, string> = {
  approve: 'Approve request',
  decline: 'Decline request',
  mark_paid: 'Mark deposit paid',
  confirm_without_payment: 'Confirm without payment',
  cancel: 'Cancel booking',
  complete: 'Mark completed',
  reschedule: 'Reschedule',
  resend_email: 'Resend email',
  delete_client_data: 'Delete client data',
};

/** Order the buttons appear in; the first available primary action gets the filled style. */
export const ACTION_ORDER: AdminAction[] = [
  'approve', 'mark_paid', 'complete', 'decline', 'confirm_without_payment', 'reschedule', 'resend_email', 'cancel', 'delete_client_data',
];
export const PRIMARY_ACTIONS: AdminAction[] = ['approve', 'mark_paid', 'complete'];

export const CANCEL_REASONS: { value: CancellationReason; label: string }[] = [
  { value: 'client_cancelled', label: 'Client cancelled' },
  { value: 'deposit_not_received', label: 'Deposit not received' },
  { value: 'photographer_cancelled', label: 'I need to cancel' },
  { value: 'other', label: 'Other' },
];

export function reasonLabel(value: string): string {
  return CANCEL_REASONS.find((r) => r.value === value)?.label ?? value.replace(/_/g, ' ');
}

export function locationLabel(loc: BookingDetail['location'] | null): string {
  if (!loc) return 'Not provided';
  switch (loc.kind) {
    case 'suggested': return loc.label;
    case 'own': return loc.text;
    case 'mini_day': return loc.label;
    case 'help_me_choose': return 'Help me choose';
    default: return 'Removed';
  }
}

export function preferredLabel(v: string): string {
  return v === 'call' ? 'Call' : v === 'text' ? 'Text' : 'Email';
}

export function answerText(v: string | number | boolean | null): string | null {
  if (v === null || v === '') return null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

export function peopleText(p: { adults: number; children: number; pets: number }): string {
  const parts = [`${p.adults} ${p.adults === 1 ? 'adult' : 'adults'}`, `${p.children} ${p.children === 1 ? 'child' : 'children'}`, `${p.pets} ${p.pets === 1 ? 'pet' : 'pets'}`];
  return parts.join(', ');
}

/** "$150.00" to cents. Returns null for anything that isn't a plain amount. */
export function dollarsToCents(raw: string): number | null {
  const t = raw.trim().replace(/^\$/, '');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}
