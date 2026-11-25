import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/booking.css';
import '../styles/admin.css';
import { h, clear } from '../lib/dom';
import { textField } from '../components/field';
import { announce, mountLiveRegions } from '../components/live';
import { checkPassphrase, generateTotpSecret, hashPassphrase, otpauthUri } from './password-hash';

function outputBlock(title: string, value: string, help: string): HTMLElement {
  const copy = h('button', { type: 'button', class: 'btn btn-secondary' }, 'Copy');
  copy.addEventListener('click', () => {
    void navigator.clipboard?.writeText(value).then(() => announce(`${title} copied.`), () => announce('Could not copy. Select the text and copy it.'));
  });
  return h('div', { class: 'detail-section' }, h('h2', null, title), h('p', { class: 'tool-out', tabindex: '0' }, value), copy, h('p', { class: 'help' }, help));
}

function run(main: HTMLElement): void {
  mountLiveRegions();
  const pass = textField({ id: 'pt-pass', label: 'New passphrase', type: 'password', autocomplete: 'new-password', help: 'At least 14 characters. Use a passphrase you do not use anywhere else.' });
  const confirm = textField({ id: 'pt-confirm', label: 'Type it again', type: 'password', autocomplete: 'new-password' });
  const hashOut = h('div', { 'aria-live': 'polite' });
  const totpOut = h('div', { 'aria-live': 'polite' });
  const account = textField({ id: 'pt-account', label: 'Your admin email', type: 'email', autocomplete: 'off', optional: true, help: 'Only used as the label in your authenticator app.' });
  const make = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Make my password hash');
  const totpBtn = h('button', { type: 'button', class: 'btn btn-primary' }, 'Make an authenticator secret');

  const hashForm = h('form', { novalidate: true, class: 'detail-section' }, h('h2', null, '1. Password hash'), pass.root, confirm.root, make, hashOut);
  hashForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const problem = checkPassphrase(pass.control.value, confirm.control.value);
    pass.setError(problem);
    if (problem) return;
    make.setAttribute('aria-disabled', 'true');
    make.textContent = 'Working...';
    try {
      const hash = await hashPassphrase(pass.control.value);
      pass.control.value = '';
      confirm.control.value = '';
      clear(hashOut);
      hashOut.append(outputBlock('Your password hash', hash, 'In Netlify, open Site configuration, then Environment variables. Paste this as ADMIN_PASSWORD_HASH, then trigger a deploy. It only takes effect after the next deploy.'));
    } finally {
      make.removeAttribute('aria-disabled');
      make.textContent = 'Make my password hash';
    }
  });

  const totpSection = h('div', { class: 'detail-section' }, h('h2', null, '2. Authenticator secret (recommended)'),
    h('p', null, 'This adds a 6-digit code to sign-in. Type the secret into an authenticator app on your phone.'), account.root, totpBtn, totpOut);
  totpBtn.addEventListener('click', () => {
    const secret = generateTotpSecret();
    clear(totpOut);
    totpOut.append(
      outputBlock('Your authenticator secret', secret, 'Add it to your authenticator app by choosing "Enter a setup key". Then paste it in Netlify as ADMIN_TOTP_SECRET and trigger a deploy.'),
      outputBlock('Or use this setup link', otpauthUri(secret, account.control.value.trim()), 'Some apps can open this link directly.'),
    );
  });

  main.append(
    h('h1', { id: 'page-heading', tabindex: '-1' }, 'Password tool'),
    h('p', null, 'Make a new admin password hash and authenticator secret. Everything happens in this browser tab. Nothing is sent anywhere and nothing is saved.'),
    hashForm, totpSection,
    h('p', null, h('a', { href: '/admin/' }, 'Back to admin sign in')),
  );
}

const main = document.getElementById('main');
if (main) {
  clear(main);
  run(main);
}
