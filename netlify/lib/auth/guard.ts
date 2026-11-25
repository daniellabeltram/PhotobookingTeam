// The admin guard (ADR 0003, review "must verify"). Every admin function is built with withAdmin(): the
// session is checked BEFORE routing, so an unknown path or method also answers 401 (deny by default).
import { HttpError } from "../errors";
import { defineFunction, dispatch, type RequestContext } from "../http";
import { log } from "../log";
import type { RouteDef } from "../route";
import type { Services } from "../services";
import { clearCookie, cookieNames, readCookie, refreshSession, serializeCookie, signSession, verifySession, type SessionPayload } from "./session";

export const VALID_AFTER_KEY = "auth/sessions-valid-after";
const REFRESH_AFTER_SEC = 5 * 60;

export interface AdminContext extends RequestContext {
  session: SessionPayload;
}

export const isSecureEnv = (svc: Services): boolean => svc.env.appEnv === "preview" || svc.env.appEnv === "production";

/** The site origin, plus PUBLIC_BASE_URL's origin as a fallback if the platform reports another host. */
export function originAllowed(req: Request, svc: Services): boolean {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return false; // a missing Origin is refused (login and logout included)
  const own = new URL(req.url).origin;
  let base = "";
  try {
    base = new URL(svc.env.publicBaseUrl).origin;
  } catch {
    /* ignore a malformed base URL */
  }
  return origin === own || (base !== "" && origin === base);
}

/** Origin and body-type checks for state-changing requests. Throws 403. */
export function assertSameOrigin(req: Request, svc: Services): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) return;
  if (!originAllowed(req, svc)) {
    log("warn", "origin refused", { reason: "forbidden_origin", code: "FORBIDDEN" });
    throw new HttpError("FORBIDDEN", "That request wasn't allowed.");
  }
  if (req.body !== null && !/^application\/json(\s*;|$)/i.test(req.headers.get("content-type") ?? "")) {
    throw new HttpError("FORBIDDEN", "That request wasn't allowed.");
  }
}

async function sessionsValidAfter(svc: Services): Promise<number> {
  return (await svc.store.get<{ at: number }>(VALID_AFTER_KEY))?.value.at ?? 0;
}

/** Returns the session or null. Never throws for a bad cookie. */
export async function readSession(req: Request, svc: Services): Promise<SessionPayload | null> {
  const token = readCookie(req, cookieNames(isSecureEnv(svc)).session);
  if (!token) return null;
  const nowSec = Math.floor(Date.parse(svc.clock.now()) / 1000);
  const payload = verifySession(token, svc.env.adminSessionSecret, nowSec, svc.env.adminEmail);
  if (!payload) return null;
  if (payload.authAt < (await sessionsValidAfter(svc))) return null;
  return payload;
}

export function unauthorized(svc: Services, includeTotpHint = false): HttpError {
  const names = cookieNames(isSecureEnv(svc));
  return new HttpError(
    "UNAUTHORIZED",
    "Please sign in to continue.",
    includeTotpHint ? { totpRequired: svc.env.adminTotpSecret !== null } : undefined,
    { "set-cookie": clearCookie(names.session, isSecureEnv(svc)) },
  );
}

export function sessionCookie(svc: Services, session: SessionPayload): string {
  const nowSec = Math.floor(Date.parse(svc.clock.now()) / 1000);
  return serializeCookie(cookieNames(isSecureEnv(svc)).session, signSession(session, svc.env.adminSessionSecret), {
    maxAgeSec: session.idleExp - nowSec,
    secure: isSecureEnv(svc),
  });
}

/** Builds an admin function: session first, then Origin, then routing. Slides the idle timer. */
export function withAdmin(name: string, routes: RouteDef<AdminContext>[]) {
  return defineFunction(
    name,
    async (req, rc) => {
      const session = await readSession(req, rc.svc);
      if (!session) throw unauthorized(rc.svc);
      assertSameOrigin(req, rc.svc);
      const admin: AdminContext = { ...rc, session };
      const res = await dispatch(routes as unknown as RouteDef<RequestContext>[], req, admin);
      const nowSec = Math.floor(Date.parse(rc.svc.clock.now()) / 1000);
      if (nowSec - session.iat > REFRESH_AFTER_SEC) {
        const next = refreshSession(session, nowSec, rc.svc.config.admin.sessionIdleMinutes);
        const headers = new Headers(res.headers);
        headers.append("set-cookie", sessionCookie(rc.svc, next));
        return new Response(res.body, { status: res.status, headers });
      }
      return res;
    },
    { headers: { "x-robots-tag": "noindex, nofollow" } },
  );
}
