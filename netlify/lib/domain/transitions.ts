// Status transitions (architecture section 8). Pure: given the booking and a validated action, returns the next
// record. The caller checks allowedActions() and expectedVersion first, and writes it with a CAS.
import type { z } from "zod";
import type { patchSchema } from "../../../shared/schemas/admin";
import type { Booking, ClientEmailKind, HistoryEntry } from "../../../shared/models";

export type PatchBody = z.infer<typeof patchSchema>;

export interface TransitionResult {
  booking: Booking;
  emailKind: ClientEmailKind | null;
  /** The ledger entry must be released (decline, cancel, complete). */
  releaseSlot: boolean;
}

const orNull = (s: string | undefined): string | null => (s && s.trim() !== "" ? s.trim() : null);

export function applyTransition(cur: Booking, body: PatchBody, nowIso: string): TransitionResult {
  const b = structuredClone(cur);
  const from = cur.status;
  const entry = (action: string, extra: Partial<HistoryEntry> = {}): void => {
    b.history.push({ at: nowIso, by: "admin", action, fromStatus: from, toStatus: b.status, ...extra });
  };

  switch (body.action) {
    case "approve": {
      b.approvedAt = nowIso;
      if (b.pricing.amountDueKind === "none") {
        b.status = "confirmed";
        b.confirmedAt = nowIso;
        b.icsSequence += 1;
        b.holdStartedAt = null;
      } else {
        b.status = "pending_deposit";
        b.holdStartedAt = nowIso; // "Deposit overdue" counts from approval (story 020 #13)
      }
      entry("approve");
      return { booking: b, emailKind: b.status === "confirmed" ? "confirmed" : "approved", releaseSlot: false };
    }
    case "decline": {
      b.status = "declined";
      b.declinedAt = nowIso;
      b.decline = { messageToClient: orNull(body.messageToClient), note: orNull(body.note) };
      entry("decline", { note: orNull(body.note) });
      return { booking: b, emailKind: body.notifyClient === false ? null : "declined", releaseSlot: true };
    }
    case "mark_paid": {
      b.status = "confirmed";
      b.confirmedAt = nowIso;
      b.icsSequence += 1;
      b.payment = {
        amountCents: body.amountCents,
        receivedOn: body.receivedOn,
        method: orNull(body.method),
        note: orNull(body.note),
        recordedAt: nowIso,
      };
      entry("mark_paid", { note: orNull(body.note) });
      return { booking: b, emailKind: "confirmed", releaseSlot: false };
    }
    case "confirm_without_payment": {
      b.status = "confirmed";
      b.confirmedAt = nowIso;
      b.icsSequence += 1;
      entry("confirm_without_payment", { note: body.note.trim() });
      return { booking: b, emailKind: "confirmed", releaseSlot: false };
    }
    case "cancel": {
      b.status = "cancelled";
      b.cancelledAt = nowIso;
      b.cancellation = { reason: body.reason, note: orNull(body.note) };
      entry("cancel", { reason: body.reason, note: orNull(body.note) });
      return { booking: b, emailKind: body.notifyClient === false ? null : "cancelled", releaseSlot: true };
    }
    case "complete": {
      b.status = "completed";
      b.completedAt = nowIso;
      entry("complete");
      return { booking: b, emailKind: null, releaseSlot: true };
    }
  }
}
