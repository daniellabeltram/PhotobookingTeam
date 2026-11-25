// Booking records: bookings/<reference>. Create is onlyIfNew; every update is a CAS on the ETag (ADR 0002).
import { HttpError } from "../errors";
import type { KvStore } from "../store/kv";
import type { Booking } from "../../../shared/models";

export const bookingKey = (id: string): string => `bookings/${id}`;

export async function getBookingWithEtag(store: KvStore, id: string): Promise<{ booking: Booking; etag: string } | null> {
  const hit = await store.get<Booking>(bookingKey(id));
  return hit ? { booking: hit.value, etag: hit.etag } : null;
}
export async function getBooking(store: KvStore, id: string): Promise<Booking | null> {
  return (await getBookingWithEtag(store, id))?.booking ?? null;
}

/** False when the reference already exists (the caller picks another one). */
export async function insertBooking(store: KvStore, booking: Booking): Promise<boolean> {
  const res = await store.set(bookingKey(booking.id), booking, { onlyIfNew: true });
  return res.ok;
}

export interface UpdateOptions {
  /** When set, a different stored version is a 409 VERSION_CONFLICT. */
  expectedVersion?: number;
  tries?: number;
}

/**
 * Read, apply `mutate` to a copy, write with onlyIfMatch and version + 1. Retries only when the write
 * lost a race AND no expectedVersion pins the read (with one, the re-read reports VERSION_CONFLICT).
 */
export async function updateBooking(
  store: KvStore,
  id: string,
  mutate: (current: Booking) => Booking,
  options: UpdateOptions = {},
): Promise<Booking> {
  const tries = options.tries ?? 5;
  for (let i = 0; i < tries; i++) {
    const hit = await getBookingWithEtag(store, id);
    if (!hit) throw new HttpError("NOT_FOUND", "We couldn't find that booking.");
    const cur = hit.booking;
    if (options.expectedVersion !== undefined && cur.version !== options.expectedVersion) {
      throw new HttpError("VERSION_CONFLICT", "This booking changed. Reload to see the latest.", {
        currentVersion: cur.version,
        currentStatus: cur.status,
      });
    }
    const next = mutate(structuredClone(cur));
    next.version = cur.version + 1;
    const res = await store.set(bookingKey(id), next, { onlyIfMatch: hit.etag });
    if (res.ok) return next;
  }
  throw new HttpError("BUSY", "That took too long. Please try again.");
}

export async function listBookings(store: KvStore): Promise<Booking[]> {
  const keys = await store.list("bookings/");
  const out: Booking[] = [];
  for (let i = 0; i < keys.length; i += 25) {
    const batch = await Promise.all(keys.slice(i, i + 25).map((k) => store.get<Booking>(k)));
    for (const b of batch) if (b) out.push(b.value);
  }
  return out;
}
