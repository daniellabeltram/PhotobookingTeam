import { h, uid } from '../../lib/dom';
import { selectField, textField, radioGroup, wrapControl } from '../../components/field';
import { icon } from '../../components/icons';
import { announce } from '../../components/live';
import { maxLength } from '../validation';
import { totalPeople } from '../intake-model';
import { peopleLabel } from '../format';
import { usd, type Form } from './form';

function bindText(form: Form, key: string, o: Parameters<typeof textField>[0]): HTMLElement {
  const f = textField({
    ...o,
    value: form.get(key),
    onInput: (v) => form.input(key, v),
    onBlur: () => form.blur(key),
  });
  form.register(key, { setError: f.setError, focus: () => f.control.focus() });
  return f.root;
}

export function bindTextField(form: Form, key: string, o: Parameters<typeof textField>[0]): HTMLElement {
  return bindText(form, key, o);
}

export function bindSelect(form: Form, key: string, o: Parameters<typeof selectField>[0]): HTMLElement {
  const f = selectField({
    ...o,
    value: form.get(key),
    onInput: (v) => { form.input(key, v); form.blur(key); },
  });
  form.register(key, { setError: f.setError, focus: () => f.control.focus() });
  return f.root;
}

export function bindRadios(form: Form, key: string, o: Omit<Parameters<typeof radioGroup>[0], 'name' | 'value' | 'onChange'>): HTMLFieldSetElement {
  const g = radioGroup({ ...o, name: key, value: form.get(key), onChange: (v) => { form.input(key, v); form.blur(key); } });
  form.register(key, { setError: g.setError, focus: () => (g.inputs.find((i) => i.checked) ?? g.inputs[0])?.focus() });
  return g.root;
}

export function aboutYou(form: Form): HTMLElement {
  const short = form.type.commonFieldsProfile === 'short';
  return h(
    'fieldset',
    null,
    h('legend', null, 'About you'),
    bindText(form, 'fullName', { label: 'Full name', autocomplete: 'name', maxlength: maxLength(form.config, 'fullName') }),
    bindText(form, 'email', { label: 'Email', type: 'email', autocomplete: 'email', inputmode: 'email', help: 'Your confirmation goes here.', maxlength: 254 }),
    bindText(form, 'phone', { label: 'Mobile phone', type: 'tel', inputmode: 'tel', autocomplete: 'tel', help: 'In case we need to reach you on the day.', maxlength: 40 }),
    short ? null : bindRadios(form, 'preferredContact', {
      legend: 'Best way to reach you',
      options: [{ value: 'email', label: 'Email' }, { value: 'text', label: 'Text' }, { value: 'call', label: 'Call' }],
    }),
  );
}

function counter(form: Form, key: 'adults' | 'children' | 'pets', label: string, total: HTMLElement, optional = false): HTMLElement {
  const id = uid(`cnt-${key}`);
  const input = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: '0', max: '50', step: '1' });
  input.value = form.get(key);
  const minus = h('button', { type: 'button', class: 'btn btn-secondary', 'aria-label': `Fewer ${key}` }, '−');
  const plus = h('button', { type: 'button', class: 'btn btn-secondary', 'aria-label': `More ${key}` }, '+');
  const sync = (): void => {
    form.input(key, input.value);
    total.textContent = peopleLabel(Number(form.get('adults')) || 0, Number(form.get('children')) || 0, Number(form.get('pets')) || 0);
  };
  const step = (delta: number): void => {
    const n = Math.min(50, Math.max(0, (Number(input.value) || 0) + delta));
    input.value = String(n);
    sync();
    form.blur(key);
  };
  minus.addEventListener('click', () => step(-1));
  plus.addEventListener('click', () => step(1));
  input.addEventListener('input', sync);
  input.addEventListener('blur', () => form.blur(key));
  const f = wrapControl(id, { label, optional }, input, h('div', { class: 'counter' }, minus, h('span', { class: 'sr-only' }), plus));
  // Move the number input between the two buttons for the visual layout.
  const row = f.root.querySelector('.counter');
  if (row && plus.parentElement === row) row.insertBefore(input, plus);
  form.register(key, { setError: f.setError, focus: () => input.focus() });
  return f.root;
}

