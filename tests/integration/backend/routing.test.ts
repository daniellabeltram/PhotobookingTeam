// Every function is wrapped by the guard (story 010 #2, ADR 0003): 401 without a session on EVERY admin path and
// method, Origin and content-type checks, and a stable route table.
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { freshApp } from "../../helpers/app";
import { ADMIN_EMAIL } from "../../helpers/seed";
import { matchRoute } from "../../../netlify/lib/route";

const FUNCTIONS_DIR = new URL("../../../netlify/functions/", import.meta.url).pathname;
const files = readdirSync(FUNCTIONS_DIR).filter((f) => f.endsWith(".ts"));
const names = files.map((f) => f.replace(/\.ts$/, ""));
const fill = (pattern: string) => pattern.replace(/:\w+/g, (m) => (m === ":date" ? "2026-12-12" : m === ":id" ? "DBP-AAAAAA" : "x"));

describe("route table", () => {
  it("has the nine functions from architecture section 7", () => {
    expect(names.sort()).toEqual(
      ["admin-auth", "admin-availability", "admin-blocks", "admin-bookings", "admin-export", "admin-mini-days", "availability", "bookings-create", "config"].sort(),
    );
  });
  it("every function exports a handler and a config with a path and methods (served only at /api/*)", async () => {
    const app = await freshApp();
    for (const n of names) {
      const mod = (await import(/* @vite-ignore */ `../../../netlify/functions/${n}`)) as { default: unknown; config: { path: string | string[]; method: string[] } };
      expect(typeof mod.default).toBe("function");
      const paths = Array.isArray(mod.config.path) ? mod.config.path : [mod.config.path];
      expect(paths.every((p) => p.startsWith("/api/"))).toBe(true);
      expect(mod.config.method.length).toBeGreaterThan(0);
    }
    expect(app).toBeTruthy();
  });
  it(":param matcher", () => {
    expect(matchRoute("/api/admin/bookings/:id", "/api/admin/bookings/DBP-AAAAAA")).toEqual({ id: "DBP-AAAAAA" });
    expect(matchRoute("/api/admin/bookings/:id", "/api/admin/bookings/DBP-AAAAAA/reschedule")).toBeNull();
    expect(matchRoute("/api/admin/bookings", "/api/admin/bookings/")).toEqual({});
    expect(matchRoute("/a/:x", "/a/%E0%A4%A")).toBeNull(); // malformed escape
  });
});

