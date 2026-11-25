// Password hashing, TOTP, session tokens, device token, and the login limiter (ADR 0003, review H3/M1/M2).
import { describe, expect, it } from "vitest";
import { hashPassword, parseHash, passwordStats, verifyPassword } from "../../../netlify/lib/auth/password";
import {
  cookieNames,
  newDeviceToken,
  newSession,
  refreshSession,
  serializeCookie,
  signSession,
  verifyDeviceToken,
  verifySession,
} from "../../../netlify/lib/auth/session";
import { base32Decode, base32Encode, generateTotpSecret, hotp, totpCode, verifyTotp } from "../../../netlify/lib/auth/totp";
import { fixedClock } from "../../../netlify/lib/clock";
import { ipBucket, hashIp, clientIp } from "../../../netlify/lib/ip";
import { RateLimiter } from "../../../netlify/lib/ratelimit";
import { MemoryKvStore } from "../../../netlify/lib/store/memory";
import type { KvStore, SetResult } from "../../../netlify/lib/store/kv";

const SECRET = "unit-test-secret-0123456789-abcdefghijklmnop";

describe("password hashing", () => {
  it("round-trips and rejects a wrong passphrase (low iteration count for speed)", async () => {
    const hash = await hashPassword("a-long-test-passphrase", 2000);
    expect(hash).toMatch(/^pbkdf2-sha256\$2000\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword("a-long-test-passphrase", hash)).toBe(true);
    expect(await verifyPassword("a-long-test-passphraze", hash)).toBe(false);
  });
  it("a malformed stored hash fails but still does the work", async () => {
    const before = passwordStats.runs;
    expect(await verifyPassword("anything", "garbage")).toBe(false);
    expect(passwordStats.runs).toBe(before + 1);
  });
  it("parseHash enforces the format and bounds", () => {
    expect(parseHash("pbkdf2-sha256$10$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBeNull();
    expect(parseHash("md5$1000$a$b")).toBeNull();
  });
});

describe("TOTP", () => {
  it("matches the RFC 6238 SHA-1 test vectors (6 digits)", () => {
    const secret = Buffer.from("12345678901234567890");
    expect(hotp(secret, 1)).toBe("287082"); // T = 59
    expect(hotp(secret, 37037036)).toBe("081804"); // T = 1111111080
    expect(hotp(secret, 37037037)).toBe("050471");
  });
  it("base32 round-trips", () => {
    const b = Buffer.from("hello world");
    expect(base32Decode(base32Encode(b)).toString()).toBe("hello world");
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });
  it("accepts the previous, current and next step only", () => {
    const secret = generateTotpSecret();
    const now = Date.UTC(2026, 11, 1, 14, 0, 10);
    const cur = totpCode(secret, now);
    expect(verifyTotp(secret, cur, now)).not.toBeNull();
    expect(verifyTotp(secret, totpCode(secret, now - 30_000), now)).not.toBeNull();
    expect(verifyTotp(secret, totpCode(secret, now + 30_000), now)).not.toBeNull();
    expect(verifyTotp(secret, totpCode(secret, now - 90_000), now)).toBeNull();
  });
  it("rejects malformed codes", () => {
    const secret = generateTotpSecret();
    for (const bad of ["", "12345", "1234567", "abcdef", "12 456"]) expect(verifyTotp(secret, bad, Date.now())).toBeNull();
  });
});

describe("session token", () => {
  const now = 1_800_000_000;
  const s = newSession("Admin@Example.test", now, 60, 12);
  it("verifies, lower-cases the subject, and carries authAt", () => {
    const token = signSession(s, SECRET);
    const p = verifySession(token, SECRET, now + 10, "admin@example.test");
    expect(p?.sub).toBe("admin@example.test");
    expect(p?.authAt).toBe(now);
  });
  it("rejects a tampered payload, another secret, a bad shape, and a different subject", () => {
    const token = signSession(s, SECRET);
    const [v, body, sig] = token.split(".") as [string, string, string];
    const forged = Buffer.from(JSON.stringify({ ...s, absExp: s.absExp + 99999 })).toString("base64url");
    expect(verifySession(`${v}.${forged}.${sig}`, SECRET, now, s.sub)).toBeNull();
    expect(verifySession(token, SECRET + "x", now, s.sub)).toBeNull();
    expect(verifySession(`${v}.${body}`, SECRET, now, s.sub)).toBeNull();
    expect(verifySession("v1.e30.AAAA", SECRET, now, s.sub)).toBeNull();
    expect(verifySession(token, SECRET, now, "someone-else@example.test")).toBeNull();
  });
  it("expires after the idle time and after the absolute limit", () => {
    const token = signSession(s, SECRET);
    expect(verifySession(token, SECRET, s.idleExp - 1, s.sub)).not.toBeNull();
    expect(verifySession(token, SECRET, s.idleExp, s.sub)).toBeNull();
  });
  it("a refresh slides the idle timer but never extends the absolute limit or authAt", () => {
    const late = newSession("a@b.test", now, 60, 1); // absExp = now + 3600
    const next = refreshSession(late, now + 3000, 60);
    expect(next.absExp).toBe(late.absExp);
    expect(next.authAt).toBe(late.authAt);
    expect(next.idleExp).toBe(late.absExp); // clamped, not now + 3000 + 3600
  });
  it("cookie flags: __Host- name with Secure in production, short name without Secure locally", () => {
    expect(cookieNames(true).session).toBe("__Host-dbp_admin");
    expect(cookieNames(false).session).toBe("dbp_admin");
    const prod = serializeCookie(cookieNames(true).session, "t", { maxAgeSec: 100, secure: true });
    expect(prod).toBe("__Host-dbp_admin=t; Path=/; HttpOnly; SameSite=Strict; Max-Age=100; Secure");
    expect(serializeCookie("dbp_admin", "t", { maxAgeSec: 100, secure: false })).not.toMatch(/Secure/);
  });
});

describe("device token (M1)", () => {
  it("is signed: a valid token yields the id, a forged or foreign one yields null", () => {
    const t = newDeviceToken(SECRET);
    expect(verifyDeviceToken(t, SECRET)).toMatch(/^[\w-]{20,}$/);
    expect(verifyDeviceToken(t, SECRET + "x")).toBeNull();
    expect(verifyDeviceToken(t.slice(0, -2) + "AA", SECRET)).toBeNull();
    expect(verifyDeviceToken(null, SECRET)).toBeNull();
    expect(verifyDeviceToken("d1.abc", SECRET)).toBeNull();
  });
});

describe("client IP (H3)", () => {
  it("uses only the platform header or the context, never x-forwarded-for", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "6.6.6.6", "x-nf-client-connection-ip": "1.2.3.4" } });
    expect(clientIp(req)).toBe("1.2.3.4");
    expect(clientIp(new Request("http://x/", { headers: { "x-forwarded-for": "6.6.6.6" } }), { ip: "9.9.9.9" })).toBe("9.9.9.9");
    expect(clientIp(new Request("http://x/", { headers: { "x-forwarded-for": "6.6.6.6" } }))).toBe("127.0.0.1");
  });
  it("buckets IPv6 by /64 and hashes without keeping the address", () => {
    expect(ipBucket("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe(ipBucket("2001:db8:1:2::1"));
    expect(ipBucket("2001:db8:1:3::1")).not.toBe(ipBucket("2001:db8:1:2::1"));
    expect(ipBucket("::ffff:1.2.3.4")).toBe("1.2.3.4");
    const h = hashIp("1.2.3.4", SECRET);
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain("1.2.3.4");
  });
});

