import { emailLink } from '../../components/links';
import { h } from '../../lib/dom';
import { longDayYear } from '../../lib/calendar-math';
import { etDateOf } from '../../lib/datetime';
import { announce } from '../../components/live';
import { progress, stepHeading } from '../chrome';
import { durationLabel, TIPS } from '../format';
import type { BookingResult } from '../../lib/types';
import type { FlowCtx } from '../context';

/** Only https links (or same-origin paths) from the API are turned into hrefs. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^\/[^/\\]/.test(url)) return url;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function newTabLink(href: string, text: string, cls: string): HTMLElement {
  return h('a', { class: cls, href, target: '_blank', rel: 'noopener noreferrer' }, text, h('span', { class: 'sr-only' }, ' (opens in new tab)'));
}

function bookingCard(r: BookingResult, isRequest: boolean): HTMLElement {
  const date = longDayYear(etDateOf(r.startUtc));
  const row = (k: string, v: string | HTMLElement): HTMLElement[] => [h('dt', null, k), h('dd', null, v)];
  const copyBtn = h('button', { type: 'button', class: 'btn-link' }, 'Copy reference');
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard?.writeText(r.reference).then(() => announce('Reference copied.'), () => announce('Could not copy. Please select the reference and copy it.'));
  });
  return h('div', { class: 'card dl-card' },
    h('dl', null,
      ...row('Session', r.sessionTypeName),
      ...row('Date', r.display.date || date),
      ...row('Time', `${r.display.timeRange.replace(/ ET$/, '')} Eastern Time`),
      ...row('Length', durationLabel(r.durationMin)),
      ...row('Where', r.locationLabel || 'Daniella will suggest spots by email'),
      ...(isRequest ? row('Status', "Waiting for Daniella's approval") : []),
      ...row('Reference', h('span', { class: 'copy-row' }, h('span', null, r.reference), copyBtn))));
}

function nextStep(ctx: FlowCtx, r: BookingResult): HTMLElement | null {
  if (r.status === 'requested') {
    return h('section', { class: 'card' },
      h('h2', null, 'Your request is with Daniella'),
      h('p', null, `Your time is reserved while Daniella reviews your request. You'll hear back within ${r.requestResponseDays ?? ctx.config.scheduling.requestResponseDays} days. Your time isn't confirmed until then.`),
      h('p', null, 'No payment is due yet. If Daniella approves, you’ll get an email with your retainer link.'),
      r.amountDue.cents > 0 ? h('p', null, `Estimated retainer: ${r.amountDue.label} (due after approval).`) : null);
  }
  if (r.status !== 'pending_deposit' || !r.amountDue.dueNow) return null;
  const href = safeHref(r.paymentLinkUrl);
  return h('section', { class: 'card' },
    h('h2', null, 'Next step: secure your date'),
    h('p', null, r.holdHours ? `Your time is held for ${r.holdHours} hours. Pay ${r.amountDue.label} to confirm it.` : `Pay ${r.amountDue.label} to confirm your time.`),
    href ? newTabLink(href, r.amountDue.kind === 'full' ? 'Pay now' : 'Pay my retainer', 'btn btn-primary btn-block')
      : h('p', null, 'Daniella will email your payment link shortly.'),
    h('p', { class: 'help' }, 'Paid already? Daniella will confirm within a day.'));
}

export function renderConfirmationStep(ctx: FlowCtx): HTMLElement {
  const conf = ctx.confirmation;
  const restart = (): void => ctx.restart();
  if (!conf) {
    return h('div', null, progress(5), stepHeading('Looking for your booking?'),
      h('p', null, 'Check your email for your confirmation and reference number.'),
      h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: restart }, 'Book a session'));
  }
  const r = conf.result;
  const isRequest = r.status === 'requested';
  const title = isRequest ? 'Request received — not confirmed yet'
    : conf.firstName ? `You're booked, ${conf.firstName}!` : "You're booked!";
  const cal = safeHref(r.calendarUrl);
  const tips = TIPS[r.sessionTypeId] ?? [];
  const root = h('div', null, progress(5),
    stepHeading(title),
    h('p', { role: 'status' }, isRequest ? 'We received your request. A confirmation of your request is on its way by email.' : 'A confirmation is on its way to your email.'));
  if (!r.emailSent) {
    root.append(h('div', { class: 'alert alert-warning', role: 'status' },
      h('p', null, `We couldn't send your email just yet. Save your reference: ${r.reference}. Daniella has your booking.`)));
  }
  root.append(bookingCard(r, isRequest));
  const next = nextStep(ctx, r);
  if (next) root.append(next);
  if (cal && !isRequest) root.append(h('a', { class: 'btn btn-secondary btn-block', href: cal, download: '' }, 'Add to calendar (.ics file)'));
  if (tips.length && !isRequest) {
    root.append(h('h2', { class: 'group-title' }, 'What to wear and bring'),
      h('ul', null, ...tips.map((t) => h('li', null, t))),
      h('p', { class: 'small muted' }, 'More tips are in your email.'));
  }
  root.append(
    h('p', null, 'Need to change something? Reply to your email or write ', emailLink(ctx.config.business.contactEmail), '.'),
    h('button', { type: 'button', class: 'btn-link', onClick: restart }, 'Book another session'),
  );
  return root;
}

export function renderAlreadyBooked(ctx: FlowCtx): HTMLElement {
  return h('div', null, stepHeading('This booking is already made'),
    h('p', null, 'Start a new booking?'),
    h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => ctx.restart() }, 'Start a new booking'),
    h('button', { type: 'button', class: 'btn-link', onClick: () => ctx.go(5) }, 'Back to my confirmation'));
}
