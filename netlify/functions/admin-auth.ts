// POST /api/admin/login, POST /api/admin/logout, GET /api/admin/session (ADR 0003).
// Login order (review H3, M1): Origin, body, RESERVE the attempt in the limiter (fails closed), then PBKDF2.
import { createHash, timingSafeEqual } from "node:crypto";
import type { Config } from "@netlify/functions";
import type { AdminSessionData } from "../../shared/api-types";
import { loginSchema } from "../../shared/schemas/admin";
import { assertSameOrigin, isSecureEnv, readSession, sessionCookie, unauthorized } from "../lib/auth/guard";
import { verifyPassword } from "../lib/auth/password";
import {
  clearCookie,
  cookieNames,
  newDeviceToken,
  newSession,
  readCookie,
  refreshSession,
  serializeCookie,
  verifyDeviceToken,
  type SessionPayload,
} from "../lib/auth/session";
import { verifyTotp } from "../lib/auth/totp";
import { HttpError } from "../lib/errors";
import { defineFunction, dispatch, fieldErrors, json, noContent, readJsonBody, validationFailed, type RequestContext } from "../lib/http";
import { hashIp, hashKey } from "../lib/ip";
import { log } from "../lib/log";
import type { Services } from "../lib/services";

const DEVICE_MAX_AGE_SEC = 90 * 24 * 3600;
const GLOBAL_LOGIN_LIMIT = { max: 50, windowMinutes: 60 };
const TOTP_KEY = "auth/totp-last-step";

const sha = (s: string) => createHash("sha256").update(s).digest();
const sameString = (a: string, b: string): boolean => timingSafeEqual(sha(a.trim().toLowerCase()), sha(b.trim().toLowerCase()));

export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 1)}***@${domain}`;
}
function sessionData(svc: Services, s: SessionPayload): AdminSessionData {
  return {
    email: maskEmail(svc.env.adminEmail),
    idleExpiresAt: new Date(s.idleExp * 1000).toISOString(),
    absoluteExpiresAt: new Date(s.absExp * 1000).toISOString(),
  };
}

/** A step is accepted once: the last used step is stored with a compare-and-swap. */
async function consumeTotpStep(svc: Services, step: number): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    const cur = await svc.store.get<{ step: number }>(TOTP_KEY);
    if (cur && cur.value.step >= step) return false;
    const res = await svc.store.set(TOTP_KEY, { step }, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (res.ok) return true;
  }
  return false;
}

async function login(req: Request, rc: RequestContext): Promise<Response> {
  const { svc } = rc;
  assertSameOrigin(req, svc);
  const raw = await readJsonBody(req);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) throw validationFailed(fieldErrors(parsed.error));
  const body = parsed.data;
  const secure = isSecureEnv(svc);
  const names = cookieNames(secure);

  // ---- reserve the attempt BEFORE any password work. The limiter fails closed. ----
  const spec = svc.config.limits.loginFailureLimit;
  const deviceId = verifyDeviceToken(readCookie(req, names.device), svc.env.adminSessionSecret);
  const reserved: (string | null)[] = [];
  const limited = (retryAfterSec: number) => {
    log("warn", "login limited", { requestId: rc.requestId, reason: "login_limited", code: "RATE_LIMITED" });
    return new HttpError("RATE_LIMITED", `Too many attempts. Please wait ${spec.windowMinutes} minutes and try again.`, undefined, {
      "retry-after": String(retryAfterSec),
    });
  };
  if (deviceId) {
    const t = await svc.limiter.take("login-device", hashKey(deviceId, svc.env.adminSessionSecret), spec, { failClosed: true });
    if (!t.allowed) throw limited(t.retryAfterSec);
    reserved.push(t.key);
  } else {
    const ip = await svc.limiter.take("login-ip", hashIp(rc.ip, svc.env.adminSessionSecret), spec, { failClosed: true });
    if (!ip.allowed) throw limited(ip.retryAfterSec);
    reserved.push(ip.key);
    const all = await svc.limiter.take("login-global", "all", GLOBAL_LOGIN_LIMIT, { failClosed: true });
    if (!all.allowed) {
      await svc.limiter.refund(ip.key);
      throw limited(all.retryAfterSec);
    }
    reserved.push(all.key);
  }

  // ---- credentials: PBKDF2 always runs, comparisons are constant time ----
  const passwordOk = await verifyPassword(body.password, svc.env.adminPasswordHash);
  const emailOk = sameString(body.email, svc.env.adminEmail);
  let totpOk = true;
  if (svc.env.adminTotpSecret) {
    const step = verifyTotp(svc.env.adminTotpSecret, body.totp ?? "", Date.parse(svc.clock.now()));
    totpOk = step !== null && passwordOk && emailOk ? await consumeTotpStep(svc, step) : false;
  }
  if (!(passwordOk && emailOk && totpOk)) {
    log("info", "sign-in failed", { requestId: rc.requestId, reason: "login_failed", code: "INVALID_CREDENTIALS" });
    throw new HttpError("INVALID_CREDENTIALS", "That email and password don't match. Please try again.");
  }

  // ---- success: give the reserved attempts back, issue the session and the device cookie ----
  for (const key of reserved) await svc.limiter.refund(key);
  const nowSec = Math.floor(Date.parse(svc.clock.now()) / 1000);
  const session = newSession(svc.env.adminEmail, nowSec, svc.config.admin.sessionIdleMinutes, svc.config.admin.sessionMaxHours);
  log("info", "sign-in ok", { requestId: rc.requestId, reason: "login_ok" });
  const res = json(200, sessionData(svc, session));
  res.headers.append("set-cookie", sessionCookie(svc, session));
  res.headers.append(
    "set-cookie",
    serializeCookie(names.device, deviceId ? (readCookie(req, names.device) as string) : newDeviceToken(svc.env.adminSessionSecret), {
      maxAgeSec: DEVICE_MAX_AGE_SEC,
      secure,
    }),
  );
  return res;
}

async function logout(req: Request, rc: RequestContext): Promise<Response> {
  assertSameOrigin(req, rc.svc);
  return noContent({}, [clearCookie(cookieNames(isSecureEnv(rc.svc)).session, isSecureEnv(rc.svc))]);
}

async function session(req: Request, rc: RequestContext): Promise<Response> {
  const { svc } = rc;
  const current = await readSession(req, svc);
  if (!current) throw unauthorized(svc, true);
  const nowSec = Math.floor(Date.parse(svc.clock.now()) / 1000);
  const next = refreshSession(current, nowSec, svc.config.admin.sessionIdleMinutes);
  const res = json(200, sessionData(svc, next), { "x-robots-tag": "noindex, nofollow" });
  res.headers.append("set-cookie", sessionCookie(svc, next));
  return res;
}

export default defineFunction(
  "admin-auth",
  (req, rc) =>
    dispatch(
      [
        { method: "POST", pattern: "/api/admin/login", handler: (r) => login(r, rc) },
        { method: "POST", pattern: "/api/admin/logout", handler: (r) => logout(r, rc) },
        { method: "GET", pattern: "/api/admin/session", handler: (r) => session(r, rc) },
      ],
      req,
      rc,
    ),
  { headers: { "x-robots-tag": "noindex, nofollow" } },
);

export const config: Config = { path: ["/api/admin/login", "/api/admin/logout", "/api/admin/session"], method: ["POST", "GET"] };
