// /api/admin/bookings: list, detail, status changes, reschedule, resend email, delete client data.
import type { Config } from "@netlify/functions";
import type { AdminActionData } from "../../shared/api-types";
import { todayEt } from "../../shared/datetime";
import { normalizeReference } from "../../shared/reference";
import { deleteDataSchema, listQuerySchema, patchSchema, rescheduleSchema, resendSchema } from "../../shared/schemas/admin";
import { allowedActions, resendKinds, STATUS_LABEL } from "../../shared/status";
import type { Booking, ClientEmailKind } from "../../shared/models";
import { withAdmin, type AdminContext } from "../lib/auth/guard";
import { getCatalogue, getSessionType } from "../lib/config";
import { flagSettings, listForAdmin } from "../lib/domain/admin-list";
import { wipePii } from "../lib/domain/delete-pii";
import { rescheduleBooking } from "../lib/domain/reschedule";
import { releaseWithRetries } from "../lib/domain/reserve";
import { applyTransition } from "../lib/domain/transitions";
import { bookingDetail } from "../lib/domain/views";
import { sendBookingEmails } from "../lib/email/notify";
import { HttpError } from "../lib/errors";
import { fieldErrors, json, readJsonBody, validationFailed } from "../lib/http";
import { log } from "../lib/log";
import { getBooking, updateBooking } from "../lib/repos/bookings";
import type { Params } from "../lib/route";

async function loadOr404(rc: AdminContext, params: Params): Promise<Booking> {
  const id = normalizeReference(params.id ?? "");
  const booking = id ? await getBooking(rc.svc.store, id) : null;
  if (!booking) throw new HttpError("NOT_FOUND", "We couldn't find that booking.");
  return booking;
}

function detail(rc: AdminContext, b: Booking) {
  const { svc } = rc;
  return bookingDetail(b, svc.clock.now(), flagSettings(svc), getSessionType(svc.config, b.sessionTypeId), getCatalogue());
}

function versionConflict(cur: Booking, wasRequestAction: boolean): HttpError {
  const message =
    wasRequestAction && cur.status !== "requested"
      ? `This request was already handled (now: ${STATUS_LABEL[cur.status]}). Reload to see the latest`
      : "This booking changed. Reload to see the latest";
  return new HttpError("VERSION_CONFLICT", message, { currentVersion: cur.version, currentStatus: cur.status });
}

function invalidTransition(rc: AdminContext, cur: Booking): HttpError {
  return new HttpError("INVALID_TRANSITION", "That change isn't possible for this booking right now.", {
    currentStatus: cur.status,
    allowedActions: allowedActions(cur, rc.svc.clock.now()),
  });
}

async function releaseSlot(rc: AdminContext, b: Booking): Promise<void> {
  const ok = await releaseWithRetries(rc.svc.store, rc.svc.clock, b.localDate, b.id, b.startUtc);
  if (!ok) log("warn", "slot release failed", { requestId: rc.requestId, bookingId: b.id, reason: "release_failed" });
}

async function sendOne(rc: AdminContext, id: string, kind: ClientEmailKind | null): Promise<AdminActionData["email"]> {
  if (!kind) return null;
  try {
    const { outcomes } = await sendBookingEmails(rc.svc, id, [kind]);
    return { kind, status: outcomes[kind] === "sent" ? "sent" : "failed" };
  } catch {
    log("warn", "email step failed", { requestId: rc.requestId, bookingId: id, reason: "email_failed" });
    return { kind, status: "failed" };
  }
}

async function patch(req: Request, params: Params, rc: AdminContext): Promise<Response> {
  const { svc } = rc;
  const raw = await readJsonBody(req);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) throw validationFailed(fieldErrors(parsed.error));
  const body = parsed.data;
  const cur = await loadOr404(rc, params);
  const requestAction = body.action === "approve" || body.action === "decline";

  if (cur.version !== body.expectedVersion) {
    // A repeated cancel or decline also retries the slot release (docs/api.md)
    if ((body.action === "cancel" && cur.status === "cancelled") || (body.action === "decline" && cur.status === "declined")) await releaseSlot(rc, cur);
    log("info", "version conflict", { requestId: rc.requestId, bookingId: cur.id, reason: "version_conflict", code: "VERSION_CONFLICT" });
    throw versionConflict(cur, requestAction);
  }
  const now = svc.clock.now();
  if (!allowedActions(cur, now).includes(body.action)) throw invalidTransition(rc, cur);
  if (body.action === "mark_paid" && body.receivedOn > todayEt(now)) throw validationFailed({ receivedOn: "The date received can't be in the future" });

  let result: ReturnType<typeof applyTransition> | null = null;
  const next = await updateBooking(
    svc.store,
    cur.id,
    (b) => {
      result = applyTransition(b, body, now);
      return result.booking;
    },
    { expectedVersion: body.expectedVersion },
  );
  const applied = result as ReturnType<typeof applyTransition> | null;
  log("info", "status changed", { requestId: rc.requestId, bookingId: cur.id, kind: body.action, reason: "transition" });
  if (applied?.releaseSlot) await releaseSlot(rc, next);
  const email = await sendOne(rc, cur.id, applied?.emailKind ?? null);
  const fresh = (await getBooking(svc.store, cur.id)) ?? next;
  return json(200, { booking: detail(rc, fresh), email } satisfies AdminActionData);
}

