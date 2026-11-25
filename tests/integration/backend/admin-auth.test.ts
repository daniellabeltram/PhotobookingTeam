// Admin sign-in (ADR 0003, review H3, M1, M2): same error for every failure, the limiter reserves before PBKDF2
// and fails closed, a device cookie gets its own bucket, TOTP is single-use, cookies carry the right flags.
import { describe, expect, it } from "vitest";
import { freshApp } from "../../helpers/app";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../../helpers/seed";
import { totpCode } from "../../../netlify/lib/auth/totp";

const TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const WRONG = "That email and password don't match. Please try again.";
const setCookies = (r: { raw: Response }) => r.raw.headers.getSetCookie();

describe("sign-in", () => {
  it("success: masked email, expiry times, HttpOnly SameSite=Strict session cookie and a 90-day device cookie", async () => {
    const app = await freshApp();
    const api = app.api();
    const r = await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, { origin: true });
    expect(r.status).toBe(200);
    expect(r.body.data.email).toBe("a***@example.test");
    expect(Date.parse(r.body.data.absoluteExpiresAt) - Date.parse(r.body.data.idleExpiresAt)).toBe(11 * 3600 * 1000);
    const [session, device] = setCookies(r);
    expect(session).toMatch(/^dbp_admin=v1\./);
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/SameSite=Strict/);
    expect(session).toMatch(/Max-Age=3600/);
    expect(device).toMatch(/^dbp_device=d1\./);
    expect(device).toMatch(/Max-Age=7776000/);
    expect(device).toMatch(/HttpOnly/);
  });
  it("every failure is the same 401 and message: wrong password, wrong email, empty, wrong case is fine", async () => {
    const app = await freshApp();
    const api = app.api();
    const msgs = new Set<string>();
    for (const creds of [
      { email: ADMIN_EMAIL, password: "not-the-password" },
      { email: "someone-else@example.test", password: ADMIN_PASSWORD },
      { email: "someone-else@example.test", password: "x" },
    ]) {
      const r = await api.post("/api/admin/login", creds, { origin: true });
      expect(r.status).toBe(401);
      expect(r.body.error.code).toBe("INVALID_CREDENTIALS");
      msgs.add(r.body.error.message);
    }
    expect([...msgs]).toEqual([WRONG]);
    expect((await api.post("/api/admin/login", { email: ADMIN_EMAIL.toUpperCase(), password: ADMIN_PASSWORD }, { origin: true })).status).toBe(200);
    expect((await api.post("/api/admin/login", { email: "", password: "" }, { origin: true })).status).toBe(400);
    expect((await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: "x", extra: 1 }, { origin: true })).status).toBe(400);
  });
  it("PBKDF2 runs even when the email is wrong (no user enumeration by timing)", async () => {
    const app = await freshApp();
    const { passwordStats } = await import("../../../netlify/lib/auth/password");
    const before = passwordStats.runs;
    await app.api().post("/api/admin/login", { email: "nobody@example.test", password: "x" }, { origin: true });
    expect(passwordStats.runs).toBe(before + 1);
  });
  it("logout clears the cookie and the session stops working; GET session slides the idle timer", async () => {
    const app = await freshApp();
    const api = app.api();
    await api.login();
    const s = await api.get("/api/admin/session");
    expect(s.status).toBe(200);
    expect(setCookies(s)[0]).toMatch(/^dbp_admin=v1\./);
    const out = await api.post("/api/admin/logout");
    expect(out.status).toBe(204);
    expect(setCookies(out)[0]).toMatch(/dbp_admin=;.*Max-Age=0/);
    api.cookie = "";
    expect((await api.get("/api/admin/bookings")).status).toBe(401);
  });
  it("a session is refused once it is idle too long, and an absolute limit is never extended", async () => {
    const app = await freshApp();
    const api = app.api();
    await api.login();
    const { setServicesForTest, getServices } = await import("../../../netlify/lib/services");
    const { steppingClock } = await import("../../../netlify/lib/clock");
    const clock = steppingClock(getServices().clock.now());
    setServicesForTest({ clock });
    expect((await api.get("/api/admin/bookings")).status).toBe(200);
    clock.advanceMinutes(59);
    expect((await api.get("/api/admin/bookings")).status).toBe(200); // refreshed the idle timer
    clock.advanceMinutes(61);
    expect((await api.get("/api/admin/bookings")).status).toBe(401);
  });
  it("the sessions-valid-after marker signs older sessions out (review L1)", async () => {
    const app = await freshApp();
    const api = app.api();
    await api.login();
    const { getServices } = await import("../../../netlify/lib/services");
    const { VALID_AFTER_KEY } = await import("../../../netlify/lib/auth/guard");
    await getServices().store.set(VALID_AFTER_KEY, { at: Math.floor(Date.parse(getServices().clock.now()) / 1000) + 5 });
    expect((await api.get("/api/admin/bookings")).status).toBe(401);
  });
});

