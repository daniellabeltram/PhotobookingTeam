// Key/value adapter (ADR 0002). All business logic sits above this interface.
export interface KvEntry<T> {
  value: T;
  etag: string;
}
export type WriteCondition = { onlyIfNew: true } | { onlyIfMatch: string };
export type SetResult = { ok: true; etag: string } | { ok: false };

export interface KvStore {
  /** Always strongly consistent. */
  get<T>(key: string): Promise<KvEntry<T> | null>;
  /** With a condition this is a compare-and-swap: `ok: false` means someone else wrote first. */
  set<T>(key: string, value: T, cond?: WriteCondition): Promise<SetResult>;
  delete(key: string): Promise<void>;
  /** Keys that start with `prefix`, all pages, sorted. */
  list(prefix: string): Promise<string[]>;
}

const KEY_RE = /^[A-Za-z0-9_\-./]+$/;
/** Keys we build are short and plain. Reject anything that could escape a directory or the key space. */
export function assertSafeKey(key: string): void {
  if (!KEY_RE.test(key) || key.startsWith("/") || key.includes("..") || key.length > 300) {
    throw new Error("Unsafe store key");
  }
}
