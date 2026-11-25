// Accessible month grid (ARIA grid pattern). One tab stop; arrow keys move across days,
// including unavailable ones; Enter or Space selects an available day.
import { h, clear } from '../lib/dom';
import { icon } from './icons';
import {
  WEEKDAY_ABBR, WEEKDAY_NAMES, addDaysYmd, addMonths, compareYmd, firstOfMonth, longDay, monthGrid, monthTitle, parseYmd, weekdayIndex,
} from '../lib/calendar-math';

export type CalendarDay = {
  state: 'open' | 'full' | 'unavailable';
  /** Appended to the accessible name, e.g. "3 times available". */
  description: string;
};

export type CalendarOptions = {
  getDay: (date: string) => CalendarDay;
  onSelect: (date: string) => void;
  /** Called when the visible month should change. The host loads data then calls show(). */
  onNavigate: (month: string, focusDate: string) => void;
  today: string;
};

export type CalendarHandle = {
  el: HTMLElement;
  /** Renders `month` (any date in it). */
  show: (month: string, selected: string | null, focusDate?: string | null, moveFocus?: boolean) => void;
  setBounds: (min: string | null, max: string | null) => void;
};

export function createCalendar(opts: CalendarOptions): CalendarHandle {
  let month = firstOfMonth(opts.today);
  let selected: string | null = null;
  let focusDate: string = opts.today;
  let min: string | null = null;
  let max: string | null = null;

  const caption = h('caption', { class: 'sr-only', 'aria-live': 'polite' });
  const tbody = h('tbody');
  const prev = h('button', { type: 'button', class: 'btn btn-secondary', 'aria-label': 'Previous month' }, icon('left'));
  const next = h('button', { type: 'button', class: 'btn btn-secondary', 'aria-label': 'Next month' }, icon('right'));
  const grid = h(
    'table',
    { class: 'cal-grid', role: 'grid' },
    caption,
    h('thead', null, h('tr', null, ...WEEKDAY_ABBR.map((d, i) => h('th', { scope: 'col', abbr: WEEKDAY_NAMES[i], role: 'columnheader' }, d)))),
    tbody,
  );
  const title = h('p', { class: 'cal-title', 'aria-hidden': 'true' });
  const el = h('div', { class: 'cal' }, h('div', { class: 'cal-head' }, prev, title, next), grid);

  const clamp = (d: string): string => {
    let out = d;
    if (min && compareYmd(out, min) < 0) out = min;
    if (max && compareYmd(out, max) > 0) out = max;
    return out;
  };

  function updateNav(): void {
    const canPrev = !min || compareYmd(firstOfMonth(min), month) < 0;
    const canNext = !max || compareYmd(addMonths(month, 1), max) <= 0;
    prev.setAttribute('aria-disabled', String(!canPrev));
    next.setAttribute('aria-disabled', String(!canNext));
  }

  function buttonFor(date: string): HTMLButtonElement | null {
    return tbody.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`);
  }

  function render(moveFocus: boolean): void {
    const label = monthTitle(month);
    caption.textContent = label;
    title.textContent = label;
    clear(tbody);
    if (focusDate.slice(0, 7) !== month.slice(0, 7)) focusDate = month;
    for (const week of monthGrid(month)) {
      const tr = h('tr');
      for (const date of week) {
        if (!date) {
          tr.append(h('td', { role: 'gridcell', 'aria-hidden': 'true' }));
          continue;
        }
        const info = opts.getDay(date);
        const isSel = selected === date;
        const name = `${longDay(date)}, ${info.description}`;
        const btn = h(
          'button',
          {
            type: 'button',
            class: 'cal-day',
            'data-date': date,
            'data-open': info.state === 'open',
            'data-full': info.state === 'full',
            'data-today': date === opts.today,
            'data-selected': isSel,
            'aria-disabled': info.state !== 'open' ? 'true' : null,
            'aria-label': name,
            'aria-current': date === opts.today ? 'date' : null,
            tabindex: date === focusDate ? 0 : -1,
          },
          h('span', { 'aria-hidden': 'true' }, String(parseYmd(date).d)),
        );
        btn.addEventListener('click', () => {
          focusDate = date;
          if (info.state === 'open') opts.onSelect(date);
        });
        btn.addEventListener('keydown', (ev) => onKey(ev, date));
        tr.append(h('td', { role: 'gridcell', 'aria-selected': isSel ? 'true' : 'false' }, btn));
      }
      tbody.append(tr);
    }
    updateNav();
    if (moveFocus) buttonFor(focusDate)?.focus();
  }

  function moveTo(date: string): void {
    const target = clamp(date);
    focusDate = target;
    if (target.slice(0, 7) !== month.slice(0, 7)) {
      opts.onNavigate(firstOfMonth(target), target);
    } else {
      for (const b of tbody.querySelectorAll<HTMLButtonElement>('button.cal-day')) b.tabIndex = -1;
      const b = buttonFor(target);
      if (b) { b.tabIndex = 0; b.focus(); }
    }
  }

  function onKey(ev: KeyboardEvent, date: string): void {
    let target: string;
    switch (ev.key) {
      case 'ArrowLeft': target = addDaysYmd(date, -1); break;
      case 'ArrowRight': target = addDaysYmd(date, 1); break;
      case 'ArrowUp': target = addDaysYmd(date, -7); break;
      case 'ArrowDown': target = addDaysYmd(date, 7); break;
      case 'Home': target = addDaysYmd(date, -weekdayIndex(date)); break;
      case 'End': target = addDaysYmd(date, 6 - weekdayIndex(date)); break;
      case 'PageUp': target = addMonths(date, -1).slice(0, 8) + String(Math.min(parseYmd(date).d, 28)).padStart(2, '0'); break;
      case 'PageDown': target = addMonths(date, 1).slice(0, 8) + String(Math.min(parseYmd(date).d, 28)).padStart(2, '0'); break;
      case 'Enter':
      case ' ': {
        ev.preventDefault();
        const info = opts.getDay(date);
        if (info.state === 'open') opts.onSelect(date);
        return;
      }
      default: return;
    }
    ev.preventDefault();
    moveTo(target);
  }

  prev.addEventListener('click', () => {
    if (prev.getAttribute('aria-disabled') === 'true') return;
    const t = addMonths(month, -1);
    opts.onNavigate(t, clamp(t));
  });
  next.addEventListener('click', () => {
    if (next.getAttribute('aria-disabled') === 'true') return;
    const t = addMonths(month, 1);
    opts.onNavigate(t, t);
  });

  return {
    el,
    show(m, sel, focus, moveFocus = false) {
      month = firstOfMonth(m);
      selected = sel;
      if (focus) focusDate = focus;
      else if (sel && sel.slice(0, 7) === month.slice(0, 7)) focusDate = sel;
      else focusDate = month.slice(0, 7) === opts.today.slice(0, 7) ? opts.today : month;
      render(moveFocus);
    },
    setBounds(a, b) {
      min = a;
      max = b;
      updateNav();
    },
  };
}
