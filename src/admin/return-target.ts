// Where to send the admin after sign-in. Only same-origin /admin/ paths are accepted
// (no "//", no backslashes, no URL schemes), so a crafted link can't redirect off-site.

const KEY = 'dbp.admin.return';

export function sanitizeReturnTarget(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 2000) return null;
  if (!/^\/admin\//.test(raw)) return null;
  if (raw.includes('\\') || raw.includes('//')) return null;
  for (let i = 0; i < raw.length; i++) if (raw.charCodeAt(i) < 32) return null;
  return raw;
}

export function currentTarget(loc: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location): string | null {
  return sanitizeReturnTarget(`${loc.pathname}${loc.search}${loc.hash}`);
}

export function saveReturnTarget(target: string | null): void {
  try {
    if (target) window.sessionStorage.setItem(KEY, target);
  } catch {
    // ignore
  }
}

export function takeReturnTarget(): string | null {
  try {
    const v = sanitizeReturnTarget(window.sessionStorage.getItem(KEY));
    window.sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
