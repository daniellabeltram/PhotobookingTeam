// Session token and cookies (ADR 0003, review M1, L1). Token: v1.<payload>.<HMAC>. Tokens are not stored.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
  sub: string; // admin email, lower-case
  iat: number; // last (re)issue, epoch seconds
  authAt: number; // when the password was entered; never changes, used by "sessions valid after" (L1)
  idleExp: number;
  absExp: number; // never extended
  jti: string;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest();

export function signSession(payload: SessionPayload, secret: string): string {
  const body = b64(JSON.stringify(payload));
  return `v1.${body}.${b64(sign(secret, `v1.${body}`))}`;
}

export function verifySession(token: string, secret: string, nowSec: number, expectedSub: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const given = Buffer.from(parts[2] as string, "base64url");
  const expected = sign(secret, `v1.${parts[1]}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let p: SessionPayload;
  try {
    p = JSON.parse(Buffer.from(parts[1] as string, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
  if (typeof p.sub !== "string" || ![p.iat, p.authAt, p.idleExp, p.absExp].every((n) => Number.isFinite(n))) return null;
  if (nowSec >= p.idleExp || nowSec >= p.absExp) return null;
  if (p.sub.toLowerCase() !== expectedSub.toLowerCase()) return null;
  return p;
}

export function newSession(sub: string, nowSec: number, idleMin: number, maxHours: number): SessionPayload {
  const absExp = nowSec + maxHours * 3600;
  return {
    sub: sub.toLowerCase(),
    iat: nowSec,
    authAt: nowSec,
    idleExp: Math.min(nowSec + idleMin * 60, absExp),
    absExp,
    jti: randomBytes(8).toString("base64url"),
  };
}
/** Slides the idle timer. absExp and authAt are carried over unchanged. */
export function refreshSession(p: SessionPayload, nowSec: number, idleMin: number): SessionPayload {
  return { ...p, iat: nowSec, idleExp: Math.min(nowSec + idleMin * 60, p.absExp) };
}

// ---- cookies ----
export interface CookieNames {
  session: string;
  device: string;
}
/** `__Host-` names need Secure + Path=/, so plain http://localhost uses the short names. */
export const cookieNames = (secure: boolean): CookieNames =>
  secure ? { session: "__Host-dbp_admin", device: "__Host-dbp_device" } : { session: "dbp_admin", device: "dbp_device" };

export function serializeCookie(name: string, value: string, opts: { maxAgeSec: number; secure: boolean }): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(opts.maxAgeSec))}${opts.secure ? "; Secure" : ""}`;
}
export function clearCookie(name: string, secure: boolean): string {
  return serializeCookie(name, "", { maxAgeSec: 0, secure });
}
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// ---- device cookie (M1): a signed random browser id, issued after a successful sign-in ----
export function newDeviceToken(secret: string): string {
  const id = randomBytes(16).toString("base64url");
  return `d1.${id}.${b64(sign(secret, `d1.${id}`))}`;
}
/** Returns the browser id when the signature is valid. */
export function verifyDeviceToken(token: string | null, secret: string): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "d1") return null;
  const given = Buffer.from(parts[2] as string, "base64url");
  const expected = sign(secret, `d1.${parts[1]}`);
  return given.length === expected.length && timingSafeEqual(given, expected) ? (parts[1] as string) : null;
}
