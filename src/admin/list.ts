import { h, clear } from '../lib/dom';
import { ApiError, exportCsvUrl, getConfig, listBookings } from '../lib/api';
import { daysBetweenDates, todayEt } from '../lib/datetime';
import type { BookingFilters, BookingList, BookingListItem, PublicSessionType } from '../lib/types';
import { flagChip, statusChip, statusText } from '../components/chip';
import { icon } from '../components/icons';
import { announce } from '../components/live';
import { rememberListQuery } from './detail';
import { errorBlock, focusHeading, loadingBlock, pageHeading, setTitle } from './common';

const PAGE_SIZE = 25;
const STATUSES = ['requested', 'pending_deposit', 'confirmed', 'completed', 'cancelled', 'declined'] as const;
const FILTER_KEYS = ['view', 'status', 'type', 'from', 'to', 'rescheduled', 'flag'] as const;

export function filtersFromQuery(q: URLSearchParams): BookingFilters {
  const f: Record<string, string> = {};
  for (const k of [...FILTER_KEYS, 'page']) {
    const v = q.get(k);
    if (v) f[k] = v;
  }
  return f as BookingFilters;
}

export function queryFromFilters(f: BookingFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v));
  return p.toString();
}

function filterCount(f: BookingFilters): number {
  return FILTER_KEYS.filter((k) => f[k] && !(k === 'view' && f.view === 'upcoming')).length;
}

function selectOf(id: string, label: string, options: [string, string][], value: string): { root: HTMLElement; get: () => string } {
  const sel = h('select', { class: 'input', id });
  for (const [v, l] of options) sel.append(h('option', { value: v }, l));
  sel.value = value;
  return { root: h('div', { class: 'field' }, h('label', { for: id }, label), sel), get: () => sel.value };
}

function groupOf(item: BookingListItem, today: string): string {
  const d = daysBetweenDates(today, item.localDate);
  if (d <= 0) return d === 0 ? 'Today' : 'Earlier';
  return d <= 7 ? 'This week' : 'Later';
}

function rowFor(item: BookingListItem): HTMLElement {
  const name = item.clientName ?? 'Client data deleted';
  const label = `${item.display.date}, ${item.display.timeRange}, ${name}, ${item.sessionTypeName}, ${statusText(item.status)}`;
  return h('li', { class: 'b-card' },
    h('a', { class: 'stretch when', href: `#/bookings/${encodeURIComponent(item.id)}`, 'aria-label': label }, `${item.display.date} · ${item.display.timeRange}`),
    h('p', null, name),
    h('p', { class: 'muted small' }, item.sessionTypeName, ' · ', item.id),
    h('div', { class: 'b-meta' }, statusChip(item.status),
      item.waitingLabel ? h('span', { class: 'small' }, item.waitingLabel) : null,
      ...item.flags.filter((f) => ['deposit_overdue', 'reply_overdue', 'email_not_sent', 'session_time_passed', 'rescheduled', 'surprise_proposal', 'help_me_choose_location'].includes(f)).map(flagChip)),
  );
}

function link(f: BookingFilters, text: string): HTMLElement {
  return h('a', { class: 'btn btn-secondary', href: `#/bookings?${queryFromFilters(f)}` }, text);
}

