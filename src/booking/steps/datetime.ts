import { h, clear } from '../../lib/dom';
import { getAvailability, ApiError } from '../../lib/api';
import { todayEt } from '../../lib/datetime';
import { addMonths, compareYmd, firstOfMonth, lastOfMonth, longDay, monthName, monthKey } from '../../lib/calendar-math';
import type { Availability, AvailabilityDay, Slot } from '../../lib/types';
import { createCalendar, type CalendarDay } from '../../components/calendar';
import { enableRadioKeys, setInitialTabStop } from '../../components/roving';
import { announce } from '../../components/live';
import { networkBanner } from '../../components/banner';
import { selectField } from '../../components/field';
import { backRow, progress, stepHeading, summaryStrip } from '../chrome';
import { durationLabel, lengthAndPrice, slotLong } from '../format';
import { selectDuration, selectSlot } from '../flow-state';
import type { FlowCtx } from '../context';

const cache = new Map<string, Availability>();

export function clearAvailabilityCache(): void {
  cache.clear();
}

export function renderDateStep(ctx: FlowCtx): HTMLElement {
  const type = ctx.type;
  if (!type) return h('div');
  const today = todayEt();
  const isMini = type.kind === 'mini';
  const days = new Map<string, AvailabilityDay>();
  let viewDate: string | null = ctx.state.selectedDate;
  let horizonEnd: string | null = null;
  let firstOpen: string | null = null;
  let loaded = false;

  const heading = stepHeading('Pick a date and time');
  const status = h('div', { 'aria-live': 'polite' });
  const monthNote = h('div');
  const timesPanel = h('div');
  const chosen = h('div', { role: 'status' });
  const next = h('button', { type: 'button', class: 'btn btn-primary btn-block' }, 'Continue');
  const root = h('div', { 'aria-busy': 'true' });

  const dayInfo = (date: string): CalendarDay => {
    const d = days.get(date);
    if (!d || d.status === 'closed' || compareYmd(date, today) < 0) return { state: 'unavailable', description: 'unavailable' };
    if (d.status === 'full') return { state: 'full', description: isMini ? 'fully booked' : 'unavailable' };
    if (d.mini) return { state: 'open', description: `${d.mini.spotsLeft} ${d.mini.spotsLeft === 1 ? 'spot' : 'spots'} left` };
    const n = d.slots.length;
    return { state: 'open', description: `${n} ${n === 1 ? 'time' : 'times'} available` };
  };

  const cal = createCalendar({
    getDay: dayInfo,
    today,
    onSelect: (date) => { viewDate = date; cal.show(currentMonth, chosenDate(), date, true); renderTimes(true); },
    onNavigate: (month, focus) => { void loadMonth(month, focus); },
  });
  let currentMonth = ctx.state.slot ? firstOfMonth(ctx.state.slot.localDate) : (ctx.state.month ?? (isMini && type.nextMiniDates?.[0] ? firstOfMonth(type.nextMiniDates[0].date) : firstOfMonth(today)));
  const chosenDate = (): string | null => ctx.state.slot?.localDate ?? null;

  function syncNext(): void {
    next.setAttribute('aria-disabled', String(!ctx.state.slot));
  }

  function renderChosen(): void {
    clear(chosen);
    if (ctx.state.slot) chosen.append(h('div', { class: 'chosen-summary' }, `You chose ${slotLong(ctx.state.slot)}.`));
    syncNext();
  }

  function renderTimes(announceIt: boolean): void {
    clear(timesPanel);
    if (!viewDate) return;
    const d = days.get(viewDate);
    if (!d || d.status !== 'open' || d.slots.length === 0) {
      timesPanel.append(h('p', { role: 'status' }, 'That day just filled up. Please pick another date.'));
      return;
    }
    const headingId = 'times-heading';
    const count = d.slots.length;
    const spots = d.mini ? (d.mini.spotsLeft === 1 ? 'Last spot!' : `${d.mini.spotsLeft} spots left`) : `${count} ${count === 1 ? 'time' : 'times'} available`;
    timesPanel.append(
      h('h2', { id: headingId, class: 'group-title' }, longDay(viewDate)),
      h('p', null, d.mini ? `${d.mini.location}${d.mini.theme ? ` · ${d.mini.theme}` : ''} · ${spots}` : spots),
    );
    const group = h('div', { class: 'time-grid', role: 'radiogroup', 'aria-label': `Available times on ${longDay(viewDate)}, Eastern Time` });
    const buttons: HTMLElement[] = [];
    const pick = (slot: Slot, btn: HTMLElement): void => {
      const label = d.mini ? `${d.mini.location}${d.mini.theme ? ` (${d.mini.theme})` : ''}` : null;
      ctx.update((s) => selectSlot(s, slot, d.date, label));
      for (const b of buttons) b.setAttribute('aria-checked', String(b === btn));
      setInitialTabStop(buttons);
      renderChosen();
      announce(`${slotLong(slot)} selected.`);
    };
    for (const slot of d.slots) {
      const on = ctx.state.slot?.startUtc === slot.startUtc && ctx.state.slot?.miniSlotId === slot.miniSlotId;
      const btn = h('button', { type: 'button', class: 'time-btn', role: 'radio', 'aria-checked': String(on), 'aria-label': `${slot.label} ET` }, `${slot.label} ET`);
      btn.addEventListener('click', () => pick(slot, btn));
      buttons.push(btn);
      group.append(btn);
    }
    enableRadioKeys(buttons, (el) => el.click());
    setInitialTabStop(buttons);
    timesPanel.append(group);
    if (announceIt) announce(`${spots} on ${longDay(viewDate)}`);
  }

  function renderMonthNote(): void {
    clear(monthNote);
    if (!loaded) return;
    if (firstOpen === null) {
      monthNote.append(
        h('div', { class: 'alert alert-info', role: 'status' },
          h('h2', null, 'No openings right now'),
          h('p', null, 'New dates are added often. Email ', h('a', { href: `mailto:${ctx.config.business.contactEmail}` }, ctx.config.business.contactEmail), ' and Daniella will help you find a time.'),
          h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => ctx.go(1) }, 'Back to sessions')),
      );
      return;
    }
    const hasOpen = [...days.values()].some((d) => d.status === 'open' && monthKey(d.date) === monthKey(currentMonth));
    if (!hasOpen) {
      const target = firstOfMonth(firstOpen);
      const label = monthName(target);
      monthNote.append(
        h('p', { role: 'status' }, `No openings in ${monthName(currentMonth)}.`),
        compareYmd(target, currentMonth) !== 0
          ? h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => { void loadMonth(target, target, true); } }, `See ${label}`)
          : null,
      );
    }
  }

  async function loadMonth(month: string, focus?: string, moveFocus = false): Promise<void> {
    currentMonth = firstOfMonth(month);
    root.setAttribute('aria-busy', 'true');
    status.textContent = '';
    const from = compareYmd(currentMonth, today) < 0 ? today : currentMonth;
    const key = `${type?.id}|${ctx.state.durationMin}|${currentMonth}`;
    try {
      let data = cache.get(key);
      if (!data) {
        data = await getAvailability({
          type: type!.id, from, to: lastOfMonth(currentMonth),
          durationMin: type!.durationOptionsMin ? (ctx.state.durationMin ?? type!.durationMin) : undefined,
        });
        cache.set(key, data);
      }
      days.clear();
      for (const d of data.days) days.set(d.date, d);
      horizonEnd = data.horizonEndDate;
      firstOpen = data.firstOpenDate;
      loaded = true;
      cal.setBounds(today, horizonEnd);
      cal.show(currentMonth, chosenDate(), focus ?? null, moveFocus || focus !== undefined);
      if (viewDate && monthKey(viewDate) !== monthKey(currentMonth)) viewDate = null;
      const only = isMini && type!.nextMiniDates?.length === 1 ? type!.nextMiniDates[0]?.date : undefined;
      if (!viewDate && only && days.get(only)?.status === 'open') viewDate = only;
      renderTimes(false);
      renderMonthNote();
      announce(`${monthName(currentMonth)} ${currentMonth.slice(0, 4)}`);
    } catch (err) {
      clear(status);
      const msg = err instanceof ApiError && !err.isNetwork ? "We couldn't load available times. Please try again." : undefined;
      status.append(networkBanner(() => { void loadMonth(month, focus, moveFocus); }, msg));
    } finally {
      root.setAttribute('aria-busy', 'false');
      renderChosen();
    }
  }

  // ----- layout -----
  const strip = summaryStrip(lengthAndPrice(type, ctx.state.durationMin).replace(/^/, `${type.name} · `), () => ctx.go(1));
  root.append(backRow(ctx, 1), progress(2), strip, heading);
  if (type.bookingMode === 'request') {
    root.append(h('p', null, `This is a request. Daniella will reply within ${ctx.config.scheduling.requestResponseDays} days.`));
  }
  root.append(h('p', null, 'All times are Eastern Time. Only open times are shown.'));

  if (type.durationOptionsMin) {
    const min = type.durationOptionsMin[0] ?? type.durationMin;
    const f = selectField({
      label: 'How long do you need?',
      help: `${durationLabel(min)} minimum`,
      value: String(ctx.state.durationMin ?? min),
      options: type.durationOptionsMin.map((m) => ({ value: String(m), label: durationLabel(m) })),
      onInput: (v) => {
        ctx.update((s) => selectDuration(s, Number(v)));
        viewDate = null;
        strip.firstElementChild!.textContent = `${type.name} · ${lengthAndPrice(type, Number(v))}`;
        renderChosen();
        clear(timesPanel);
        void loadMonth(currentMonth);
      },
    });
    root.append(f.root);
  }

  next.addEventListener('click', () => {
    if (!ctx.state.slot) {
      announce('Please choose a time to continue.');
      return;
    }
    ctx.update((s) => ({ ...s, month: currentMonth }));
    ctx.go(3);
  });
  root.append(status, cal.el, monthNote, timesPanel, chosen, next);
  cal.show(currentMonth, chosenDate());
  renderChosen();
  void loadMonth(currentMonth);
  // Keep unused helpers referenced for tree-shaking clarity.
  void addMonths;
  return root;
}
