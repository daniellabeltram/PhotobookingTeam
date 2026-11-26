// Admin reschedule (story 014, ADR 0002 write ordering). Two phases so a crash can leave a booking holding two
// slots but never zero: (a) reserve the new entry, (b) update the booking with a CAS, (c) release the old entry.
import type { z } from "zod";
import { addDays, addMinutes, etDateOf, etTimeOf } from "../../../shared/datetime";
import { computeAmountDue, resolvePaymentLink } from "../../../shared/money";
import type { Booking, LedgerEntry } from "../../../shared/models";
import type { rescheduleSchema } from "../../../shared/schemas/admin";
import { getSessionType } from "../config";
import { HttpError } from "../errors";
import { validationFailed } from "../http";
import { log } from "../log";
import { updateBooking } from "../repos/bookings";
import type { Services } from "../services";
import { nearestAlternatives } from "./alternatives";
import { computeAvailability } from "./availability";
import { releaseWithRetries, reserveSlot } from "./reserve";
import { loadWorld } from "./world";

export type RescheduleBody = z.infer<typeof rescheduleSchema>;

export async function rescheduleBooking(svc: Services, cur: Booking, body: RescheduleBody): Promise<Booking> {
  const type = getSessionType(svc.config, cur.sessionTypeId);
  if (!type) throw new HttpError("SESSION_TYPE_UNAVAILABLE", "This session type no longer exists.");
  const now = svc.clock.now();

  let durationMin = type.durationMin;
  if (type.durationOptionsMin) {
    durationMin = body.durationMin ?? cur.durationMin;
    if (!type.durationOptionsMin.includes(durationMin)) throw validationFailed({ durationMin: "Choose one of the listed lengths" });
  } else if (body.durationMin !== undefined && body.durationMin !== type.durationMin) {
    throw validationFailed({ durationMin: "That length isn't available for this session" });
  }
  if (type.kind === "mini" && !body.miniSlotId) throw validationFailed({ miniSlotId: "Choose a mini time" });
  if (type.kind !== "mini" && body.miniSlotId) throw validationFailed({ miniSlotId: "Only Holiday Minis use a mini slot" });

  const date = etDateOf(body.startUtc);
  const world = await loadWorld(svc, addDays(date, -14), addDays(date, 14));
  const avail = computeAvailability({
    config: svc.config,
    type,
    durationMin,
    from: date,
    to: date,
    nowIso: now,
    ledgers: world.ledgers,
    blocks: world.blocks,
    ignoreNoticeAndHorizon: true,
    excludeBookingId: cur.id,
  });
  const day = avail.days[0];
  const slot = day?.slots.find((s) => s.startUtc === body.startUtc && (type.kind !== "mini" || s.miniSlotId === body.miniSlotId));
  if (!day || !slot) {
    const alternatives = nearestAlternatives({
      config: svc.config,
      type,
      durationMin,
      requestedStartUtc: body.startUtc,
      nowIso: now,
      ledgers: world.ledgers,
      blocks: world.blocks,
      ignoreNoticeAndHorizon: true,
      excludeBookingId: cur.id,
    });
    throw new HttpError("SLOT_TAKEN", "That time was just booked.", { alternatives });
  }
  if (slot.startUtc === cur.startUtc && durationMin === cur.durationMin) throw validationFailed({ startUtc: "Choose a different time" });

  // (a) reserve the new entry; the booking's own current entry never conflicts with it
  const entry: LedgerEntry = {
    bookingId: cur.id,
    sessionTypeId: type.id,
    kind: type.kind === "mini" ? "mini" : "standard",
    startUtc: slot.startUtc,
    endUtc: slot.endUtc,
    busyStartUtc: addMinutes(slot.startUtc, -type.bufferMin),
    busyEndUtc: addMinutes(slot.endUtc, type.bufferMin),
    countsTowardDailyCap: type.countsTowardDailyCap,
    miniSlotId: type.kind === "mini" ? (body.miniSlotId ?? null) : null,
    createdAt: now,
    verified: false,
  };
  const reserved = await reserveSlot(svc.store, svc.clock, { date, entry, maxSessionsPerDay: svc.config.scheduling.maxSessionsPerDay });
  if (!reserved.ok) {
    if (reserved.reason === "busy") throw new HttpError("BUSY", "We're a little busy. Please try again in a moment.");
    const fresh = await loadWorld(svc, addDays(date, -14), addDays(date, 14));
    throw new HttpError("SLOT_TAKEN", "That time was just booked.", {
      alternatives: nearestAlternatives({
        config: svc.config,
        type,
        durationMin,
        requestedStartUtc: body.startUtc,
        nowIso: now,
        ledgers: fresh.ledgers,
        blocks: fresh.blocks,
        ignoreNoticeAndHorizon: true,
        excludeBookingId: cur.id,
      }),
    });
  }

  // (b) the booking record
  const due = computeAmountDue(type, durationMin);
  let next: Booking;
  try {
    next = await updateBooking(
      svc.store,
      cur.id,
      (b) => {
        b.history.push({
          at: now,
          by: "admin",
          action: "reschedule",
          fromStatus: b.status,
          toStatus: b.status,
          fromStartUtc: b.startUtc,
          toStartUtc: slot.startUtc,
          reason: body.reason,
          note: body.note?.trim() || null,
        });
        b.startUtc = slot.startUtc;
        b.endUtc = slot.endUtc;
        b.busyStartUtc = entry.busyStartUtc;
        b.busyEndUtc = entry.busyEndUtc;
        b.localDate = date;
        b.localStartTime = etTimeOf(slot.startUtc);
        b.localEndTime = etTimeOf(slot.endUtc);
        b.durationMin = durationMin;
        b.miniSlotId = entry.miniSlotId;
        if (type.kind === "mini" && day.mini) b.location = { kind: "mini_day", label: day.mini.location };
        b.pricing.amountDueCents = due.amountCents;
        b.pricing.amountDueKind = due.kind;
        if (due.estimatedTotalCents !== undefined) b.pricing.estimatedTotalCents = due.estimatedTotalCents;
        b.pricing.paymentLinkUrl = resolvePaymentLink(type, durationMin, b.id, svc.env.paymentLinkOverrideUrl);
        b.rescheduleCount += 1;
        b.lastRescheduledAt = now;
        if (b.status !== "requested") b.icsSequence += 1;
        return b;
      },
      { expectedVersion: body.expectedVersion },
    );
  } catch (err) {
    // undo (a): the booking keeps its time
    if (cur.startUtc !== slot.startUtc) {
      await releaseWithRetries(svc.store, svc.clock, date, cur.id, slot.startUtc);
    } else {
      // same start, new length: (a) replaced the entry in place, so put the OLD entry back
      const oldEntry: LedgerEntry = {
        ...entry,
        endUtc: cur.endUtc,
        busyStartUtc: cur.busyStartUtc,
        busyEndUtc: cur.busyEndUtc,
        createdAt: now,
        verified: false,
      };
      const back = await reserveSlot(svc.store, svc.clock, { date, entry: oldEntry, maxSessionsPerDay: svc.config.scheduling.maxSessionsPerDay });
      if (!back.ok) log("warn", "old entry not restored", { bookingId: cur.id, reason: "release_failed" });
    }
    throw err;
  }

  // (c) free the old time
  const released = cur.startUtc === slot.startUtc ? true : await releaseWithRetries(svc.store, svc.clock, cur.localDate, cur.id, cur.startUtc);
  if (!released) log("warn", "old slot not released", { bookingId: cur.id, reason: "release_failed" });
  return next;
}
