import { h, clear, type Child } from '../lib/dom';
import { ApiError, getBooking, getConfig } from '../lib/api';
import { addMinutes, formatDateStringMedium, formatDateTimeLabel } from '../lib/datetime';
import { emailLink, phoneLink } from '../components/links';
import { smsHref } from '../lib/links';
import type { BookingDetail } from '../lib/types';
import { flagChip, statusChip, statusText } from '../components/chip';
import { announce } from '../components/live';
import { toast } from '../components/toast';
import { safeHref } from '../booking/steps/confirmation';
import { errorBlock, focusHeading, loadingBlock, pageHeading, setTitle } from './common';
import { ACTION_LABEL, ACTION_ORDER, PRIMARY_ACTIONS, answerText, locationLabel, peopleText, preferredLabel, reasonLabel } from './format';
import { runAction } from './actions';

const LIST_KEY = 'dbp.admin.list';

/** The list remembers its query so "All bookings" returns to the same filters. */
export function rememberListQuery(hash: string): void {
  try { window.sessionStorage.setItem(LIST_KEY, hash); } catch { /* ignore */ }
}
function listHref(): string {
  try {
    const v = window.sessionStorage.getItem(LIST_KEY);
    if (v && /^#\/bookings(\?[\w=&%,.:-]*)?$/.test(v)) return v;
  } catch { /* ignore */ }
  return '#/bookings';
}

function section(title: string, ...children: Child[]): HTMLElement {
  return h('section', { class: 'detail-section' }, h('h2', null, title), ...children);
}
function dl(rows: [string, Child][]): HTMLElement {
  const el = h('dl', { class: 'kv' });
  for (const [k, v] of rows) el.append(h('dt', null, k), h('dd', null, v));
  return el;
}
const notProvided = (): HTMLElement => h('span', { class: 'muted' }, 'Not provided');

function contactSection(b: BookingDetail): HTMLElement {
  if (!b.contact) return section('Contact', h('p', { class: 'muted' }, 'Client data was deleted.'));
  const sms = b.contact.preferredContact === 'text' ? smsHref(b.contact.phone) : null;
  return section('Contact', dl([
    ['Email', emailLink(b.contact.email)],
    ['Phone', h('span', null, phoneLink(b.contact.phone), sms ? [' · ', h('a', { href: sms }, 'Text')] : null)],
    ['Prefers', preferredLabel(b.contact.preferredContact)],
  ]));
}

function sessionSection(b: BookingDetail): HTMLElement {
  const rows: [string, Child][] = [
    ['Location', locationLabel(b.location)],
    ['People', b.people ? peopleText(b.people) : notProvided()],
  ];
  for (const a of b.intake ?? []) {
    const t = answerText(a.value);
    rows.push([a.label, t ?? notProvided()]);
  }
  if (b.portfolioOptOut !== null) rows.push(['Portfolio use', b.portfolioOptOut ? 'Opted out' : 'OK']);
  return section('Session and intake answers', dl(rows));
}

function paymentSection(b: BookingDetail, holdHours: number | null, onCopy: () => void): HTMLElement {
  const due = b.pricing.amountDue;
  const rows: [string, Child][] = [];
  const kind = due.kind === 'full' ? 'Paid in full to book' : due.kind === 'estimated_deposit' ? 'Estimated deposit' : due.kind === 'none' ? 'No deposit' : 'Deposit';
  rows.push([kind, due.kind === 'none' ? '—' : due.label]);
  if (b.pricing.estimatedTotal) rows.push(['Estimated total', b.pricing.estimatedTotal.label]);
  if (b.payment) {
    rows.push(['Paid', `${(b.payment.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} on ${formatDateStringMedium(b.payment.receivedOn)}`]);
    if (b.payment.method) rows.push(['Method', b.payment.method]);
    if (b.payment.note) rows.push(['Note', b.payment.note]);
  } else if (b.status === 'pending_deposit') {
    rows.push(['Status', 'Not yet paid']);
    if (b.timestamps.holdStartedAt && holdHours) {
      rows.push(['Held until', formatDateTimeLabel(addMinutes(b.timestamps.holdStartedAt, holdHours * 60))]);
    }
  } else if (b.status === 'requested') {
    rows.push(['Status', 'Due after approval']);
  }
  const link = safeHref(b.pricing.paymentLinkUrl);
  const kids: Child[] = [dl(rows)];
  if (link) kids.push(h('button', { type: 'button', class: 'btn-link', onClick: onCopy }, 'Copy payment link'));
  else if (b.flags.includes('no_payment_link')) kids.push(h('p', { class: 'muted' }, 'No payment link is set up for this booking.'));
  return section('Payment', ...kids);
}

function historySection(b: BookingDetail): HTMLElement {
  const who = (by: string): string => (by === 'admin' ? 'Daniella' : by === 'client' ? 'Client' : 'System');
  return section('History', h('ol', { class: 'history' }, ...b.history.map((e) => {
    const move = e.fromStatus && e.toStatus ? ` (${statusText(e.fromStatus)} to ${statusText(e.toStatus)})` : e.toStatus ? ` (${statusText(e.toStatus)})` : '';
    return h('li', null, h('strong', null, e.atLabel), ' · ', `${who(e.by)}: ${e.action.replace(/_/g, ' ')}${move}`,
      e.reason ? ` · ${reasonLabel(e.reason)}` : null, e.note ? h('div', { class: 'muted small' }, e.note) : null);
  })));
}

export function renderDetail(main: HTMLElement, id: string): void {
  setTitle(`Booking ${id}`);
  const host = h('div');
  main.append(host);
  let holdHours: number | null = null;

  async function load(focus = true): Promise<void> {
    clear(host);
    host.append(loadingBlock('Loading booking...'));
    try {
      const [b, cfg] = await Promise.all([getBooking(id), getConfig().catch(() => null)]);
      holdHours = cfg?.scheduling.unpaidHoldHours ?? null;
      draw(b);
      if (focus) focusHeading(host);
    } catch (err) {
      clear(host);
      if (err instanceof ApiError && err.code === 'NOT_FOUND') {
        host.append(pageHeading("We can't find that booking."), h('a', { class: 'btn btn-secondary', href: listHref() }, 'Back to bookings'));
        focusHeading(host);
        return;
      }
      host.append(errorBlock("We couldn't load this booking.", () => { void load(); }, err));
    }
  }

  function draw(b: BookingDetail): void {
    clear(host);
    const name = b.contact?.fullName ?? 'Client data deleted';
    const actions = ACTION_ORDER.filter((a) => b.allowedActions.includes(a));
    const buttons = actions.map((a) => {
      const btn = h('button', { type: 'button', class: `btn ${PRIMARY_ACTIONS.includes(a) ? 'btn-primary' : a === 'cancel' || a === 'delete_client_data' ? 'btn-danger' : 'btn-secondary'}` }, ACTION_LABEL[a]);
      btn.addEventListener('click', () => {
        runAction(a, b, btn, {
          holdHours,
          done: (updated, message) => { draw(updated); focusHeading(host); toast(message); },
          reload: (message) => { void load().then(() => toast(message, 'error')); },
        });
      });
      return btn;
    });
    host.append(
      h('p', null, h('a', { href: listHref() }, '‹ All bookings')),
      pageHeading(`${name} · ${b.sessionTypeName}`),
      h('div', { class: 'flag-list' }, statusChip(b.status), ...b.flags.map(flagChip)),
      h('p', null, `${b.display.date}, ${b.display.timeRange} · ${b.durationMin} min · Ref ${b.id}`),
      h('div', { class: 'actions' }, ...buttons),
      ...(b.allowedActions.length === 0 ? [h('p', { class: 'muted' }, 'This booking is read only.')] : []),
      h('div', { class: 'detail-cols' },
        h('div', null, contactSection(b), sessionSection(b)),
        h('div', null,
          paymentSection(b, holdHours, () => {
            const url = safeHref(b.pricing.paymentLinkUrl);
            if (url) void navigator.clipboard?.writeText(url).then(() => announce('Payment link copied.'), () => announce('Could not copy the link.'));
          }),
          section('Policy', dl([['Accepted', b.policy.version], ['When', b.policy.acceptedAtLabel]]),
            b.policy.url.startsWith('/policies.html') ? h('a', { href: b.policy.url, target: '_blank', rel: 'noopener' }, 'Read this version', h('span', { class: 'sr-only' }, ' (opens in new tab)')) : null),
          section('Emails', failedEmails(b)),
          historySection(b))),
    );
    setTitle(`Booking ${b.id}`);
  }

  void load();
}

function failedEmails(b: BookingDetail): HTMLElement {
  const entries = Object.entries(b.emails);
  if (entries.length === 0) return h('p', { class: 'muted' }, 'No emails recorded.');
  return h('ul', null, ...entries.map(([kind, e]) =>
    h('li', null, `${kind.replace(/_/g, ' ')}: `, e ? (e.status === 'failed' ? h('strong', null, 'Email not sent') : e.status) : '')));
}
