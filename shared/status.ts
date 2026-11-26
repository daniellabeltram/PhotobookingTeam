// Booking statuses, the transition table (architecture section 8) and derived flags. Browser-safe.
import type { AdminAction, Booking, BookingFlag, BookingStatus, ClientEmailKind } from "./models";

export const BOOKING_STATUSES: readonly BookingStatus[] = ["requested", "pending_deposit", "confirmed", "completed", "cancelled", "declined"];
export const ACTIVE_STATUSES: readonly BookingStatus[] = ["requested", "pending_deposit", "confirmed"];
export const isActive = (s: BookingStatus): boolean => ACTIVE_STATUSES.includes(s);

export const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "Requested",
  pending_deposit: "Pending deposit",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
};

/** Client emails that fit the booking's current status (resend-email answers 422 otherwise). */
export function resendKinds(
  b: Pick<Booking, "status" | "bookingMode" | "approvedAt" | "payment" | "history" | "rescheduleCount">,
): ClientEmailKind[] {
  const kinds: ClientEmailKind[] = [];
  switch (b.status) {
    case "requested":
      kinds.push("request_received");
      break;
    case "pending_deposit":
      kinds.push(b.approvedAt ? "approved" : "booking_received");
      break;
    case "confirmed": {
      const straightToConfirmed =
        b.bookingMode === "instant" && !b.payment && !b.history.some((h) => h.action === "confirm_without_payment" || h.action === "approve");
      kinds.push(straightToConfirmed ? "booking_received" : "confirmed");
      break;
    }
    case "cancelled":
      kinds.push("cancelled");
      break;
    case "declined":
      kinds.push("declined");
      break;
    case "completed":
      break;
  }
  if (b.rescheduleCount > 0 && isActive(b.status)) kinds.push("rescheduled");
  return kinds;
}

type ActionInput = Pick<Booking, "status" | "startUtc" | "piiDeletedAt" | "bookingMode" | "approvedAt" | "payment" | "history" | "rescheduleCount">;

/** What the server would accept right now (the UI shows only these). `nowIso` is a UTC instant. */
export function allowedActions(b: ActionInput, nowIso: string): AdminAction[] {
  const future = b.startUtc > nowIso;
  const out: AdminAction[] = [];
  switch (b.status) {
    case "requested":
      if (future) out.push("approve");
      out.push("decline", "reschedule");
      break;
    case "pending_deposit":
      out.push("mark_paid", "confirm_without_payment", "cancel", "reschedule");
      break;
    case "confirmed":
      if (!future) out.push("complete");
      out.push("cancel", "reschedule");
      break;
    case "cancelled":
    case "declined":
    case "completed":
      if (!b.piiDeletedAt) out.push("delete_client_data");
      break;
  }
  if (!b.piiDeletedAt && resendKinds(b).length > 0) out.push("resend_email");
  return out;
}

export interface FlagSettings {
  unpaidHoldHours: number;
  requestResponseDays: number;
}
type FlagInput = Pick<
  Booking,
  "status" | "startUtc" | "holdStartedAt" | "requestedAt" | "emails" | "rescheduleCount" | "location" | "intake" | "pricing" | "piiDeletedAt"
>;

const HOUR_MS = 3_600_000;

/** Derived, never stored. Order is fixed so API output is stable. */
export function deriveFlags(b: FlagInput, nowIso: string, s: FlagSettings): BookingFlag[] {
  const now = Date.parse(nowIso);
  const flags: BookingFlag[] = [];
  if (b.status === "pending_deposit" && b.holdStartedAt && now >= Date.parse(b.holdStartedAt) + s.unpaidHoldHours * HOUR_MS) flags.push("deposit_overdue");
  if (latestClientEmailFailed(b.emails)) flags.push("email_not_sent");
  if (b.intake?.["couples.surpriseProposal"] === true) flags.push("surprise_proposal");
  if (b.location.kind === "help_me_choose") flags.push("help_me_choose_location");
  if (b.status === "requested" && b.requestedAt && now >= Date.parse(b.requestedAt) + s.requestResponseDays * 24 * HOUR_MS) flags.push("reply_overdue");
  if (isActive(b.status) && b.startUtc < nowIso) flags.push("session_time_passed");
  if (b.rescheduleCount > 0) flags.push("rescheduled");
  if (b.status === "pending_deposit" && b.pricing.paymentLinkUrl === null && b.pricing.amountDueKind !== "none") flags.push("no_payment_link");
  if (b.piiDeletedAt) flags.push("pii_deleted");
  return flags;
}

/** "Email not sent": the most recent client email (not Daniella's notice) failed. */
export function latestClientEmailFailed(emails: Booking["emails"]): boolean {
  let latest: { at: string; status: string } | null = null;
  for (const [kind, rec] of Object.entries(emails)) {
    if (!rec || kind === "admin_new_booking") continue;
    if (!latest || rec.at > latest.at) latest = rec;
  }
  return latest?.status === "failed";
}

/** "Waiting 2 days 5 h", "Waiting 5 h", "Waiting < 1 h" (story 020 #8). */
export function waitingLabel(sinceIso: string, nowIso: string): string {
  const ms = Math.max(0, Date.parse(nowIso) - Date.parse(sinceIso));
  const hoursTotal = Math.floor(ms / HOUR_MS);
  const days = Math.floor(hoursTotal / 24);
  const hours = hoursTotal % 24;
  if (days > 0) return `Waiting ${days} ${days === 1 ? "day" : "days"}${hours > 0 ? ` ${hours} h` : ""}`;
  if (hours > 0) return `Waiting ${hours} h`;
  return "Waiting < 1 h";
}
