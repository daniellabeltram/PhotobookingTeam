// Confirmation dialogs for every status action (docs/design/admin.md section 4).
import { h } from '../lib/dom';
import { ApiError, deleteClientData, patchBooking, resendEmail } from '../lib/api';
import { todayEt } from '../lib/datetime';
import type { ActionResult, AdminAction, BookingDetail, CancellationReason, EmailKind } from '../lib/types';
import { openDialog, type DialogHandle } from '../components/dialog';
import { textField, selectField } from '../components/field';
import { ACTION_ERROR } from './common';
import { CANCEL_REASONS, centsToDollars, dollarsToCents } from './format';
import { openReschedule } from './reschedule';

export type ActionHooks = {
  holdHours: number | null;
  done: (booking: BookingDetail, message: string) => void;
  reload: (message: string) => void;
};

const first = (b: BookingDetail): string => (b.contact?.fullName ?? 'The client').split(/\s+/)[0] ?? 'The client';
const who = (b: BookingDetail): string => b.contact?.fullName ?? 'The client';

function emailNote(b: BookingDetail, r: ActionResult): string {
  if (!r.email) return '';
  return r.email.status === 'sent' ? ` Email sent to ${first(b)}.` : " The email didn't send. You can resend it from this page.";
}

function checkbox(label: string, checked = true): { root: HTMLElement; box: HTMLInputElement } {
  const box = h('input', { type: 'checkbox', checked });
  return { root: h('label', { class: 'choice' }, box, h('span', null, label)), box };
}

/** Maps an API failure to dialog text. Returns true when the booking was reloaded instead. */
export function reportFailure(err: unknown, dialog: DialogHandle, hooks: ActionHooks): void {
  if (err instanceof ApiError) {
    if (err.code === 'VERSION_CONFLICT' || err.code === 'INVALID_TRANSITION') {
      dialog.close();
      hooks.reload(err.code === 'VERSION_CONFLICT' ? err.message : 'That action is no longer available. The booking was reloaded.');
      return;
    }
    if (err.code === 'VALIDATION_FAILED') {
      dialog.setError(Object.values(err.fieldErrors())[0] ?? err.message);
      return;
    }
    if (err.code === 'UNAUTHORIZED') return;
  }
  dialog.setError(ACTION_ERROR);
}

async function patch(
  dialog: DialogHandle, b: BookingDetail, hooks: ActionHooks, body: Record<string, unknown>, message: (r: ActionResult) => string,
): Promise<void> {
  try {
    const r = await patchBooking(b.id, { ...body, expectedVersion: b.version });
    dialog.close();
    hooks.done(r.booking, message(r) + emailNote(b, r));
  } catch (err) {
    reportFailure(err, dialog, hooks);
  }
}

