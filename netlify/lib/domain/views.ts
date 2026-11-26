// Booking record to API shapes (docs/api.md). Display strings come from shared/datetime so the confirmation,
// the email, the .ics and admin all show the same time.
import type { AdminBookingDetail, AdminBookingListItem, AmountDue, CreateBookingData, Money } from "../../../shared/api-types";
import type { IntakeFieldDef, SessionType } from "../../../shared/config-schema";
import { formatDateLong, formatDateMedium, formatDateTimeLabel, formatRangeEt } from "../../../shared/datetime";
import { formatUsd } from "../../../shared/money";
import type { Booking } from "../../../shared/models";
import { allowedActions, deriveFlags, waitingLabel, type FlagSettings } from "../../../shared/status";

export const money = (cents: number): Money => ({ cents, label: formatUsd(cents) });

export function amountDue(b: Booking): AmountDue {
  const dueNow = b.status === "pending_deposit" && b.pricing.amountDueKind !== "none";
  return { ...money(b.pricing.amountDueCents), kind: b.pricing.amountDueKind, dueNow };
}

export function locationLabel(b: Booking): string {
  switch (b.location.kind) {
    case "suggested":
    case "mini_day":
      return b.location.label;
    case "own":
      return b.location.text;
    case "help_me_choose":
      return "Daniella will help you choose a spot";
    case "removed":
      return "";
  }
}

/** The 201 body for POST /api/bookings. Holds no contact details or intake answers. */
export function createResponse(b: Booking, emailSent: boolean, settings: FlagSettings): CreateBookingData {
  const isRequest = b.status === "requested";
  const due = amountDue(b);
  return {
    reference: b.id,
    status: b.status as CreateBookingData["status"],
    bookingMode: b.bookingMode,
    sessionTypeId: b.sessionTypeId,
    sessionTypeName: b.sessionTypeName,
    durationMin: b.durationMin,
    startUtc: b.startUtc,
    endUtc: b.endUtc,
    display: { date: formatDateLong(b.startUtc), timeRange: formatRangeEt(b.startUtc, b.endUtc) },
    locationLabel: locationLabel(b),
    amountDue: isRequest ? { ...due, kind: b.pricing.amountDueKind === "none" ? "none" : "estimated_deposit", dueNow: false } : due,
    paymentLinkUrl: isRequest ? null : b.pricing.paymentLinkUrl,
    holdHours: b.status === "pending_deposit" ? settings.unpaidHoldHours : null,
    requestResponseDays: isRequest ? settings.requestResponseDays : null,
    emailSent,
  };
}

export function listItem(b: Booking, nowIso: string, settings: FlagSettings): AdminBookingListItem {
  const waitingSince = b.status === "requested" ? (b.requestedAt ?? b.createdAt) : null;
  return {
    id: b.id,
    version: b.version,
    status: b.status,
    sessionTypeId: b.sessionTypeId,
    sessionTypeName: b.sessionTypeName,
    startUtc: b.startUtc,
    endUtc: b.endUtc,
    localDate: b.localDate,
    display: { date: formatDateMedium(b.startUtc), timeRange: formatRangeEt(b.startUtc, b.endUtc) },
    clientName: b.contact?.fullName ?? null,
    flags: deriveFlags(b, nowIso, settings),
    waitingSince,
    waitingLabel: waitingSince ? waitingLabel(waitingSince, nowIso) : null,
  };
}

/** Every intake field for the type in form order, with null for unanswered ones. */
export function intakeAnswers(b: Booking, type: SessionType | undefined, catalogue: IntakeFieldDef[]): AdminBookingDetail["intake"] {
  if (!b.intake) return [];
  const label = (id: string) => catalogue.find((f) => f.id === id)?.label ?? id;
  const ids = ["subjectsNames"];
  if (!type || type.commonFieldsProfile === "full") ids.push("styleNotes", "mustHaveShots");
  ids.push("anythingElse", "heardAbout", ...(type?.intakeExtraFields.map((f) => f.id) ?? []));
  const intake = b.intake;
  return ids.map((id) => ({ id, label: label(id), value: intake[id] ?? null }));
}

export function bookingDetail(
  b: Booking,
  nowIso: string,
  settings: FlagSettings,
  type: SessionType | undefined,
  catalogue: IntakeFieldDef[],
): AdminBookingDetail {
  const est = b.pricing.estimatedTotalCents;
  return {
    id: b.id,
    version: b.version,
    status: b.status,
    bookingMode: b.bookingMode,
    sessionTypeId: b.sessionTypeId,
    sessionTypeName: b.sessionTypeName,
    durationMin: b.durationMin,
    bufferMin: b.bufferMin,
    startUtc: b.startUtc,
    endUtc: b.endUtc,
    localDate: b.localDate,
    localStartTime: b.localStartTime,
    localEndTime: b.localEndTime,
    display: {
      date: formatDateLong(b.startUtc),
      timeRange: formatRangeEt(b.startUtc, b.endUtc),
      createdAt: formatDateTimeLabel(b.createdAt),
    },
    location: b.location,
    contact: b.contact,
    people: b.people,
    intake: intakeAnswers(b, type, catalogue),
    portfolioOptOut: b.portfolioOptOut,
    policy: {
      version: b.policyVersion,
      acceptedAt: b.policyAcceptedAt,
      acceptedAtLabel: formatDateTimeLabel(b.policyAcceptedAt),
      url: `/policies.html?version=${encodeURIComponent(b.policyVersion)}`,
    },
    pricing: { amountDue: amountDue(b), estimatedTotal: est === undefined ? null : money(est), paymentLinkUrl: b.pricing.paymentLinkUrl },
    payment: b.payment,
    timestamps: {
      createdAt: b.createdAt,
      requestedAt: b.requestedAt ?? null,
      approvedAt: b.approvedAt ?? null,
      confirmedAt: b.confirmedAt ?? null,
      completedAt: b.completedAt ?? null,
      cancelledAt: b.cancelledAt ?? null,
      declinedAt: b.declinedAt ?? null,
      holdStartedAt: b.holdStartedAt,
    },
    cancellation: b.cancellation,
    decline: b.decline,
    rescheduleCount: b.rescheduleCount,
    emails: Object.fromEntries(Object.entries(b.emails).map(([k, v]) => [k, { status: v.status, at: v.at }])),
    flags: deriveFlags(b, nowIso, settings),
    history: b.history.map((h) => ({
      at: h.at,
      atLabel: formatDateTimeLabel(h.at),
      by: h.by,
      action: h.action,
      fromStatus: h.fromStatus ?? null,
      toStatus: h.toStatus ?? null,
      note: h.note ?? null,
      reason: h.reason ?? null,
      fromStartUtc: h.fromStartUtc ?? null,
      toStartUtc: h.toStartUtc ?? null,
    })),
    allowedActions: allowedActions(b, nowIso),
    piiDeletedAt: b.piiDeletedAt,
  };
}
