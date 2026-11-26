// Builds mailto:, tel: and sms: links only from validated values. Free text never becomes an href.
import { EMAIL_RE, normalizePhone } from '../booking/validation';

export function mailtoHref(email: string | null | undefined): string | null {
  const e = (email ?? '').trim();
  return EMAIL_RE.test(e) && e.length <= 254 ? `mailto:${encodeURIComponent(e).replace('%40', '@')}` : null;
}

/** E.164 for US 10-digit numbers, "+digits" as given for international ones. */
export function e164(phone: string | null | undefined): string | null {
  const n = normalizePhone(phone ?? '');
  if (!n) return null;
  return n.startsWith('+') ? n : `+1${n}`;
}

export function telHref(phone: string | null | undefined): string | null {
  const n = e164(phone);
  return n ? `tel:${encodeURIComponent(n).replace('%2B', '+')}` : null;
}

export function smsHref(phone: string | null | undefined): string | null {
  const n = e164(phone);
  return n ? `sms:${encodeURIComponent(n).replace('%2B', '+')}` : null;
}

/** "(561) 555-0123" for US numbers; other values are shown as typed. */
export function formatPhone(phone: string | null | undefined): string {
  const n = normalizePhone(phone ?? '');
  if (n && /^\d{10}$/.test(n)) return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  return phone ?? '';
}
