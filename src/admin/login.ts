import { h } from '../lib/dom';
import { ApiError, adminLogin } from '../lib/api';
import { alertBox } from '../components/banner';
import { icon } from '../components/icons';
import { textField } from '../components/field';

export type LoginNotice = 'expired' | 'signed_out' | null;

export function renderLogin(opts: { notice: LoginNotice; totpRequired: boolean; onSuccess: () => void }): HTMLElement {
  const email = textField({ id: 'login-email', label: 'Email', type: 'email', autocomplete: 'username', inputmode: 'email' });
  const password = textField({ id: 'login-password', label: 'Password', type: 'password', autocomplete: 'current-password' });
  const totp = textField({
    id: 'login-totp', label: 'Authenticator code', optional: !opts.totpRequired, type: 'text',
    inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6,
    help: opts.totpRequired ? 'The 6-digit code from your authenticator app.' : 'Only if you set up an authenticator app.',
  });
  const show = h('button', { type: 'button', class: 'btn btn-secondary', 'aria-pressed': 'false' }, 'Show');
  show.addEventListener('click', () => {
    const on = show.getAttribute('aria-pressed') !== 'true';
    show.setAttribute('aria-pressed', String(on));
    show.textContent = on ? 'Hide' : 'Show';
    (password.control as HTMLInputElement).type = on ? 'text' : 'password';
  });
  password.root.querySelector('label')?.after(h('div', { class: 'password-row' }, password.control, show));
  const errorHost = h('div');
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Sign in');
  let busy = false;

  const showError = (msg: string): void => {
    errorHost.replaceChildren(alertBox('error', null, h('p', null, icon('alert', 16), ' ', msg)));
    errorHost.firstElementChild?.setAttribute('tabindex', '-1');
    (errorHost.firstElementChild as HTMLElement | null)?.focus();
  };

  const form = h('form', { novalidate: true }, email.root, password.root, totp.root, submit);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (busy) return;
    const e = (email.control as HTMLInputElement).value.trim();
    const p = (password.control as HTMLInputElement).value;
    const code = (totp.control as HTMLInputElement).value.replace(/\s/g, '');
    errorHost.replaceChildren();
    if (!e || !p) { showError('Please enter your email and password.'); return; }
    if (opts.totpRequired && !code) { showError('Please enter your authenticator code.'); return; }
    busy = true;
    submit.setAttribute('aria-disabled', 'true');
    submit.textContent = 'Signing in...';
    try {
      await adminLogin(code ? { email: e, password: p, totp: code } : { email: e, password: p });
      opts.onSuccess();
    } catch (err) {
      if (err instanceof ApiError) showError(err.isNetwork ? "We can't reach the server. Try again." : err.message);
      else showError('Something went wrong. Please try again.');
    } finally {
      busy = false;
      submit.removeAttribute('aria-disabled');
      submit.textContent = 'Sign in';
    }
  });

  const notice = opts.notice === 'expired'
    ? alertBox('info', null, h('p', null, 'You were signed out to keep things safe. Please sign in again.'))
    : opts.notice === 'signed_out' ? alertBox('success', null, h('p', null, "You're signed out.")) : null;

  return h('main', { id: 'main', class: 'login-box admin-main' },
    h('p', { class: 'wordmark' }, 'Daniella Beltram Photography'),
    h('h1', { id: 'page-heading', tabindex: '-1' }, 'Admin sign in'),
    notice, errorHost, form,
    h('p', { class: 'small muted' }, 'Lost your password? Use the ', h('a', { href: '/admin/password-tool.html' }, 'password tool'), ' to make a new one, then add it in Netlify.'),
  );
}
