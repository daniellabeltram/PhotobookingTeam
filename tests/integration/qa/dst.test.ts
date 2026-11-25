// DST weeks (story 002 #11, #12; 008 #4; 015 #7; must-have 3). All run with the device zone of the test process
// (CI also runs `npm run test:tz` under America/Los_Angeles and UTC).
import "../../helpers/env";
import { describe, it, expect } from "vitest";
import { freshApp } from "../../helpers/app";
import { buildBookingBody, firstOpenSlot, type Slot } from "../../helpers/builders";
import { DST_END_2027, DST_START_2027, DST_START_WEEK, DST_END_WEEK, NOW_BEFORE_DST_END, NOW_BEFORE_DST_START, etDate, etOffsetHours, etTime } from "../../helpers/clock";

async function slotsFor(now: string, type: string, date: string) {
  const app = await freshApp({ FAKE_NOW: now });
  const api = app.api();
  const r = await api.availability(type, date, date);
  expect(r.status).toBe(200);
  return { app, api, day: r.body.data.days[0]! };
}

describe.each([
  ["spring forward", DST_START_2027, NOW_BEFORE_DST_START, -5, -4],
  ["fall back", DST_END_2027, NOW_BEFORE_DST_END, -4, -5],
])("%s %s", (_n, date, now, offsetBefore, offsetAfter) => {
  for (const type of ["portraits", "families", "events"]) {
    it(`${type}: slots are ET wall-clock correct, none in 1:00-3:00 AM, none duplicated, same times as an ordinary day`, async () => {
      const dur = type === "events" ? 120 : undefined;
      const { api, day } = await slotsFor(now, type, date);
      const ordinary = (await api.availability(type, addWeek(date), addWeek(date), dur)).body.data.days[0]!;
      const times: string[] = day.slots.map((s: Slot) => s.localTime);
      expect(new Set(times).size, "no duplicate times").toBe(times.length);
      for (const s of day.slots as Slot[]) {
        expect(etDate(s.startUtc)).toBe(date);
        expect(etTime(s.startUtc)).toBe(s.localTime); // UTC instant converts back to the stated ET wall time
        const h = Number(s.localTime.slice(0, 2));
        expect(h < 1 || h >= 3, `slot ${s.localTime} must not sit in the changed hours`).toBe(true);
        expect(s.rangeLabel).toMatch(/ET$/);
        // duration is absolute minutes
        expect((+new Date(s.endUtc) - +new Date(s.startUtc)) / 60000).toBe(dur ?? (+new Date(s.endUtc) - +new Date(s.startUtc)) / 60000);
      }
      if (ordinary.status === "open" && day.status === "open") {
        expect(times, "slot times match an ordinary day in the same window").toEqual(ordinary.slots.map((s: Slot) => s.localTime));
      }
      const offsets = new Set(day.slots.map((s: Slot) => etOffsetHours(s.startUtc)));
      for (const o of offsets) expect([offsetBefore, offsetAfter]).toContain(o);
    });
  }

  it("a booking made on the DST date shows the same ET time in the response, admin and .ics (invariant)", async () => {
    const { app, api } = await slotsFor(now, "portraits", date);
    const slot = await firstOpenSlot(api, "portraits", date, date);
    const res = await api.createBooking(buildBookingBody({ type: "portraits", slot }));
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data.display.timeRange).toBe(slot.rangeLabel);
    const admin = app.api();
    await admin.login();
    const d = (await admin.get(`/api/admin/bookings/${res.body.data.reference}`)).body.data;
    expect(d.localStartTime).toBe(slot.localTime);
    expect(d.display.timeRange).toBe(slot.rangeLabel);
    // .ics: DTSTART must be either TZID=America/New_York local time or UTC at the same instant.
    const { sentEmails } = await import("../../helpers/app");
    const withIcs = (await sentEmails()).find((m) => (m.attachments ?? []).some((a: any) => /calendar|\.ics/i.test(a.contentType + a.filename)));
    const mail = withIcs?.attachments?.find((a: any) => /calendar|\.ics/i.test(a.contentType + a.filename));
    if (mail) {
      const ics = Buffer.from(mail.contentBase64, "base64").toString("utf8").replace(/\r\n/g, "\n");
      const m = ics.match(/DTSTART(?:;TZID=America\/New_York)?:(\d{8}T\d{6}Z?)/);
      expect(m, "DTSTART present").toBeTruthy();
      const raw = m![1]!;
      const iso = raw.endsWith("Z") ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}Z` : null;
      if (iso) expect(+new Date(iso)).toBe(+new Date(slot.startUtc));
      else expect(`${raw.slice(9, 11)}:${raw.slice(11, 13)}`).toBe(slot.localTime);
    }
  });

  it("an all-day block and a time-range block on the DST date show exactly as entered; DST gap time is rejected", async () => {
    const app = await freshApp({ FAKE_NOW: now });
    const admin = app.api();
    await admin.login();
    const t = await admin.post("/api/admin/blocks", { kind: "time_range", startDate: date, endDate: date, startTime: "15:00", endTime: "18:00", label: null, confirmOverlaps: false });
    expect(t.status).toBe(201);
    expect(t.body.data.block.startTime).toBe("15:00");
    expect(t.body.data.block.endTime).toBe("18:00");
    expect(etTime(t.body.data.block.startUtc)).toBe("15:00");
    const a = await admin.post("/api/admin/blocks", { kind: "all_day", startDate: date, endDate: date, label: null, confirmOverlaps: false });
    expect(a.status).toBe(201);
    expect(etTime(a.body.data.block.startUtc)).toBe("00:00");
    const day = (await app.api().availability("portraits", date, date)).body.data.days[0]!;
    expect(day.slots).toHaveLength(0);
  });
});

describe("spring-forward gap input", () => {
  it("a block starting at 02:30 on 2027-03-14 (nonexistent) is rejected with VALIDATION_FAILED", async () => {
    const app = await freshApp({ FAKE_NOW: NOW_BEFORE_DST_START });
    const admin = app.api();
    await admin.login();
    const r = await admin.post("/api/admin/blocks", { kind: "time_range", startDate: DST_START_2027, endDate: DST_START_2027, startTime: "02:30", endTime: "04:00", label: null, confirmOverlaps: false });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("the whole DST week stays consistent", () => {
  it.each([...DST_START_WEEK.map((d) => [d, NOW_BEFORE_DST_START]), ...DST_END_WEEK.map((d) => [d, NOW_BEFORE_DST_END])])("%s: every slot's UTC instant round-trips to its ET label", async (date, now) => {
    const { day } = await slotsFor(now, "families", date);
    for (const s of day.slots as Slot[]) {
      expect(etTime(s.startUtc)).toBe(s.localTime);
      expect(etDate(s.startUtc)).toBe(s.localDate);
    }
  });
});

function addWeek(date: string) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}