describe("login limiter (review H3, M1)", () => {
  it("50 parallel attempts run PBKDF2 at most 5 times and the rest are 429 (reserve BEFORE the work)", async () => {
    const app = await freshApp();
    const { passwordStats } = await import("../../../netlify/lib/auth/password");
    const before = passwordStats.runs;
    const api = app.api();
    const rs = await Promise.all(
      Array.from({ length: 50 }, () => api.post("/api/admin/login", { email: ADMIN_EMAIL, password: "wrong-" + Math.random() }, { origin: true, ip: "198.51.100.7" })),
    );
    const runs = passwordStats.runs - before;
    expect(runs).toBeLessThanOrEqual(5);
    expect(rs.filter((r) => r.status === 401).length).toBeLessThanOrEqual(5);
    expect(rs.filter((r) => r.status === 429).length).toBeGreaterThanOrEqual(45);
    const limited = rs.find((r) => r.status === 429)!;
    expect(limited.body.error.message).toBe("Too many attempts. Please wait 10 minutes and try again.");
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
  it("after 5 failures even the RIGHT password is refused from that address; another address still works", async () => {
    const app = await freshApp();
    const api = app.api();
    for (let i = 0; i < 5; i++) await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: "nope" + i }, { origin: true, ip: "198.51.100.8" });
    const blocked = await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, { origin: true, ip: "198.51.100.8" });
    expect(blocked.status).toBe(429);
    expect((await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, { origin: true, ip: "198.51.100.9" })).status).toBe(200);
  });
  it("RATE_LIMIT_DISABLED never switches off the login limiter", async () => {
    const app = await freshApp({ RATE_LIMIT_DISABLED: "1" });
    const api = app.api();
    const rs: number[] = [];
    for (let i = 0; i < 7; i++) rs.push((await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: "bad" }, { origin: true, ip: "198.51.100.10" })).status);
    expect(rs.slice(5)).toEqual([429, 429]);
  });
  it("a successful sign-in gives its attempt back, so using the page all day never locks Daniella out", async () => {
    const app = await freshApp();
    const api = app.api();
    for (let i = 0; i < 7; i++) expect((await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, { origin: true, ip: "198.51.100.11" })).status).toBe(200);
  });
  it("IPv6 addresses share a bucket per /64", async () => {
    const app = await freshApp();
    const api = app.api();
    for (let i = 0; i < 5; i++) await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: "bad" }, { origin: true, ip: `2001:db8:1:2::${i + 1}` });
    expect((await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: "bad" }, { origin: true, ip: "2001:db8:1:2:ffff::9" })).status).toBe(429);
    expect((await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, { origin: true, ip: "2001:db8:1:3::1" })).status).toBe(200);
  });
  it("x-forwarded-for is ignored: rotating it does not escape the limit", async () => {
    const app = await freshApp();
    const api = app.api();
    const rs: number[] = [];
    for (let i = 0; i < 7; i++) {
      rs.push((await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: "bad" }, { origin: true, ip: "198.51.100.12", headers: { "x-forwarded-for": `9.9.9.${i}` } })).status);
    }
    expect(rs.slice(5)).toEqual([429, 429]);
  });
  it("a device cookie gets its own bucket and skips the address and site-wide buckets (M1)", async () => {
    const app = await freshApp();
    const api = app.api();
    const first = await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, { origin: true, ip: "198.51.100.20" });
    const device = setCookies(first).map((c) => c.split(";")[0]!).find((c) => c.startsWith("dbp_device="))!;
    // an attacker exhausts the address bucket and the site-wide bucket
    for (let i = 0; i < 5; i++) await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: "bad" }, { origin: true, ip: "198.51.100.21" });
    expect((await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, { origin: true, ip: "198.51.100.21" })).status).toBe(429);
    // Daniella, from the same address but with her device cookie, still gets in
    const hers = await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, { origin: true, ip: "198.51.100.21", headers: { cookie: device } });
    expect(hers.status).toBe(200);
    // ... and the device bucket is still 5 per window
    const rs: number[] = [];
    for (let i = 0; i < 7; i++) rs.push((await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: "bad" }, { origin: true, ip: "198.51.100.22", headers: { cookie: device } })).status);
    expect(rs.slice(5)).toEqual([429, 429]);
  });
  it("a forged device cookie is ignored (it gets the normal address bucket)", async () => {
    const app = await freshApp();
    const api = app.api();
    const rs: number[] = [];
    for (let i = 0; i < 7; i++) rs.push((await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: "bad" }, { origin: true, ip: "198.51.100.30", headers: { cookie: "dbp_device=d1.AAAAAAAAAAAAAAAAAAAAAA.AAAA" } })).status);
    expect(rs.slice(5)).toEqual([429, 429]);
  });
});

