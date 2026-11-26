// Netlify Blobs driver (ADR 0002): strong consistency and conditional writes (onlyIfNew / onlyIfMatch).
// Imports only "@netlify/blobs" (never "@netlify/blobs/server", review L9), and only when first used,
// so local dev and tests never load it.
import type { KvEntry, KvStore, SetResult, WriteCondition } from "./kv";
import { assertSafeKey } from "./kv";

interface BlobStore {
  getWithMetadata(key: string, options: { type: "json"; consistency?: "strong" | "eventual" }): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(key: string, data: unknown, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }): Promise<{ modified: boolean; etag?: string }>;
  delete(key: string): Promise<void>;
  list(options: { prefix?: string; paginate: true }): AsyncIterable<{ blobs: { key: string; etag: string }[] }>;
}

export class NetlifyBlobsKv implements KvStore {
  private storePromise: Promise<BlobStore> | null = null;
  private readonly namespace: string;
  constructor(namespace: string) {
    this.namespace = namespace;
  }

  private store(): Promise<BlobStore> {
    this.storePromise ??= import("@netlify/blobs").then(
      (m) => m.getStore({ name: `dbp-${this.namespace}`, consistency: "strong" }) as unknown as BlobStore,
    );
    return this.storePromise;
  }

  async get<T>(key: string): Promise<KvEntry<T> | null> {
    assertSafeKey(key);
    const hit = await (await this.store()).getWithMetadata(key, { type: "json", consistency: "strong" });
    if (!hit || hit.etag === undefined) return null;
    return { value: hit.data as T, etag: hit.etag };
  }

  async set<T>(key: string, value: T, cond?: WriteCondition): Promise<SetResult> {
    assertSafeKey(key);
    const options = cond ? ("onlyIfNew" in cond ? { onlyIfNew: true } : { onlyIfMatch: cond.onlyIfMatch }) : undefined;
    const res = await (await this.store()).setJSON(key, value, options);
    return res.modified && res.etag !== undefined ? { ok: true, etag: res.etag } : { ok: false };
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await (await this.store()).delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    for await (const page of (await this.store()).list({ prefix, paginate: true })) {
      for (const b of page.blobs) out.push(b.key);
    }
    return out.sort();
  }
}
