// Controller for the 5-step flow: history entries per step, focus management, persistence.
import { h, clear } from '../lib/dom';
import { getConfig } from '../lib/api';
import { readJson, writeJson, removeKey } from '../lib/storage';
import type { PublicConfig, PublicSessionType } from '../lib/types';
import { alertBox } from '../components/banner';
import { mountLiveRegions, announce } from '../components/live';
import type { FlowCtx, StoredConfirmation } from './context';
import { clampStep, findType, initialState, restoreState, selectSessionType, STEP_TITLES, type FlowState, type StepNo } from './flow-state';
import { documentTitle } from './format';
import type { FieldErrors } from './validation';
import { renderTypeStep } from './steps/type';
import { renderDateStep, clearAvailabilityCache } from './steps/datetime';
import { renderIntakeStep } from './steps/intake';
import { renderPoliciesStep } from './steps/policies';
import { renderConfirmationStep, renderAlreadyBooked } from './steps/confirmation';

const FLOW_KEY = 'dbp.flow.v1';
const CONF_KEY = 'dbp.confirmation.v1';
const TITLES: Record<StepNo, string> = {
  1: 'Choose your session', 2: 'Choose your date', 3: 'Your details', 4: 'Review policies', 5: 'Confirmation',
};

function stepFromHash(): number {
  const m = /^#step-(\d)$/.exec(window.location.hash);
  return m ? Number(m[1]) : 1;
}

export class BookingApp implements FlowCtx {
  config: PublicConfig;
  state: FlowState;
  confirmation: StoredConfirmation | null;
  pendingErrors: FieldErrors | null = null;
  notice: string | null = null;
  private readonly main: HTMLElement;
  private alreadyBooked = false;

  constructor(main: HTMLElement, config: PublicConfig) {
    this.main = main;
    this.config = config;
    this.state = restoreState(readJson<unknown>(FLOW_KEY), config);
    this.confirmation = readJson<StoredConfirmation>(CONF_KEY);
    mountLiveRegions();
    window.addEventListener('popstate', () => this.onPop());
  }

  get type(): PublicSessionType | null {
    return findType(this.config, this.state.sessionTypeId);
  }

  start(): void {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get('type');
    const preset = wanted ? this.config.sessionTypes.find((t) => t.id === wanted) : undefined;
    let step = stepFromHash();
    if (this.confirmation && step === 5) {
      this.show(5, 'replace', false);
      return;
    }
    // Anywhere else this is a fresh visit: forget an earlier confirmation so a second booking works.
    if (this.confirmation) {
      this.confirmation = null;
      removeKey(CONF_KEY);
    }
    if (preset && !this.state.slot) {
      this.state = selectSessionType(this.state, preset).state;
      step = Math.max(step, 2);
    }
    this.show(clampStep(this.state, this.config, step), 'replace', false);
  }

  update(fn: (s: FlowState) => FlowState): void {
    this.state = fn(this.state);
    if (!this.confirmation) writeJson(FLOW_KEY, this.state);
  }

  go(step: StepNo): void {
    this.alreadyBooked = false;
    this.show(step === 5 ? 5 : clampStep(this.state, this.config, step), 'push');
  }

  rerender(): void {
    this.render(false);
  }

  setConfirmation(c: StoredConfirmation): void {
    this.confirmation = c;
    // Keep only what a reload of the confirmation needs: no contact details or intake answers.
    this.state = initialState();
    removeKey(FLOW_KEY);
    // The location can be a client's home address, so it is not kept across reloads.
    writeJson(CONF_KEY, { result: { ...c.result, locationLabel: '' }, firstName: '' });
  }

  async reloadConfig(): Promise<void> {
    try {
      this.config = await getConfig();
      clearAvailabilityCache();
    } catch {
      // Keep the old config; the next submit reports the problem.
    }
  }

  restart(): void {
    this.confirmation = null;
    this.alreadyBooked = false;
    this.state = initialState();
    removeKey(FLOW_KEY);
    removeKey(CONF_KEY);
    clearAvailabilityCache();
    this.show(1, 'push');
  }

  private onPop(): void {
    const n = stepFromHash();
    if (this.confirmation && n !== 5) {
      this.alreadyBooked = true;
      this.render(true);
      return;
    }
    this.alreadyBooked = false;
    const step = n === 5 ? 5 : clampStep(this.state, this.config, n);
    this.state = { ...this.state, step };
    this.render(true);
  }

  private show(step: StepNo, mode: 'push' | 'replace', moveFocus = true): void {
    this.state = { ...this.state, step };
    if (!this.confirmation) writeJson(FLOW_KEY, this.state);
    const url = `${window.location.pathname}${window.location.search}#step-${step}`;
    if (mode === 'push') window.history.pushState({ step }, '', url);
    else window.history.replaceState({ step }, '', url);
    this.render(moveFocus);
  }

  private render(moveFocus: boolean): void {
    const step = this.state.step;
    let node: HTMLElement;
    if (this.alreadyBooked) node = renderAlreadyBooked(this);
    else {
      switch (step) {
        case 1: node = renderTypeStep(this); break;
        case 2: node = renderDateStep(this); break;
        case 3: node = renderIntakeStep(this); break;
        case 4: node = renderPoliciesStep(this); break;
        default: node = renderConfirmationStep(this);
      }
    }
    clear(this.main);
    this.main.append(node);
    document.title = documentTitle(this.alreadyBooked ? 'Already booked' : TITLES[step]);
    if (moveFocus) {
      const heading = this.main.querySelector<HTMLElement>('#step-heading');
      heading?.focus();
      window.scrollTo({ top: 0 });
      announce(`Step ${step} of 5: ${STEP_TITLES[step]}`);
    }
  }
}

export async function boot(main: HTMLElement): Promise<void> {
  clear(main);
  main.append(h('p', { role: 'status', 'aria-busy': 'true' }, 'Loading sessions...'));
  try {
    const config = await getConfig();
    new BookingApp(main, config).start();
  } catch {
    clear(main);
    main.append(
      h('h1', { id: 'step-heading', tabindex: '-1' }, 'Booking is temporarily unavailable'),
      alertBox('error', null, h('p', null, "We couldn't load the sessions. Please try again.")),
      h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => { void boot(main); } }, 'Try again'),
    );
  }
}