describe("401 without a session on every admin path and method (story 010 #2, must-have 7)", () => {
  const adminFiles = names.filter((n) => n.startsWith("admin-") && n !== "admin-auth");
  it.each(adminFiles)("%s", async (name) => {
    const app = await freshApp();
    const mod = (await import(/* @vite-ignore */ `../../../netlify/functions/${name}`)) as { config: { path: string | string[] } };
    const paths = Array.isArray(mod.config.path) ? mod.config.path : [mod.config.path];
    const api = app.api();
    let checked = 0;
    for (const pattern of paths) {
      for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
        const hasBody = method === "POST" || method === "PATCH" || method === "PUT";
        const r = await api.call(method, fill(pattern), { body: hasBody ? {} : undefined });
        expect(r.status, `${method} ${pattern}`).toBe(401);
        expect(r.body.error.code).toBe("UNAUTHORIZED");
        expect(r.headers.get("x-robots-tag")).toMatch(/noindex/);
        expect(r.headers.get("cache-control")).toBe("no-store");
        expect(r.headers.get("x-request-id")).toBeTruthy();
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });
  it("an unknown path under an admin function is 401 too, never a data-bearing 404", async () => {
    const app = await freshApp();
    expect((await app.api().get("/api/admin/bookings/DBP-AAAAAA/secret")).status).toBe(401);
  });
  it("session endpoint: 401 with totpRequired false/true", async () => {
    const app = await freshApp();
    const r = await app.api().get("/api/admin/session");
    expect(r.status).toBe(401);
    expect(r.body.error.details).toEqual({ totpRequired: false });
    const app2 = await freshApp({ ADMIN_TOTP_SECRET: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" });
    expect((await app2.api().get("/api/admin/session")).body.error.details).toEqual({ totpRequired: true });
  });
  it("a forged, tampered, expired or other-secret cookie is 401 and clears the cookie", async () => {
    const app = await freshApp();
    const api = app.api();
    for (const cookie of ["dbp_admin=garbage", "dbp_admin=v1.e30.AAAA", "dbp_admin="]) {
      const r = await api.get("/api/admin/bookings", { headers: { cookie } });
      expect(r.status).toBe(401);
      expect(r.headers.get("set-cookie")).toMatch(/dbp_admin=;.*Max-Age=0/);
    }
  });
});

describe("Origin and content type (CSRF defence)", () => {
  it("a state-changing admin request needs an Origin equal to the site (missing, null and foreign are 403)", async () => {
    const app = await freshApp();
    const admin = app.api();
    expect((await admin.login()).status).toBe(200);
    const path = "/api/admin/blocks";
    const body = { kind: "all_day", startDate: "2026-12-24", endDate: "2026-12-24", label: null };
    expect((await admin.call("POST", path, { body, origin: false })).status).toBe(403);
    expect((await admin.call("POST", path, { body, origin: false, headers: { origin: "null" } })).status).toBe(403);
    expect((await admin.call("POST", path, { body, origin: false, headers: { origin: "https://evil.test" } })).status).toBe(403);
    expect((await admin.call("POST", path, { body, headers: { "content-type": "text/plain" } })).status).toBe(403);
    expect((await admin.call("POST", path, { body })).status).toBe(201);
    expect((await admin.get("/api/admin/blocks")).status).toBe(200); // GET needs no Origin
  });
  it("login and logout also refuse a missing or foreign Origin", async () => {
    const app = await freshApp();
    const api = app.api();
    const creds = { email: ADMIN_EMAIL, password: "whatever" };
    expect((await api.call("POST", "/api/admin/login", { body: creds, origin: false })).status).toBe(403);
    expect((await api.call("POST", "/api/admin/login", { body: creds, origin: false, headers: { origin: "https://evil.test" } })).status).toBe(403);
    expect((await api.call("POST", "/api/admin/logout", { origin: false })).status).toBe(403);
    expect((await api.call("POST", "/api/admin/logout", {})).status).toBe(204);
  });
});

describe("method and path handling on public functions", () => {
  it("wrong method is 405, unknown policy version is 404, config is cacheable, API is no-store", async () => {
    const app = await freshApp();
    const api = app.api();
    expect((await api.call("POST", "/api/config", { body: {} })).status).toBe(405);
    expect((await api.get("/api/policies/v9.9-nope")).status).toBe(404);
    expect((await api.get("/api/policies/..%2F..%2Fetc")).status).toBe(404);
    const policy = await api.get("/api/policies/v0.1-draft");
    expect(policy.body.data).toMatchObject({ version: "v0.1-draft", isCurrent: true });
    expect(policy.headers.get("cache-control")).toBe("public, max-age=60");
    expect((await api.get("/api/availability?type=portraits")).headers.get("cache-control")).toBe("no-store");
  });
  it("the public config hides internals (admin email, limits, payment link URLs)", async () => {
    const app = await freshApp();
    const text = JSON.stringify((await app.api().get("/api/config")).body);
    expect(text).not.toMatch(/buy\.stripe|adminNotification|RateLimit|bookingGlobal|loginFailure|sessionIdle/);
    expect(text).not.toContain("bookings@");
  });
});

describe("availability endpoint rules (docs/api.md)", () => {
  it("validates type, dates, range and Events length", async () => {
    const app = await freshApp();
    const api = app.api();
    expect((await api.get("/api/availability")).status).toBe(400);
    expect((await api.get("/api/availability?type=nope")).status).toBe(422);
    expect((await api.get("/api/availability?type=portraits&from=2026-13-01")).status).toBe(400);
    expect((await api.get("/api/availability?type=portraits&from=2026-12-01&to=2027-03-01")).status).toBe(400);
    expect((await api.get("/api/availability?type=portraits&from=2026-12-10&to=2026-12-01")).status).toBe(400);
    expect((await api.get("/api/availability?type=events")).status).toBe(400);
    expect((await api.get("/api/availability?type=events&durationMin=150")).status).toBe(400);
    const ok = await api.get("/api/availability?type=events&durationMin=180&from=2026-12-04&to=2026-12-04");
    expect(ok.status).toBe(200);
    expect(ok.body.data.durationMin).toBe(180);
    expect(ok.body.data.days[0].slots.at(-1).localTime).toBe("19:00"); // the 3 hour session must end by 22:00
  });
  it("defaults to today + 35 days, reports the horizon and the first open date", async () => {
    const app = await freshApp();
    const d = (await app.api().get("/api/availability?type=portraits")).body.data;
    expect(d.from).toBe("2026-12-01");
    expect(d.days).toHaveLength(35);
    expect(d.horizonEndDate).toBe("2027-06-02");
    expect(d.firstOpenDate).toBe("2026-12-04");
    expect(d.timezone).toBe("America/New_York");
  });
});