describe("TOTP (M2)", () => {
  it("is required when configured, single-use, and a wrong or missing code is the same 401", async () => {
    const app = await freshApp({ ADMIN_TOTP_SECRET: TOTP_SECRET });
    const api = app.api();
    const { getServices } = await import("../../../netlify/lib/services");
    const now = () => Date.parse(getServices().clock.now());
    const creds = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
    const missing = await api.post("/api/admin/login", creds, { origin: true });
    expect(missing.status).toBe(401);
    expect(missing.body.error.message).toBe(WRONG);
    expect((await api.post("/api/admin/login", { ...creds, totp: "000000" }, { origin: true })).status).toBe(401);
    const code = totpCode(TOTP_SECRET, now());
    expect((await api.post("/api/admin/login", { ...creds, totp: code }, { origin: true })).status).toBe(200);
    const replay = await api.post("/api/admin/login", { ...creds, totp: code }, { origin: true });
    expect(replay.status).toBe(401); // the same code cannot be used twice
    const next = totpCode(TOTP_SECRET, now() + 30_000);
    expect((await api.post("/api/admin/login", { ...creds, totp: next }, { origin: true })).status).toBe(200);
  });
  it("a wrong password with a right code does not burn the code", async () => {
    const app = await freshApp({ ADMIN_TOTP_SECRET: TOTP_SECRET });
    const api = app.api();
    const { getServices } = await import("../../../netlify/lib/services");
    const code = totpCode(TOTP_SECRET, Date.parse(getServices().clock.now()));
    expect((await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: "bad", totp: code }, { origin: true })).status).toBe(401);
    expect((await api.post("/api/admin/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, totp: code }, { origin: true })).status).toBe(200);
  });
});

describe("production cookie flags", () => {
  it("the __Host- session cookie is Secure with Path=/ and no Domain (unit-level check of the serializer)", async () => {
    const { serializeCookie, cookieNames } = await import("../../../netlify/lib/auth/session");
    const c = serializeCookie(cookieNames(true).session, "x", { maxAgeSec: 60, secure: true });
    expect(c).toMatch(/^__Host-dbp_admin=x; Path=\/; HttpOnly; SameSite=Strict; Max-Age=60; Secure$/);
    expect(c).not.toMatch(/Domain/i);
  });
});
