// Builds, sends and records emails AFTER the booking is committed (ADR 0004). A failure never rolls
// anything back: it is recorded on the booking ("Email not sent") and can be resent.
import { buildIcs, icsFilename } from "./ics";
import { log } from "../log";
import { getBooking, updateBooking } from "../repos/bookings";
import type { Services } from "../services";
import type { EmailKind } from "../../../shared/models";
import { EmailSendError, type OutgoingEmail } from "./sender";
import { renderAdminNewBooking } from "./templates/admin";
import type { EmailContext, Rendered } from "./templates/common";
import { renderClientEmail } from "./templates/client";

export type SendStatus = "sent" | "failed";
const SEND_TIMEOUT_MS = 10_000;

const ICS_KINDS: ReadonlySet<EmailKind> = new Set(["booking_received", "approved", "confirmed", "rescheduled"]);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new EmailSendError(null)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Sends the given kinds for one booking at once, then records every outcome in a single booking update. */
export async function sendBookingEmails(
  svc: Services,
  bookingId: string,
  kinds: EmailKind[],
): Promise<{ outcomes: Partial<Record<EmailKind, SendStatus>> }> {
  const booking = await getBooking(svc.store, bookingId);
  const outcomes: Partial<Record<EmailKind, SendStatus>> = {};
  if (!booking || !booking.contact) {
    for (const k of kinds) outcomes[k] = "failed";
    return { outcomes };
  }
  const type = svc.config.sessionTypes.find((t) => t.id === booking.sessionTypeId);
  if (!type) {
    for (const k of kinds) outcomes[k] = "failed";
    return { outcomes };
  }
  const ctx: EmailContext = { config: svc.config, booking, type, baseUrl: svc.env.publicBaseUrl };
  const nowIso = svc.clock.now();
  const results = new Map<EmailKind, { status: SendStatus; providerId?: string }>();

  await Promise.all(
    kinds.map(async (kind) => {
      const attempt = (booking.emails[kind]?.attempts ?? 0) + 1;
      const rendered: Rendered = kind === "admin_new_booking" ? renderAdminNewBooking(ctx) : renderClientEmail(kind, ctx);
      const msg: OutgoingEmail = {
        kind,
        bookingId,
        to: kind === "admin_new_booking" ? svc.config.email.adminNotificationEmail : booking.contact!.email,
        replyTo: kind === "admin_new_booking" ? undefined : svc.config.email.replyTo,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        idempotencyKey: `${bookingId}:${kind}:${booking.icsSequence}:${attempt}`,
      };
      if (ICS_KINDS.has(kind) && booking.status !== "requested") {
        msg.attachments = [
          {
            filename: icsFilename(booking),
            contentType: "text/calendar; charset=utf-8; method=PUBLISH",
            contentBase64: Buffer.from(buildIcs(booking, svc.config, nowIso), "utf8").toString("base64"),
          },
        ];
      }
      try {
        const res = await withTimeout(svc.email.send(msg), SEND_TIMEOUT_MS);
        results.set(kind, { status: "sent", providerId: res.providerId });
        log("info", "email sent", { kind, bookingId, driver: svc.env.emailDriver });
      } catch (err) {
        results.set(kind, { status: "failed" });
        log("warn", "email failed", {
          kind,
          bookingId,
          driver: svc.env.emailDriver,
          reason: "email_failed",
          providerStatus: err instanceof EmailSendError && err.providerStatus !== null ? err.providerStatus : undefined,
        });
      }
    }),
  );

  await updateBooking(svc.store, bookingId, (b) => {
    for (const [kind, r] of results) {
      b.emails[kind] = {
        status: r.status,
        at: nowIso,
        attempts: (b.emails[kind]?.attempts ?? 0) + 1,
        ...(r.providerId ? { providerId: r.providerId } : {}),
      };
    }
    return b;
  });
  for (const [kind, r] of results) outcomes[kind] = r.status;
  return { outcomes };
}
