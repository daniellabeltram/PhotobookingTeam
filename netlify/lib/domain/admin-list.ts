// Filtering, summary and paging for GET /api/admin/bookings and the CSV export.
import type { AdminBookingListData } from "../../../shared/api-types";
import type { ListQuery } from "../../../shared/schemas/admin";
import type { Booking } from "../../../shared/models";
import { ACTIVE_STATUSES, deriveFlags, type FlagSettings } from "../../../shared/status";
import { listBookings } from "../repos/bookings";
import type { Services } from "../services";
import { listItem } from "./views";

export const flagSettings = (svc: Services): FlagSettings => ({
  unpaidHoldHours: svc.config.scheduling.unpaidHoldHours,
  requestResponseDays: svc.config.scheduling.requestResponseDays,
});

export function filterBookings(all: Booking[], q: ListQuery, nowIso: string, settings: FlagSettings): Booking[] {
  const statuses = q.status ?? (q.view === "upcoming" ? [...ACTIVE_STATUSES] : null);
  const needle = q.q?.toLowerCase();
  const out = all.filter((b) => {
    if (q.view === "upcoming" && b.startUtc < nowIso) return false;
    if (q.view === "past" && b.startUtc >= nowIso) return false;
    if (statuses && !statuses.includes(b.status)) return false;
    if (q.rescheduled && b.rescheduleCount === 0) return false;
    if (q.flag && !deriveFlags(b, nowIso, settings).includes(q.flag)) return false;
    if (q.type && !q.type.includes(b.sessionTypeId)) return false;
    if (q.from && b.localDate < q.from) return false;
    if (q.to && b.localDate > q.to) return false;
    if (needle) {
      const hay = `${b.contact?.fullName ?? ""}\n${b.contact?.email ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  out.sort((a, b) => (q.view === "upcoming" ? a.startUtc.localeCompare(b.startUtc) : b.startUtc.localeCompare(a.startUtc)));
  return out;
}

export function summarize(all: Booking[], nowIso: string, settings: FlagSettings): AdminBookingListData["summary"] {
  let upcomingPendingDeposit = 0;
  let depositOverdue = 0;
  let requestsWaiting = 0;
  let replyOverdue = 0;
  for (const b of all) {
    const flags = deriveFlags(b, nowIso, settings);
    if (b.status === "pending_deposit" && b.startUtc >= nowIso) upcomingPendingDeposit++;
    if (flags.includes("deposit_overdue")) depositOverdue++;
    if (b.status === "requested") requestsWaiting++;
    if (flags.includes("reply_overdue")) replyOverdue++;
  }
  return { upcomingPendingDeposit, depositOverdue, requestsWaiting, replyOverdue };
}

export async function listForAdmin(svc: Services, q: ListQuery): Promise<AdminBookingListData> {
  const all = await listBookings(svc.store);
  const now = svc.clock.now();
  const settings = flagSettings(svc);
  const filtered = filterBookings(all, q, now, settings);
  const start = (q.page - 1) * q.pageSize;
  return {
    items: filtered.slice(start, start + q.pageSize).map((b) => listItem(b, now, settings)),
    total: filtered.length,
    page: q.page,
    pageSize: q.pageSize,
    summary: summarize(all, now, settings),
  };
}
