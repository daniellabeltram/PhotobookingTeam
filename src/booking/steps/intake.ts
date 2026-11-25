import { h, clear } from '../../lib/dom';
import { announceUrgent } from '../../components/live';
import { backRow, progress, stepHeading, summaryStrip } from '../chrome';
import { slotShort } from '../format';
import { orderedErrorKeys, type FieldErrors } from '../validation';
import { createForm } from '../intake/form';
import { aboutYou, notes, yourSession } from '../intake/common';
import { extraSections } from '../intake/extras';
import type { FlowCtx } from '../context';

const LABELS: Record<string, string> = {
  fullName: 'Full name', email: 'Email', phone: 'Mobile phone', preferredContact: 'Best way to reach you',
  subjectsNames: "Who's being photographed", adults: 'Number of people', children: 'Children', pets: 'Pets',
  locationKind: 'Where to meet', locationOptionId: 'Spot', locationText: 'Location',
  'couples.occasion': 'Occasion', 'couples.surpriseProposal': 'Surprise proposal', 'families.childrenAges': "Children's ages",
  'families.extendedFamily': 'Extended family', 'events.eventName': 'Event name', 'events.eventType': 'Type of event',
  'events.venueAddress': 'Venue', 'events.eventStartTime': 'Start time', 'events.eventEndTime': 'End time',
  'events.guestCount': 'Guests',
};

export function renderIntakeStep(ctx: FlowCtx): HTMLElement {
  const type = ctx.type;
  if (!type || !ctx.state.slot) return h('div');
  const form = createForm(ctx, type);
  const summary = h('div', { tabindex: '-1', class: 'error-summary' });
  const root = h('div', null, backRow(ctx, 2), progress(3), summaryStrip(`${type.name} · ${slotShort(ctx.state.slot)}`, () => ctx.go(2)), stepHeading('Tell us about your session'));
  root.append(h('p', null, 'A few quick questions so Daniella can plan the perfect shoot. Takes about 2 minutes.'));

  function showSummary(errors: FieldErrors): void {
    clear(summary);
    const keys = orderedErrorKeys(errors).filter((k) => k !== '_form');
    if (keys.length === 0 && !errors['_form']) return;
    summary.className = 'alert alert-error error-summary';
    summary.setAttribute('role', 'alert');
    const count = keys.length;
    summary.append(h('h2', null, count > 0 ? `Please fix ${count} ${count === 1 ? 'thing' : 'things'} to continue` : "We couldn't save that"));
    if (errors['_form']) summary.append(h('p', null, errors['_form']));
    if (count > 0) {
      summary.append(h('ul', null, ...keys.map((k) => h('li', null, h('button', { type: 'button', class: 'btn-link', onClick: () => form.focusKey(k) }, `${LABELS[k] ?? k}: ${errors[k]}`)))));
    }
    summary.focus();
    announceUrgent(`Please fix ${count} ${count === 1 ? 'thing' : 'things'} to continue.`);
  }

  const formEl = h('form', { novalidate: true, autocomplete: 'on' });
  formEl.append(aboutYou(form), yourSession(form), ...extraSections(form), notes(form));
  const next = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Continue');
  formEl.append(
    h('p', { class: 'small muted' }, 'We use your details only to plan and deliver your session. ',
      h('a', { href: '/privacy.html', target: '_blank', rel: 'noopener' }, 'Privacy notice', h('span', { class: 'sr-only' }, ' (opens in new tab)'))),
    next,
  );
  formEl.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const errs = form.errors();
    if (Object.keys(errs).length === 0) {
      ctx.go(4);
      return;
    }
    form.showAll(errs);
    showSummary(errs);
  });

  root.append(summary, formEl);
  if (ctx.pendingErrors) {
    const errs = ctx.pendingErrors;
    ctx.pendingErrors = null;
    form.showAll(errs);
    showSummary(errs);
  }
  return root;
}
