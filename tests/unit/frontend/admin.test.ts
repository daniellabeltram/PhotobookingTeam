// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { h } from '../../../src/lib/dom';
import { mailtoHref, smsHref, telHref, e164 } from '../../../src/lib/links';
import { sanitizeReturnTarget } from '../../../src/admin/return-target';
import { dollarsToCents } from '../../../src/admin/format';
import { miniStartTimes } from '../../../src/admin/minis';
import { filtersFromQuery, queryFromFilters } from '../../../src/admin/list';
import { parseRoute } from '../../../src/admin/app';
import { safeHref } from '../../../src/booking/steps/confirmation';
import { base32, base64url, checkPassphrase, generateTotpSecret, hashPassphrase, otpauthUri } from '../../../src/admin/password-hash';

describe('h() helper', () => {
  it('renders user text as text, never as markup', () => {
    const el = h('p', null, '<img src=x onerror=alert(1)>');
    expect(el.children).toHaveLength(0);
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });
  it('sets aria and data booleans as "true"', () => {
    const el = h('button', { 'aria-pressed': true, 'data-open': true, 'aria-disabled': false });
    expect(el.getAttribute('aria-pressed')).toBe('true');
    expect(el.getAttribute('data-open')).toBe('true');
    expect(el.hasAttribute('aria-disabled')).toBe(false);
  });
});

describe('links from validated values only', () => {
  it('builds mailto, tel and sms from valid input', () => {
    expect(mailtoHref('ana@example.com')).toBe('mailto:ana@example.com');
    expect(telHref('(561) 555-0123')).toBe('tel:+15615550123');
    expect(smsHref('5615550123')).toBe('sms:+15615550123');
    expect(e164('+44 20 7946 0958')).toBe('+442079460958');
  });
  it('refuses free text and script-like values', () => {
    expect(mailtoHref('javascript:alert(1)')).toBeNull();
    expect(mailtoHref('a@b.co?bcc=evil@x.com')).toBeNull();
    expect(telHref('call me maybe')).toBeNull();
    expect(smsHref('')).toBeNull();
  });
  it('only lets https or same-origin API links become hrefs', () => {
    expect(safeHref('https://buy.stripe.com/x')).toBe('https://buy.stripe.com/x');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('//evil.example/x')).toBeNull();
    expect(safeHref('http://insecure.example')).toBeNull();
    expect(safeHref(null)).toBeNull();
  });
});

describe('admin return target', () => {
  it('accepts same-origin /admin/ paths', () => {
    expect(sanitizeReturnTarget('/admin/')).toBe('/admin/');
    expect(sanitizeReturnTarget('/admin/#/bookings/DBP-7K3F9Q')).toBe('/admin/#/bookings/DBP-7K3F9Q');
    expect(sanitizeReturnTarget('/admin/?x=1#/bookings?status=requested')).toContain('/admin/');
  });
  it('rejects everything else', () => {
    for (const bad of ['//evil.com', '/admin//evil.com', 'https://evil.com/admin/', '/\\evil.com', '/admin/\\x', 'javascript:alert(1)', '/administrator', '/admin', '', null, 5, '/admin/\n']) {
      expect(sanitizeReturnTarget(bad)).toBeNull();
    }
  });
});

describe('admin helpers', () => {
  it('parses money to cents strictly', () => {
    expect(dollarsToCents('150')).toBe(15000);
    expect(dollarsToCents('$150.50')).toBe(15050);
    expect(dollarsToCents('1.234')).toBeNull();
    expect(dollarsToCents('-5')).toBeNull();
    expect(dollarsToCents('abc')).toBeNull();
  });
  it('makes back-to-back mini start times', () => {
    expect(miniStartTimes('08:00', 4, 30)).toEqual(['08:00', '08:30', '09:00', '09:30']);
    expect(miniStartTimes('23:00', 4, 30)).toBeNull();
    expect(miniStartTimes('08:00', 0, 30)).toBeNull();
    expect(miniStartTimes('08:00', 31, 30)).toBeNull();
  });
  it('round-trips list filters through the URL and never puts search text in it', () => {
    const q = new URLSearchParams('status=requested&view=all&q=ana&page=2');
    const f = filtersFromQuery(q);
    expect(f).toEqual({ status: 'requested', view: 'all', page: '2' });
    expect(queryFromFilters(f)).toBe('view=all&status=requested&page=2');
  });
  it('routes by hash', () => {
    expect(parseRoute('#/bookings/DBP-7K3F9Q')).toEqual({ name: 'detail', id: 'DBP-7K3F9Q' });
    expect(parseRoute('#/blocks').name).toBe('blocks');
    expect(parseRoute('#/minis').name).toBe('minis');
    const r = parseRoute('#/bookings?status=confirmed');
    expect(r.name === 'list' && r.query.get('status')).toBe('confirmed');
    expect(parseRoute('').name).toBe('list');
  });
});

describe('password tool', () => {
  it('requires a long matching passphrase', () => {
    expect(checkPassphrase('short', 'short')).toContain('at least 14');
    expect(checkPassphrase('a long enough passphrase', 'different')).toContain("don't match");
    expect(checkPassphrase('a long enough passphrase', 'a long enough passphrase')).toBeNull();
  });
  it('makes a hash in the format the server expects', async () => {
    const salt = new Uint8Array(16).fill(7);
    const hash = await hashPassphrase('correct horse battery', 1000, salt);
    const parts = hash.split('$');
    expect(parts[0]).toBe('pbkdf2-sha256');
    expect(parts[1]).toBe('1000');
    expect(parts[2]).toBe(base64url(salt));
    expect(parts[3]).toHaveLength(43);
  });
  it('matches the server derivation for the same salt and password', async () => {
    const { pbkdf2Sync } = await import('node:crypto');
    const salt = new Uint8Array(16).fill(3);
    const hash = await hashPassphrase('pässwörd phrase long', 2000, salt);
    const expected = pbkdf2Sync('pässwörd phrase long'.normalize('NFKC'), Buffer.from(salt), 2000, 32, 'sha256').toString('base64url');
    expect(hash.split('$')[3]).toBe(expected);
  });
  it('encodes base32 per RFC 4648 and builds an otpauth URI', () => {
    expect(base32(new TextEncoder().encode('foobar'))).toBe('MZXW6YTBOI');
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(otpauthUri(secret, 'd@example.com')).toContain(`secret=${secret}`);
  });
});
