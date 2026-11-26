// "Delete client data" (story 012 #7, review L4). Keeps the reference, type, times, status, amounts and
// policy version. Everything personal is nulled, including payment method and note.
import type { Booking } from "../../../shared/models";

export function wipePii(cur: Booking, nowIso: string): Booking {
  const b = structuredClone(cur);
  b.contact = null;
  b.intake = null;
  b.people = null;
  b.portfolioOptOut = null;
  b.location = { kind: "removed" };
  if (b.payment) {
    b.payment.note = null;
    b.payment.method = null;
  }
  if (b.cancellation) b.cancellation.note = null;
  if (b.decline) b.decline = { messageToClient: null, note: null };
  for (const h of b.history) h.note = null;
  b.piiDeletedAt = nowIso;
  b.history.push({ at: nowIso, by: "admin", action: "delete_client_data", fromStatus: b.status, toStatus: b.status });
  return b;
}
