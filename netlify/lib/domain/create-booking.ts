// Creating a booking after validation (architecture section 10, steps 6 to 9): policy check, server-side rule
// check, daily site cap, atomic reserve, then the booking record. Emails are sent by the handler afterwards.
import { addDays, addMinutes, etDateOf, etTimeOf } from "../../../shared/datetime";
import type { BookingConfig, SessionType } from "../../../shared/config-schema";
import { computeAmountDue, resolvePaymentLink } from "../../../shared/money";
import type { Booking, BookingLocation, IntakeValue, LedgerEntry } from "../../../shared/models";
import { generateReference } from "../../../shared/reference";
import type { ParsedBooking } from "../../../shared/schemas/booking";
import { HttpError } from "../errors";
import { log } from "../log";
import { insertBooking } from "../repos/bookings";
import type { Services } from "../services";
import { nearestAlternatives } from "./alternatives";
import { computeAvailability } from "./availability";
import { releaseEntry, reserveSlot } from "./reserve";
import { loadWorld, loadWorldForType } from "./world";

const blank = (v: unknown): v is null | undefined | "" => v === undefined || v === null || v === "";
const orNull = <T>(v: T | null | undefined | ""): T | null => (blank(v) ? null : v);

export function buildIntake(parsed: ParsedBooking, type: SessionType): Record<string, IntakeValue> {
  const intake: Record<string, IntakeValue> = {
    subjectsNames: parsed.subjectsNames,
    anythingElse: orNull(parsed.anythingElse),
    heardAbout: orNull(parsed.heardAbout),
  };
  if (type.commonFieldsProfile === "full") {
    intake.styleNotes = orNull(parsed.styleNotes);
    intake.mustHaveShots = orNull(parsed.mustHaveShots);
  }
  for (const f of type.intakeExtraFields) {
    const [prefix, name] = f.id.split(".") as [string, string];
    intake[f.id] = orNull(parsed.extra[prefix]?.[name]) as IntakeValue;
  }
  return intake;
}

function slotTaken(svc: Services, type: SessionType, durationMin: number, startUtc: string, world: Awaited<ReturnType<typeof loadWorld>>): HttpError {
  const alternatives = nearestAlternatives({
    config: svc.config,
    type,
    durationMin,
    requestedStartUtc: startUtc,
    nowIso: svc.clock.now(),
    ledgers: world.ledgers,
    blocks: world.blocks,
  });
  return new HttpError("SLOT_TAKEN", "That time was just booked.", { alternatives });
}

