// POST /api/bookings (architecture section 10). Order: rate limit, honeypot, idempotency claim, validation,
// policy + rules + atomic reserve + store, emails AFTER the commit, 201.
import type { Config } from "@netlify/functions";
import type { CreateBookingData } from "../../shared/api-types";
import { formatDateLong, formatRangeEt, normalizeInstant, addMinutes } from "../../shared/datetime";
import { computeAmountDue } from "../../shared/money";
import type { ClientEmailKind } from "../../shared/models";
import { generateReference } from "../../shared/reference";
import { buildBookingSchema } from "../../shared/schemas/booking";
import { getCatalogue, getSessionType } from "../lib/config";
import { createBooking } from "../lib/domain/create-booking";
import { createResponse, locationLabel } from "../lib/domain/views";
import { CREATE_SEND_TIMEOUT_MS, sendBookingEmails } from "../lib/email/notify";
import { HttpError } from "../lib/errors";
import { defineFunction, dispatch, fieldErrors, json, readJsonBody, validationFailed, type RequestContext } from "../lib/http";
import { claim, finish, hashBody, noteBooking, peekReplay, release, type IdemRecord } from "../lib/idempotency";
import type { Services } from "../lib/services";
import { hashIp } from "../lib/ip";
import { log } from "../lib/log";
import { getBooking } from "../lib/repos/bookings";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * What is stored for a replay: the 201 without the location text (the client's own words, possibly an address).
 * A replay puts the label back from the booking, so idem/ records hold no personal details (review L-2).
 */
const forStorage = (data: CreateBookingData): Omit<CreateBookingData, "locationLabel"> => {
  const { locationLabel: _dropped, ...rest } = data;
  return rest;
};
async function rehydrate(svc: Services, stored: unknown): Promise<unknown> {
  const body = stored as Omit<CreateBookingData, "locationLabel">;
  const booking = body?.reference ? await getBooking(svc.store, body.reference) : null;
  return { ...body, locationLabel: booking ? locationLabel(booking) : "" };
}

/** A believable 201 for a filled honeypot. Nothing is stored or sent (story 017 #2). */
function fakeResponse(rc: RequestContext, body: Record<string, unknown>): CreateBookingData {
  const { svc } = rc;
  const type = getSessionType(svc.config, String(body.sessionTypeId ?? "")) ?? svc.config.sessionTypes.find((t) => t.active) ?? svc.config.sessionTypes[0];
  if (!type) throw new HttpError("INTERNAL", "Something went wrong on our side. Please try again.");
  const durationMin = type.durationOptionsMin?.includes(Number(body.durationMin)) ? Number(body.durationMin) : type.durationMin;
  const startUtc = (typeof body.startUtc === "string" ? normalizeInstant(body.startUtc) : null) ?? addMinutes(svc.clock.now(), 72 * 60);
  const endUtc = addMinutes(startUtc, durationMin);
  const due = computeAmountDue(type, durationMin);
  const isRequest = type.bookingMode === "request";
  const dueCents = due.amountCents;
  return {
    reference: generateReference(),
    status: isRequest ? "requested" : due.kind === "none" ? "confirmed" : "pending_deposit",
    bookingMode: type.bookingMode,
    sessionTypeId: type.id,
    sessionTypeName: type.name,
    durationMin,
    startUtc,
    endUtc,
    display: { date: formatDateLong(startUtc), timeRange: formatRangeEt(startUtc, endUtc) },
    locationLabel: "Daniella will help you choose a spot",
    amountDue: {
      cents: dueCents,
      label: `$${(dueCents / 100).toFixed(2)}`,
      kind: isRequest ? "estimated_deposit" : due.kind,
      dueNow: !isRequest && due.kind !== "none",
    },
    paymentLinkUrl: null,
    holdHours: !isRequest && due.kind !== "none" ? svc.config.scheduling.unpaidHoldHours : null,
    requestResponseDays: isRequest ? svc.config.scheduling.requestResponseDays : null,
    emailSent: true,
  };
}

async function create(req: Request, rc: RequestContext): Promise<Response> {
  const { svc } = rc;
  const { config } = svc;

  // 1. Body (size capped before parsing)
  const body = await readJsonBody(req);
  const key = req.headers.get("idempotency-key")?.trim() ?? "";
  const requestHash = hashBody(body);

  // A retry of a booking that already went through gets its stored 201, even from a visitor who is now rate limited
  if (UUID_V4.test(key)) {
    const replay = await peekReplay(svc.store, svc.clock, key, requestHash);
    if (replay) {
      log("info", "idempotent replay", { requestId: rc.requestId, reason: "idempotent_replay" });
      return json(replay.status, await rehydrate(svc, replay.body));
    }
  }

  // 2. Rate limit per visitor
  if (!svc.env.rateLimitDisabled) {
    const take = await svc.limiter.take("booking", hashIp(rc.ip, svc.env.adminSessionSecret), config.limits.bookingRateLimit);
    if (!take.allowed) {
      log("warn", "booking rate limited", { requestId: rc.requestId, reason: "rate_limited", code: "RATE_LIMITED" });
      throw new HttpError(
        "RATE_LIMITED",
        `Too many attempts. Please wait a few minutes and try again, or contact Daniella at ${config.business.contactEmail}.`,
        undefined,
        { "retry-after": String(take.retryAfterSec) },
      );
    }
  }

  // 3. Honeypot
  if (typeof body.website === "string" && body.website.trim() !== "") {
    log("info", "honeypot", { requestId: rc.requestId, honeypot: 1, reason: "honeypot" });
    return json(201, fakeResponse(rc, body));
  }

  // 4. Idempotency
  if (!UUID_V4.test(key)) throw validationFailed({ "header.idempotencyKey": "An Idempotency-Key header (a UUID v4) is required" });
  const claimed = await claim(svc.store, svc.clock, key, requestHash);
  switch (claimed.kind) {
    case "replay":
      log("info", "idempotent replay", { requestId: rc.requestId, reason: "idempotent_replay" });
      return json(claimed.status, await rehydrate(svc, claimed.body));
    case "mismatch":
      throw new HttpError("IDEMPOTENCY_KEY_REUSED", "That request key was already used with different answers. Please start the booking again.");
    case "in_progress":
      throw new HttpError("REQUEST_IN_PROGRESS", "Your booking is still being processed. One moment please.", undefined, { "retry-after": "1" });
    case "resume": {
      const existing = await getBooking(svc.store, claimed.bookingId);
      if (existing) {
        const data = createResponse(existing, existing.emails.booking_received?.status === "sent" || existing.emails.request_received?.status === "sent", config.scheduling);
        await finish(svc.store, key, { state: "pending", requestHash, createdAt: svc.clock.now() }, 201, forStorage(data));
        return json(201, data);
      }
      break;
    }
    case "claimed":
      break;
  }

  const rec: IdemRecord = { state: "pending", requestHash, createdAt: svc.clock.now() };
  let committed = false; // once the booking exists the claim must stay, so a retry resumes instead of rebooking
  try {
    // 5. Validation: schema built for this session type
    const typeId = typeof body.sessionTypeId === "string" ? body.sessionTypeId : "";
    const type = getSessionType(config, typeId);
    if (!typeId) throw validationFailed({ sessionTypeId: "Choose a session type" });
    if (!type || !type.active) throw new HttpError("SESSION_TYPE_UNAVAILABLE", "This session isn't available to book right now.");
    const parsed = buildBookingSchema({ type, catalogue: getCatalogue(), portfolioOptOutEnabled: config.features.portfolioOptOutEnabled }).safeParse(body);
    if (!parsed.success) throw validationFailed(fieldErrors(parsed.error));

    // 6-9. Policy, rules, reserve, store
    const booking = await createBooking(svc, parsed.data, type);
    committed = true;
    // From here on the booking exists: bookkeeping problems are logged, never turned into an error for the client.
    if (claimed.kind === "claimed") {
      await noteBooking(svc.store, key, claimed.etag, rec, booking.id).catch(() => log("warn", "idempotency note failed", { requestId: rc.requestId, bookingId: booking.id, reason: "store_error" }));
    }
    log("info", "booking created", { requestId: rc.requestId, bookingId: booking.id, status: 201, reason: "created", kind: booking.status });

    // 10. Emails after the commit. A failure is recorded on the booking and never undoes it.
    const clientKind: ClientEmailKind = booking.status === "requested" ? "request_received" : "booking_received";
    let emailSent = false;
    try {
      const { outcomes } = await sendBookingEmails(svc, booking.id, [clientKind, "admin_new_booking"], { timeoutMs: CREATE_SEND_TIMEOUT_MS });
      emailSent = outcomes[clientKind] === "sent";
    } catch {
      log("warn", "email step failed", { requestId: rc.requestId, bookingId: booking.id, reason: "email_failed" });
    }

    const data = createResponse(booking, emailSent, config.scheduling);
    await finish(svc.store, key, rec, 201, forStorage(data)).catch(() => log("warn", "idempotency finish failed", { requestId: rc.requestId, bookingId: booking.id, reason: "store_error" }));
    return json(201, data);
  } catch (err) {
    if (!committed) await release(svc.store, key).catch(() => undefined);
    throw err;
  }
}

export default defineFunction("bookings-create", (req, rc) =>
  dispatch([{ method: "POST", pattern: "/api/bookings", handler: (r) => create(r, rc) }], req, rc),
);

export const config: Config = { path: "/api/bookings", method: ["POST"] };