export function renderList(main: HTMLElement, query: URLSearchParams): void {
  setTitle('Bookings');
  rememberListQuery(window.location.hash);
  const filters = filtersFromQuery(query);
  const view = filters.view ?? 'upcoming';
  const results = h('div');
  const title = h('div', { class: 'title-row' }, pageHeading('Bookings'));
  const exportHost = h('div');
  const panel = h('div', { class: 'filters-panel', id: 'filters-panel', hidden: filterCount(filters) === 0 });
  const toggle = h('button', { type: 'button', class: 'btn btn-secondary', 'aria-expanded': String(filterCount(filters) > 0), 'aria-controls': 'filters-panel' },
    `Filters${filterCount(filters) ? ` (${filterCount(filters)})` : ''}`);
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  });
  main.append(title, h('p', { class: 'muted' }, 'All times Eastern'), h('div', { class: 'filters' }, toggle, panel), results);

  const build = (types: PublicSessionType[]): void => {
    const v = selectOf('f-view', 'Show', [['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']], view);
    const s = selectOf('f-status', 'Status', [['', 'All'], ...STATUSES.map((x): [string, string] => [x, statusText(x)])], filters.status ?? '');
    const t = selectOf('f-type', 'Session type', [['', 'All'], ...types.map((x): [string, string] => [x.id, x.name])], filters.type ?? '');
    const fl = selectOf('f-flag', 'Needs attention', [['', 'Any'], ['deposit_overdue', 'Deposit overdue'], ['reply_overdue', 'Reply overdue'], ['email_not_sent', 'Email not sent']], filters.flag ?? '');
    const from = h('input', { class: 'input', type: 'date', id: 'f-from', value: filters.from ?? '' });
    const to = h('input', { class: 'input', type: 'date', id: 'f-to', value: filters.to ?? '' });
    const resc = h('input', { type: 'checkbox', id: 'f-resc', checked: filters.rescheduled === 'true' });
    const apply = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Apply');
    const form = h('form', { class: 'filters-panel', novalidate: true },
      v.root, s.root, t.root, fl.root,
      h('div', { class: 'field' }, h('label', { for: 'f-from' }, 'From'), from),
      h('div', { class: 'field' }, h('label', { for: 'f-to' }, 'To'), to),
      h('label', { class: 'choice' }, resc, h('span', null, 'Rescheduled only')),
      h('div', { class: 'btn-row' }, apply, h('a', { href: '#/bookings', class: 'btn-link' }, 'Clear filters')));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const next: BookingFilters = {
        view: v.get() as BookingFilters['view'], status: s.get(), type: t.get(), flag: fl.get(),
        from: from.value, to: to.value, rescheduled: resc.checked ? 'true' : '',
      };
      const qs = queryFromFilters(next);
      window.location.hash = `#/bookings${qs ? `?${qs}` : ''}`;
    });
    clear(panel);
    panel.className = '';
    panel.append(form);
  };
  build([]);
  void getConfig().then((c) => build(c.sessionTypes)).catch(() => undefined);

  async function load(): Promise<void> {
    replaceResults(loadingBlock('Loading bookings...'));
    try {
      const page = Number(filters.page) > 0 ? Number(filters.page) : 1;
      const data = await listBookings({ ...filters, view, page: String(page), pageSize: PAGE_SIZE });
      draw(data, page);
      focusHeading(main);
    } catch (err) {
      replaceResults(errorBlock("We couldn't load bookings. Please try again.", () => { void load(); }, err));
      if (err instanceof ApiError && err.status === 401) return;
    }
  }

  function replaceResults(...nodes: Node[]): void {
    clear(results);
    results.append(...nodes);
  }

  function draw(data: BookingList, page: number): void {
    const attention: HTMLElement[] = [];
    const s = data.summary;
    if (s.requestsWaiting) attention.push(h('a', { class: 'chip chip-warning', href: '#/bookings?status=requested&view=all' }, icon('clock', 16), `${s.requestsWaiting} ${s.requestsWaiting === 1 ? 'request' : 'requests'} waiting`));
    if (s.upcomingPendingDeposit) attention.push(h('a', { class: 'chip chip-warning', href: '#/bookings?status=pending_deposit' }, icon('hourglass', 16), `${s.upcomingPendingDeposit} pending deposit`));
    if (s.depositOverdue) attention.push(h('a', { class: 'chip chip-error', href: '#/bookings?flag=deposit_overdue&view=all' }, icon('alert', 16), `${s.depositOverdue} deposit overdue`));
    if (s.replyOverdue) attention.push(h('a', { class: 'chip chip-error', href: '#/bookings?flag=reply_overdue&view=all' }, icon('alert', 16), `${s.replyOverdue} reply overdue`));

    const exportNode = data.total === 0
      ? h('div', null, h('span', { class: 'btn', 'aria-disabled': 'true' }, 'Export CSV'), h('p', { class: 'help' }, 'Nothing to export.'))
      : h('div', null,
          h('a', { class: 'btn btn-secondary', href: exportCsvUrl(filters), download: '' }, `Export CSV (${data.total} ${data.total === 1 ? 'booking' : 'bookings'})`),
          h('p', { class: 'help' }, 'This file has client contact details. Store it somewhere private and delete it when you are done.'));
    clear(exportHost);
    exportHost.append(exportNode);
    if (!exportHost.isConnected) title.append(exportHost);

    if (data.items.length === 0) {
      const any = filterCount(filters) > 0;
      const empty: Node[] = [];
      if (attention.length) empty.push(h('div', { class: 'attention' }, ...attention));
      empty.push(h('h2', null, any ? 'No bookings match these filters.' : 'No bookings yet'));
      if (!any) empty.push(h('p', null, 'When someone books, it will appear here.'));
      else empty.push(h('a', { class: 'btn btn-secondary', href: '#/bookings' }, 'Clear filters'));
      replaceResults(...empty);
      return;
    }
    const today = todayEt();
    const nodes: Node[] = [];
    if (attention.length) nodes.push(h('div', { class: 'attention', 'aria-label': 'Needs attention' }, ...attention));
    let current = '';
    let ul: HTMLElement | null = null;
    for (const item of data.items) {
      const g = view === 'upcoming' ? groupOf(item, today) : '';
      if (!ul || g !== current) {
        current = g;
        if (g) nodes.push(h('h2', { class: 'group-title' }, g));
        ul = h('ul', { class: 'b-cards' });
        nodes.push(ul);
      }
      ul.append(rowFor(item));
    }
    const first = (page - 1) * data.pageSize + 1;
    const last = Math.min(data.total, first + data.items.length - 1);
    const hasPrev = page > 1;
    const hasNext = last < data.total;
    nodes.push(h('div', { class: 'pager' },
      h('p', { role: 'status' }, `Showing ${first} to ${last} of ${data.total}`),
      h('div', { class: 'btn-row' },
        ...(hasPrev ? [link({ ...filters, page: String(page - 1) }, 'Previous')] : []),
        ...(hasNext ? [link({ ...filters, page: String(page + 1) }, 'Next')] : []))));
    replaceResults(...nodes);
    announce(`Showing ${first} to ${last} of ${data.total} bookings`);
  }

  // The export block sits beside the heading.
  title.append(exportHost);
  void load();
}
