// Roving tabindex + arrow-key navigation for radio-like button groups.

export function enableRadioKeys(items: HTMLElement[], onActivate?: (el: HTMLElement) => void): void {
  const enabled = (): HTMLElement[] => items.filter((i) => i.getAttribute('aria-disabled') !== 'true');
  const focusAt = (el: HTMLElement | undefined): void => {
    if (!el) return;
    for (const i of items) i.tabIndex = i === el ? 0 : -1;
    el.focus();
  };
  for (const item of items) {
    item.addEventListener('keydown', (ev) => {
      const list = enabled();
      const idx = list.indexOf(item);
      let next: HTMLElement | undefined;
      switch (ev.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = list[(idx + 1) % list.length];
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          next = list[(idx - 1 + list.length) % list.length];
          break;
        case 'Home':
          next = list[0];
          break;
        case 'End':
          next = list[list.length - 1];
          break;
        case ' ':
        case 'Enter':
          ev.preventDefault();
          onActivate?.(item);
          return;
        default:
          return;
      }
      ev.preventDefault();
      focusAt(next);
    });
    item.addEventListener('focus', () => { for (const i of items) i.tabIndex = i === item ? 0 : -1; });
  }
}

/** Gives the checked item (or the first enabled one) the single tab stop. */
export function setInitialTabStop(items: HTMLElement[]): void {
  const checked = items.find((i) => i.getAttribute('aria-checked') === 'true');
  const first = items.find((i) => i.getAttribute('aria-disabled') !== 'true');
  const stop = checked ?? first;
  for (const i of items) i.tabIndex = i === stop ? 0 : -1;
}
