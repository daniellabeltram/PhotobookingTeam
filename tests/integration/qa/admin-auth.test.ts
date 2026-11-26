// Every admin route: 401 without a session, 403 on a bad Origin, noindex/no-store headers (stories 010 #2, #9, 013, 020 #22; must-have 7).
import "../../helpers/env";
import { describe, it, expect, beforeEach } from "vitest";
import { ADMIN_ROUTE_SAMPLES, freshApp } from "../../helpers/app";
import { buildBookingBody, firstOpenSlot, type Api } from "../../helpers/builders";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../../helpers/seed";
import { readdirSync } from "node:fs";
import { join } from "node:path";

let app: Awaited<ReturnType<typeof freshApp>>;
beforeEach(async () => { app = await freshApp(); });

describe("401 without a session", () => {
  it.each(ADMIN_ROUTE_SAMPLES.map((r) => [`${r.method} ${r.path}`, r] as const))("%s", async (_n, r) => {
    const res = await app.api().call(r.method, r.path, { body: r.body });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(JSON.stringify(res.body)).not.toMatch(/@|DBP-[A-Z0-9]{6}.*fullName/);
    expect(res.headers.get("x-robots-tag")).toMatch(/noindex/);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("a garbage or tampered cookie is also 401", async () => {
    for (const cookie of ["dbp_admin=garbage", "dbp_admin=v1.e30.AAAA", "__Host-dbp_admin=v1.e30.AAAA"]) {
      const res = await app.api().get("/api/admin/bookings", { headers: { cookie } });
      expect(res.status).toBe(401);
    }
  });

  it("every function file named admin-*.ts is covered by a sample route (guard against forgotten routes)", () => {
    const files = readdirSync(join(process.cwd(), "netlify/functions")).filter((f) => /^admin-.*\.ts$/.test(f) && f !== "admin-auth.ts");
    for (const f of files) {
      const key = f.replace(/^admin-|\.ts$/g, "");
      const covered = ADMIN_ROUTE_SAMPLES.some((s) => s.path.includes(key === "export" ? "export.csv" : key === "mini-days" ? "mini-days" : key));
      expect(covered, `${f} has no sample in ADMIN_ROUTE_SAMPLES`).toBe(true);
    }
  });
});

describe("login", () => {
  it("wrong password and unknown email give the identical 401 INVALID_CREDENTIALS body (010 #4)", async () => {
    const a = await app.api().post("/api/admin/login", { email: ADMIN_EMAIL, password: "wrong-wrong-wrong-wrong" }, { origin: true });
    const b = await app.api().post("/api/admin/login", { email: "nobody@example.test", password: "wrong-wrong-wrong-wrong" }, { origin: true });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
    expect(a.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(a.raw.headers.get("set-cookie")).toBeNull();
  });

  it("success sets an HttpOnly SameSite=Strict cookie and GET session works; logout clears it (010 #6)", async () => {
    const api = app.api();
    const r = await api.login();
    expect(r.status).toBe(200);
    const sc = r.raw.headers.get("set-cookie") ?? "";
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=Strict/i);
    expect(r.body.data.email).not.toBe(ADMIN_EMAIL); // masked
    expect((await api.get("/api/admin/session")).status).toBe(200);
    const out = await api.post("/api/admin/logout", undefined, { origin: true });
    expect(out.status).toBe(204);
    expect(out.raw.headers.get("set-cookie") ?? "").toMatch(/Max-Age=0/i);
  });

  it("repeated failures are rate limited with RATE_LIMITED (010 #5)", async () => {
    const limited = await freshApp({ RATE_LIMIT_DISABLED: undefined });
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await limited.api().post("/api/admin/login", { email: ADMIN_EMAIL, password: "nope-nope-nope-nope" }, { origin: true, ip: "203.0.113.9" })).status;
    expect(last).toBe(429);
  });
});

describe("403 on state-changing admin requests with a wrong or missing Origin", () => {
  const writes = ADMIN_ROUTE_SAMPLES.filter((r) => r.method !== "GET");
  it.each(writes.map((r) => [`${r.method} ${r.path}`, r] as const))("%s", async (_n, r) => {
    const api: Api = app.api();
    expect((await api.login()).status).toBe(200);
    const evil = await api.call(r.method, r.path, { body: r.body, headers: { origin: "https://evil.example" }, origin: false });
    expect(evil.status).toBe(403);
    expect(evil.body.error.code).toBe("FORBIDDEN");
    const none = await api.call(r.method, r.path, { body: r.body, origin: false });
    expect(none.status).toBe(403);
  });
});

describe("approve/decline direct requests (020 #21, #22)", () => {
  it("without a session the booking stays unchanged; Mark paid on a request is INVALID_TRANSITION", async () => {
    const api = app.api();
    const slot = await firstOpenSlot(api, "events", "2026-12-01", "2027-02-01", 120);
    const created = await api.createBooking(buildBookingBody({ type: "events", slot, durationMin: 120 }));
    expect(created.status).toBe(201);
    const ref = created.body.data.reference;
    const anon = await app.api().patch(`/api/admin/bookings/${ref}`, { action: "approve", expectedVersion: 1 }, { origin: true });
    expect(anon.status).toBe(401);
    const admin = app.api();
    await admin.login();
    const v = (await admin.get(`/api/admin/bookings/${ref}`)).body.data.version;
    for (const body of [
      { action: "mark_paid", expectedVersion: v, amountCents: 100, receivedOn: "2026-12-01" },
      { action: "confirm_without_payment", expectedVersion: v, note: "x" },
      { action: "cancel", expectedVersion: v, reason: "other" },
      { action: "complete", expectedVersion: v },
    ]) {
      const r = await admin.patch(`/api/admin/bookings/${ref}`, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      expect(r.body.error.code).toBe("INVALID_TRANSITION");
    }
    expect((await admin.get(`/api/admin/bookings/${ref}`)).body.data.status).toBe("requested");
  });

  it("stale expectedVersion -> 409 VERSION_CONFLICT, nothing changes (013 #8, 020 #18)", async () => {
    const api = app.api();
    const slot = await firstOpenSlot(api, "events", "2026-12-01", "2027-02-01", 120);
    const ref = (await api.createBooking(buildBookingBody({ type: "events", slot, durationMin: 120 }))).body.data.reference;
    const admin = app.api();
    await admin.login();
    const d = (await admin.get(`/api/admin/bookings/${ref}`)).body.data;
    expect((await admin.patch(`/api/admin/bookings/${ref}`, { action: "decline", expectedVersion: d.version, notifyClient: false })).status).toBe(200);
    const again = await admin.patch(`/api/admin/bookings/${ref}`, { action: "approve", expectedVersion: d.version });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("VERSION_CONFLICT");
    expect(again.body.error.details.currentStatus).toBe("declined");
    // declined is final even with the right version
    const v2 = (await admin.get(`/api/admin/bookings/${ref}`)).body.data.version;
    const fin = await admin.patch(`/api/admin/bookings/${ref}`, { action: "approve", expectedVersion: v2 });
    expect(fin.status).toBe(422);
  });
});

void ADMIN_PASSWORD;
