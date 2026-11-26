// Security review M-1 and L-2: client-typed location text is never echoed by our email or calendar file, and the
// idempotency store holds no personal details (and is purged on "Delete client data").
import { describe, expect, it } from "vitest";
import { freshApp } from "../../helpers/app";
import { buildBookingBody, firstOpenSlot, newKey } from "../../helpers/builders";
import { CLIENT } from "../../helpers/seed";
import type { KvStore } from "../../../netlify/lib/store/kv";

const FROM = "2026-12-01";
const TO = "2027-01-15";
const OWN_TEXT = "77 Hidden Lane, Palm Beach (gate code 4455) call 5615550177";

async function setup() {
  const app = await freshApp();
  const api = app.api();
  const admin = app.api();
  expect((await admin.login()).status).toBe(200);
  const svcMod = await import("../../../netlify/lib/services");
  const svc = svcMod.getServices();
  const emails = svc.email as unknown as { sent: any[]; clear(): void };
  return { api, admin, svc, emails };
}
const icsOf = (mail: any) => Buffer.from(mail.attachments[0].contentBase64, "base64").toString("utf8");
const everything = (mail: any) => `${mail.subject}\n${mail.text}\n${mail.html}${mail.attachments ? "\n" + icsOf(mail) : ""}`;

describe("M-1: own-location text is not echoed", () => {
  it("booking_received, confirmed, rescheduled and cancelled emails and their .ics say 'the location you gave us'", async () => {
    const { api, admin, emails } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const body = buildBookingBody({ type: "portraits", slot, override: { location: { kind: "own", text: OWN_TEXT } } });
    const created = await api.createBooking(body);
    expect(created.status).toBe(201);
    const id = created.body.data.reference as string;
    expect(created.body.data.locationLabel).toBe(OWN_TEXT); // the client's own confirmation screen may show what they typed

    const first = emails.sent.find((m) => m.kind === "booking_received");
    expect(everything(first)).not.toContain("Hidden Lane");
    expect(everything(first)).not.toContain("4455");
    expect(everything(first)).not.toContain("5615550177");
    expect(first.text).toContain("Where: the location you gave us");
    expect(icsOf(first)).toContain("LOCATION:the location you gave us");

    const v = (await admin.get(`/api/admin/bookings/${id}`)).body.data;
    expect(v.location).toEqual({ kind: "own", text: OWN_TEXT }); // Daniella sees everything
    emails.clear();
    const paid = await admin.patch(`/api/admin/bookings/${id}`, { action: "mark_paid", expectedVersion: v.version, amountCents: 10000, receivedOn: "2026-12-01" });
    expect(paid.status).toBe(200);
    const confirmed = emails.sent.find((m) => m.kind === "confirmed");
    expect(everything(confirmed)).not.toContain("Hidden Lane");
    expect(confirmed.text).toContain("the location you gave us");

    emails.clear();
    const days = (await admin.get(`/api/admin/availability?type=portraits&from=${slot.localDate}&to=2026-12-22&excludeBookingId=${id}`)).body.data.days as { slots: any[] }[];
    const target = days.flatMap((d) => d.slots).find((s) => s.startUtc !== slot.startUtc)!;
    await admin.post(`/api/admin/bookings/${id}/reschedule`, { expectedVersion: paid.body.data.booking.version, startUtc: target.startUtc, reason: "weather" });
    const moved = emails.sent.find((m) => m.kind === "rescheduled");
    expect(everything(moved)).not.toContain("Hidden Lane");
    expect(icsOf(moved)).toContain("LOCATION:the location you gave us");

    emails.clear();
    const cur = (await admin.get(`/api/admin/bookings/${id}`)).body.data;
    await admin.patch(`/api/admin/bookings/${id}`, { action: "cancel", expectedVersion: cur.version, reason: "other" });
    expect(everything(emails.sent.find((m) => m.kind === "cancelled"))).not.toContain("Hidden Lane");
    // Daniella's own notice never had it either
    expect(JSON.stringify(emails.sent.filter((m) => m.kind === "admin_new_booking"))).not.toContain("Hidden Lane");
  });
  it("a preset location label is ours, so it is printed", async () => {
    const { api, emails } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    await api.createBooking(buildBookingBody({ type: "portraits", slot, override: { location: { kind: "suggested", optionId: "downtown-waterfront" } } }));
    const mail = emails.sent.find((m) => m.kind === "booking_received");
    expect(mail.text).toContain("Where: Downtown West Palm Beach / waterfront");
    expect(icsOf(mail)).toContain("LOCATION:Downtown West Palm Beach / waterfront");
  });
  it("'help me choose' still says Daniella will email suggestions", async () => {
    const { api, emails } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    expect(icsOf(emails.sent.find((m) => m.kind === "booking_received"))).toContain("Location to be confirmed");
  });
});

async function idemDump(store: KvStore) {
  const keys = await store.list("idem/");
  return { keys, text: JSON.stringify(await Promise.all(keys.map((k) => store.get(k)))) };
}

describe("L-2: idempotency records hold no personal details", () => {
  it("the stored record has no name, email, phone, notes or location text; a replay still returns the same 201", async () => {
    const { api, svc } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const body = buildBookingBody({ type: "portraits", slot, override: { location: { kind: "own", text: OWN_TEXT } } });
    const key = newKey();
    const first = await api.createBooking(body, key);
    const { keys, text } = await idemDump(svc.store);
    expect(keys).toHaveLength(1);
    for (const needle of [OWN_TEXT, "Hidden Lane", CLIENT.fullName, "Quillfeather", CLIENT.email, CLIENT.phone, "QA-STYLE-NOTE", "QA-ANYTHING-ELSE"]) {
      expect(text, `idem/ leaked ${needle}`).not.toContain(needle);
    }
    expect(text).toContain(first.body.data.reference);
    const replay = await api.createBooking(body, key);
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(first.body); // locationLabel is filled back from the booking
  });
  it("delete client data removes the booking's idempotency records and any record older than 48 hours", async () => {
    const { api, admin, svc } = await setup();
    const slot = await firstOpenSlot(api, "portraits", FROM, TO);
    const other = await firstOpenSlot(api, "couples", FROM, TO, undefined, 3);
    const id = (await api.createBooking(buildBookingBody({ type: "portraits", slot }), newKey())).body.data.reference as string;
    const keepId = (await api.createBooking(buildBookingBody({ type: "couples", slot: other, contact: { email: "other@example.test" } }), newKey())).body.data.reference as string;
    // an old record that nothing refers to any more
    await svc.store.set("idem/" + "a".repeat(64), { state: "done", requestHash: "x", createdAt: "2026-11-20T00:00:00.000Z", status: 201, body: { reference: "DBP-OLDOLD" } });
    expect((await idemDump(svc.store)).keys).toHaveLength(3);

    const d = (await admin.get(`/api/admin/bookings/${id}`)).body.data;
    const c = await admin.patch(`/api/admin/bookings/${id}`, { action: "cancel", expectedVersion: d.version, reason: "other", notifyClient: false });
    expect((await admin.post(`/api/admin/bookings/${id}/delete-client-data`, { confirmReference: id, expectedVersion: c.body.data.booking.version })).status).toBe(200);

    const after = await idemDump(svc.store);
    expect(after.text).not.toContain(id);
    expect(after.text).not.toContain("DBP-OLDOLD");
    expect(after.text).toContain(keepId); // other bookings' records stay
    expect(after.keys).toHaveLength(1);
  });
});
