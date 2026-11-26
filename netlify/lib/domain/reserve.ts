// Atomic slot reservation (ADR 0002): one compare-and-swap on the day ledger.
import type { Clock } from "../../../shared/datetime";
import type { LedgerEntry } from "../../../shared/models";
import { mutateLedger, sleepBackoff } from "../repos/ledger";
import type { KvStore } from "../store/kv";
import { entryInterval, gapConflict, miniSlotInterval } from "./overlap";

export type ReserveResult =
  | { ok: true }
  | { ok: false; reason: "conflict" | "cap" | "mini_unavailable" | "busy" };

export interface ReserveInput {
  date: string;
  entry: LedgerEntry;
  /** The daily cap for non-mini entries that count toward it. */
  maxSessionsPerDay: number;
}

/**
 * Adds `entry` to the day's ledger unless it conflicts. Entries of the SAME booking never conflict with it
 * (a reschedule briefly holds both the old and the new time, see rescheduleBooking).
 */
export async function reserveSlot(store: KvStore, clock: Clock, input: ReserveInput): Promise<ReserveResult> {
  const { entry } = input;
  const mine = entryInterval(entry);
  const outcome = await mutateLedger<ReserveResult>(store, clock, input.date, (ledger) => {
    const same = ledger.entries.find((e) => e.bookingId === entry.bookingId && e.startUtc === entry.startUtc);
    if (same && same.endUtc === entry.endUtc) return { result: { ok: true } }; // same request again: already reserved
    const others = ledger.entries.filter((e) => e.bookingId !== entry.bookingId);
    if (entry.kind === "mini") {
      const slot = ledger.miniDay?.slots.find((s) => s.id === entry.miniSlotId && s.startUtc === entry.startUtc);
      if (!slot || (slot.bookingId !== null && slot.bookingId !== entry.bookingId)) {
        return { result: { ok: false, reason: "mini_unavailable" } };
      }
      slot.bookingId = entry.bookingId;
    } else {
      if (others.some((e) => gapConflict(mine, entryInterval(e)))) return { result: { ok: false, reason: "conflict" } };
      if ((ledger.miniDay?.slots ?? []).some((s) => gapConflict(mine, miniSlotInterval(s)))) {
        return { result: { ok: false, reason: "conflict" } };
      }
      if (entry.countsTowardDailyCap && others.filter((e) => e.countsTowardDailyCap).length >= input.maxSessionsPerDay) {
        return { result: { ok: false, reason: "cap" } };
      }
    }
    ledger.entries = ledger.entries.filter((e) => e !== same && !(e.bookingId === entry.bookingId && e.startUtc === entry.startUtc));
    ledger.entries.push(entry); // a longer or shorter session at the same start replaces its own entry
    return { write: ledger, result: { ok: true } };
  });
  return outcome.ok ? outcome.result : { ok: false, reason: "busy" };
}

/**
 * Removes the booking's ledger entries (only the one starting at `startUtc` when given) and frees its mini slot.
 * Safe to repeat. Returns false when the write kept losing races (the caller logs it; orphan pruning also heals).
 */
export async function releaseEntry(
  store: KvStore,
  clock: Clock,
  date: string,
  bookingId: string,
  startUtc?: string,
): Promise<boolean> {
  const outcome = await mutateLedger<boolean>(store, clock, date, (ledger) => {
    const before = ledger.entries.length;
    ledger.entries = ledger.entries.filter((e) => !(e.bookingId === bookingId && (!startUtc || e.startUtc === startUtc)));
    let changed = ledger.entries.length !== before;
    for (const s of ledger.miniDay?.slots ?? []) {
      if (s.bookingId === bookingId && (!startUtc || s.startUtc === startUtc)) {
        s.bookingId = null;
        changed = true;
      }
    }
    return changed ? { write: ledger, result: true } : { result: true };
  });
  return outcome.ok;
}

/**
 * releaseEntry with extra rounds, for the paths where a failed release would leave a hold behind (cancel, decline,
 * complete, reschedule). Each round already retries the CAS; this adds a pause and another round.
 */
export async function releaseWithRetries(
  store: KvStore,
  clock: Clock,
  date: string,
  bookingId: string,
  startUtc?: string,
  rounds = 3,
): Promise<boolean> {
  for (let i = 0; i < rounds; i++) {
    try {
      if (await releaseEntry(store, clock, date, bookingId, startUtc)) return true;
    } catch {
      /* a store error counts as a failed round */
    }
    if (i < rounds - 1) await sleepBackoff(i + 2);
  }
  return false;
}
