// Request and response types for every endpoint in docs/api.md. Types only, browser-safe.
// If this file and docs/api.md disagree, docs/api.md wins: fix this file.
import type {
  AdminAction,
  AmountDueKind,
  BookingFlag,
  BookingMode,
  BookingStatus,
  CancellationReason,
  ClientEmailKind,
  EmailKind,
  RescheduleReason,
} from "./models";
import type { ApiErrorBody, ErrorCode } from "./errors";

export type {
  AdminAction,
  AmountDueKind,
  BookingFlag,
  BookingMode,
  BookingStatus,
  CancellationReason,
  ClientEmailKind,
  EmailKind,
  RescheduleReason,
  ApiErrorBody,
  ErrorCode,
};

/** Every success body is wrapped like this (204 has no body). */
export interface ApiSuccess<T> {
  data: T;
}

// ---- shared shapes ----
export interface Slot {
  startUtc: string;
  endUtc: string;
  localDate: string; // "2026-12-05"
  localTime: string; // "17:30"
  label: string; // "5:30 PM"
  rangeLabel: string; // "5:30 – 6:30 PM ET"
  miniSlotId?: string; // minis only
}
export interface Money {
  cents: number;
  label: string;
}
export type AmountDue = Money & { kind: AmountDueKind; dueNow: boolean };

// ---- GET /api/config ----
export interface PublicIntakeField {
  id: string;
  label: string;
  input: "text" | "textarea" | "email" | "tel" | "number" | "select" | "checkbox" | "date" | "time";
  maxLength?: number;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  helpText?: string;
}
export interface PublicSessionType {
  id: string;
  name: string;
  description: string;
  included: string[];
  kind: "standard" | "mini";
  bookingMode: BookingMode;
  durationMin: number;
  durationOptionsMin?: number[];
  /** Minimum gap between two sessions of this type; the admin minis form spaces slots by durationMin + bufferMin. */
  bufferMin: number;
  price: { fromCents: number; unit: "session" | "hour"; label: string };
  /** `text` fits the policy sentence "a retainer of {{depositText}}"; `cardText` is the picker-card wording (additive field). */
  deposit: { kind: "flat" | "percent" | "full" | "none"; text: string; cardText: string; percent?: number; amountCents?: number };
  hasPaymentLink: boolean;
  maxPeople: number | null;
  includedPeople: number | null;
  extraPersonFeeCents: number | null;
  locationOptions: { id: string; label: string }[];
  allowOwnLocation: boolean;
  allowHelpMeChoose: boolean;
  commonFieldsProfile: "full" | "short";
  intakeExtraFields: { id: string; required: boolean }[];
  bookingHorizonDays: number;
  /** Minis only: up to 3 future dates with open slots, or []. null for other types. */
  nextMiniDates: { date: string; spotsLeft: number }[] | null;
  /** Additive: tips shown in the emails, one bullet per line. */
  whatToBringText?: string;
}
export interface PublicConfig {
  business: { name: string; contactEmail: string; siteUrl: string; timezone: "America/New_York" };
  scheduling: { minimumNoticeHours: number; unpaidHoldHours: number; requestResponseDays: number };
  features: { portfolioOptOutEnabled: boolean };
  privacy: { dataRetentionMonths: number; privacyContactEmail: string; lastUpdated: string };
  policy: { version: string; summaryTemplate: string; summaryVariants: { request: string; full: string }; values: Record<string, number | string> };
  intakeFields: PublicIntakeField[];
  sessionTypes: PublicSessionType[];
}
export type GetConfigResponse = ApiSuccess<PublicConfig>;

// ---- GET /api/policies/:version ----
export interface PolicyDocument {
  version: string;
  effectiveDate: string;
  isCurrent: boolean;
  summaryTemplate: string;
  summaryVariants: { request: string; full: string };
  values: Record<string, number | string>;
  sections: { heading: string; paragraphs: string[] }[];
}
export type GetPolicyResponse = ApiSuccess<PolicyDocument>;

// ---- GET /api/availability and GET /api/admin/availability ----
export interface AvailabilityQuery {
  type: string;
  from?: string;
  to?: string;
  durationMin?: number;
  /** Admin only. */
  excludeBookingId?: string;
}
export interface AvailabilityDay {
  date: string;
  status: "open" | "full" | "closed";
  slots: Slot[];
  /** Mini type only. */
  mini?: { location: string; theme: string | null; spotsLeft: number; totalSpots: number };
}
export interface AvailabilityData {
  sessionTypeId: string;
  durationMin: number;
  timezone: "America/New_York";
  from: string;
  to: string;
  horizonEndDate: string;
  firstOpenDate: string | null;
  days: AvailabilityDay[];
}
export type GetAvailabilityResponse = ApiSuccess<AvailabilityData>;

