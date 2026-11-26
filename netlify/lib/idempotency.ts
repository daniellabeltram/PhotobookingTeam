// Idempotency records: idem/<sha256(key)> (ADR 0002). Claim with onlyIfNew, finish with onlyIfMatch.
import { createHash } from "node:crypto";
import type { Clock } from "../../shared/datetime";
import type { KvStore } from "./store/kv";

export interface IdemRecord {
  state: "pending" | "done";
  requestHash: string;
  createdAt: string;
  /** Set once the booking exists, so a crashed attempt can be completed from the stored booking. */
  bookingId?: string;
  status?: number;
  body?: unknown;
}

const PENDING_TAKEOVER_MS = 2 * 60_000;
const EXPIRY_MS = 24 * 3_600_000;

export const idemKey = (key: string): string => `idem/${createHash("sha256").update(key).digest("hex")}`;

/** Stable hash of a JSON body: keys sorted, so the same answers in another order are the same request. */
export function hashBody(body: unknown): string {
  const canon = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canon)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canon(x)]))
        : v;
  return createHash("sha256").update(JSON.stringify(canon(body))).digest("hex");
}

export type ClaimResult =
  | { kind: "claimed"; etag: string }
  | { kind: "replay"; status: number; body: unknown }
  | { kind: "resume"; bookingId: string; etag: string }
  | { kind: "in_progress" }
  | { kind: "mismatch" };

export async function claim(store: KvStore, clock: Clock, rawKey: string, requestHash: string): Promise<ClaimResult> {
  const key = idemKey(rawKey);
  const now = clock.now();
  const fresh: IdemRecord = { state: "pending", requestHash, createdAt: now };
  for (let i = 0; i < 3; i++) {
    const made = await store.set(key, fresh, { onlyIfNew: true });
    if (made.ok) return { kind: "claimed", etag: made.etag };
    const cur = await store.get<IdemRecord>(key);
    if (!cur) continue; // deleted in between: try again
    const rec = cur.value;
    const age = Date.parse(now) - Date.parse(rec.createdAt);
    if (age > EXPIRY_MS) {
      const took = await store.set(key, fresh, { onlyIfMatch: cur.etag });
      if (took.ok) return { kind: "claimed", etag: took.etag };
      continue;
    }
    if (rec.requestHash !== requestHash) return { kind: "mismatch" };
    if (rec.state === "done") return { kind: "replay", status: rec.status ?? 201, body: rec.body };
    if (age > PENDING_TAKEOVER_MS) {
      const took = await store.set(key, { ...rec, createdAt: now }, { onlyIfMatch: cur.etag });
      if (took.ok) return rec.bookingId ? { kind: "resume", bookingId: rec.bookingId, etag: took.etag } : { kind: "claimed", etag: took.etag };
      continue;
    }
    return { kind: "in_progress" };
  }
  return { kind: "in_progress" };
}

/**
 * The stored 201 for this key and body, without claiming anything. Used BEFORE the rate limit, so a client that
 * retries a booking that already went through gets its confirmation back instead of a 429.
 */
export async function peekReplay(store: KvStore, clock: Clock, rawKey: string, requestHash: string): Promise<{ status: number; body: unknown } | null> {
  const cur = await store.get<IdemRecord>(idemKey(rawKey));
  if (!cur || cur.value.state !== "done" || cur.value.requestHash !== requestHash) return null;
  if (Date.parse(clock.now()) - Date.parse(cur.value.createdAt) > EXPIRY_MS) return null;
  return { status: cur.value.status ?? 201, body: cur.value.body };
}

export async function noteBooking(store: KvStore, rawKey: string, etag: string, rec: IdemRecord, bookingId: string): Promise<string> {
  const res = await store.set(idemKey(rawKey), { ...rec, bookingId }, { onlyIfMatch: etag });
  return res.ok ? res.etag : etag;
}

export async function finish(store: KvStore, rawKey: string, rec: IdemRecord, status: number, body: unknown): Promise<void> {
  await store.set(idemKey(rawKey), { ...rec, state: "done", status, body } satisfies IdemRecord);
}

/** On a 4xx or 5xx the claim is deleted so the client can try again with the same key. */
export async function release(store: KvStore, rawKey: string): Promise<void> {
  await store.delete(idemKey(rawKey));
}
