// Fixed-window counters in the store, changed by compare-and-swap (ADR 0002 key rl/<scope>/<id>/<window>).
// take() RESERVES a slot before the work it protects runs. Login uses failClosed (review H3): if the counter
// cannot be written, the attempt is refused. Booking and availability fail open.
import type { Clock } from "../../shared/datetime";
import type { KvStore } from "./store/kv";
import { log } from "./log";

export interface LimitSpec {
  max: number;
  windowMinutes: number;
}
export interface TakeOptions {
  failClosed?: boolean;
  tries?: number;
  /** Overrides the time-window part of the key (the daily booking cap uses the ET date). */
  windowKey?: string;
  /** Used only for Retry-After when windowKey is given. */
  retryAfterSec?: number;
}
export interface TakeResult {
  allowed: boolean;
  retryAfterSec: number;
  /** The counter key that was incremented, so it can be refunded. */
  key: string | null;
}

interface Counter {
  count: number;
}

export class RateLimiter {
  private readonly store: KvStore;
  private readonly clock: Clock;
  constructor(store: KvStore, clock: Clock) {
    this.store = store;
    this.clock = clock;
  }

  private windowInfo(spec: LimitSpec): { start: number; retryAfter: number } {
    const nowSec = Math.floor(Date.parse(this.clock.now()) / 1000);
    const size = spec.windowMinutes * 60;
    const start = Math.floor(nowSec / size) * size;
    return { start, retryAfter: Math.max(1, start + size - nowSec) };
  }

  async take(scope: string, idHash: string, spec: LimitSpec, opts: TakeOptions = {}): Promise<TakeResult> {
    const win = this.windowInfo(spec);
    const key = `rl/${scope}/${idHash}/${opts.windowKey ?? win.start}`;
    const retryAfterSec = opts.retryAfterSec ?? win.retryAfter;
    const tries = opts.tries ?? 3;
    const onFail: TakeResult = { allowed: !opts.failClosed, retryAfterSec, key: null };
    try {
      for (let i = 0; i < tries; i++) {
        const cur = await this.store.get<Counter>(key);
        const count = cur?.value.count ?? 0;
        if (count >= spec.max) return { allowed: false, retryAfterSec, key: null };
        const res = await this.store.set<Counter>(key, { count: count + 1 }, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
        if (res.ok) return { allowed: true, retryAfterSec, key };
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 4)));
      }
    } catch {
      log("warn", "rate limiter store error", { reason: "store_error", kind: scope });
    }
    return onFail;
  }

  /** Gives a reserved slot back (a successful sign-in, a failed booking). Best effort. */
  async refund(key: string | null): Promise<void> {
    if (!key) return;
    try {
      for (let i = 0; i < 3; i++) {
        const cur = await this.store.get<Counter>(key);
        if (!cur || cur.value.count <= 0) return;
        const res = await this.store.set<Counter>(key, { count: cur.value.count - 1 }, { onlyIfMatch: cur.etag });
        if (res.ok) return;
      }
    } catch {
      log("warn", "rate limiter refund error", { reason: "store_error" });
    }
  }
}
