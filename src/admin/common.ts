import { h, clear } from '../lib/dom';
import { ApiError } from '../lib/api';
import { networkBanner } from '../components/banner';

export function setTitle(text: string): void {
  document.title = `${text} | Admin`;
}

export function pageHeading(text: string): HTMLElement {
  return h('h1', { id: 'page-heading', tabindex: '-1' }, text);
}

export function focusHeading(root: ParentNode = document): void {
  root.querySelector<HTMLElement>('#page-heading')?.focus();
}

/** Standard load-error block with a retry button. */
export function errorBlock(message: string, retry: () => void, err?: unknown): HTMLElement {
  if (err instanceof ApiError && err.isNetwork) return networkBanner(retry, "We can't reach the server. Try again.");
  return h('div', { class: 'alert alert-error', role: 'alert' }, h('p', null, message),
    h('button', { type: 'button', class: 'btn btn-secondary', onClick: retry }, 'Try again'));
}

export function loadingBlock(label: string, rows = 3): HTMLElement {
  const wrap = h('div', { 'aria-busy': 'true' }, h('p', { role: 'status', class: 'muted' }, label));
  for (let i = 0; i < rows; i++) wrap.append(h('div', { class: 'skeleton', 'aria-hidden': 'true' }));
  return wrap;
}

export function replaceWith(host: HTMLElement, ...nodes: Node[]): void {
  clear(host);
  host.append(...nodes);
}

export const ACTION_ERROR = "That didn't work and nothing was changed. Please try again.";
