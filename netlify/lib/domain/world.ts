// Loads what the pure availability engine needs: existing day ledgers in a range, and all blocks.
import { addDays, todayEt } from "../../../shared/datetime";
import type { SessionType } from "../../../shared/config-schema";
import type { BlockedTime, DayLedger } from "../../../shared/models";
import { listBlocks } from "../repos/blocks";
import { loadLedgers } from "../repos/ledger";
import type { Services } from "../services";

export interface World {
  ledgers: Map<string, DayLedger>;
  blocks: BlockedTime[];
}

export async function loadWorld(svc: Services, from: string, to: string): Promise<World> {
  const [ledgers, blocks] = await Promise.all([loadLedgers(svc.store, from, to), listBlocks(svc.store)]);
  return { ledgers, blocks };
}

/** Public reads need today..horizon (first open date) plus the requested range. */
export async function loadWorldForType(svc: Services, type: SessionType, from: string, to: string): Promise<World> {
  const today = todayEt(svc.clock.now());
  const horizonEnd = addDays(today, type.bookingHorizonDays);
  const lo = from < today ? from : today;
  const hi = to > horizonEnd ? to : horizonEnd;
  return loadWorld(svc, lo, hi);
}
