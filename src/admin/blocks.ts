import { h, clear } from '../lib/dom';
import { ApiError, createBlock, deleteBlock, listBlocks } from '../lib/api';
import { todayEt } from '../lib/datetime';
import type { BlockItem, OverlapBooking } from '../lib/types';
import { openDialog } from '../components/dialog';
import { textField } from '../components/field';
import { toast } from '../components/toast';
import { ACTION_ERROR, errorBlock, loadingBlock, pageHeading, setTitle } from './common';

function overlapDialog(items: OverlapBooking[], onConfirm: () => Promise<void>, trigger: HTMLElement): void {
  openDialog({
    title: 'Some bookings fall in this range',
    description: h('p', null, `${items.length} ${items.length === 1 ? 'booking is' : 'bookings are'} already scheduled. Blocking won't cancel them. You can still block, or go back to review them.`),
    body: h('ul', null, ...items.map((i) => h('li', null, `${i.clientName ?? 'Client'}, ${i.display.date} ${i.display.timeRange}`))),
    cancelLabel: 'Go back', confirmLabel: 'Block anyway',
    onConfirm: async (d) => { try { await onConfirm(); d.close(); } catch { d.setError(ACTION_ERROR); } },
  }, trigger);
}

export function renderBlocks(main: HTMLElement): void {
  setTitle('Blocked dates');
  const listHost = h('div');
  const from = textField({ id: 'b-from', label: 'From date', type: 'date' });
  const to = textField({ id: 'b-to', label: 'To date', type: 'date', help: 'Leave empty for a single day.' });
  (from.control as HTMLInputElement).min = todayEt();
  (to.control as HTMLInputElement).min = todayEt();
  const allDayBox = h('input', { type: 'checkbox', checked: true });
  const start = textField({ id: 'b-start', label: 'Start time', type: 'time' });
  const end = textField({ id: 'b-end', label: 'End time', type: 'time' });
  const times = h('div', { hidden: true }, start.root, end.root);
  allDayBox.addEventListener('change', () => { times.hidden = allDayBox.checked; });
  const label = textField({ id: 'b-label', label: 'Reason (optional, private)', maxlength: 100, help: 'Only you can see this.' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Block these dates');
  const errors = h('div', { role: 'alert' });
  let busy = false;

  const form = h('form', { novalidate: true, class: 'detail-section' },
    h('h2', null, 'Add a block'), errors, from.root, to.root,
    h('label', { class: 'choice' }, allDayBox, h('span', null, 'All day')), times, label.root, submit);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (busy) return;
    const startDate = from.control.value;
    const endDate = to.control.value || startDate;
    const allDay = allDayBox.checked;
    const problems: string[] = [];
    if (!startDate) problems.push('Please pick a start date.');
    else if (endDate < startDate) problems.push("The end date can't be before the start date.");
    if (!allDay) {
      if (!start.control.value || !end.control.value) problems.push('Please enter a start and end time.');
      else if (end.control.value <= start.control.value) problems.push('The end time must be after the start time.');
      if (startDate && endDate !== startDate) problems.push('A time range has to be on a single day.');
    }
    from.setError(problems.includes('Please pick a start date.') ? 'Please pick a start date.' : null);
    clear(errors);
    if (problems.length) { errors.append(h('div', { class: 'alert alert-error' }, ...problems.map((p) => h('p', null, p)))); return; }
    const base = allDay
      ? { kind: 'all_day' as const, startDate, endDate }
      : { kind: 'time_range' as const, startDate, endDate: startDate, startTime: start.control.value, endTime: end.control.value };
    const body = { ...base, label: label.control.value.trim() || null };
    busy = true;
    submit.setAttribute('aria-disabled', 'true');
    submit.textContent = 'Blocking...';
    try {
      const r = await createBlock({ ...body, confirmOverlaps: false });
      toast("Dates blocked. Clients won't see them.");
      void r;
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'BLOCK_OVERLAPS_BOOKINGS') {
        const bookings = (err.details['bookings'] as OverlapBooking[] | undefined) ?? [];
        overlapDialog(bookings, async () => {
          await createBlock({ ...body, confirmOverlaps: true });
          toast(`Dates blocked. ${bookings.length} existing ${bookings.length === 1 ? 'booking was' : 'bookings were'} not changed.`);
          void load();
        }, submit);
      } else if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
        errors.append(h('div', { class: 'alert alert-error' }, h('p', null, err.message)));
      } else {
        errors.append(h('div', { class: 'alert alert-error' }, h('p', null, ACTION_ERROR)));
      }
    } finally {
      busy = false;
      submit.removeAttribute('aria-disabled');
      submit.textContent = 'Block these dates';
    }
  });

  async function load(): Promise<void> {
    clear(listHost);
    listHost.append(loadingBlock('Loading blocked dates...', 2));
    try {
      const { items } = await listBlocks();
      clear(listHost);
      listHost.append(h('h2', { class: 'group-title' }, 'Upcoming blocks'));
      if (items.length === 0) listHost.append(h('p', null, 'No blocked dates. Add one above when you need time off.'));
      for (const b of items) listHost.append(row(b));
    } catch (err) {
      clear(listHost);
      listHost.append(errorBlock("We couldn't load blocked dates.", () => { void load(); }, err));
    }
  }

  function row(b: BlockItem): HTMLElement {
    const remove = h('button', { type: 'button', class: 'btn btn-secondary', 'aria-label': `Remove block ${b.display}` }, 'Remove');
    remove.addEventListener('click', () => {
      openDialog({
        title: 'Remove this block?',
        description: h('p', null, `Clients will be able to book ${b.display} again.`),
        cancelLabel: 'Keep block', confirmLabel: 'Remove block',
        onConfirm: async (d) => {
          try { await deleteBlock(b.id); d.close(); toast('Block removed.'); void load(); } catch { d.setError(ACTION_ERROR); }
        },
      }, remove);
    });
    return h('div', { class: 'row-item' }, h('div', null, h('p', null, h('strong', null, b.display)), b.label ? h('p', { class: 'muted small' }, b.label) : null), remove);
  }

  main.append(pageHeading('Blocked dates'),
    h('p', null, "Block days or hours when you're not available. Clients won't see these times."), form, listHost);
  void load();
}
