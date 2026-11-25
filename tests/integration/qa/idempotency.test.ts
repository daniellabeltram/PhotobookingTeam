// Idempotent retry (story 004 #6, 008 #6, 020 #7; must-have 9) and honeypot/rate limit (017).
import "../../helpers/env";
import { describe, it, expect } from "vitest";
import { freshApp, sentEmails } from "../../helpers/app";
import { buildBookingBody, firstOpenSlot, newKey } from "../../helpers/builders";

describe("Idempotency-Key", () => {
  it("same key + same body twice -> the original 201 body, ONE booking, ONE client email", async () => {
    const app = await freshApp();
    const api = app.api();
    const slot = await firstOpenSlot(api, "families", "2026-12-01", "2027-02-01");
    const body = buildBookingBody({ type: "families", slot });
    const key = newKey();
    const a = await api.createBooking(body, key);
    const b = await api.createBooking(body, key);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body).toEqual(a.body);
    const admin = app.api();
    await admin.login();
    expect((await admin.get("/api/admin/bookings?view=all")).body.data.total).toBe(1);
    const mails = (await sentEmails()).filter((m) => JSON.stringify(m).includes(a.body.data.reference));
    const toClient = mails.filter((m) => JSON.stringify(m).includes("zelda.quillfeather@example.test"));
    expect(toClient).toHaveLength(1);
  });

  it("10 parallel retries with one key -> one booking; every response is 201 (same reference) or REQUEST_IN_PROGRESS", async () => {
    const app = await freshApp();
    const api = app.api();
    const slot = await firstOpenSlot(api, "portraits", "2026-12-01", "2027-02-01");
    const body = buildBookingBody({ type: "portraits", slot });
    const key = newKey();
    const rs = await Promise.all(Array.from({ length: 10 }, () => app.api().createBooking(body, key)));
    const created = rs.filter((r) => r.status === 201);
    expect(created.length).toBeGreaterThanOrEqual(1);
    expect(new Set(created.map((r) => r.body.data.reference)).size).toBe(1);
    for (const r of rs.filter((x) => x.status !== 201)) {
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe("REQUEST_IN_PROGRESS");
    }
    const admin = app.api();
    await admin.login();
    expect((await admin.get("/api/admin/bookings?view=all")).body.data.total).toBe(1);
  });

  it("same key, different body -> 422 IDEMPOTENCY_KEY_REUSED", async () => {
    const app = await freshApp();
    const api = app.api();
    const slot = await firstOpenSlot(api, "portraits", "2026-12-01", "2027-02-01");
    const key = newKey();
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot }), key)).status).toBe(201);
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot, contact: { fullName: "Someone Else" } }), key);
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("missing key -> 400 VALIDATION_FAILED with header.idempotencyKey", async () => {
    const app = await freshApp();
    const api = app.api();
    const slot = await firstOpenSlot(api, "portraits", "2026-12-01", "2027-02-01");
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot }), null);
    expect(r.status).toBe(400);
    expect(r.body.error.details.fieldErrors["header.idempotencyKey"]).toBeTruthy();
  });

  it("a retry after the slot was taken by someone else is SLOT_TAKEN, not a second booking", async () => {
    const app = await freshApp();
    const api = app.api();
    const slot = await firstOpenSlot(api, "portraits", "2026-12-01", "2027-02-01");
    expect((await api.createBooking(buildBookingBody({ type: "portraits", slot }), newKey())).status).toBe(201);
    const r = await app.api().createBooking(buildBookingBody({ type: "portraits", slot, contact: { email: "b@example.test" } }), newKey());
    expect(r.status).toBe(409);
  });
});

describe("Honeypot and rate limit (017)", () => {
  it("honeypot filled: normal-looking 201, nothing stored, no slot reserved, no email", async () => {
    const app = await freshApp();
    const api = app.api();
    const slot = await firstOpenSlot(api, "portraits", "2026-12-01", "2027-02-01");
    const r = await api.createBooking(buildBookingBody({ type: "portraits", slot, override: { website: "http://spam.test" } }));
    expect(r.status).toBe(201);
    expect(r.body.data.reference).toMatch(/^DBP-[A-Z0-9]{6}$/);
    const admin = app.api();
    await admin.login();
    expect((await admin.get("/api/admin/bookings?view=all")).body.data.total).toBe(0);
    expect((await admin.get(`/api/admin/bookings/${r.body.data.reference}`)).status).toBe(404);
    const again = await api.availability("portraits", slot.localDate, slot.localDate);
    expect(again.body.data.days[0].slots.map((s: any) => s.startUtc)).toContain(slot.startUtc);
    expect((await sentEmails()).length).toBe(0);
  });

  it("more than bookingRateLimit submissions from one IP -> 429 RATE_LIMITED with Retry-After; other IPs unaffected", async () => {
    const app = await freshApp({ RATE_LIMIT_DISABLED: undefined });
    const api = app.api();
    const slot = await firstOpenSlot(api, "portraits", "2026-12-01", "2027-02-01");
    let limited: any;
    for (let i = 0; i < 12 && !limited; i++) {
      const r = await app.api().createBooking(buildBookingBody({ type: "portraits", slot, override: { website: "x" } }), newKey(), { ip: "198.51.100.7" });
      if (r.status === 429) limited = r;
    }
    expect(limited, "limit should trigger within 12 submissions (placeholder: 5 per 60 min)").toBeTruthy();
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(limited.headers.get("retry-after")).toBeTruthy();
    const other = await app.api().createBooking(buildBookingBody({ type: "portraits", slot }), newKey(), { ip: "198.51.100.8" });
    expect(other.status).toBe(201);
  });
});
