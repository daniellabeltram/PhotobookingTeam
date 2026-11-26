import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/booking.css';
import { emailLink } from '../components/links';
import { h, clear } from '../lib/dom';
import { getConfig } from '../lib/api';
import { formatDateStringPlain } from '../lib/datetime';
import type { PublicConfig } from '../lib/types';

function content(c: PublicConfig): HTMLElement[] {
  return [
    h('h1', null, 'Privacy notice'),
    h('p', { class: 'muted' }, `Last updated ${formatDateStringPlain(c.privacy.lastUpdated)}`),
    h('p', { class: 'small muted' }, '[PLACEHOLDER] This notice is a draft until it has been reviewed by an attorney and approved by Daniella.'),
    h('h2', null, 'What we collect'),
    h('p', null, 'When you book, we ask for your name, email, phone number, who is being photographed and how many people are coming, where you would like to meet, and any notes you choose to share (for example style ideas, anything that helps your session go smoothly, or event details). For family sessions you can tell us your children’s ages. For event sessions we also ask for the venue, times and an on-site contact. We also store the policy version you agreed to and when you agreed.'),
    h('h2', null, 'Why we collect it'),
    h('p', null, 'To plan and deliver your session and to contact you about it: confirmation emails, reminders and changes.'),
    h('h2', null, 'Who can see it'),
    h('p', null, 'Daniella can see your booking. The services we use to run the booking site can process it for us: web hosting and data storage, email delivery, and payments. We never sell your information.'),
    h('h2', null, 'How long we keep it'),
    h('p', null, `We keep booking details for ${c.privacy.dataRetentionMonths} months, then delete them.`),
    h('h2', null, 'Your choices'),
    h('p', null, 'You can ask for a copy of your information or ask us to delete it. Email ', emailLink(c.privacy.privacyContactEmail), '.'),
    h('h2', null, 'Tracking'),
    h('p', null, 'The booking pages do not load advertising or tracking scripts.'),
    h('p', null, h('a', { href: '/policies.html' }, 'Booking policies')),
  ];
}

async function run(main: HTMLElement): Promise<void> {
  clear(main);
  main.append(h('p', { role: 'status', 'aria-busy': 'true' }, 'Loading...'));
  try {
    const config = await getConfig();
    clear(main);
    main.append(...content(config));
  } catch {
    clear(main);
    main.append(
      h('h1', null, 'Privacy notice'),
      h('div', { class: 'alert alert-error', role: 'alert' },
        h('p', null, "We couldn't load this page. Please try again."),
        h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => { void run(main); } }, 'Try again')),
    );
  }
}

const main = document.getElementById('main');
if (main) void run(main);
