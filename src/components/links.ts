import { h } from '../lib/dom';
import { mailtoHref, telHref, formatPhone } from '../lib/links';

/** A mailto link when the address is valid; plain text otherwise. */
export function emailLink(email: string | null | undefined): HTMLElement {
  const href = mailtoHref(email);
  return href ? h('a', { href }, email) : h('span', null, email ?? '');
}

export function phoneLink(phone: string | null | undefined): HTMLElement {
  const href = telHref(phone);
  return href ? h('a', { href }, formatPhone(phone)) : h('span', null, phone ?? '');
}