export async function createBooking(
  svc: Services,
  parsed: ParsedBooking,
  type: SessionType,
): Promise<Booking> {
  const config: BookingConfig = svc.config;
  const now = svc.clock.now();

  // 6. Policy
  if (parsed.policy.version !== config.policyVersion) {
    throw new HttpError("POLICY_VERSION_CHANGED", "Our policies were just updated. Please review them and try again.", { currentVersion: config.policyVersion });
  }

  // 7. Server-side rules: the time must be an open slot right now
  const durationMin = type.durationOptionsMin ? (parsed.durationMin as number) : type.durationMin;
  const date = etDateOf(parsed.startUtc);
  const world = await loadWorldForType(svc, type, addDays(date, -14), addDays(date, 14));
  const avail = computeAvailability({
    config,
    type,
    durationMin,
    from: date,
    to: date,
    nowIso: now,
    ledgers: world.ledgers,
    blocks: world.blocks,
  });
  const day = avail.days[0];
  const slot = day?.slots.find((s) => s.startUtc === parsed.startUtc && (type.kind !== "mini" || s.miniSlotId === parsed.miniSlotId));
  if (!day || !slot) throw slotTaken(svc, type, durationMin, parsed.startUtc, world);

  // Site-wide daily cap (email relay guard, review M5). Fails open: a store hiccup never blocks real clients.
  let capKey: string | null = null;
  if (!svc.env.rateLimitDisabled) {
    const spec = config.limits.bookingGlobalLimit;
    const take = await svc.limiter.take("booking-global", "all", spec, { windowKey: etDateOf(now), retryAfterSec: 3600 });
    if (!take.allowed) {
      log("warn", "site-wide booking cap reached", { reason: "global_cap", code: "RATE_LIMITED" });
      throw new HttpError(
        "RATE_LIMITED",
        `Too many attempts. Please wait a few minutes and try again, or contact Daniella at ${config.business.contactEmail}.`,
        undefined,
        { "retry-after": String(take.retryAfterSec) },
      );
    }
    capKey = take.key;
  }

  try {
    const busyStartUtc = addMinutes(slot.startUtc, -type.bufferMin);
    const busyEndUtc = addMinutes(slot.endUtc, type.bufferMin);
    const miniDay = day.mini;

    for (let attempt = 0; attempt < 3; attempt++) {
      const id = generateReference();
      const entry: LedgerEntry = {
        bookingId: id,
        sessionTypeId: type.id,
        kind: type.kind === "mini" ? "mini" : "standard",
        startUtc: slot.startUtc,
        endUtc: slot.endUtc,
        busyStartUtc,
        busyEndUtc,
        countsTowardDailyCap: type.countsTowardDailyCap,
        miniSlotId: type.kind === "mini" ? (parsed.miniSlotId ?? null) : null,
        createdAt: now,
        verified: false,
      };
      const reserved = await reserveSlot(svc.store, svc.clock, { date, entry, maxSessionsPerDay: config.scheduling.maxSessionsPerDay });
      if (!reserved.ok) {
        if (reserved.reason === "busy") throw new HttpError("BUSY", "We're a little busy. Please try again in a moment.");
        const fresh = await loadWorld(svc, addDays(date, -14), addDays(date, 14));
        log("info", "slot taken", { reason: "slot_taken", code: "SLOT_TAKEN" });
        throw slotTaken(svc, type, durationMin, parsed.startUtc, fresh);
      }

      const due = computeAmountDue(type, durationMin);
      const isRequest = type.bookingMode === "request";
      const status = isRequest ? "requested" : due.kind === "none" ? "confirmed" : "pending_deposit";
      const location: BookingLocation =
        type.kind === "mini"
          ? { kind: "mini_day", label: miniDay?.location ?? "Holiday Minis" }
          : parsed.location?.kind === "suggested"
            ? { kind: "suggested", optionId: parsed.location.optionId, label: type.locationOptions.find((l) => l.id === (parsed.location as { optionId: string }).optionId)?.label ?? "" }
            : parsed.location?.kind === "own"
              ? { kind: "own", text: parsed.location.text }
              : { kind: "help_me_choose" };
      const booking: Booking = {
        id,
        version: 1,
        status,
        sessionTypeId: type.id,
        sessionTypeName: type.name,
        bookingMode: type.bookingMode,
        durationMin,
        bufferMin: type.bufferMin,
        startUtc: slot.startUtc,
        endUtc: slot.endUtc,
        busyStartUtc,
        busyEndUtc,
        localDate: date,
        localStartTime: etTimeOf(slot.startUtc),
        localEndTime: etTimeOf(slot.endUtc),
        timezone: "America/New_York",
        miniSlotId: entry.miniSlotId,
        location,
        contact: { ...parsed.contact },
        people: { ...parsed.people },
        intake: buildIntake(parsed, type),
        portfolioOptOut: config.features.portfolioOptOutEnabled ? (parsed.portfolioOptOut ?? false) : null,
        policyVersion: parsed.policy.version,
        policyAcceptedAt: now,
        pricing: {
          priceFromCents: type.priceFromCents,
          priceUnit: type.priceUnit,
          ...(due.estimatedTotalCents !== undefined ? { estimatedTotalCents: due.estimatedTotalCents } : {}),
          amountDueCents: due.amountCents,
          amountDueKind: due.kind,
          paymentLinkUrl: resolvePaymentLink(type, durationMin, id, svc.env.paymentLinkOverrideUrl),
        },
        payment: null,
        createdAt: now,
        ...(isRequest ? { requestedAt: now } : {}),
        ...(status === "confirmed" ? { confirmedAt: now } : {}),
        holdStartedAt: status === "pending_deposit" ? now : null,
        cancellation: null,
        decline: null,
        rescheduleCount: 0,
        lastRescheduledAt: null,
        icsSequence: 0,
        emails: {},
        history: [{ at: now, by: "client", action: "create", fromStatus: null, toStatus: status }],
        piiDeletedAt: null,
      };
      if (await insertBooking(svc.store, booking)) {
        capKey = null; // the booking exists: the daily count stays
        return booking;
      }
      await releaseEntry(svc.store, svc.clock, date, id, slot.startUtc); // reference collision: try another
    }
    throw new HttpError("BUSY", "We're a little busy. Please try again in a moment.");
  } finally {
    if (capKey) await svc.limiter.refund(capKey);
  }
}
