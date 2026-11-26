// File driver for local development and e2e (ADR 0002): one JSON file per key under DATA_DIR.
// A per-key in-process mutex and write-to-temp-then-rename. Safe for ONE dev process only.
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { KvEntry, KvStore, SetResult, WriteCondition } from "./kv";
import { assertSafeKey } from "./kv";

const sha = (bytes: string) => createHash("sha256").update(bytes).digest("hex");

export class FileKvStore implements KvStore {
  private readonly root: string;
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  private path(key: string): string {
    assertSafeKey(key);
    return join(this.root, `${key}.json`);
  }

  private async withLock<R>(key: string, fn: () => Promise<R>): Promise<R> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.catch(() => undefined);
    this.locks.set(key, tail);
    try {
      return await run;
    } finally {
      if (this.locks.get(key) === tail) this.locks.delete(key);
    }
  }

  private async read(key: string): Promise<{ json: string; etag: string } | null> {
    try {
      const json = await readFile(this.path(key), "utf8");
      return { json, etag: sha(json) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async get<T>(key: string): Promise<KvEntry<T> | null> {
    return this.withLock(key, async () => {
      const hit = await this.read(key);
      return hit ? { value: JSON.parse(hit.json) as T, etag: hit.etag } : null;
    });
  }

  async set<T>(key: string, value: T, cond?: WriteCondition): Promise<SetResult> {
    const json = JSON.stringify(value);
    return this.withLock(key, async () => {
      const cur = await this.read(key);
      if (cond && "onlyIfNew" in cond && cur) return { ok: false } as const;
      if (cond && "onlyIfMatch" in cond && (!cur || cur.etag !== cond.onlyIfMatch)) return { ok: false } as const;
      const file = this.path(key);
      await mkdir(dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      await writeFile(tmp, json, "utf8");
      await rename(tmp, file);
      return { ok: true, etag: sha(json) } as const;
    });
  }

  async delete(key: string): Promise<void> {
    await this.withLock(key, async () => {
      try {
        await unlink(this.path(key));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    });
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    const walk = async (dir: string, rel: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
        throw err;
      }
      for (const e of entries) {
        if (e.isDirectory()) await walk(join(dir, e.name), `${rel}${e.name}/`);
        else if (e.name.endsWith(".json")) keys.push(`${rel}${e.name.slice(0, -5)}`);
      }
    };
    await walk(this.root, "");
    return keys.filter((k) => k.startsWith(prefix)).sort();
  }
}
