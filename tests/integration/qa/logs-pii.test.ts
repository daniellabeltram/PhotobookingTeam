// No PII in logs (story 017 #6; must-have 10; architecture section 11).
import "../../helpers/env";
import { describe, it, expect } from "vitest";
import { captureLogs, freshApp } from "../../helpers/app";
import { buildBookingBody, firstOpenSlot, newKey } from "../../helpers/builders";
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SESSION_SECRET, OTHER_CLIENT, PII_NEEDLES } from "../../helpers/seed";

describe("logs contain no client PII, credentials or secrets", () => {
  it("across create, conflict, validation error, honeypot, admin read, status change, CSV and login failure", async () => {
    const app = await freshApp();
    const logs = captureLogs();
    try {
      const api = app.api();
      const slot = await firstOpenSlot(api, "families", "2026-12-01", "2027-02-01");
      const ok = await api.createBooking(buildBookingBody({ type: "families", slot }));
      expect(ok.status).toBe(201);
      // conflict (other client's PII is in the body)
      await app.api().createBooking(buildBookingBody({ type: "families", slot, contact: { ...OTHER_CLIENT } }));
      // validation failure with PII in the body
      await app.api().createBooking(buildBookingBody({ type: "families", slot, override: { contact: { fullName: "Zelda Quillfeather", email: "bad-email", phone: "1", preferredContact: "email" } } }));
      // unknown field carrying PII
      await app.api().createBooking(buildBookingBody({ type: "families", slot, override: { sneaky: "Quillfeather" } }));
      // honeypot
      await app.api().createBooking(buildBookingBody({ type: "families", slot, override: { website: "http://spam.test" } }));
      // admin traffic
      await app.api().post("/api/admin/login", { email: ADMIN_EMAIL, password: "wrong-wrong-wrong-wrong" }, { origin: true });
      const admin = app.api();
      await admin.login();
      const ref = ok.body.data.reference;
      const d = (await admin.get(`/api/admin/bookings/${ref}`)).body.data;
      await admin.get("/api/admin/bookings?q=Quillfeather");
      await admin.patch(`/api/admin/bookings/${ref}`, { action: "mark_paid", expectedVersion: d.version, amountCents: 15000, receivedOn: "2026-12-01", note: "Blackwood paid by Zelle" });
      await admin.get("/api/admin/export.csv");
      await admin.post(`/api/admin/bookings/${ref}/resend-email`, { kind: "confirmed" });
    } finally {
      logs.restore();
    }
    const text = logs.text();
    expect(logs.lines.length, "the app should log something (request ids etc.)").toBeGreaterThan(0);
    for (const needle of [...PII_NEEDLES, ADMIN_PASSWORD, ADMIN_SESSION_SECRET, "wrong-wrong-wrong-wrong", "Blackwood paid", "spam.test"]) {
      expect(text, `log output leaks "${needle}"`).not.toContain(needle);
    }
    expect(text).not.toMatch(/\b(?:\d{1,3}\.){3}\d{1,3}\b/); // no full IPv4 addresses (017 #6)
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // no email addresses at all
    expect(text).not.toMatch(/pbkdf2-sha256\$/);
    expect(text).not.toMatch(/dbp_admin=v1\./); // no session tokens
  });

  it("every log line that is JSON uses only allowlisted keys", async () => {
    const app = await freshApp();
    const logs = captureLogs();
    try {
      const api = app.api();
      const slot = await firstOpenSlot(api, "portraits", "2026-12-01", "2027-02-01");
      await api.createBooking(buildBookingBody({ type: "portraits", slot }), newKey());
    } finally { logs.restore(); }
    const allow = new Set(["requestId", "fn", "route", "status", "code", "bookingId", "durationMs", "count", "reason", "driver", "kind", "level", "msg", "time", "ts", "honeypot", "event"]);
    for (const line of logs.lines) {
      let o: any;
      try { o = JSON.parse(line); } catch { continue; }
      for (const k of Object.keys(o)) expect(allow.has(k), `non-allowlisted log key "${k}" in ${line}`).toBe(true);
    }
  });
});
