import { h } from '../../lib/dom';
import { maxLength } from '../validation';
import { bindRadios, bindSelect, bindTextField } from './common';
import { usd, type Form } from './form';

const yesNo = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];

function couples(form: Form): HTMLElement {
  const surpriseHelp = h('p', { class: 'help', 'aria-live': 'polite' });
  const syncHelp = (): void => {
    surpriseHelp.textContent = form.get('couples.surpriseProposal') === 'yes'
      ? "Lovely! We'll keep it between us. Daniella will only message you, not your partner."
      : '';
  };
  const group = bindRadios(form, 'couples.surpriseProposal', { legend: 'Is this a surprise proposal?', options: yesNo });
  group.addEventListener('change', syncHelp);
  syncHelp();
  return h(
    'fieldset', null,
    h('legend', null, 'About your couples session'),
    bindSelect(form, 'couples.occasion', {
      label: "What's the occasion?", placeholder: 'Choose one',
      options: [
        { value: 'engagement', label: 'Engagement' }, { value: 'anniversary', label: 'Anniversary' },
        { value: 'just_because', label: 'Just because' }, { value: 'other', label: 'Other' },
      ],
    }),
    group,
    surpriseHelp,
  );
}

function families(form: Form): HTMLElement {
  const t = form.type;
  const extendedHelp = t.maxPeople !== null && t.extraPersonFeeCents !== null
    ? `Groups over ${t.maxPeople} are ${usd(t.extraPersonFeeCents)} per extra person.`
    : undefined;
  return h(
    'fieldset', null,
    h('legend', null, 'About your family session'),
    bindTextField(form, 'families.childrenAges', {
      label: "Children's ages", optional: true, help: 'For example: 3 and 7.', maxlength: maxLength(form.config, 'families.childrenAges'),
    }),
    bindRadios(form, 'families.extendedFamily', { legend: 'Will extended family join?', options: yesNo, help: extendedHelp }),
  );
}

function events(form: Form): HTMLElement {
  const m = (k: string): number => maxLength(form.config, k);
  return h(
    'fieldset', null,
    h('legend', null, 'About your event'),
    bindTextField(form, 'events.eventName', { label: 'Event name', maxlength: m('events.eventName') }),
    bindSelect(form, 'events.eventType', {
      label: 'Type of event', placeholder: 'Choose one',
      options: ['Birthday', 'Shower', 'Corporate', 'Celebration', 'Other'].map((v) => ({ value: v, label: v })),
    }),
    bindTextField(form, 'events.venueAddress', { label: 'Venue name and address', autocomplete: 'street-address', maxlength: m('events.venueAddress') }),
    bindTextField(form, 'events.eventStartTime', { label: 'Start time', type: 'time', help: 'Your session starts at this time.' }),
    bindTextField(form, 'events.eventEndTime', { label: 'End time', type: 'time', help: 'Your session ends at this time.' }),
    bindTextField(form, 'events.guestCount', { label: 'Expected guests', type: 'number', inputmode: 'numeric' }),
    bindTextField(form, 'events.onsiteContactName', { label: 'On-site contact name', optional: !form.required('events.onsiteContactName'), maxlength: m('events.onsiteContactName') }),
    bindTextField(form, 'events.onsiteContactPhone', { label: 'On-site contact phone', optional: !form.required('events.onsiteContactPhone'), type: 'tel', inputmode: 'tel' }),
    bindTextField(form, 'events.timeline', { label: 'Timeline or must-have moments', optional: !form.required('events.timeline'), rows: 3, help: 'Cake cutting at 4, toast at 5...', maxlength: m('events.timeline') }),
  );
}

function minis(form: Form): HTMLElement {
  return h(
    'fieldset', null,
    h('legend', null, 'Holiday Minis'),
    bindTextField(form, 'minis.cardDeadline', {
      label: 'Do you need your photos by a card deadline?', optional: true, type: 'date',
      help: "We'll do our best to get them to you in time.",
    }),
  );
}

/** Type-specific groups, driven by the type's intakeExtraFields from the config. */
export function extraSections(form: Form): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (form.has('couples.occasion') || form.has('couples.surpriseProposal')) out.push(couples(form));
  if (form.has('families.extendedFamily') || form.has('families.childrenAges')) out.push(families(form));
  if (form.has('events.eventName')) out.push(events(form));
  if (form.has('minis.cardDeadline')) out.push(minis(form));
  return out;
}
