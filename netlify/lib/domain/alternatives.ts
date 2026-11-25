// The 3 nearest open slots for a 409 SLOT_TAKEN (architecture section 9).
import { addDays, etDateOf } from "../../../shared/datetime";
import type { Slot } from "../../../shared/api-types";
import type { BookingConfig, SessionType } from "../../../shared/config-schema";
import type { BlockedTime, DayLedger } from "../../../shared/models";
import { computeAvailability } from "./availability";

export function nearestAlternatives(args: {
  config: BookingConfig;
  type: SessionType;
  durationMin: number;
  requestedStartUtc: string;
  nowIso: string;
  ledgers: Map<string, DayLedger>;
  blocks: BlockedTime[];
  ignoreNoticeAndHorizon?: boolean;
  excludeBookingId?: string;
  limit?: number;
}): Slot[] {
  const requestedDate = etDateOf(args.requestedStartUtc);
  const res = computeAvailability({
    config: args.config,
    type: args.type,
    durationMin: args.durationMin,
    from: addDays(requestedDate, -14),
    to: addDays(requestedDate, 14),
    nowIso: args.nowIso,
    ledgers: args.ledgers,
    blocks: args.blocks,
    ignoreNoticeAndHorizon: args.ignoreNoticeAndHorizon,
    excludeBookingId: args.excludeBookingId,
  });
  const want = Date.parse(args.requestedStartUtc);
  return res.days
    .flatMap((d) => d.slots)
    .filter((s) => s.startUtc !== args.requestedStartUtc)
    .sort((a, b) => {
      const sameA = a.localDate === requestedDate ? 0 : 1;
      const sameB = b.localDate === requestedDate ? 0 : 1;
      if (sameA !== sameB) return sameA - sameB;
      return Math.abs(Date.parse(a.startUtc) - want) - Math.abs(Date.parse(b.startUtc) - want);
    })
    .slice(0, args.limit ?? 3);
}

