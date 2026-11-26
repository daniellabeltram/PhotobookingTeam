// Tiny ":param" path matcher shared by the function handlers and the Vite dev plugin.
export type Params = Record<string, string>;

/** Matches "/api/admin/bookings/:id" against "/api/admin/bookings/DBP-AAAAAA". Trailing slash ignored. */
export function matchRoute(pattern: string, pathname: string): Params | null {
  const a = pattern.split("/").filter(Boolean);
  const b = pathname.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Params = {};
  for (let i = 0; i < a.length; i++) {
    const p = a[i] as string;
    const v = b[i] as string;
    if (p.startsWith(":")) {
      let decoded: string;
      try {
        decoded = decodeURIComponent(v);
      } catch {
        return null;
      }
      params[p.slice(1)] = decoded;
    } else if (p !== v) {
      return null;
    }
  }
  return params;
}

export function matchAny(patterns: string | string[], pathname: string): Params | null {
  for (const p of Array.isArray(patterns) ? patterns : [patterns]) {
    const m = matchRoute(p, pathname);
    if (m) return m;
  }
  return null;
}

export interface RouteDef<C> {
  method: string;
  pattern: string;
  handler: (req: Request, params: Params, ctx: C) => Promise<Response> | Response;
}
