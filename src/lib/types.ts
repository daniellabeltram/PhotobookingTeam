// Browser-side view of docs/api.md. When shared/api-types.ts is the source of truth,
// this file re-exports from it. Until then these mirror the contract by hand.

export type BookingStatus =
  | 'requested'
  | 'pending_deposit'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'declined';

export type Slot = {
  startUtc: string;
  endUtc: string;
  localDate: string;
  localTime: string;
  label: string;
  rangeLabel: string;
  miniSlotId?: string;
};

export type Money = { cents: number; label: string };
export type AmountDue = Money & {
  kind: 'deposit' | 'estimated_deposit' | 'full' | 'none';
  dueNow: boolean;
};

export type ApiErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

// ---- Public config ----
export type PublicSessionType = {
  id: string;
  name: string;
  description: string;
  included: string[];
  kind: 'standard' | 'mini';
  bookingMode: 'instant' | 'request';
  durationMin: number;
  durationOptionsMin?: number[];
  price: { fromCents: number; unit: 'session' | 'hour'; label: string };
  deposit: { kind: 'flat' | 'percent' | 'full' | 'none'; text: string; percent?: number; amountCents?: number };
  hasPaymentLink: boolean;
  maxPeople: number | null;
  includedPeople: number | null;
  extraPersonFeeCents: number | null;
  locationOptions: { id: string; label: string }[];
  allowOwnLocation: boolean;
  allowHelpMeChoose: boolean;
  commonFieldsProfile: 'full' | 'short';
  intakeExtraFields: { id: string; required: boolean }[];
  bookingHorizonDays: number;
  nextMiniDates: { date: string; spotsLeft: number }[] | null;
};

export type PublicConfig = {
  business: { name: string; contactEmail: string; siteUrl: string; timezone: string };
  scheduling: { minimumNoticeHours: number; unpaidHoldHours: number; requestResponseDays: number };
  features: { portfolioOptOutEnabled: boolean };
  privacy: { dataRetentionMonths: number; privacyContactEmail: string; lastUpdated: string };
  policy: {
    version: string;
    summaryTemplate: string;
    values: Record<string, number | string>;
  };
  intakeFields: { id: string; label: string; input: string; maxLength?: number }[];
  sessionTypes: PublicSessionType[];
};

export type PolicyDoc = {
  version: string;
  effectiveDate: string;
  isCurrent: boolean;
  summaryTemplate: string;
  values: Record<string, number | string>;
  sections: { heading: string; paragraphs: string[] }[];
};

// ---- Availability ----
export type AvailabilityDay = {
  date: string;
  status: 'open' | 'full' | 'closed';
  slots: Slot[];
  mini?: { location: string; theme: string | null; spotsLeft: number; totalSpots: number };
};

export type Availability = {
  sessionTypeId: string;
  durationMin: number;
  timezone: string;
  from: string;
  to: string;
  horizonEndDate: string;
  firstOpenDate: string | null;
  days: AvailabilityDay[];
};

// ---- Booking create ----
export type BookingRequestBody = {
  sessionTypeId: string;
  startUtc: string;
  durationMin?: number;
  miniSlotId?: string | null;
  contact: { fullName: string; email: string; phone: string; preferredContact: 'email' | 'call' | 'text' };
  subjectsNames: string;
  people: { adults: number; children: number; pets: number };
  location?:
    | { kind: 'suggested'; optionId: string }
    | { kind: 'own'; text: string }
    | { kind: 'help_me_choose' };
  styleNotes?: string;
  mustHaveShots?: string;
  anythingElse?: string;
  heardAbout?: string;
  extra?: Record<string, Record<string, unknown>>;
  portfolioOptOut?: boolean;
  policy: { accepted: boolean; version: string };
  website: string;
};

export type BookingResult = {
  reference: string;
  status: BookingStatus;
  bookingMode: 'instant' | 'request';
  sessionTypeId: string;
  sessionTypeName: string;
  durationMin: number;
  startUtc: string;
  endUtc: string;
  display: { date: string; timeRange: string };
  locationLabel: string | null;
  amountDue: AmountDue;
  paymentLinkUrl: string | null;
  holdHours: number | null;
  requestResponseDays: number | null;
  emailSent: boolean;
  /** Not in docs/api.md yet; shown only if the API ever returns it. */
  calendarUrl?: string | null;
};

