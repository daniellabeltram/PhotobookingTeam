// Labelled form controls with helper and error text wired up through aria-describedby.
import { h, uid, type Child } from '../lib/dom';
import { icon } from './icons';

export type FieldOptions = {
  id?: string;
  label: string;
  optional?: boolean;
  help?: string;
  type?: string;
  inputmode?: string;
  autocomplete?: string;
  maxlength?: number;
  value?: string;
  rows?: number;
  required?: boolean;
  onInput?: (value: string) => void;
  onBlur?: (value: string) => void;
};

export type FieldHandle = {
  root: HTMLElement;
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  setError: (message: string | null) => void;
};

function labelNode(text: string, optional?: boolean): Child[] {
  return [text, optional ? h('span', { class: 'optional' }, ' (optional)') : null];
}

/** Wraps any control in the standard label / help / error structure. */
export function wrapControl(
  id: string,
  opts: { label: string; optional?: boolean; help?: string },
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  extra?: Child,
): FieldHandle {
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  const errorBox = h('p', { class: 'error-text', id: errId, hidden: true });
  const describedBy = [opts.help ? helpId : '', errId].filter(Boolean).join(' ');
  control.setAttribute('aria-describedby', describedBy);
  control.id = id;
  const root = h(
    'div',
    { class: 'field', 'data-field': id },
    h('label', { for: id }, ...labelNode(opts.label, opts.optional)),
    control,
    extra,
    opts.help ? h('p', { class: 'help', id: helpId }, opts.help) : null,
    errorBox,
  );
  return {
    root,
    control,
    setError(message) {
      errorBox.textContent = '';
      if (message) {
        errorBox.append(icon('alert', 16), h('span', null, message));
        errorBox.hidden = false;
        control.setAttribute('aria-invalid', 'true');
      } else {
        errorBox.hidden = true;
        control.removeAttribute('aria-invalid');
      }
    },
  };
}

export function textField(o: FieldOptions): FieldHandle {
  const id = o.id ?? uid('f');
  const multiline = o.rows !== undefined;
  const control = multiline
    ? h('textarea', { class: 'input', rows: o.rows, maxlength: o.maxlength })
    : h('input', {
        class: 'input',
        type: o.type ?? 'text',
        inputmode: o.inputmode,
        autocomplete: o.autocomplete,
        maxlength: o.maxlength,
      });
  control.value = o.value ?? '';
  if (o.onInput) control.addEventListener('input', () => o.onInput?.(control.value));
  if (o.onBlur) control.addEventListener('blur', () => o.onBlur?.(control.value));
  const count =
    multiline && o.maxlength
      ? h('p', { class: 'help char-count', 'aria-hidden': 'true' }, `${control.value.length} / ${o.maxlength}`)
      : null;
  if (count && o.maxlength) {
    control.addEventListener('input', () => { count.textContent = `${control.value.length} / ${o.maxlength}`; });
  }
  return wrapControl(id, o, control, count);
}

export function selectField(
  o: Omit<FieldOptions, 'rows' | 'type'> & { options: { value: string; label: string }[]; placeholder?: string },
): FieldHandle {
  const id = o.id ?? uid('f');
  const control = h('select', { class: 'input' });
  if (o.placeholder !== undefined) control.append(h('option', { value: '' }, o.placeholder));
  for (const opt of o.options) control.append(h('option', { value: opt.value }, opt.label));
  control.value = o.value ?? '';
  if (o.onInput) control.addEventListener('change', () => o.onInput?.(control.value));
  if (o.onBlur) control.addEventListener('blur', () => o.onBlur?.(control.value));
  return wrapControl(id, o, control);
}

export type ChoiceGroup = {
  root: HTMLFieldSetElement;
  inputs: HTMLInputElement[];
  setError: (message: string | null) => void;
};

/** Radio group in a fieldset with a legend. */
export function radioGroup(o: {
  name: string;
  legend: string;
  optional?: boolean;
  help?: string;
  value: string;
  options: { value: string; label: string; help?: string }[];
  onChange: (value: string) => void;
}): ChoiceGroup {
  const errId = uid('rg-err');
  const helpId = uid('rg-help');
  const errorBox = h('p', { class: 'error-text', id: errId, hidden: true });
  const inputs: HTMLInputElement[] = [];
  const row = h('div', { class: 'choice-row' });
  for (const opt of o.options) {
    const input = h('input', { type: 'radio', name: o.name, value: opt.value, checked: opt.value === o.value });
    input.setAttribute('aria-describedby', [o.help ? helpId : '', errId].filter(Boolean).join(' '));
    input.addEventListener('change', () => { if (input.checked) o.onChange(opt.value); });
    inputs.push(input);
    row.append(h('label', { class: 'choice' }, input, h('span', null, opt.label)));
  }
  const root = h(
    'fieldset',
    { 'data-field': o.name },
    h('legend', null, ...labelNode(o.legend, o.optional)),
    row,
    o.help ? h('p', { class: 'help', id: helpId }, o.help) : null,
    errorBox,
  );
  return {
    root,
    inputs,
    setError(message) {
      errorBox.textContent = '';
      errorBox.hidden = !message;
      if (message) errorBox.append(icon('alert', 16), h('span', null, message));
      for (const i of inputs) {
        if (message) i.setAttribute('aria-invalid', 'true');
        else i.removeAttribute('aria-invalid');
      }
    },
  };
}
