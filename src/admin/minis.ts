import { h, clear } from '../lib/dom';
import { addMiniSlots, ApiError, deleteMiniDay, deleteMiniSlot, getConfig, listMiniDays } from '../lib/api';
import { formatDateStringMedium, formatHm, hmToMinutes, minutesToHm, todayEt } from '../lib/datetime';
import type { MiniDay } from '../lib/types';
import { openDialog } from '../components/dialog';
import { textField } from '../components/field';
import { toast } from '../components/toast';
import { ACTION_ERROR, errorBlock, loadingBlock, pageHeading, setTitle } from './common';

/** Back-to-back start times: first start, count, and the gap between starts (minutes). */
export function miniStartTimes(first: string, count: number, spacingMin: number): string[] | null {
  if (!/^\d{2}:\d{2}$/.test(first) || !Number.isInteger(count) || count < 1 || count > 30 || spacingMin < 1) return null;
  const base = hmToMinutes(first);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const m = base + i * spacingMin;
    if (m >= 24 * 60) return null;
    out.push(minutesToHm(m));
  }
  return out;
}

export function renderMinis(main: HTMLElement): void {
  setTitle('Add minis slots');
  const listHost = h('div');
  const date = textField({ id: 'm-date', label: 'Date', type: 'date' });
  (date.control as HTMLInputElement).min = todayEt();
  const location = textField({ id: 'm-loc', label: 'Location', maxlength: 100 });
  const theme = textField({ id: 'm-theme', label: 'Theme', optional: true, maxlength: 100 });
  const firstStart = textField({ id: 'm-start', label: 'First start time', type: 'time' });
  const count = textField({ id: 'm-count', label: 'Number of slots', type: 'number', inputmode: 'numeric', value: '6', help: 'Between 1 and 30.' });
  const spacing = textField({ id: 'm-space', label: 'Minutes between starts', type: 'number', inputmode: 'numeric', value: '30', help: 'Slot length plus buffer. The server rejects overlaps.' });
  const preview = h('div', { class: 'preview', 'aria-live': 'polite' });
  const errors = h('div', { role: 'alert' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Add these slots');
  let slotLen = 20;
  let busy = false;
  let existing: MiniDay[] = [];

  void getConfig().then((c) => {
    const mini = c.sessionTypes.find((t) => t.kind === 'mini');
    if (mini) {
      slotLen = mini.durationMin;
      // Buffer is not in the public config (API gap): start from length + 10 and let Daniella adjust.
      (spacing.control as HTMLInputElement).value = String(mini.durationMin + 10);
      updatePreview();
    }
  }).catch(() => undefined);

  function times(): string[] | null {
    return miniStartTimes(firstStart.control.value, Number(count.control.value), Number(spacing.control.value));
  }
  let timer = 0;
  function updatePreview(): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      clear(preview);
      const t = times();
      if (!t) { preview.append(h('p', null, 'Enter a first start time and between 1 and 30 slots to see a preview.')); return; }
      const last = t[t.length - 1] ?? '00:00';
      preview.append(h('p', null, h('strong', null, 'Preview: '), t.map(formatHm).join(', ')),
        h('p', null, `Last session ends ${formatHm(minutesToHm(hmToMinutes(last) + slotLen))}`));
    }, 250);
  }
  for (const f of [firstStart, count, spacing]) f.control.addEventListener('input', updatePreview);
  updatePreview();

  const form = h('form', { novalidate: true, class: 'detail-section' },
    h('h2', null, 'New mini day'), errors, date.root, location.root, theme.root, firstStart.root, count.root, spacing.root, preview, submit);
  date.control.addEventListener('change', () => {
    const found = existing.find((d) => d.date === date.control.value);
    if (found) { (location.control as HTMLInputElement).value = found.location; (theme.control as HTMLInputElement).value = found.theme ?? ''; }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (busy) return;
    clear(errors);
    const problems: string[] = [];
    const t = times();
    if (!date.control.value) problems.push('Please pick a date.');
    const found = existing.find((d) => d.date === date.control.value);
    if (!found && !location.control.value.trim()) problems.push('Please add a location.');
    if (!t) problems.push('Enter between 1 and 30 slots and a first start time.');
    if (problems.length || !t) { errors.append(h('div', { class: 'alert alert-error' }, ...problems.map((p) => h('p', null, p)))); return; }
    busy = true;
    submit.setAttribute('aria-disabled', 'true');
    submit.textContent = 'Adding...';
    try {
      const r = await addMiniSlots(date.control.value, {
        startTimes: t,
        ...(location.control.value.trim() ? { location: location.control.value.trim() } : {}),
        ...(theme.control.value.trim() ? { theme: theme.control.value.trim() } : {}),
      });
      toast(`${r.created.length} Holiday Minis ${r.created.length === 1 ? 'slot' : 'slots'} added for ${formatDateStringMedium(date.control.value)}.`);
      if (r.rejected.length) {
        errors.append(h('div', { class: 'alert alert-warning' }, h('p', null, 'Some slots were not added:'), h('ul', null, ...r.rejected.map((x) => h('li', null, x.message)))));
      }
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SLOT_TAKEN') {
        const rej = (err.details['rejected'] as { message: string }[] | undefined) ?? [];
        errors.append(h('div', { class: 'alert alert-error' }, h('p', null, 'None of those slots could be added:'), h('ul', null, ...rej.map((x) => h('li', null, x.message)))));
      } else if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
        errors.append(h('div', { class: 'alert alert-error' }, h('p', null, err.message)));
      } else {
        errors.append(h('div', { class: 'alert alert-error' }, h('p', null, ACTION_ERROR)));
      }
    } finally {
      busy = false;
      submit.removeAttribute('aria-disabled');
      submit.textContent = 'Add these slots';
    }
  });

  async function load(): Promise<void> {
    clear(listHost);
    listHost.append(loadingBlock('Loading mini days...', 2));
    try {
      const { items } = await listMiniDays();
      existing = items;
      clear(listHost);
      listHost.append(h('h2', { class: 'group-title' }, 'Upcoming mini days'));
      if (items.length === 0) listHost.append(h('p', null, 'No mini days yet. Add one above.'));
      for (const d of items) listHost.append(dayCard(d));
    } catch (err) {
      clear(listHost);
      listHost.append(errorBlock("We couldn't load mini days.", () => { void load(); }, err));
    }
  }

  function dayCard(d: MiniDay): HTMLElement {
    const removeDay = h('button', { type: 'button', class: 'btn btn-secondary', 'aria-disabled': d.booked > 0 ? 'true' : null }, 'Remove mini day');
    removeDay.addEventListener('click', () => {
      if (d.booked > 0) return;
      openDialog({
        title: 'Remove this mini day?',
        description: h('p', null, `All ${d.slots.length} open slots will disappear for clients.`),
        cancelLabel: 'Keep it', confirmLabel: 'Remove mini day', destructive: true,
        onConfirm: async (dlg) => {
          try { await deleteMiniDay(d.date); dlg.close(); toast('Mini day removed.'); void load(); } catch { dlg.setError(ACTION_ERROR); }
        },
      }, removeDay);
    });
    return h('section', { class: 'detail-section' },
      h('h3', null, formatDateStringMedium(d.date)),
      h('p', null, `${d.location}${d.theme ? ` · ${d.theme}` : ''} · ${d.slots.length} slots · ${d.booked} booked`),
      ...d.slots.map((s) => {
        const rm = h('button', { type: 'button', class: 'btn btn-secondary', 'aria-label': `Remove slot ${s.rangeLabel} on ${formatDateStringMedium(d.date)}` }, 'Remove');
        rm.addEventListener('click', async () => {
          try { await deleteMiniSlot(d.date, s.id); toast('Slot removed.'); void load(); } catch (err) {
            toast(err instanceof ApiError && err.code === 'MINI_DAY_HAS_BOOKINGS' ? 'That slot is booked. Cancel the booking first.' : ACTION_ERROR, 'error');
          }
        });
        return h('div', { class: 'row-item' }, h('p', null, s.rangeLabel, s.bookingId ? ` · booked (${s.bookingId})` : ''), s.bookingId ? null : rm);
      }),
      h('div', { class: 'btn-row' }, removeDay),
      d.booked > 0 ? h('p', { class: 'help' }, `${d.booked} ${d.booked === 1 ? 'slot is' : 'slots are'} booked. Cancel those bookings first.`) : null);
  }

  main.append(pageHeading('Add Holiday Minis slots'), h('p', null, "Create a mini-session day. We'll make back-to-back slots for you."), form, listHost);
  void load();
}
