import { h, clear, uid } from '../../lib/dom';
import { getPolicy, ApiError } from '../../lib/api';
import { longDayYear } from '../../lib/calendar-math';
import type { Slot } from '../../lib/types';
import { icon } from '../../components/icons';
import { announce, announceUrgent } from '../../components/live';
import { backRow, progress, stepHeading } from '../chrome';
import { depositLine, peopleLabel, policySummaryLines, slotShort } from '../format';
import { selectSlot } from '../flow-state';
import { submitBooking, type SubmitOutcome } from '../submit';
import type { FlowCtx } from '../context';

function locationText(ctx: FlowCtx): string {
  const a = ctx.state.intake;
  const t = ctx.type;
  if (t?.kind === 'mini') return ctx.state.miniLabel ?? 'Set by Daniella for the mini day';
  if (a['locationKind'] === 'suggested') return t?.locationOptions.find((o) => o.id === a['locationOptionId'])?.label ?? '';
  if (a['locationKind'] === 'own') return a['locationText'] ?? '';
  return 'Daniella will suggest spots';
}

function summaryCard(ctx: FlowCtx): HTMLElement {
  const t = ctx.type!;
  const slot = ctx.state.slot!;
  const a = ctx.state.intake;
  const row = (k: string, v: string): HTMLElement[] => [h('dt', null, k), h('dd', null, v)];
  return h('div', { class: 'card dl-card' }, h('h2', { class: 'group-title' }, 'Your booking'),
    h('dl', null,
      ...row('Session', t.name),
      ...row('Date', longDayYear(slot.localDate)),
      ...row('Time', `${slot.rangeLabel.replace(/ ET$/, '')} Eastern Time`),
      ...row('Where', locationText(ctx)),
      ...row('Who', peopleLabel(Number(a['adults']) || 0, Number(a['children']) || 0, Number(a['pets']) || 0)),
      ...row('Price', t.price.label),
      ...row('Deposit', depositLine(t)),
    ));
}

function variantLines(ctx: FlowCtx): string[] {
  const t = ctx.type!;
  if (t.bookingMode === 'request') {
    return [`This is a request. You won't be charged now. If Daniella approves, you'll get a link for the retainer (${t.deposit.text}).`];
  }
  if (t.deposit.kind === 'full') {
    return [`${t.name} is paid in full (${t.price.label.replace(/^from /, '')}) to book.`];
  }
  return [];
}

