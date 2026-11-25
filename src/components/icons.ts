import { svgIcon } from '../lib/dom';

const P = {
  check: ['M20 6 9 17l-5-5'],
  doubleCheck: ['M18 6 7 17l-5-5', 'M22 10 13 19'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  hourglass: ['M6 2h12', 'M6 22h12', 'M6 2v5l6 5-6 5v5', 'M18 2v5l-6 5 6 5v5'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  arrows: ['M17 1l4 4-4 4', 'M3 11V9a4 4 0 0 1 4-4h14', 'M7 23l-4-4 4-4', 'M21 13v2a4 4 0 0 1-4 4H3'],
  left: ['M15 18l-6-6 6-6'],
  right: ['M9 18l6-6-6-6'],
  alert: ['M12 9v4', 'M12 17h.01', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
} as const;

export type IconName = keyof typeof P;

export function icon(name: IconName, size = 20): SVGSVGElement {
  const el = svgIcon([...P[name]]);
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  return el;
}
