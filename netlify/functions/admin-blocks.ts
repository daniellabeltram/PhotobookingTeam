// /api/admin/blocks: list, create (with the overlap confirmation), delete (story 015).
import type { Config } from "@netlify/functions";
import type { BlockItem, OverlappingBooking } from "../../shared/api-types";
import {
  addDays,
  daysBetween,
  etLocalToUtc,
  formatDateStringMedium,
  formatDateStringShort,
  formatDateMedium,
  formatHm,
  formatRangeEt,
} from "../../shared/datetime";
import { blockSchema } from "../../shared/schemas/admin";
import type { BlockedTime } from "../../shared/models";
import { ACTIVE_STATUSES } from "../../shared/status";
import { withAdmin } from "../lib/auth/guard";
import { plainOverlap } from "../lib/domain/overlap";
import { HttpError } from "../lib/errors";
import { fieldErrors, json, noContent, readJsonBody, validationFailed } from "../lib/http";
import { log } from "../lib/log";
import { deleteBlock, getBlock, isBlockId, listBlocks, newBlockId, putBlock } from "../lib/repos/blocks";
import { listBookings } from "../lib/repos/bookings";

function displayOf(b: BlockedTime): string {
  if (b.kind === "time_range") {
    return `${formatDateStringMedium(b.startDate)}, ${formatHm(b.startTime as string)} – ${formatHm(b.endTime as string)} ET`;
  }
  if (b.startDate === b.endDate) return `${formatDateStringMedium(b.startDate)} (all day)`;
  return `${formatDateStringShort(b.startDate)} – ${formatDateStringMedium(b.endDate)} (all day)`;
}

export function toItem(b: BlockedTime): BlockItem {
  return {
    id: b.id,
    kind: b.kind,
    startDate: b.startDate,
    endDate: b.endDate,
    startTime: b.startTime,
    endTime: b.endTime,
    startUtc: b.startUtc,
    endUtc: b.endUtc,
    label: b.label,
    display: displayOf(b),
  };
}

export default withAdmin("admin-blocks", [
  {
    method: "GET",
    pattern: "/api/admin/blocks",
    handler: async (req, _p, rc) => {
      const includePast = new URL(req.url).searchParams.get("includePast") === "true";
      const now = rc.svc.clock.now();
      const blocks = (await listBlocks(rc.svc.store)).filter((b) => includePast || b.endUtc > now);
      return json(200, { items: blocks.map(toItem) });
    },
  },
  {
    method: "POST",
    pattern: "/api/admin/blocks",
    handler: async (req, _p, rc) => {
      const { svc } = rc;
      const parsed = blockSchema.safeParse(await readJsonBody(req));
      if (!parsed.success) throw validationFailed(fieldErrors(parsed.error));
      const body = parsed.data;
      const now = svc.clock.now();

      let startUtc: string | null;
      let endUtc: string | null;
      if (body.kind === "all_day") {
        if (body.endDate < body.startDate) throw validationFailed({ endDate: "The end must be after the start" }, "The end must be after the start");
        if (daysBetween(body.startDate, body.endDate) >= 366) throw validationFailed({ endDate: "A block can cover at most 366 days" });
        startUtc = etLocalToUtc(body.startDate, "00:00");
        endUtc = etLocalToUtc(addDays(body.endDate, 1), "00:00");
      } else {
        if (body.startDate !== body.endDate) throw validationFailed({ endDate: "A time range must be on one date" });
        if (body.endTime <= body.startTime) throw validationFailed({ endTime: "The end must be after the start" }, "The end must be after the start");
        startUtc = etLocalToUtc(body.startDate, body.startTime);
        endUtc = etLocalToUtc(body.endDate, body.endTime);
        if (!startUtc) throw validationFailed({ startTime: "That time doesn't exist on that date because the clocks change" });
        if (!endUtc) throw validationFailed({ endTime: "That time doesn't exist on that date because the clocks change" });
      }
      if (!startUtc || !endUtc) throw validationFailed({ startDate: "That date isn't valid" });
      if (endUtc <= now) throw validationFailed({ [body.kind === "all_day" ? "endDate" : "endTime"]: "That time has already passed" }, "That time has already passed");

      const overlapping: OverlappingBooking[] = (await listBookings(svc.store))
        .filter((b) => ACTIVE_STATUSES.includes(b.status) && plainOverlap(startUtc, endUtc, b.startUtc, b.endUtc))
        .map((b) => ({
          id: b.id,
          clientName: b.contact?.fullName ?? null,
          display: { date: formatDateMedium(b.startUtc), timeRange: formatRangeEt(b.startUtc, b.endUtc) },
          status: b.status,
        }));
      if (overlapping.length > 0 && !body.confirmOverlaps) {
        throw new HttpError("BLOCK_OVERLAPS_BOOKINGS", "This block covers existing bookings. They won't be changed.", { bookings: overlapping });
      }

      const block: BlockedTime = {
        id: newBlockId(),
        kind: body.kind,
        startDate: body.startDate,
        endDate: body.endDate,
        startTime: body.kind === "time_range" ? body.startTime : null,
        endTime: body.kind === "time_range" ? body.endTime : null,
        startUtc,
        endUtc,
        label: body.label?.trim() ? body.label.trim() : null,
        createdAt: now,
      };
      await putBlock(svc.store, block);
      log("info", "block created", { requestId: rc.requestId, reason: "block_created", kind: block.kind, count: overlapping.length });
      return json(201, { block: toItem(block), overlappingBookings: overlapping });
    },
  },
  {
    method: "DELETE",
    pattern: "/api/admin/blocks/:id",
    handler: async (_r, p, rc) => {
      const id = p.id ?? "";
      if (!isBlockId(id) || !(await getBlock(rc.svc.store, id))) throw new HttpError("NOT_FOUND", "We couldn't find that block.");
      await deleteBlock(rc.svc.store, id);
      return noContent();
    },
  },
]);

export const config: Config = { path: ["/api/admin/blocks", "/api/admin/blocks/:id"], method: ["GET", "POST", "DELETE"] };
