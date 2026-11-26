import { h } from '../lib/dom';
import { icon } from '../components/icons';
import { STEP_TITLES, type StepNo } from './flow-state';
import type { FlowCtx } from './context';

export function stepHeading(text: string): HTMLElement {
  return h('h1', { id: 'step-heading', tabindex: '-1' }, text);
}

export function progress(step: StepNo): HTMLElement {
  const items: HTMLElement[] = [];
  for (const n of [1, 2, 3, 4, 5] as StepNo[]) {
    items.push(
      h('li', {
        'data-done': n < step,
        'aria-current': n === step ? 'step' : null,
      }, h('span', { class: 'sr-only' }, `Step ${n}: ${STEP_TITLES[n]}${n < step ? ', done' : ''}`)),
    );
  }
  return h(
    'div',
    null,
    h('p', { class: 'progress-text' }, `Step ${step} of 5 · ${STEP_TITLES[step]}`),
    h('ol', { class: 'progress progress-dots', 'aria-label': 'Booking progress' }, ...items),
  );
}

export function backRow(ctx: FlowCtx, to: StepNo, label = 'Back'): HTMLElement {
  return h(
    'div',
    { class: 'back-row' },
    h('button', { type: 'button', class: 'btn-link', onClick: () => ctx.go(to) }, icon('left', 18), label),
  );
}

/** "Families · 60 min · from $450" with a Change link back to step 1 or 2. */
export function summaryStrip(text: string, onChange: () => void, changeLabel = 'Change'): HTMLElement {
  return h(
    'div',
    { class: 'summary-strip' },
    h('p', null, text),
    h('button', { type: 'button', class: 'btn-link', onClick: onChange }, changeLabel),
  );
}
