import { emailLink } from '../../components/links';
import { h } from '../../lib/dom';
import { icon } from '../../components/icons';
import { enableRadioKeys, setInitialTabStop } from '../../components/roving';
import { announce } from '../../components/live';
import { stepHeading, progress } from '../chrome';
import { badgeFor, depositLine, isBookable, miniDatesLine, lengthAndPrice } from '../format';
import { selectSessionType, findType } from '../flow-state';
import type { FlowCtx } from '../context';
import type { PublicSessionType } from '../../lib/types';

function orderedTypes(types: PublicSessionType[]): PublicSessionType[] {
  const order = ['portraits', 'couples', 'families', 'events', 'holiday-minis'];
  return [...types].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export function renderTypeStep(ctx: FlowCtx): HTMLElement {
  const { config } = ctx;
  const heading = stepHeading('Choose your session');
  const root = h('div', null, progress(1), heading);

  const types = orderedTypes(config.sessionTypes);
  if (types.length === 0) {
    root.append(
      h('h2', null, 'Bookings are paused right now'),
      h('p', null, 'Please check back soon, or email ', emailLink(config.business.contactEmail), " and we'll sort something out."),
    );
    return root;
  }

  root.append(h('p', null, "Pick the experience that fits. You'll choose a date next."));
  if (ctx.notice) {
    root.append(h('div', { class: 'alert alert-info', role: 'status' }, ctx.notice));
    ctx.notice = null;
  }

  const selected = { id: ctx.state.sessionTypeId };
  const cards: HTMLElement[] = [];
  const list = h('div', { class: 'type-list', role: 'radiogroup', 'aria-labelledby': 'step-heading' });
  const helper = h('p', { class: 'help', id: 'continue-help' }, 'Choose a session to continue');
  const next = h('button', { type: 'button', class: 'btn btn-primary btn-block', 'aria-describedby': 'continue-help' }, 'Continue');

  const syncNext = (): void => {
    const ok = selected.id !== null;
    next.setAttribute('aria-disabled', String(!ok));
    helper.hidden = ok;
  };

  const choose = (type: PublicSessionType, card: HTMLElement): void => {
    if (!isBookable(type)) return;
    selected.id = type.id;
    for (const c of cards) c.setAttribute('aria-checked', String(c === card));
    setInitialTabStop(cards);
    const res = selectSessionType(ctx.state, type);
    if (res.clearedSlot) ctx.notice = 'We cleared your time because it belongs to a different session. Please pick again.';
    ctx.update(() => res.state);
    syncNext();
    announce(`${type.name} selected.`);
  };

  for (const type of types) {
    const bookable = isBookable(type);
    const badge = badgeFor(type);
    const nameId = `type-${type.id}-name`;
    const descId = `type-${type.id}-desc`;
    const minisLine = miniDatesLine(type);
    const card = h(
      'div',
      {
        class: 'type-card', role: 'radio', 'data-type': type.id,
        'aria-checked': String(selected.id === type.id),
        'aria-disabled': bookable ? null : 'true',
        'aria-labelledby': nameId, 'aria-describedby': descId,
      },
      h('div', { class: 'type-photo', 'aria-hidden': 'true' }),
      h('span', { class: 'type-check', 'aria-hidden': 'true' }, icon('check', 18)),
      h(
        'div',
        { class: 'type-body' },
        h('h2', { id: nameId }, type.name, badge ? h('span', { class: `chip type-badge ${badge.text === 'Sold out' ? 'chip-neutral' : 'chip-info'}` }, badge.text) : null),
        h(
          'div',
          { id: descId },
          h('p', null, type.description),
          h('p', null, h('strong', null, lengthAndPrice(type, type.durationMin))),
          h('p', null, depositLine(type)),
          minisLine ? h('p', null, minisLine) : null,
          type.included.length ? h('ul', { class: 'type-includes' }, ...type.included.map((i) => h('li', null, i))) : null,
        ),
      ),
    );
    card.addEventListener('click', () => choose(type, card));
    cards.push(card);
    list.append(card);
  }
  enableRadioKeys(cards, (el) => {
    const t = findType(config, el.getAttribute('data-type'));
    if (t) choose(t, el);
  });
  setInitialTabStop(cards);

  next.addEventListener('click', () => {
    if (!selected.id) {
      helper.hidden = false;
      return;
    }
    ctx.go(2);
  });
  syncNext();
  root.append(list, helper, next);
  return root;
}
