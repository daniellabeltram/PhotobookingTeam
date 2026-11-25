import { describe, it } from "vitest";
import { appendFileSync } from "node:fs";
const console = { log: (...a: unknown[]) => appendFileSync("/tmp/claude-0/-home-user-PhotobookingTeam/174b96b1-4dbf-5d12-9b3a-c56c8e9e074c/scratchpad/dbg.txt", a.join(" ") + "\n") };
import { freshApp } from "../../helpers/app";
import { ADMIN_PASSWORD } from "../../helpers/seed";
import { buildBookingBody, firstOpenSlot } from "../../helpers/builders";

describe("scratch", () => {
  it("block flow", async () => {
    const app = await freshApp();
    const api = app.api();
    const admin = app.api();
    const login = await admin.login(undefined, ADMIN_PASSWORD);
    console.log("login", login.status);
    const slot = await firstOpenSlot(api, "portraits", "2026-12-01", "2027-01-31");
    console.log("slot", slot.startUtc, slot.localDate, slot.localTime);
    const booked = await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    console.log("book", booked.status);
    const before = await api.get(`/api/availability?type=portraits&from=${slot.localDate}&to=${slot.localDate}`);
    console.log(JSON.stringify(before.body.data.days));
    const saved = await admin.post("/api/admin/blocks", { kind: "all_day", startDate: slot.localDate, endDate: slot.localDate, label: "x", confirmOverlaps: true });
    console.log("saved", saved.status, JSON.stringify(saved.body));
    const del = await admin.del(`/api/admin/blocks/${saved.body.data.block.id}`);
    console.log("del", del.status);
    const after = await api.get(`/api/availability?type=portraits&from=${slot.localDate}&to=${slot.localDate}`);
    console.log(JSON.stringify(after.body.data.days));
  });
});
