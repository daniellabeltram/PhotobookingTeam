// /api/admin/mini-days: Holiday Minis windows created by hand (story 003). Each change is ONE ledger CAS.
import type { Config } from "@netlify/functions";
import type { MiniDayItem, MiniDaySlotItem, MiniRejection, MiniRejectCode } from "../../shared/api-types";
import { addMinutes, etDateOf, etLocalToUtc, etTimeOf, formatHm, formatRangeEt, isValidDate, todayEt } from "../../shared/datetime";
import { miniSlotsSchema } from "../../shared/schemas/admin";
import type { DayLedger, MiniSlot } from "../../shared/models";
import { withAdmin } from "../lib/auth/guard";
import { entryInterval, gapConflict, miniSlotInterval, plainOverlap } from "../lib/domain/overlap";
import { HttpError } from "../lib/errors";
import { fieldErrors, json, noContent, readJsonBody, validationFailed } from "../lib/http";
import { log } from "../lib/log";
import { listBlocks } from "../lib/repos/blocks";
import { listLedgerDates, mutateLedger, readLedger } from "../lib/repos/ledger";
import type { Services } from "../lib/services";

const slotItem = (s: MiniSlot): MiniDaySlotItem => ({
  id: s.id,
  localTime: etTimeOf(s.startUtc),
  rangeLabel: formatRangeEt(s.startUtc, s.endUtc),
  bookingId: s.bookingId,
});
const dayItem = (date: string, l: DayLedger): MiniDayItem => {
  const slots = [...(l.miniDay?.slots ?? [])].sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  return {
    date,
    location: l.miniDay?.location ?? "",
    theme: l.miniDay?.theme ?? null,
    slots: slots.map(slotItem),
    totalSpots: slots.length,
    booked: slots.filter((s) => s.bookingId).length,
  };
};
const checkDate = (date: string | undefined): string => {
  if (!date || !isValidDate(date)) throw new HttpError("NOT_FOUND", "We couldn't find that mini day.");
  return date;
};
const busy = () => new HttpError("BUSY", "We're a little busy. Please try again in a moment.");

type AddResult = { error: string } | { created: string[]; rejected: MiniRejection[]; day: DayLedger | null };

async function addSlots(svc: Services, date: string, raw: Record<string, unknown>): Promise<AddResult> {
  const parsed = miniSlotsSchema.safeParse(raw);
  if (!parsed.success) throw validationFailed(fieldErrors(parsed.error));
  const body = parsed.data;
  const type = svc.config.sessionTypes.find((t) => t.kind === "mini" && t.active);
  if (!type) throw new HttpError("SESSION_TYPE_UNAVAILABLE", "Holiday Minis aren't set up.");
  const blocks = await listBlocks(svc.store);
  const now = svc.clock.now();

  const outcome = await mutateLedger<AddResult>(svc.store, svc.clock, date, (ledger) => {
    const existing = ledger.miniDay;
    if (existing) {
      if ((body.location && body.location !== existing.location) || (body.theme !== undefined && (body.theme ?? null) !== existing.theme)) {
        return { result: { error: "That date already has a mini day. Edit it instead." } };
      }
    } else if (!body.location) {
      return { result: { error: "Enter a location for the new mini day." } };
    }
    const day = existing ?? { location: body.location as string, theme: body.theme ?? null, createdAt: now, slots: [] as MiniSlot[] };
    const created: string[] = [];
    const rejected: MiniRejection[] = [];
    const reject = (startTime: string, code: MiniRejectCode, message: string) => rejected.push({ startTime, code, message });

    for (const hm of body.startTimes) {
      const startUtc = /^([01]\d|2[0-3]):[0-5]\d$/.test(hm) ? etLocalToUtc(date, hm) : null;
      if (!startUtc) {
        reject(hm, "INVALID_TIME", "That time isn't valid on that date (clocks change at 2:00 AM).");
        continue;
      }
      const endUtc = addMinutes(startUtc, type.durationMin);
      const busyStartUtc = addMinutes(startUtc, -type.bufferMin);
      const busyEndUtc = addMinutes(endUtc, type.bufferMin);
      if (etDateOf(busyStartUtc) !== date || etDateOf(busyEndUtc) !== date) {
        reject(hm, "INVALID_TIME", "That time is too close to midnight.");
        continue;
      }
      if (startUtc <= now) {
        reject(hm, "IN_PAST", "That time has already passed");
        continue;
      }
      if (day.slots.some((s) => s.startUtc === startUtc)) {
        reject(hm, "DUPLICATE", "That time is already in the list.");
        continue;
      }
      const mine = { startUtc, endUtc, bufferMin: type.bufferMin };
      if (day.slots.some((s) => gapConflict(mine, miniSlotInterval(s)))) {
        reject(hm, "OVERLAPS_MINI_SLOT", "That time overlaps another mini slot.");
        continue;
      }
      if (ledger.entries.some((e) => e.kind !== "mini" && gapConflict(mine, entryInterval(e)))) {
        reject(hm, "OVERLAPS_BOOKING", `These slots overlap another booking at ${formatHm(hm)}.`);
        continue;
      }
      if (blocks.some((b) => plainOverlap(startUtc, endUtc, b.startUtc, b.endUtc))) {
        reject(hm, "OVERLAPS_BLOCK", "That time is blocked.");
        continue;
      }
      day.slots.push({ id: `ms_${date}_${hm.replace(":", "")}`, startUtc, endUtc, busyStartUtc, busyEndUtc, bookingId: null });
      created.push(hm);
    }
    if (created.length === 0) return { result: { created, rejected, day: null } };
    ledger.miniDay = day;
    return { write: ledger, result: { created, rejected, day: ledger } };
  });
  if (!outcome.ok) throw busy();
  return outcome.result;
}

