// CSV export (story 016): format, formula injection guard, filters, PII deletion (012 #7).
import "../../helpers/env";
import { describe, it, expect } from "vitest";
import { freshApp } from "../../helpers/app";
import { buildBookingBody, firstOpenSlot, parseCsv } from "../../helpers/builders";
import { FORMULA_PAYLOADS } from "../../helpers/seed";

const COLUMNS_HEAD = ["Reference", "Status", "Session type", "Date (ET)", "Start (ET)", "End (ET)", "Length (min)", "Client name", "Email", "Phone"];

async function setup() {
  const app = await freshApp();
  const api = app.api();
  const admin = app.api();
  await admin.login();
  return { app, api, admin };
}

describe("CSV export", () => {
  it("format: BOM, CRLF, all fields quoted, documented header order, filename bookings-YYYY-MM-DD.csv (016 #2, #3, #6)", async () => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "portraits", "2026-12-01", "2027-02-01");
    await api.createBooking(buildBookingBody({ type: "portraits", slot, override: { subjectsNames: 'Zoë "Zo", O\'Neil,\nsecond line' } }));
    const r = await admin.get("/api/admin/export.csv");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/^text\/csv; charset=utf-8/i);
    expect(r.headers.get("content-disposition")).toMatch(/attachment; filename="bookings-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(r.headers.get("content-disposition")).toContain("bookings-2026-12-01.csv"); // FAKE_NOW, ET date
    const text = r.body as string;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("\r\n");
    expect(text.slice(1).split("\r\n")[0]).toMatch(/^"Reference","Status"/); // every field quoted
    const rows = parseCsv(text);
    expect(rows[0]!.slice(0, 10)).toEqual(COLUMNS_HEAD);
    const widths = new Set(rows.filter((x) => x.length > 1).map((x) => x.length));
    expect(widths.size, "every row has the header's column count").toBe(1);
    expect(rows).toHaveLength(2);
    const col = rows[0]!.indexOf("Names photographed");
    expect(rows[1]![col]).toBe('Zoë "Zo", O\'Neil,\nsecond line'); // commas, quotes, newline, accent survive
  });

  it.each(FORMULA_PAYLOADS)("formula injection guard: %j is neutralised (016 #4)", async (payload) => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "portraits", "2026-12-01", "2027-02-01");
    const res = await api.createBooking(buildBookingBody({ type: "portraits", slot, override: { subjectsNames: payload.trim() ? payload : "x", styleNotes: payload, anythingElse: payload, contact: { fullName: payload.replace(/^[\t\r]/, "") || "x", email: "inj@example.test", phone: "5615550100", preferredContact: "email" } } }));
    expect([201, 400]).toContain(res.status); // the server may also reject odd names; if stored, they must be guarded
    if (res.status !== 201) return;
    const rows = parseCsv((await admin.get("/api/admin/export.csv")).body as string);
    const idx = ["Client name", "Names photographed", "Style notes", "Anything to know"].map((h) => rows[0]!.indexOf(h));
    for (const i of idx) {
      const cell = rows[1]![i]!;
      expect(cell, `column ${rows[0]![i]}`).not.toMatch(/^[=+\-@\t\r]/);
      if (/^[=+\-@\t\r]/.test(i === idx[0] ? payload.replace(/^[\t\r]/, "") : payload)) expect(cell.startsWith("'")).toBe(true);
    }
  });

  it("no match: header row only (016 #7); filters apply to the export (016 #1)", async () => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "portraits", "2026-12-01", "2027-02-01");
    await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    const none = parseCsv((await admin.get("/api/admin/export.csv?type=families")).body as string);
    expect(none).toHaveLength(1);
    const some = parseCsv((await admin.get("/api/admin/export.csv?type=portraits")).body as string);
    expect(some).toHaveLength(2);
  });

  it("exports ALL matching rows, not just one page (016 #1)", async () => {
    const { api, admin } = await setup();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const s = await firstOpenSlot(api, "events", "2026-12-01", "2027-06-01", 120, i * 2);
      expect((await api.createBooking(buildBookingBody({ type: "events", slot: s, durationMin: 120 }))).status).toBe(201);
    }
    const rows = parseCsv((await admin.get("/api/admin/export.csv?pageSize=2")).body as string);
    expect(rows.length - 1).toBe(n);
  });

  it("deleted client data leaves no PII in the export (012 #7)", async () => {
    const { api, admin } = await setup();
    const slot = await firstOpenSlot(api, "portraits", "2026-12-01", "2027-02-01");
    const ref = (await api.createBooking(buildBookingBody({ type: "portraits", slot }))).body.data.reference;
    let d = (await admin.get(`/api/admin/bookings/${ref}`)).body.data;
    expect((await admin.post(`/api/admin/bookings/${ref}/delete-client-data`, { confirmReference: ref, expectedVersion: d.version })).status).toBe(422); // active
    await admin.patch(`/api/admin/bookings/${ref}`, { action: "cancel", expectedVersion: d.version, reason: "other", notifyClient: false });
    d = (await admin.get(`/api/admin/bookings/${ref}`)).body.data;
    expect((await admin.post(`/api/admin/bookings/${ref}/delete-client-data`, { confirmReference: "DBP-WRONG1", expectedVersion: d.version })).status).toBe(400);
    expect((await admin.post(`/api/admin/bookings/${ref}/delete-client-data`, { confirmReference: ref.toLowerCase(), expectedVersion: d.version })).status).toBe(200);
    const text = (await admin.get("/api/admin/export.csv?view=all")).body as string; // cancelled rows only show with view=all
    for (const s of ["Quillfeather", "zelda", "5615550142", "QA-STYLE-NOTE"]) expect(text).not.toContain(s);
    expect(text).toContain(ref);
  });
});