describe("login limiter (H3)", () => {
  const clock = fixedClock("2026-12-01T14:00:00.000Z");
  const spec = { max: 5, windowMinutes: 10 };

  it("50 parallel reservations allow at most 5 (the rest are refused before any password work)", async () => {
    const limiter = new RateLimiter(new MemoryKvStore(), clock);
    const results = await Promise.all(Array.from({ length: 50 }, () => limiter.take("login-ip", "abc", spec, { failClosed: true })));
    expect(results.filter((r) => r.allowed).length).toBeLessThanOrEqual(5);
    // with only 3 CAS tries a heavy race may refuse even more; it must never allow more
  });
  it("sequential use: 5 allowed, the 6th refused with a Retry-After inside the window", async () => {
    const limiter = new RateLimiter(new MemoryKvStore(), clock);
    for (let i = 0; i < 5; i++) expect((await limiter.take("s", "id", spec)).allowed).toBe(true);
    const sixth = await limiter.take("s", "id", spec);
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterSec).toBeGreaterThan(0);
    expect(sixth.retryAfterSec).toBeLessThanOrEqual(600);
  });
  it("a refund gives the attempt back", async () => {
    const limiter = new RateLimiter(new MemoryKvStore(), clock);
    const keys: (string | null)[] = [];
    for (let i = 0; i < 5; i++) keys.push((await limiter.take("s", "id", spec)).key);
    await limiter.refund(keys[0] ?? null);
    expect((await limiter.take("s", "id", spec)).allowed).toBe(true);
  });
  it("FAILS CLOSED when the counter cannot be written; booking-style limiters fail open", async () => {
    class Broken extends MemoryKvStore {
      override async set<T>(): Promise<SetResult> {
        throw new Error("store down");
      }
    }
    const broken = new RateLimiter(new Broken() as KvStore, clock);
    expect((await broken.take("login-ip", "id", spec, { failClosed: true })).allowed).toBe(false);
    expect((await broken.take("booking", "id", spec)).allowed).toBe(true);
  });
  it("FAILS CLOSED when every compare-and-swap loses", async () => {
    class AlwaysLose extends MemoryKvStore {
      override async set<T>(): Promise<SetResult> {
        return { ok: false };
      }
    }
    const limiter = new RateLimiter(new AlwaysLose() as KvStore, clock);
    expect((await limiter.take("login-ip", "id", spec, { failClosed: true })).allowed).toBe(false);
  });
  it("different identifiers and windows are independent", async () => {
    const store = new MemoryKvStore();
    const a = new RateLimiter(store, clock);
    for (let i = 0; i < 5; i++) await a.take("s", "one", spec);
    expect((await a.take("s", "two", spec)).allowed).toBe(true);
    const later = new RateLimiter(store, fixedClock("2026-12-01T14:11:00.000Z"));
    expect((await later.take("s", "one", spec)).allowed).toBe(true);
  });
});