// ---- POST /api/bookings ----
export interface CreateBookingRequest {
  sessionTypeId: string;
  startUtc: string;
  durationMin?: number;
  miniSlotId?: string | null;
  contact: { fullName: string; email: string; phone: string; preferredContact: "email" | "call" | "text" };
  subjectsNames: string;
  people: { adults: number; children: number; pets: number };
  /** Omitted for minis. */
  location?:
    | { kind: "suggested"; optionId: string }
    | { kind: "own"; text: string }
    | { kind: "help_me_choose" };
  styleNotes?: string;
  mustHaveShots?: string;
  anythingElse?: string;
  heardAbout?: string;
  /** Only the key of the chosen type (couples, families, events, minis). Field names are the catalogue ids without the prefix. */
  extra?: Record<string, Record<string, string | number | boolean | null>>;
  portfolioOptOut?: boolean;
  policy: { accepted: boolean; version: string };
  /** Honeypot. Must be empty or absent. */
  website?: string;
}
export interface CreateBookingData {
  reference: string;
  status: Extract<BookingStatus, "requested" | "pending_deposit" | "confirmed">;
  bookingMode: BookingMode;
  sessionTypeId: string;
  sessionTypeName: string;
  durationMin: number;
  startUtc: string;
  endUtc: string;
  display: { date: string; timeRange: string };
  locationLabel: string;
  amountDue: AmountDue;
  paymentLinkUrl: string | null;
  holdHours: number | null;
  requestResponseDays: number | null;
  emailSent: boolean;
}
export type CreateBookingResponse = ApiSuccess<CreateBookingData>;
export interface SlotTakenDetails {
  alternatives: Slot[];
}
export interface PolicyVersionChangedDetails {
  currentVersion: string;
}

// ---- admin session ----
export interface AdminLoginRequest {
  email: string;
  password: string;
  totp?: string;
}
export interface AdminSessionData {
  email: string; // masked, "d***@example.com"
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}
export type AdminSessionResponse = ApiSuccess<AdminSessionData>;
/** `details` of a 401 from GET /api/admin/session. */
export interface UnauthorizedDetails {
  totpRequired: boolean;
}

// ---- admin bookings ----
export interface AdminListQuery {
  view?: "upcoming" | "past" | "all";
  status?: string; // comma list of BookingStatus
  rescheduled?: "true";
  flag?: "deposit_overdue" | "reply_overdue" | "email_not_sent";
  type?: string; // comma list of session type ids
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}
export interface AdminBookingListItem {
  id: string;
  version: number;
  status: BookingStatus;
  sessionTypeId: string;
  sessionTypeName: string;
  startUtc: string;
  endUtc: string;
  localDate: string;
  display: { date: string; timeRange: string };
  /** null after "Delete client data". */
  clientName: string | null;
  flags: BookingFlag[];
  waitingSince: string | null;
  waitingLabel: string | null;
}
export interface AdminBookingListData {
  items: AdminBookingListItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: { upcomingPendingDeposit: number; depositOverdue: number; requestsWaiting: number; replyOverdue: number };
}
export type AdminBookingListResponse = ApiSuccess<AdminBookingListData>;

export interface AdminIntakeAnswer {
  id: string;
  label: string;
  value: string | number | boolean | null;
}
export interface AdminBookingDetail {
  id: string;
  version: number;
  status: BookingStatus;
  bookingMode: BookingMode;
  sessionTypeId: string;
  sessionTypeName: string;
  durationMin: number;
  bufferMin: number;
  startUtc: string;
  endUtc: string;
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  display: { date: string; timeRange: string; createdAt: string };
  location:
    | { kind: "suggested"; optionId: string; label: string }
    | { kind: "own"; text: string }
    | { kind: "help_me_choose" }
    | { kind: "mini_day"; label: string }
    | { kind: "removed" };
  contact: { fullName: string; email: string; phone: string; preferredContact: "email" | "call" | "text" } | null;
  people: { adults: number; children: number; pets: number } | null;
  intake: AdminIntakeAnswer[];
  portfolioOptOut: boolean | null;
  policy: { version: string; acceptedAt: string; acceptedAtLabel: string; url: string };
  pricing: { amountDue: AmountDue; estimatedTotal: Money | null; paymentLinkUrl: string | null };
  payment: { amountCents: number; receivedOn: string; method?: string | null; note?: string | null; recordedAt: string } | null;
  timestamps: {
    createdAt: string;
    requestedAt: string | null;
    approvedAt: string | null;
    confirmedAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    declinedAt: string | null;
    holdStartedAt: string | null;
  };
  cancellation: { reason: CancellationReason; note?: string | null } | null;
  decline: { messageToClient?: string | null; note?: string | null } | null;
  rescheduleCount: number;
  emails: Partial<Record<EmailKind, { status: "sent" | "failed" | "skipped"; at: string }>>;
  flags: BookingFlag[];
  history: {
    at: string;
    atLabel: string;
    by: "client" | "admin" | "system";
    action: string;
    fromStatus: BookingStatus | null;
    toStatus: BookingStatus | null;
    note: string | null;
    reason?: string | null;
    fromStartUtc?: string | null;
    toStartUtc?: string | null;
  }[];
  allowedActions: AdminAction[];
  piiDeletedAt: string | null;
}
export type AdminBookingDetailResponse = ApiSuccess<AdminBookingDetail>;