export default withAdmin("admin-mini-days", [
  {
    method: "GET",
    pattern: "/api/admin/mini-days",
    handler: async (req, _p, rc) => {
      const q = new URL(req.url).searchParams;
      const today = todayEt(rc.svc.clock.now());
      const from = q.get("from") ?? today;
      const to = q.get("to");
      if (!isValidDate(from) || (to !== null && !isValidDate(to))) throw validationFailed({ from: "Enter a date like 2026-12-05" });
      const dates = (await listLedgerDates(rc.svc.store)).filter((d) => d >= from && (!to || d <= to));
      const items: MiniDayItem[] = [];
      for (const d of dates) {
        const l = await readLedger(rc.svc.store, d);
        if (l?.miniDay) items.push(dayItem(d, l));
      }
      return json(200, { items });
    },
  },
  {
    method: "POST",
    pattern: "/api/admin/mini-days/:date/slots",
    handler: async (req, p, rc) => {
      const date = checkDate(p.date);
      const out = await addSlots(rc.svc, date, await readJsonBody(req));
      if ("error" in out) throw validationFailed({ location: out.error as string }, out.error as string);
      if (!out.day) {
        throw new HttpError("SLOT_TAKEN", "None of those times could be added.", { rejected: out.rejected });
      }
      log("info", "mini slots created", { requestId: rc.requestId, reason: "mini_slots_created", count: out.created.length });
      const item = dayItem(date, out.day);
      return json(201, {
        miniDay: { date, location: item.location, theme: item.theme, slots: item.slots },
        created: out.created,
        rejected: out.rejected,
      });
    },
  },
  {
    method: "DELETE",
    pattern: "/api/admin/mini-days/:date/slots/:slotId",
    handler: async (_r, p, rc) => {
      const date = checkDate(p.date);
      const outcome = await mutateLedger<"ok" | "missing" | "booked">(rc.svc.store, rc.svc.clock, date, (ledger) => {
        const slot = ledger.miniDay?.slots.find((s) => s.id === p.slotId);
        if (!ledger.miniDay || !slot) return { result: "missing" as const };
        if (slot.bookingId) return { result: "booked" as const };
        ledger.miniDay.slots = ledger.miniDay.slots.filter((s) => s.id !== slot.id);
        if (ledger.miniDay.slots.length === 0) ledger.miniDay = null;
        return { write: ledger, result: "ok" as const };
      });
      if (!outcome.ok) throw busy();
      if (outcome.result === "missing") throw new HttpError("NOT_FOUND", "We couldn't find that mini slot.");
      if (outcome.result === "booked") throw new HttpError("MINI_DAY_HAS_BOOKINGS", "That slot is booked. Cancel the booking first.");
      return noContent();
    },
  },
  {
    method: "DELETE",
    pattern: "/api/admin/mini-days/:date",
    handler: async (_r, p, rc) => {
      const date = checkDate(p.date);
      const outcome = await mutateLedger<{ kind: "ok" | "missing" | "booked"; booked?: number }>(rc.svc.store, rc.svc.clock, date, (ledger) => {
        if (!ledger.miniDay) return { result: { kind: "missing" as const } };
        const booked = ledger.miniDay.slots.filter((s) => s.bookingId).length;
        if (booked > 0) return { result: { kind: "booked" as const, booked } };
        ledger.miniDay = null;
        return { write: ledger, result: { kind: "ok" as const } };
      });
      if (!outcome.ok) throw busy();
      if (outcome.result.kind === "missing") throw new HttpError("NOT_FOUND", "We couldn't find that mini day.");
      if (outcome.result.kind === "booked") {
        throw new HttpError("MINI_DAY_HAS_BOOKINGS", "Some of those slots are booked. Cancel those bookings first.", { booked: outcome.result.booked });
      }
      return noContent();
    },
  },
]);

export const config: Config = {
  path: ["/api/admin/mini-days", "/api/admin/mini-days/:date", "/api/admin/mini-days/:date/slots", "/api/admin/mini-days/:date/slots/:slotId"],
  method: ["GET", "POST", "DELETE"],
};