export function yourSession(form: Form): HTMLElement {
  const { type } = form;
  const total = h('p', { class: 'help', 'aria-live': 'polite' }, peopleLabel(Number(form.get('adults')) || 0, Number(form.get('children')) || 0, Number(form.get('pets')) || 0));
  let limit = '';
  if (type.maxPeople !== null) {
    limit = `Up to ${type.maxPeople} people.`;
    if (type.extraPersonFeeCents !== null) limit += ` Extra people are ${usd(type.extraPersonFeeCents)} each.`;
  }
  const fs = h(
    'fieldset',
    null,
    h('legend', null, 'Your session'),
    bindText(form, 'subjectsNames', { label: "Who's being photographed?", rows: 2, help: 'First names are perfect.', maxlength: maxLength(form.config, 'subjectsNames') }),
    h('div', { class: 'counter-grid' },
      counter(form, 'adults', 'Adults', total),
      counter(form, 'children', 'Children', total),
      counter(form, 'pets', 'Pets', total, type.commonFieldsProfile === 'short'),
    ),
    total,
    limit ? h('p', { class: 'help' }, limit) : null,
    location(form),
  );
  return fs;
}

function location(form: Form): HTMLElement | null {
  const { type } = form;
  if (type.kind === 'mini') {
    const label = form.ctx.state.miniLabel;
    return label ? h('p', null, h('strong', null, 'Where: '), label) : null;
  }
  const options: { value: string; label: string }[] = [];
  if (type.locationOptions.length) options.push({ value: 'suggested', label: 'Pick a favorite spot' });
  if (type.allowOwnLocation) options.push({ value: 'own', label: 'Enter my own' });
  if (type.allowHelpMeChoose) options.push({ value: 'help_me_choose', label: 'Help me choose' });

  const spot = bindSelect(form, 'locationOptionId', {
    label: 'Choose a spot', placeholder: 'Choose a spot',
    options: type.locationOptions.map((o) => ({ value: o.id, label: o.label })),
    help: 'Beach sessions are best near sunrise.',
  });
  const own = bindTextField(form, 'locationText', {
    label: 'Address or place name', autocomplete: 'street-address', maxlength: maxLength(form.config, 'locationText'),
    help: "Venues you choose need Daniella's approval. Some venues need a permit, and that fee is yours.",
  });
  const help = h('p', null, icon('check', 16), ' Great, Daniella will suggest her favorites after you book.');
  const panels: Record<string, HTMLElement> = { suggested: spot, own, help_me_choose: help };
  const sync = (): void => {
    const kind = form.get('locationKind');
    for (const [k, el] of Object.entries(panels)) el.hidden = k !== kind;
  };
  const group = bindRadios(form, 'locationKind', {
    legend: 'Where would you like to meet?',
    options,
    // Keep panels in step with the radios.
  });
  group.addEventListener('change', () => { sync(); announce('Location options updated.'); });
  sync();
  return h('div', null, group, spot, own, help);
}

export function notes(form: Form): HTMLElement {
  const short = form.type.commonFieldsProfile === 'short';
  return h(
    'fieldset',
    null,
    h('legend', null, short ? 'A little more' : 'Style and notes'),
    short ? null : bindText(form, 'styleNotes', { label: 'Style and mood', optional: true, rows: 3, help: 'Bright and airy, golden hour, candid, editorial... anything goes.', maxlength: maxLength(form.config, 'styleNotes') }),
    short ? null : bindText(form, 'mustHaveShots', { label: 'Must-have photos or groupings', optional: true, rows: 3, help: 'Grandma with all the grandkids, a special place...', maxlength: maxLength(form.config, 'mustHaveShots') }),
    bindText(form, 'anythingElse', { label: 'Anything else we should know?', optional: true, rows: 3, help: 'Shy kids, mobility needs, sensory needs, allergies. Anything that helps.', maxlength: maxLength(form.config, 'anythingElse') }),
    bindSelect(form, 'heardAbout', {
      label: 'How did you hear about us?', optional: true, placeholder: 'Choose one',
      options: ['Instagram', 'Google', 'A friend or family', 'Previous client', 'Other'].map((v) => ({ value: v, label: v })),
    }),
    !short && form.config.features.portfolioOptOutEnabled ? portfolio(form) : null,
  );
}

function portfolio(form: Form): HTMLElement {
  const box = h('input', { type: 'checkbox', checked: form.get('portfolioOptOut') === 'true' });
  box.addEventListener('change', () => form.set('portfolioOptOut', String(box.checked)));
  return h(
    'div',
    { class: 'field' },
    h('label', { class: 'choice' }, box, h('span', null, "Please don't share my photos in Daniella's portfolio or marketing ", h('span', { class: 'optional' }, '(optional)'))),
    h('p', { class: 'help' }, 'You can change your mind later.'),
  );
}

export { totalPeople };
