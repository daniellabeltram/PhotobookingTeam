// Per-day ledger: days/<YYYY-MM-DD>, changed only by compare-and-swap (ADR 0002).
import type { Clock } from "../../../shared/datetime";
import type { DayLedger } from "../../../shared/models";
import { isActive } from "../../../shared/status";
import type { KvStore } from "../store/kv";
import { getBooking } from "./bookings";

export const ledgerKey = (date: string): string => `days/${date}`;
export const emptyLedger = (date: string, now: string): DayLedger => ({ date, updatedAt: now, entries: [], miniDay: null });

export async function readLedger(store: KvStore, date: string): Promise<DayLedger | null> {
  return (await store.get<DayLedger>(ledgerKey(date)))?.value ?? null;
}
export async function listLedgerDates(store: KvStore): Promise<string[]> {
  return (await store.list("days/")).map((k) => k.slice("days/".length));
}
/** Reads only the ledgers that exist (one list call, then parallel gets). */
export async function loadLedgers(store: KvStore, from: string, to: string): Promise<Map<string, DayLedger>> {
  const dates = (await listLedgerDates(store)).filter((d) => d >= from && d <= to);
  const rows = await Promise.all(dates.map((d) => readLedger(store, d)));
  const map = new Map<string, DayLedger>();
  rows.forEach((l, i) => {
    if (l) map.set(dates[i] as string, l);
  });
  return map;
}

// ---- retry pacing (tests shrink it) ----
let retryMin = 20;
let retryMax = 80;
export function setRetryDelay(min: number, max: number): void {
  retryMin = min;
  retryMax = max;
}
const BACKOFF_GROWTH = 1.5;
const BACKOFF_CAP_MS = 600;
/** Jittered backoff that grows with the attempt number: 20-80 ms, then x1.5 each time, capped. */
export const sleepBackoff = (attempt = 0): Promise<void> => {
  const factor = BACKOFF_GROWTH ** attempt;
  const lo = Math.min(BACKOFF_CAP_MS, retryMin * factor);
  const hi = Math.min(BACKOFF_CAP_MS, Math.max(lo, retryMax * factor));
  return new Promise((r) => setTimeout(r, lo + Math.floor(Math.random() * (hi - lo + 1))));
};
export const sleepRandom = (): Promise<void> => sleepBackoff(0);

export const LEDGER_TRIES = 10;
const ORPHAN_AGE_MS = 5 * 60_000;
const RECHECK_AGE_MS = 24 * 3_600_000;

/**
 * ADR 0002 orphan pruning. An unverified entry older than 5 minutes is valid only if its booking is active at the same
 * time. A verified entry is re-checked the same way once it is about a day old (and then once a day), so a release that
 * failed after a cancel, decline, complete or reschedule heals itself instead of holding the slot forever.
 */
async function prune(store: KvStore, ledger: DayLedger, nowIso: string): Promise<boolean> {
  const now = Date.parse(nowIso);
  let changed = false;
  const keep = [];
  for (const e of ledger.entries) {
    const age = now - Date.parse(e.createdAt);
    const dueForCheck = e.verified ? now - Date.parse(e.checkedAt ?? e.createdAt) >= RECHECK_AGE_MS : age >= ORPHAN_AGE_MS;
    if (!dueForCheck) {
      keep.push(e);
      continue;
    }
    const b = await getBooking(store, e.bookingId);
    if (b && isActive(b.status) && b.startUtc === e.startUtc) {
      keep.push({ ...e, verified: true, checkedAt: nowIso });
    } else {
      const slot = ledger.miniDay?.slots.find((s) => s.bookingId === e.bookingId && s.startUtc === e.startUtc);
      if (slot) slot.bookingId = null;
    }
    changed = true;
  }
  if (changed) ledger.entries = keep;
  return changed;
}

export type MutateOutcome<R> = { ok: true; result: R } | { ok: false };

/**
 * Read the ledger with its ETag, prune orphans, let `fn` decide. When `fn` returns a `write`, it is stored with
 * onlyIfMatch (onlyIfNew for a new day). A lost race re-reads and re-decides, up to `tries` times (default 10) with growing, jittered backoff.
 */
export async function mutateLedger<R>(
  store: KvStore,
  clock: Clock,
  date: string,
  fn: (ledger: DayLedger) => { write?: DayLedger; result: R },
  tries = LEDGER_TRIES,
): Promise<MutateOutcome<R>> {
  for (let attempt = 0; attempt < tries; attempt++) {
    const cur = await store.get<DayLedger>(ledgerKey(date));
    const now = clock.now();
    const ledger: DayLedger = cur ? structuredClone(cur.value) : emptyLedger(date, now);
    await prune(store, ledger, now);
    const decision = fn(ledger);
    if (!decision.write) return { ok: true, result: decision.result };
    decision.write.updatedAt = now;
    const res = await store.set(ledgerKey(date), decision.write, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (res.ok) return { ok: true, result: decision.result };
    if (attempt < tries - 1) await sleepBackoff(attempt);
  }
  return { ok: false };
}
