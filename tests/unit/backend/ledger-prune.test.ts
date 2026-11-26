// Orphan and stale-entry pruning in the day ledger (ADR 0002, code review S1) and the retry backoff (S2).
import { describe, expect, it } from "vitest";
import { fixedClock } from "../../../netlify/lib/clock";
import { LEDGER_TRIES, mutateLedger, sleepBackoff, setRetryDelay } from "../../../netlify/lib/repos/ledger";
import { MemoryKvStore } from "../../../netlify/lib/store/memory";
import type { KvEntry, KvStore, SetResult, WriteCondition } from "../../../netlify/lib/store/kv";
import type { Booking, DayLedger, LedgerEntry } from "../../../shared/models";

const DATE = "2026-12-09";
const START = "2026-12-09T12:00:00.000Z";
const END = "2026-12-09T13:00:00.000Z";
const NOW = "2026-12-05T15:00:00.000Z";
const iso = (ms: number) => new Date(ms).toISOString();
const ago = (minutes: number) => iso(Date.parse(NOW) - minutes * 60_000);

function entry(id: string, over: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    bookingId: id, sessionTypeId: "portraits", kind: "standard", startUtc: START, endUtc: END,
    busyStartUtc: "2026-12-09T11:30:00.000Z", busyEndUtc: "2026-12-09T13:30:00.000Z",
    countsTowardDailyCap: true, miniSlotId: null, createdAt: ago(60), verified: false, ...over,
  };
}
function booking(id: string, status: Booking["status"], startUtc = START): Booking {
  return { id, status, startUtc } as unknown as Booking;
}
async function seed(store: KvStore, entries: LedgerEntry[], bookings: Booking[], miniDay: DayLedger["miniDay"] = null) {
  await store.set(`days/${DATE}`, { date: DATE, updatedAt: NOW, entries, miniDay } satisfies DayLedger);
  for (const b of bookings) await store.set(`bookings/${b.id}`, b);
}
/** Runs a no-op mutation that forces a write, so pruning is persisted and visible. */
async function touch(store: KvStore, nowIso = NOW): Promise<DayLedger> {
  await mutateLedger(store, fixedClock(nowIso), DATE, (l) => ({ write: l, result: null }));
  return (await store.get<DayLedger>(`days/${DATE}`))!.value;
}

describe("pruning of unverified entries (older than 5 minutes)", () => {
  it("drops an entry with no booking, keeps a fresh one, verifies a valid one", async () => {
    const store = new MemoryKvStore();
    await seed(store, [
      entry("DBP-ORPHAN", { createdAt: ago(10) }),
      entry("DBP-FRESH0", { createdAt: ago(2), startUtc: "2026-12-09T14:00:00.000Z" }),
      entry("DBP-GOOD00", { createdAt: ago(10), startUtc: "2026-12-09T16:00:00.000Z" }),
    ], [booking("DBP-GOOD00", "pending_deposit", "2026-12-09T16:00:00.000Z")]);
    const l = await touch(store);
    expect(l.entries.map((e) => e.bookingId).sort()).toEqual(["DBP-FRESH0", "DBP-GOOD00"]);
    const good = l.entries.find((e) => e.bookingId === "DBP-GOOD00")!;
    expect(good.verified).toBe(true);
    expect(good.checkedAt).toBe(NOW);
  });
  it("drops an entry whose booking is inactive or at another time", async () => {
    const store = new MemoryKvStore();
    await seed(store, [
      entry("DBP-CANCEL", { createdAt: ago(10) }),
      entry("DBP-MOVED0", { createdAt: ago(10), startUtc: "2026-12-09T15:00:00.000Z" }),
    ], [booking("DBP-CANCEL", "cancelled"), booking("DBP-MOVED0", "confirmed", "2026-12-10T15:00:00.000Z")]);
    expect((await touch(store)).entries).toEqual([]);
  });
  it("frees the mini slot of a dropped orphan", async () => {
    const store = new MemoryKvStore();
    const slot = { id: "ms_2026-12-09_0700", startUtc: START, endUtc: "2026-12-09T12:20:00.000Z", busyStartUtc: START, busyEndUtc: END, bookingId: "DBP-ORPHAN" };
    await seed(store, [entry("DBP-ORPHAN", { kind: "mini", miniSlotId: slot.id, createdAt: ago(10) })], [], { location: "X", theme: null, createdAt: NOW, slots: [slot] });
    const l = await touch(store);
    expect(l.entries).toEqual([]);
    expect(l.miniDay!.slots[0]!.bookingId).toBeNull();
  });
});