export function renderPoliciesStep(ctx: FlowCtx): HTMLElement {
  const t = ctx.type;
  if (!t || !ctx.state.slot) return h('div');
  const lines = [...variantLines(ctx), ...policySummaryLines(ctx.config, t)];
  const checkId = uid('agree');
  const errId = uid('agree-err');
  const alertHost = h('div', { tabindex: '-1' });
  const status = h('div', { role: 'status' });
  const error = h('p', { class: 'error-text', id: errId, hidden: true });
  const box = h('input', { type: 'checkbox', id: checkId, checked: ctx.state.policyAccepted });
  box.setAttribute('aria-describedby', errId);
  const honeypot = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' });
  const label = request(t.bookingMode);
  const submit = h('button', { type: 'button', class: 'btn btn-primary btn-block' }, label);
  let sending = false;

  function setCheckError(msg: string | null): void {
    clear(error);
    error.hidden = !msg;
    if (msg) error.append(icon('alert', 16), h('span', null, msg));
    if (msg) box.setAttribute('aria-invalid', 'true');
    else box.removeAttribute('aria-invalid');
  }
  box.addEventListener('change', () => {
    ctx.update((s) => ({ ...s, policyAccepted: box.checked }));
    if (box.checked) setCheckError(null);
  });

  // ----- full policy disclosure -----
  const bodyId = uid('policy-full');
  const full = h('div', { id: bodyId, class: 'disclosure-body', hidden: true });
  const toggle = h('button', { type: 'button', class: 'btn btn-secondary', 'aria-expanded': 'false', 'aria-controls': bodyId }, 'Read the full policies');
  let loadedFull = false;
  toggle.addEventListener('click', async () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    full.hidden = !open;
    if (!open || loadedFull) return;
    full.append(h('p', { role: 'status' }, 'Loading...'));
    try {
      const doc = await getPolicy(ctx.config.policy.version);
      clear(full);
      for (const s of doc.sections) full.append(h('h3', null, s.heading), ...s.paragraphs.map((p) => h('p', null, p)));
      full.append(h('p', null, h('a', { href: `/policies.html?version=${encodeURIComponent(doc.version)}`, target: '_blank', rel: 'noopener' }, 'Open in a new page', h('span', { class: 'sr-only' }, ' (opens in new tab)'))));
      loadedFull = true;
    } catch {
      clear(full);
      full.append(h('p', { role: 'alert' }, "We couldn't load the full policies. Please try again."));
    }
  });

  // ----- outcomes -----
  function showAlert(node: HTMLElement): void {
    clear(alertHost);
    alertHost.append(node);
    alertHost.focus();
  }
  function retryButton(): HTMLElement {
    return h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => { void send(); } }, 'Try again');
  }
  function swapSlot(alt: Slot): void {
    ctx.update((s) => selectSlot(s, alt, alt.localDate, s.miniLabel));
    ctx.notice = `Time updated to ${slotShort(alt)}.`;
    announce(ctx.notice);
    ctx.rerender();
    window.setTimeout(() => document.querySelector<HTMLElement>('[data-submit]')?.focus(), 50);
  }
  function handle(o: SubmitOutcome): void {
    switch (o.kind) {
      case 'ok':
        ctx.go(5);
        return;
      case 'invalid_intake':
        if (o.errors['policyAccepted']) {
          setCheckError('Please agree to the policies to book your session.');
          box.focus();
          return;
        }
        ctx.pendingErrors = o.errors;
        ctx.go(3);
        return;
      case 'slot_taken': {
        const alts = o.alternatives.slice(0, 4);
        const node = h('div', { class: 'alert alert-error', role: 'alert' },
          h('h2', null, 'That time was just booked'),
          alts.length
            ? [h('p', null, 'Someone grabbed it a moment ago. Here are the closest open times:'),
               h('div', { class: 'alt-grid' }, ...alts.map((a) => h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => swapSlot(a) }, slotShort(a)))),
               h('button', { type: 'button', class: 'btn-link', onClick: () => ctx.go(2) }, 'See all dates')]
            : [h('p', null, 'No other times are open on nearby days. Pick another date.'),
               h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => ctx.go(2) }, 'Choose another date')]);
        showAlert(node);
        announceUrgent('That time was just booked.');
        return;
      }
      case 'policy_changed':
        void ctx.reloadConfig().then(() => {
          ctx.update((s) => ({ ...s, policyAccepted: false }));
          ctx.notice = 'We updated our policies while you were booking. Please review them and agree again.';
          ctx.rerender();
        });
        return;
      case 'rate_limited':
        showAlert(h('div', { class: 'alert alert-error', role: 'alert' }, h('p', null, o.message)));
        return;
      case 'busy':
        showAlert(h('div', { class: 'alert alert-error', role: 'alert' }, h('p', null, "We're a little busy right now. Please try again in a moment."), retryButton()));
        return;
      case 'unavailable':
        showAlert(h('div', { class: 'alert alert-error', role: 'alert' }, h('p', null, o.message), h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => ctx.go(1) }, 'Back to sessions')));
        return;
      case 'not_sure':
        showAlert(h('div', { class: 'alert alert-error', role: 'alert' },
          h('p', null, "We're not sure if that went through. Check your email for a confirmation before trying again."), retryButton()));
        return;
      case 'failed':
        showAlert(h('div', { class: 'alert alert-error', role: 'alert' }, h('p', null, o.message), retryButton()));
    }
  }

  async function send(): Promise<void> {
    if (sending) return;
    if (!box.checked) {
      setCheckError('Please agree to the policies to book your session.');
      box.focus();
      announceUrgent('Please agree to the policies to book your session.');
      return;
    }
    sending = true;
    clear(alertHost);
    submit.setAttribute('aria-disabled', 'true');
    submit.textContent = 'Booking...';
    status.textContent = 'Booking your session...';
    try {
      const outcome = await submitBooking(ctx, honeypot.value);
      status.textContent = '';
      handle(outcome);
    } catch (err) {
      status.textContent = '';
      handle({ kind: err instanceof ApiError && err.isNetwork ? 'not_sure' : 'failed', message: 'Something went wrong. Please try again.' } as SubmitOutcome);
    } finally {
      sending = false;
      submit.removeAttribute('aria-disabled');
      submit.textContent = label;
    }
  }
  submit.setAttribute('data-submit', '');
  submit.addEventListener('click', () => { void send(); });

  const root = h('div', null, backRow(ctx, 3), progress(4), stepHeading('Almost done. Please review our policies'));
  if (ctx.notice) { root.append(h('div', { class: 'alert alert-info', role: 'status' }, ctx.notice)); ctx.notice = null; }
  root.append(
    h('p', null, "Here's what to expect. No surprises."),
    alertHost,
    summaryCard(ctx),
    h('div', { class: 'link-row' },
      h('button', { type: 'button', class: 'btn-link', onClick: () => ctx.go(3) }, 'Edit details'),
      h('button', { type: 'button', class: 'btn-link', onClick: () => ctx.go(2) }, 'Change date')),
    h('h2', { class: 'group-title' }, 'Before you book'),
    h('ul', { class: 'policy-bullets' }, ...lines.map((l) => h('li', null, l))),
    h('div', { class: 'disclosure' }, toggle, full),
    h('p', { class: 'small' }, h('a', { href: '/privacy.html', target: '_blank', rel: 'noopener' }, 'Privacy notice', h('span', { class: 'sr-only' }, ' (opens in new tab)'))),
    h('div', { class: 'field' },
      h('label', { class: 'choice', for: checkId }, box, h('span', null, 'I have read and agree to the booking, cancellation and weather policies.')),
      error),
    h('div', { class: 'hp-field', 'aria-hidden': 'true' }, h('label', null, 'Website', honeypot)),
    submit,
    status,
    h('p', { class: 'help' }, afterNote(ctx)),
  );
  if (ctx.state.policyAccepted) setCheckError(null);
  return root;
}

function request(mode: 'instant' | 'request'): string {
  return mode === 'request' ? 'Send my request' : 'Book my session';
}

function afterNote(ctx: FlowCtx): string {
  const t = ctx.type!;
  if (t.bookingMode === 'request') return `Daniella will reply within ${ctx.config.scheduling.requestResponseDays} days.`;
  if (t.deposit.kind === 'full') return 'Next, you’ll pay in full to secure your spot.';
  if (t.deposit.kind === 'none') return '';
  return `Next, you’ll get a link to pay your retainer. Your time is held for ${ctx.config.scheduling.unpaidHoldHours} hours.`;
}
