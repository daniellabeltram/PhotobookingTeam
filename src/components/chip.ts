import { h } from '../lib/dom';
import { icon, type IconName } from './icons';
import type { BookingStatus } from '../lib/types';

const CHIPS: Record<BookingStatus, { text: string; cls: string; icon: IconName }> = {
  requested: { text: 'Requested', cls: 'chip-warning', icon: 'clock' },
  pending_deposit: { text: 'Pending deposit', cls: 'chip-warning', icon: 'hourglass' },
  confirmed: { text: 'Confirmed', cls: 'chip-success', icon: 'check' },
  completed: { text: 'Completed', cls: 'chip-info', icon: 'doubleCheck' },
  cancelled: { text: 'Cancelled', cls: 'chip-neutral', icon: 'x' },
  declined: { text: 'Declined', cls: 'chip-neutral', icon: 'x' },
};

export function statusText(status: BookingStatus): string {
  return CHIPS[status]?.text ?? status;
}

export function statusChip(status: BookingStatus): HTMLElement {
  const c = CHIPS[status] ?? { text: status, cls: 'chip-neutral', icon: 'x' as IconName };
  return h('span', { class: `chip ${c.cls}` }, icon(c.icon, 16), c.text);
}

const FLAG_TEXT: Record<string, { text: string; cls: string; icon: IconName }> = {
  deposit_overdue: { text: 'Deposit overdue', cls: 'chip-error', icon: 'alert' },
  reply_overdue: { text: 'Reply overdue', cls: 'chip-error', icon: 'alert' },
  email_not_sent: { text: 'Email not sent', cls: 'chip-error', icon: 'alert' },
  session_time_passed: { text: 'Session time passed', cls: 'chip-neutral', icon: 'clock' },
  surprise_proposal: { text: 'Surprise proposal', cls: 'chip-info', icon: 'alert' },
  help_me_choose_location: { text: 'Location: help me choose', cls: 'chip-info', icon: 'alert' },
  rescheduled: { text: 'Rescheduled', cls: 'chip-neutral', icon: 'arrows' },
  no_payment_link: { text: 'No payment link', cls: 'chip-warning', icon: 'alert' },
  pii_deleted: { text: 'Client data deleted', cls: 'chip-neutral', icon: 'x' },
};

export function flagText(flag: string): string {
  return FLAG_TEXT[flag]?.text ?? flag;
}

export function flagChip(flag: string): HTMLElement {
  const c = FLAG_TEXT[flag] ?? { text: flag, cls: 'chip-neutral', icon: 'alert' as IconName };
  return h('span', { class: `chip ${c.cls}` }, icon(c.icon, 16), c.text);
}