describe("verified entries are re-checked about once a day (S1)", () => {
  it("a verified hold older than a day whose booking was cancelled is dropped (a release that failed heals itself)", async () => {
    const store = new MemoryKvStore();
    await seed(store, [entry("DBP-STALE0", { verified: true, createdAt: ago(60 * 48) })], [booking("DBP-STALE0", "cancelled")]);
    expect((await touch(store)).entries).toEqual([]);
  });
  it("also for declined, completed and moved bookings", async () => {
    for (const b of [booking("DBP-STALE0", "declined"), booking("DBP-STALE0", "completed"), booking("DBP-STALE0", "confirmed", "2026-12-20T12:00:00.000Z")]) {
      const store = new MemoryKvStore();
      await seed(store, [entry("DBP-STALE0", { verified: true, createdAt: ago(60 * 30) })], [b]);
      expect((await touch(store)).entries, b.status).toEqual([]);
    }
  });
  it("a verified entry for a still-active booking stays, and is stamped so it is not re-read all day", async () => {
    const store = new MemoryKvStore();
    await seed(store, [entry("DBP-LIVE00", { verified: true, createdAt: ago(60 * 48) })], [booking("DBP-LIVE00", "confirmed")]);
    let reads = 0;
    const spy: KvStore = {
      get: async <T,>(k: string): Promise<KvEntry<T> | null> => {
        if (k.startsWith("bookings/")) reads++;
        return store.get<T>(k);
      },
      set: <T,>(k: string, v: T, c?: WriteCondition): Promise<SetResult> => store.set(k, v, c),
      delete: (k) => store.delete(k),
      list: (p) => store.list(p),
    };
    await touch(spy);
    expect(reads).toBe(1);
    const l = await touch(spy, iso(Date.parse(NOW) + 3 * 3_600_000));
    expect(reads).toBe(1); // checked 3 hours ago: not again
    expect(l.entries).toHaveLength(1);
    expect(l.entries[0]!.checkedAt).toBe(NOW);
    await touch(spy, iso(Date.parse(NOW) + 25 * 3_600_000));
    expect(reads).toBe(2); // a day later: checked again
  });
  it("a young verified entry is trusted without a read (no extra cost on a busy day)", async () => {
    const store = new MemoryKvStore();
    await seed(store, [entry("DBP-YOUNG0", { verified: true, createdAt: ago(60 * 5) })], [booking("DBP-YOUNG0", "cancelled")]);
    expect((await touch(store)).entries).toHaveLength(1); // not yet due; the explicit release or the daily check removes it
  });
});

describe("retry backoff (S2)", () => {
  it("allows 10 tries and the delay grows with the attempt, within a cap", async () => {
    expect(LEDGER_TRIES).toBe(10);
    setRetryDelay(20, 80);
    const time = async (attempt: number) => {
      const t0 = Date.now();
      await sleepBackoff(attempt);
      return Date.now() - t0;
    };
    expect(await time(0)).toBeLessThan(200);
    const late = await time(8); // 20 * 1.5^8 = 512 ms up to the 600 ms cap
    expect(late).toBeGreaterThanOrEqual(480);
    expect(late).toBeLessThan(900);
    setRetryDelay(0, 4);
  });
});
