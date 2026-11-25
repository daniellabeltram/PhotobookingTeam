// Persisted data shapes (docs/architecture.md section 6). Types only, browser-safe.

export type BookingStatus = "requested" | "pending_deposit" | "confirmed" | "completed" | "cancelled" | "declined";
export type BookingMode = "instant" | "request";
export type EmailKind =
  | "booking_received"
  | "request_received"
  | "admin_new_booking"
  | "approved"
  | "declined"
  | "confirmed"
  | "cancelled"
  | "rescheduled";
export type ClientEmailKind = Exclude<EmailKind, "admin_new_booking">;
export type AdminAction =
  | "approve"
  | "decline"
  | "mark_paid"
  | "confirm_without_payment"
  | "cancel"
  | "complete"
  | "reschedule"
  | "resend_email"
  | "delete_client_data";
export type BookingFlag =
  | "deposit_overdue"
  | "email_not_sent"
  | "surprise_proposal"
  | "help_me_choose_location"
  | "reply_overdue"
  | "session_time_passed"
  | "rescheduled"
  | "no_payment_link"
  | "pii_deleted";
export type AmountDueKind = "deposit" | "estimated_deposit" | "full" | "none";
export type CancellationReason = "client_cancelled" | "deposit_not_received" | "photographer_cancelled" | "other";
export type RescheduleReason = "client_request" | "weather" | "photographer";

export type BookingLocation =
  | { kind: "suggested"; optionId: string; label: string }
  | { kind: "own"; text: string }
  | { kind: "help_me_choose" }
  | { kind: "mini_day"; label: string }
  | { kind: "removed" };

export interface BookingContact {
  fullName: string;
  email: string;
  phone: string;
  preferredContact: "email" | "call" | "text";
}

export type IntakeValue = string | number | boolean | null;

export interface EmailRecord {
  status: "sent" | "failed" | "skipped";
  at: string;
  attempts: number;
  providerId?: string;
}

export interface HistoryEntry {
  at: string;
  by: "client" | "admin" | "system";
  action: string;
  fromStatus?: BookingStatus | null;
  toStatus?: BookingStatus | null;
  fromStartUtc?: string;
  toStartUtc?: string;
  reason?: string;
  note?: string | null;
}

export interface Booking {
  id: string;
  version: number;
  status: BookingStatus;
  sessionTypeId: string;
  sessionTypeName: string;
  bookingMode: BookingMode;
  durationMin: number;
  bufferMin: number;
  startUtc: string;
  endUtc: string;
  busyStartUtc: string;
  busyEndUtc: string;
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  timezone: "America/New_York";
  miniSlotId: string | null;
  location: BookingLocation;
  contact: BookingContact | null;
  people: { adults: number; children: number; pets: number } | null;
  intake: Record<string, IntakeValue> | null;
  portfolioOptOut: boolean | null;
  policyVersion: string;
  policyAcceptedAt: string;
  pricing: {
    priceFromCents: number;
    priceUnit: "session" | "hour";
    estimatedTotalCents?: number;
    amountDueCents: number;
    amountDueKind: AmountDueKind;
    paymentLinkUrl: string | null;
  };
  payment: { amountCents: number; receivedOn: string; method?: string | null; note?: string | null; recordedAt: string } | null;
  createdAt: string;
  requestedAt?: string;
  approvedAt?: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  declinedAt?: string;
  holdStartedAt: string | null;
  cancellation: { reason: CancellationReason; note?: string | null } | null;
  decline: { messageToClient?: string | null; note?: string | null } | null;
  rescheduleCount: number;
  lastRescheduledAt: string | null;
  icsSequence: number;
  emails: Partial<Record<EmailKind, EmailRecord>>;
  history: HistoryEntry[];
  piiDeletedAt: string | null;
}

export interface LedgerEntry {
  bookingId: string;
  sessionTypeId: string;
  kind: "standard" | "mini";
  startUtc: string;
  endUtc: string;
  busyStartUtc: string;
  busyEndUtc: string;
  countsTowardDailyCap: boolean;
  miniSlotId: string | null;
  createdAt: string;
  verified: boolean;
}

export interface MiniSlot {
  id: string;
  startUtc: string;
  endUtc: string;
  busyStartUtc: string;
  busyEndUtc: string;
  bookingId: string | null;
}

export interface MiniDay {
  location: string;
  theme: string | null;
  createdAt: string;
  slots: MiniSlot[];
}

export interface DayLedger {
  date: string;
  updatedAt: string;
  entries: LedgerEntry[];
  miniDay: MiniDay | null;
}

export interface BlockedTime {
  id: string;
  kind: "all_day" | "time_range";
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  startUtc: string;
  endUtc: string;
  label: string | null;
  createdAt: string;
}
