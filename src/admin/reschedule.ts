import { h, clear } from '../lib/dom';
import { adminAvailability, ApiError, getConfig, rescheduleBooking } from '../lib/api';
import { todayEt } from '../lib/datetime';
import type { BookingDetail, PublicSessionType, RescheduleReason, Slot } from '../lib/types';
import { openDialog } from '../components/dialog';
import { selectField, textField } from '../components/field';
import { enableRadioKeys, setInitialTabStop } from '../components/roving';
import { announce } from '../components/live';
import { reportFailure, type ActionHooks } from './actions';

const REASONS: { value: RescheduleReason; label: string }[] = [
  { value: 'client_request', label: 'Client asked to move' },
  { value: 'weather', label: 'Weather (always free)' },
  { value: 'photographer', label: 'I need to move it' },
];

export function openReschedule(b: BookingDetail, trigger: HTMLElement, hooks: ActionHooks): void {
  let chosen: Slot | null = null;
  let duration = b.durationMin;
  let type: PublicSessionType | undefined;

  const reason = selectField({ id: 'rs-reason', label: 'Reason', options: REASONS, value: 'client_request' });
  const date = textField({ id: 'rs-date', label: 'New date', type: 'date', value: b.localDate });
  (date.control as HTMLInputElement).min = todayEt();
  const slotsHost = h('div', { 'aria-live': 'polite' });
  const durationHost = h('div');
  const note = textField({ id: 'rs-note', label: 'Note', optional: true, rows: 2, maxlength: 1000, help: 'Only you can see this.' });
  const notifyBox = h('input', { type: 'checkbox', checked: true });
  const notify = h('label', { class: 'choice' }, notifyBox, h('span', null, `Email ${(b.contact?.fullName ?? 'the client').split(/\s+/)[0]} about the new time`));

  async function loadSlots(): Promise<void> {
    chosen = null;
    clear(slotsHost);
    const d = (date.control as HTMLInputElement).value;
    if (!d) return;
    slotsHost.append(h('p', { role: 'status' }, 'Loading times...'));
    try {
      const data = await adminAvailability({
        type: b.sessionTypeId, from: d, to: d, excludeBookingId: b.id,
        durationMin: type?.durationOptionsMin ? duration : undefined,
      });
      clear(slotsHost);
      const slots = data.days.find((x) => x.date === d)?.slots ?? [];
      if (slots.length === 0) {
        slotsHost.append(h('p', null, 'No open times on that date. Try another date.'));
        return;
      }
      const buttons: HTMLElement[] = [];
      const group = h('div', { class: 'slot-pick', role: 'radiogroup', 'aria-label': 'Open times, Eastern Time' });
      for (const s of slots) {
        const btn = h('button', { type: 'button', class: 'time-btn', role: 'radio', 'aria-checked': 'false' }, `${s.label} ET`);
        btn.addEventListener('click', () => {
          chosen = s;
          for (const x of buttons) x.setAttribute('aria-checked', String(x === btn));
          setInitialTabStop(buttons);
          announce(`${s.label} Eastern selected.`);
        });
        buttons.push(btn);
        group.append(btn);
      }
      enableRadioKeys(buttons, (el) => el.click());
      setInitialTabStop(buttons);
      slotsHost.append(group);
    } catch (err) {
      clear(slotsHost);
      slotsHost.append(h('p', { role: 'alert' }, err instanceof ApiError && err.isNetwork ? "We can't reach the server. Try again." : "We couldn't load times. Try again."));
    }
  }
  date.control.addEventListener('change', () => { void loadSlots(); });

  void getConfig().then((cfg) => {
    type = cfg.sessionTypes.find((t) => t.id === b.sessionTypeId);
    if (type?.durationOptionsMin) {
      const f = selectField({
        id: 'rs-duration', label: 'Coverage length',
        options: type.durationOptionsMin.map((m) => ({ value: String(m), label: `${m / 60} hours` })), value: String(b.durationMin),
        onInput: (v) => { duration = Number(v); void loadSlots(); },
      });
      durationHost.append(f.root);
    }
  }).catch(() => undefined);

  const body = h('div', null,
    h('p', { class: 'muted' }, `Now: ${b.display.date}, ${b.display.timeRange}`),
    reason.root, date.root, durationHost,
    h('p', { class: 'label' }, 'Open times'), slotsHost, note.root, notify);

  openDialog({
    title: 'Reschedule this booking?',
    description: h('p', null, 'Minimum notice and the booking window are not applied. Other bookings, buffers and blocked times are.'),
    body, cancelLabel: 'Keep current time', confirmLabel: 'Reschedule',
    onConfirm: async (d) => {
      if (!chosen) { d.setError('Please pick a new time.'); return; }
      try {
        const r = await rescheduleBooking(b.id, {
          expectedVersion: b.version, startUtc: chosen.startUtc,
          ...(type?.durationOptionsMin ? { durationMin: duration } : {}),
          ...(chosen.miniSlotId ? { miniSlotId: chosen.miniSlotId } : {}),
          reason: reason.control.value as RescheduleReason,
          notifyClient: notifyBox.checked,
          ...(note.control.value.trim() ? { note: note.control.value.trim() } : {}),
        });
        d.close();
        const mail = r.email ? (r.email.status === 'sent' ? ' Email sent.' : " The email didn't send. You can resend it from this page.") : '';
        hooks.done(r.booking, `Booking rescheduled.${mail}`);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'SLOT_TAKEN') {
          d.setError('That time is no longer open. The booking keeps its current time. Please pick another.');
          void loadSlots();
          return;
        }
        reportFailure(err, d, hooks);
      }
    },
  }, trigger);
}