async function reschedule(req: Request, params: Params, rc: AdminContext): Promise<Response> {
  const { svc } = rc;
  const parsed = rescheduleSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) throw validationFailed(fieldErrors(parsed.error));
  const body = parsed.data;
  const cur = await loadOr404(rc, params);
  if (cur.version !== body.expectedVersion) throw versionConflict(cur, false);
  if (!allowedActions(cur, svc.clock.now()).includes("reschedule")) throw invalidTransition(rc, cur);
  const next = await rescheduleBooking(svc, cur, body);
  log("info", "rescheduled", { requestId: rc.requestId, bookingId: cur.id, reason: "reschedule" });
  const email = await sendOne(rc, cur.id, body.notifyClient === false ? null : "rescheduled");
  const fresh = (await getBooking(svc.store, cur.id)) ?? next;
  return json(200, { booking: detail(rc, fresh), email } satisfies AdminActionData);
}

async function resend(req: Request, params: Params, rc: AdminContext): Promise<Response> {
  const parsed = resendSchema.safeParse(await readJsonBody(req, { required: false }));
  if (!parsed.success) throw validationFailed(fieldErrors(parsed.error));
  const cur = await loadOr404(rc, params);
  if (cur.piiDeletedAt || !cur.contact) throw invalidTransition(rc, cur);
  let kind: ClientEmailKind | undefined = parsed.data.kind;
  if (!kind) {
    const failed = Object.entries(cur.emails)
      .filter(([k, v]) => k !== "admin_new_booking" && v?.status === "failed")
      .sort((a, b) => (b[1]?.at ?? "").localeCompare(a[1]?.at ?? ""))[0];
    if (!failed) throw validationFailed({ kind: "No failed email to resend. Choose which email to send." });
    kind = failed[0] as ClientEmailKind;
  }
  if (!resendKinds(cur).includes(kind)) throw invalidTransition(rc, cur);
  const out = await sendOne(rc, cur.id, kind);
  return json(200, out);
}

async function deleteClientData(req: Request, params: Params, rc: AdminContext): Promise<Response> {
  const { svc } = rc;
  const parsed = deleteDataSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) throw validationFailed(fieldErrors(parsed.error));
  const body = parsed.data;
  const cur = await loadOr404(rc, params);
  if (normalizeReference(body.confirmReference) !== cur.id) throw validationFailed({ confirmReference: "Type the booking reference exactly to confirm" });
  if (cur.version !== body.expectedVersion) throw versionConflict(cur, false);
  const now = svc.clock.now();
  if (!allowedActions(cur, now).includes("delete_client_data")) throw invalidTransition(rc, cur);
  const next = await updateBooking(svc.store, cur.id, (b) => wipePii(b, now), { expectedVersion: body.expectedVersion });
  log("info", "client data deleted", { requestId: rc.requestId, bookingId: cur.id, reason: "pii_deleted" });
  return json(200, { booking: detail(rc, next) });
}

export default withAdmin("admin-bookings", [
  {
    method: "GET",
    pattern: "/api/admin/bookings",
    handler: async (req, _p, rc) => {
      const parsed = listQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
      if (!parsed.success) throw validationFailed(fieldErrors(parsed.error));
      return json(200, await listForAdmin(rc.svc, parsed.data));
    },
  },
  { method: "GET", pattern: "/api/admin/bookings/:id", handler: async (_r, p, rc) => json(200, detail(rc, await loadOr404(rc, p))) },
  { method: "PATCH", pattern: "/api/admin/bookings/:id", handler: patch },
  { method: "POST", pattern: "/api/admin/bookings/:id/reschedule", handler: reschedule },
  { method: "POST", pattern: "/api/admin/bookings/:id/resend-email", handler: resend },
  { method: "POST", pattern: "/api/admin/bookings/:id/delete-client-data", handler: deleteClientData },
]);

export const config: Config = {
  path: [
    "/api/admin/bookings",
    "/api/admin/bookings/:id",
    "/api/admin/bookings/:id/reschedule",
    "/api/admin/bookings/:id/resend-email",
    "/api/admin/bookings/:id/delete-client-data",
  ],
  method: ["GET", "PATCH", "POST"],
};
