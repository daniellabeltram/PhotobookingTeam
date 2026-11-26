import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/booking.css';
import { h, clear } from '../lib/dom';
import { getConfig, getPolicy } from '../lib/api';
import { formatDateStringPlain } from '../lib/datetime';

async function run(main: HTMLElement): Promise<void> {
  clear(main);
  main.append(h('p', { role: 'status', 'aria-busy': 'true' }, 'Loading policies...'));
  try {
    const asked = new URLSearchParams(window.location.search).get('version');
    const version = asked && /^[\w.-]{1,40}$/.test(asked) ? asked : (await getConfig()).policy.version;
    const doc = await getPolicy(version);
    document.title = 'Booking policies | Daniella Beltram Photography';
    clear(main);
    main.append(
      h('h1', { id: 'page-title' }, 'Booking policies'),
      h('p', { class: 'muted' }, `Version ${doc.version} · in effect from ${formatDateStringPlain(doc.effectiveDate)}`,
        doc.isCurrent ? null : ' · This is an older version.'),
      h('p', { class: 'small muted' }, '[PLACEHOLDER] These policies are a draft until Daniella confirms them.'),
      ...doc.sections.flatMap((s) => [h('h2', null, s.heading), ...s.paragraphs.map((p) => h('p', null, p))]),
      h('p', null, h('a', { href: '/privacy.html' }, 'Privacy notice')),
    );
  } catch {
    clear(main);
    main.append(
      h('h1', null, 'Booking policies'),
      h('div', { class: 'alert alert-error', role: 'alert' },
        h('p', null, "We couldn't load the policies. Please try again."),
        h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => { void run(main); } }, 'Try again')),
    );
  }
}

const main = document.getElementById('main');
if (main) void run(main);