export function runAction(action: AdminAction, b: BookingDetail, trigger: HTMLElement, hooks: ActionHooks): void {
  const when = `${b.display.date}, ${b.display.timeRange}`;
  switch (action) {
    case 'approve': {
      const dueNow = b.pricing.amountDue;
      openDialog({
        title: 'Approve this request?',
        description: h('p', null, `${who(b)} will get an email with a link to pay the ${dueNow.label} deposit. If it isn't paid, the booking is flagged "Deposit overdue" after ${hooks.holdHours ? `${hooks.holdHours} hours` : 'the hold period'}. Nothing is released automatically.`),
        cancelLabel: 'Not yet', confirmLabel: 'Approve',
        onConfirm: (d) => patch(d, b, hooks, { action: 'approve' }, () => 'Request approved.'),
      }, trigger);
      return;
    }
    case 'decline': {
      const msg = textField({ id: 'dec-msg', label: 'Note for the client', optional: true, rows: 3, maxlength: 1000, help: 'This is added to the email.' });
      const note = textField({ id: 'dec-note', label: 'Private note', optional: true, rows: 2, maxlength: 1000, help: 'Only you can see this.' });
      const notify = checkbox(`Email ${first(b)}`);
      openDialog({
        title: 'Decline this request?',
        description: h('p', null, `The time is released and ${who(b)} gets a polite email. ${when}.`),
        body: h('div', null, msg.root, note.root, notify.root),
        cancelLabel: 'Keep request', confirmLabel: 'Decline request', destructive: true,
        onConfirm: (d) => patch(d, b, hooks, {
          action: 'decline', notifyClient: notify.box.checked,
          ...(msg.control.value.trim() ? { messageToClient: msg.control.value.trim() } : {}),
          ...(note.control.value.trim() ? { note: note.control.value.trim() } : {}),
        }, () => 'Request declined.'),
      }, trigger);
      return;
    }
    case 'mark_paid': {
      const amount = textField({ id: 'paid-amount', label: 'Amount received (dollars)', inputmode: 'decimal', value: centsToDollars(b.pricing.amountDue.cents) });
      const date = textField({ id: 'paid-date', label: 'Received on', type: 'date', value: todayEt() });
      (date.control as HTMLInputElement).max = todayEt();
      const method = textField({ id: 'paid-method', label: 'How was it paid', optional: true, maxlength: 50 });
      const note = textField({ id: 'paid-note', label: 'Note', optional: true, rows: 2, maxlength: 1000 });
      openDialog({
        title: 'Mark deposit as paid?',
        description: h('p', null, `${who(b)}'s deposit was received. Their booking becomes Confirmed and they'll get a confirmation email.`),
        body: h('div', null, amount.root, date.root, method.root, note.root),
        cancelLabel: 'Not yet', confirmLabel: 'Mark as paid',
        onConfirm: async (d) => {
          const cents = dollarsToCents(amount.control.value);
          amount.setError(cents === null ? 'Enter an amount like 150.00.' : null);
          date.setError(date.control.value ? null : 'Pick the date it arrived.');
          if (cents === null || !date.control.value) { d.setError('Please fix the highlighted fields.'); return; }
          await patch(d, b, hooks, {
            action: 'mark_paid', amountCents: cents, receivedOn: date.control.value,
            ...(method.control.value.trim() ? { method: method.control.value.trim() } : {}),
            ...(note.control.value.trim() ? { note: note.control.value.trim() } : {}),
          }, () => 'Booking confirmed.');
        },
      }, trigger);
      return;
    }
    case 'confirm_without_payment': {
      const note = textField({ id: 'cwp-note', label: 'Why are you confirming without payment?', rows: 3, maxlength: 1000 });
      openDialog({
        title: 'Confirm without payment?',
        description: h('p', null, `${who(b)}'s booking becomes Confirmed with no deposit recorded. A note is required.`),
        body: note.root,
        cancelLabel: 'Not yet', confirmLabel: 'Confirm booking',
        onConfirm: async (d) => {
          const v = note.control.value.trim();
          note.setError(v ? null : 'Please add a note.');
          if (!v) { d.setError('Please add a note.'); return; }
          await patch(d, b, hooks, { action: 'confirm_without_payment', note: v }, () => 'Booking confirmed.');
        },
      }, trigger);
      return;
    }
    case 'complete':
      openDialog({
        title: 'Mark session as completed?',
        description: h('p', null, "This moves it to Completed. You can't undo this."),
        cancelLabel: 'Not yet', confirmLabel: 'Mark completed',
        onConfirm: (d) => patch(d, b, hooks, { action: 'complete' }, () => 'Marked completed.'),
      }, trigger);
      return;
    case 'cancel': {
      const reason = selectField({ id: 'cancel-reason', label: 'Reason', options: CANCEL_REASONS.map((r) => ({ value: r.value, label: r.label })), value: 'client_cancelled' });
      const note = textField({ id: 'cancel-note', label: 'Note', optional: true, rows: 2, maxlength: 1000, help: 'Only you can see this.' });
      const notify = checkbox(`Email ${first(b)} about the cancellation`);
      openDialog({
        title: 'Cancel this booking?',
        description: h('p', null, `This frees ${when} so someone else can book it. This can't be undone. Refunds are made in your payment provider.`),
        body: h('div', null, reason.root, note.root, notify.root, h('p', { class: 'help' }, 'Untick the box to cancel without emailing.')),
        cancelLabel: 'Keep booking', confirmLabel: 'Cancel booking', destructive: true,
        onConfirm: (d) => patch(d, b, hooks, {
          action: 'cancel', reason: reason.control.value as CancellationReason, notifyClient: notify.box.checked,
          ...(note.control.value.trim() ? { note: note.control.value.trim() } : {}),
        }, () => 'Booking cancelled. The time is open again.'),
      }, trigger);
      return;
    }
    case 'reschedule':
      openReschedule(b, trigger, hooks);
      return;
    case 'resend_email': {
      const kinds: [string, string][] = [
        ['', 'The latest email that failed'], ['booking_received', 'Booking received'], ['request_received', 'Request received'],
        ['approved', 'Request approved'], ['declined', 'Request declined'], ['confirmed', 'Booking confirmed'],
        ['cancelled', 'Cancelled'], ['rescheduled', 'Rescheduled'],
      ];
      const kind = selectField({ id: 'resend-kind', label: 'Which email', options: kinds.map(([value, label]) => ({ value, label })), value: '' });
      openDialog({
        title: 'Resend an email?',
        description: h('p', null, `We'll send ${first(b)} one email with the booking's current details.`),
        body: kind.root, cancelLabel: 'Not now', confirmLabel: 'Resend email',
        onConfirm: async (d) => {
          try {
            const r = await resendEmail(b.id, (kind.control.value || undefined) as EmailKind | undefined);
            d.close();
            if (r.status === 'sent') hooks.reload(`Email sent to ${first(b)}.`);
            else hooks.reload("The email still didn't send. Please try again later.");
          } catch (err) { reportFailure(err, d, hooks); }
        },
      }, trigger);
      return;
    }
    case 'delete_client_data': {
      const ref = textField({ id: 'del-ref', label: `Type ${b.id} to confirm`, autocomplete: 'off' });
      openDialog({
        title: 'Delete this client’s data?',
        description: h('p', null, "This removes the name, email, phone, intake answers and notes. It keeps the reference, session type, times, status, amounts and policy version. This can't be undone."),
        body: ref.root, cancelLabel: 'Keep data', confirmLabel: 'Delete client data', destructive: true,
        onConfirm: async (d) => {
          if (ref.control.value.trim().toUpperCase() !== b.id.toUpperCase()) {
            ref.setError('That doesn’t match the reference.');
            d.setError('Type the reference exactly as shown.');
            return;
          }
          try {
            const r = await deleteClientData(b.id, { confirmReference: ref.control.value.trim(), expectedVersion: b.version });
            d.close();
            hooks.done(r.booking, 'Client data deleted.');
          } catch (err) { reportFailure(err, d, hooks); }
        },
      }, trigger);
    }
  }
}