// ---- Admin ----
export type AdminAction =
  | 'approve'
  | 'decline'
  | 'mark_paid'
  | 'confirm_without_payment'
  | 'cancel'
  | 'complete'
  | 'reschedule'
  | 'resend_email'
  | 'delete_client_data';

export type BookingFlag =
  | 'deposit_overdue'
  | 'email_not_sent'
  | 'surprise_proposal'
  | 'help_me_choose_location'
  | 'reply_overdue'
  | 'session_time_passed'
  | 'rescheduled'
  | 'no_payment_link'
  | 'pii_deleted';

export type AdminSession = { email: string; idleExpiresAt: string; absoluteExpiresAt: string };

export type BookingListItem = {
  id: string;
  version: number;
  status: BookingStatus;
  sessionTypeId: string;
  sessionTypeName: string;
  startUtc: string;
  endUtc: string;
  localDate: string;
  display: { date: string; timeRange: string };
  clientName: string | null;
  flags: BookingFlag[];
  waitingSince: string | null;
  waitingLabel: string | null;
};

export type BookingList = {
  items: BookingListItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    upcomingPendingDeposit: number;
    depositOverdue: number;
    requestsWaiting: number;
    replyOverdue: number;
  };
};

export type EmailKind =
  | 'booking_received'
  | 'request_received'
  | 'approved'
  | 'declined'
  | 'confirmed'
  | 'cancelled'
  | 'rescheduled';

export type BookingDetail = {
  id: string;
  version: number;
  status: BookingStatus;
  bookingMode: 'instant' | 'request';
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
  location: { kind: string; optionId?: string; label?: string; text?: string } | null;
  contact: { fullName: string; email: string; phone: string; preferredContact: string } | null;
  people: { adults: number; children: number; pets: number } | null;
  intake: { id: string; label: string; value: string | number | boolean | null }[] | null;
  portfolioOptOut: boolean | null;
  policy: { version: string; acceptedAt: string; acceptedAtLabel: string; url: string };
  pricing: {
    amountDue: AmountDue;
    estimatedTotal: Money | null;
    paymentLinkUrl: string | null;
  };
  payment: {
    amountCents: number;
    receivedOn: string;
    method?: string | null;
    note?: string | null;
    recordedAt?: string;
  } | null;
  timestamps: Record<string, string | null>;
  cancellation: { reason: string; note?: string | null } | null;
  decline: { messageToClient?: string | null; note?: string | null } | null;
  rescheduleCount: number;
  emails: Record<string, { status: 'sent' | 'failed' | 'skipped'; at: string }>;
  flags: BookingFlag[];
  history: {
    at: string;
    atLabel: string;
    by: 'client' | 'admin' | 'system';
    action: string;
    fromStatus: BookingStatus | null;
    toStatus: BookingStatus | null;
    note: string | null;
  }[];
  allowedActions: AdminAction[];
  piiDeletedAt: string | null;
};

export type ActionResult = {
  booking: BookingDetail;
  email: { kind: string; status: 'sent' | 'failed' | 'skipped' } | null;
};

export type BlockItem = {
  id: string;
  kind: 'all_day' | 'time_range';
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  startUtc: string;
  endUtc: string;
  label: string | null;
  display: string;
};

export type BlockCreateBody = {
  kind: 'all_day' | 'time_range';
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  label: string | null;
  confirmOverlaps: boolean;
};

export type OverlapBooking = {
  id: string;
  clientName: string | null;
  display: { date: string; timeRange: string };
  status: BookingStatus;
};

export type MiniDay = {
  date: string;
  location: string;
  theme: string | null;
  slots: { id: string; localTime: string; rangeLabel: string; bookingId: string | null }[];
  totalSpots: number;
  booked: number;
};

export type MiniSlotsResult = {
  miniDay: MiniDay;
  created: string[];
  rejected: { startTime: string; code: string; message: string }[];
};

export type BookingFilters = {
  view?: 'upcoming' | 'past' | 'all';
  status?: string;
  rescheduled?: string;
  flag?: string;
  type?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: string;
};