export type AdminPatchRequest =
  | { action: "approve"; expectedVersion: number }
  | { action: "decline"; expectedVersion: number; messageToClient?: string; note?: string; notifyClient?: boolean }
  | { action: "mark_paid"; expectedVersion: number; amountCents: number; receivedOn: string; method?: string; note?: string }
  | { action: "confirm_without_payment"; expectedVersion: number; note: string }
  | { action: "cancel"; expectedVersion: number; reason: CancellationReason; note?: string; notifyClient?: boolean }
  | { action: "complete"; expectedVersion: number };
export interface EmailOutcome {
  kind: ClientEmailKind;
  status: "sent" | "failed";
}
export interface AdminActionData {
  booking: AdminBookingDetail;
  email: EmailOutcome | null;
}
export type AdminPatchResponse = ApiSuccess<AdminActionData>;

export interface AdminRescheduleRequest {
  expectedVersion: number;
  startUtc: string;
  durationMin?: number;
  miniSlotId?: string | null;
  reason: RescheduleReason;
  note?: string;
  notifyClient?: boolean;
}
export type AdminRescheduleResponse = ApiSuccess<AdminActionData>;

export interface AdminResendRequest {
  kind?: ClientEmailKind;
}
export type AdminResendResponse = ApiSuccess<EmailOutcome>;

export interface AdminDeleteClientDataRequest {
  confirmReference: string;
  expectedVersion: number;
}
export type AdminDeleteClientDataResponse = ApiSuccess<{ booking: AdminBookingDetail }>;

export interface VersionConflictDetails {
  currentVersion: number;
  currentStatus: BookingStatus;
}
export interface InvalidTransitionDetails {
  currentStatus: BookingStatus;
  allowedActions: AdminAction[];
}

// ---- admin blocks ----
export interface BlockItem {
  id: string;
  kind: "all_day" | "time_range";
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  startUtc: string;
  endUtc: string;
  label: string | null;
  display: string;
}
export type AdminBlocksListResponse = ApiSuccess<{ items: BlockItem[] }>;
export type AdminBlockCreateRequest =
  | { kind: "all_day"; startDate: string; endDate: string; label?: string | null; confirmOverlaps?: boolean }
  | { kind: "time_range"; startDate: string; endDate: string; startTime: string; endTime: string; label?: string | null; confirmOverlaps?: boolean };
export interface OverlappingBooking {
  id: string;
  clientName: string | null;
  display: { date: string; timeRange: string };
  status: BookingStatus;
}
export type AdminBlockCreateResponse = ApiSuccess<{ block: BlockItem; overlappingBookings: OverlappingBooking[] }>;
export interface BlockOverlapsDetails {
  bookings: OverlappingBooking[];
}

// ---- admin mini days ----
export interface MiniDaySlotItem {
  id: string;
  localTime: string;
  rangeLabel: string;
  bookingId: string | null;
}
export interface MiniDayItem {
  date: string;
  location: string;
  theme: string | null;
  slots: MiniDaySlotItem[];
  totalSpots: number;
  booked: number;
}
export type AdminMiniDaysListResponse = ApiSuccess<{ items: MiniDayItem[] }>;
export interface AdminMiniSlotsRequest {
  location?: string;
  theme?: string | null;
  startTimes: string[];
}
export type MiniRejectCode = "OVERLAPS_MINI_SLOT" | "OVERLAPS_BOOKING" | "OVERLAPS_BLOCK" | "IN_PAST" | "INVALID_TIME" | "DUPLICATE";
export interface MiniRejection {
  startTime: string;
  code: MiniRejectCode;
  message: string;
}
export type AdminMiniSlotsResponse = ApiSuccess<{
  miniDay: { date: string; location: string; theme: string | null; slots: MiniDaySlotItem[] };
  created: string[];
  rejected: MiniRejection[];
}>;
