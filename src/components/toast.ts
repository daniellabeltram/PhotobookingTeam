import { h } from '../lib/dom';
import { announce } from './live';

let host: HTMLElement | null = null;

function ensureHost(): HTMLElement {
  if (host?.isConnected) return host;
  host = h('div', { class: 'toasts' });
  document.body.append(host);
  return host;
}

/** Visible for at least 8 seconds, dismissible, pauses on hover and focus. The message is also announced. */
export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  const container = ensureHost();
  let timer = 0;
  const remove = (): void => { window.clearTimeout(timer); node.remove(); };
  const start = (): void => { window.clearTimeout(timer); timer = window.setTimeout(remove, 8000); };
  const close = h('button', { type: 'button', 'aria-label': 'Dismiss message', onClick: remove }, '×');
  const node = h('div', { class: `toast ${kind === 'error' ? 'toast-error' : ''}` }, h('span', null, message), close);
  node.addEventListener('mouseenter', () => window.clearTimeout(timer));
  node.addEventListener('mouseleave', start);
  node.addEventListener('focusin', () => window.clearTimeout(timer));
  node.addEventListener('focusout', start);
  container.append(node);
  announce(message);
  start();
}
