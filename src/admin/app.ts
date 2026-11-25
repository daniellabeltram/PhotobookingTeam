// Admin shell: session check, login, hash router, header and nav.
import { h, clear } from '../lib/dom';
import { ApiError, adminLogout, adminSession, setUnauthorizedHandler } from '../lib/api';
import { mountLiveRegions } from '../components/live';
import { currentTarget, saveReturnTarget, sanitizeReturnTarget, takeReturnTarget } from './return-target';
import { renderLogin, type LoginNotice } from './login';
import { renderList } from './list';
import { renderDetail } from './detail';
import { renderBlocks } from './blocks';
import { renderMinis } from './minis';

export type Route =
  | { name: 'list'; query: URLSearchParams }
  | { name: 'detail'; id: string }
  | { name: 'blocks' }
  | { name: 'minis' };

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path = '', qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'bookings' && parts[1]) return { name: 'detail', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'blocks') return { name: 'blocks' };
  if (parts[0] === 'minis') return { name: 'minis' };
  return { name: 'list', query: new URLSearchParams(qs) };
}

const NAV = [
  { href: '#/bookings', label: 'Bookings', match: ['list', 'detail'] },
  { href: '#/blocks', label: 'Blocked dates', match: ['blocks'] },
  { href: '#/minis', label: 'Add minis slots', match: ['minis'] },
];

export class AdminApp {
  private loggedIn = false;
  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async start(): Promise<void> {
    mountLiveRegions();
    window.addEventListener('hashchange', () => { if (this.loggedIn) this.route(); });
    try {
      await adminSession();
      this.enter();
    } catch (err) {
      const totp = err instanceof ApiError && err.details['totpRequired'] === true;
      this.showLogin(null, totp);
    }
    setUnauthorizedHandler(() => this.onUnauthorized());
  }

  private onUnauthorized(): void {
    if (!this.loggedIn) return;
    saveReturnTarget(currentTarget());
    this.loggedIn = false;
    this.showLogin('expired', false);
  }

  private showLogin(notice: LoginNotice, totpRequired: boolean): void {
    this.loggedIn = false;
    document.title = 'Sign in | Admin';
    clear(this.root);
    this.root.append(renderLogin({
      notice, totpRequired,
      onSuccess: () => {
        const target = takeReturnTarget();
        if (target && sanitizeReturnTarget(target)) {
          const here = window.location.pathname;
          const url = new URL(target, window.location.origin);
          if (url.pathname !== here) { window.location.assign(target); return; }
          window.history.replaceState(null, '', target);
        }
        this.enter();
      },
    }));
    this.root.querySelector<HTMLElement>('#page-heading')?.focus();
  }

  private enter(): void {
    this.loggedIn = true;
    this.route();
  }

  private async signOut(): Promise<void> {
    try { await adminLogout(); } catch { /* the cookie is cleared server-side either way */ }
    this.loggedIn = false;
    window.location.hash = '';
    this.showLogin('signed_out', false);
  }

  private route(): void {
    const route = parseRoute(window.location.hash);
    const main = h('main', { id: 'main', class: 'admin-main' });
    const nav = h('nav', { class: 'admin-nav', 'aria-label': 'Admin' },
      ...NAV.map((n) => h('a', { href: n.href, 'aria-current': n.match.includes(route.name) ? 'page' : null }, n.label)));
    const header = h('header', { class: 'admin-header' },
      h('div', { class: 'inner' }, h('span', { class: 'wordmark' }, 'Admin'), nav,
        h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => { void this.signOut(); } }, 'Sign out')));
    clear(this.root);
    this.root.append(header, main);
    switch (route.name) {
      case 'list': renderList(main, route.query); break;
      case 'detail': renderDetail(main, route.id); break;
      case 'blocks': renderBlocks(main); break;
      case 'minis': renderMinis(main); break;
    }
  }
}
