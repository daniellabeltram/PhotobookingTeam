// In-memory driver for tests (ADR 0002). get and set each yield a macrotask first so parallel requests
// really interleave and the CAS path is exercised. The compare and the write are one synchronous step.
import type { KvEntry, KvStore, SetResult, WriteCondition } from "./kv";
import { assertSafeKey } from "./kv";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

export class MemoryKvStore implements KvStore {
  private readonly map = new Map<string, { json: string; etag: string }>();
  private counter = 0;

  async get<T>(key: string): Promise<KvEntry<T> | null> {
    assertSafeKey(key);
    await tick();
    const hit = this.map.get(key);
    return hit ? { value: JSON.parse(hit.json) as T, etag: hit.etag } : null;
  }

  async set<T>(key: string, value: T, cond?: WriteCondition): Promise<SetResult> {
    assertSafeKey(key);
    const json = JSON.stringify(value);
    await tick();
    const cur = this.map.get(key);
    if (cond && "onlyIfNew" in cond && cur) return { ok: false };
    if (cond && "onlyIfMatch" in cond && (!cur || cur.etag !== cond.onlyIfMatch)) return { ok: false };
    const etag = `m${++this.counter}`;
    this.map.set(key, { json, etag });
    return { ok: true, etag };
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await tick();
    this.map.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    await tick();
    return [...this.map.keys()].filter((k) => k.startsWith(prefix)).sort();
  }

  /** Test helper: every stored key and parsed value. */
  dump(): Record<string, unknown> {
    return Object.fromEntries([...this.map.entries()].map(([k, v]) => [k, JSON.parse(v.json)]));
  }
}
