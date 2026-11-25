import { h, type Child } from '../lib/dom';

export function alertBox(kind: 'error' | 'success' | 'warning' | 'info', heading: string | null, ...body: Child[]): HTMLElement {
  return h(
    'div',
    { class: `alert alert-${kind}`, role: kind === 'error' ? 'alert' : 'status' },
    heading ? h('h2', null, heading) : null,
    ...body,
  );
}

/** Offline / timeout banner with a retry button. */
export function networkBanner(onRetry: () => void, message = "We can't reach the server. Check your connection and try again."): HTMLElement {
  return h(
    'div',
    { class: 'alert alert-error', role: 'alert' },
    h('p', null, message),
    h('button', { type: 'button', class: 'btn btn-secondary', onClick: onRetry }, 'Try again'),
  );
}

export function skeletons(count: number, label: string): HTMLElement {
  const wrap = h('div', { 'aria-busy': 'true' }, h('span', { class: 'sr-only', role: 'status' }, label));
  for (let i = 0; i < count; i++) wrap.append(h('div', { class: 'skeleton', 'aria-hidden': 'true' }));
  return wrap;
}
