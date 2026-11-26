// The KvStore contract (ADR 0002) run against the memory and file drivers.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileKvStore } from "../../../netlify/lib/store/file";
import type { KvStore } from "../../../netlify/lib/store/kv";
import { MemoryKvStore } from "../../../netlify/lib/store/memory";

const drivers: [string, () => KvStore][] = [
  ["memory", () => new MemoryKvStore()],
  ["file", () => new FileKvStore(mkdtempSync(join(tmpdir(), "dbp-kv-")))],
];

describe.each(drivers)("KvStore contract: %s", (_name, make) => {
  it("get on a missing key is null; set then get round-trips with an etag", async () => {
    const kv = make();
    expect(await kv.get("a/b")).toBeNull();
    const w = await kv.set("a/b", { n: 1 });
    expect(w.ok).toBe(true);
    const got = await kv.get<{ n: number }>("a/b");
    expect(got?.value).toEqual({ n: 1 });
    expect(typeof got?.etag).toBe("string");
  });

  it("onlyIfNew succeeds once", async () => {
    const kv = make();
    expect((await kv.set("k", 1, { onlyIfNew: true })).ok).toBe(true);
    expect((await kv.set("k", 2, { onlyIfNew: true })).ok).toBe(false);
    expect((await kv.get<number>("k"))?.value).toBe(1);
  });

  it("onlyIfMatch needs the current etag", async () => {
    const kv = make();
    const first = await kv.set("k", { v: 1 });
    if (!first.ok) throw new Error("setup");
    expect((await kv.set("k", { v: 2 }, { onlyIfMatch: "wrong" })).ok).toBe(false);
    const ok = await kv.set("k", { v: 2 }, { onlyIfMatch: first.etag });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect((await kv.set("k", { v: 3 }, { onlyIfMatch: first.etag })).ok).toBe(false); // stale
    expect((await kv.get<{ v: number }>("k"))?.value.v).toBe(2);
    expect((await kv.set("missing", 1, { onlyIfMatch: "x" })).ok).toBe(false);
  });

  it("20 parallel onlyIfNew writes: exactly one wins", async () => {
    const kv = make();
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => kv.set("race", i, { onlyIfNew: true })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("20 parallel onlyIfMatch writes from the same etag: exactly one wins", async () => {
    const kv = make();
    const base = await kv.set("race", 0);
    if (!base.ok) throw new Error("setup");
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => kv.set("race", i + 1, { onlyIfMatch: base.etag })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("delete is idempotent; list returns sorted keys under a prefix", async () => {
    const kv = make();
    await kv.set("days/2026-12-02", 1);
    await kv.set("days/2026-12-01", 1);
    await kv.set("bookings/DBP-AAAAAA", 1);
    expect(await kv.list("days/")).toEqual(["days/2026-12-01", "days/2026-12-02"]);
    await kv.delete("days/2026-12-01");
    await kv.delete("days/2026-12-01");
    expect(await kv.list("days/")).toEqual(["days/2026-12-02"]);
    expect(await kv.get("days/2026-12-01")).toBeNull();
  });

  it("refuses keys that could escape the store", async () => {
    const kv = make();
    await expect(kv.set("../escape", 1)).rejects.toThrow();
    await expect(kv.get("/abs")).rejects.toThrow();
    await expect(kv.set("a b", 1)).rejects.toThrow();
  });

  it("values are copies: changing a returned object does not change the store", async () => {
    const kv = make();
    await kv.set("k", { list: [1] });
    const a = await kv.get<{ list: number[] }>("k");
    a!.value.list.push(2);
    expect((await kv.get<{ list: number[] }>("k"))?.value.list).toEqual([1]);
  });
});
