// One polite and one assertive live region per page. Announce by changing their text.
import { h } from '../lib/dom';

let polite: HTMLElement | null = null;
let assertive: HTMLElement | null = null;

export function mountLiveRegions(root: HTMLElement = document.body): void {
  if (polite) return;
  polite = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', id: 'live-polite' });
  assertive = h('div', { class: 'sr-only', role: 'alert', 'aria-live': 'assertive', 'aria-atomic': 'true', id: 'live-assertive' });
  root.append(polite, assertive);
}

function say(region: HTMLElement | null, message: string): void {
  if (!region) return;
  region.textContent = '';
  // Re-set on the next tick so repeated identical messages are still announced.
  window.setTimeout(() => { region.textContent = message; }, 30);
}

export const announce = (message: string): void => say(polite, message);
export const announceUrgent = (message: string): void => say(assertive, message);
