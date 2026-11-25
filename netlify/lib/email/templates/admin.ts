// Daniella's new-booking notice. Minimal by design (story 008 #2, review M4): reference, type, date and time,
// client name, a marker for requests, and the admin link. No phone, email, notes or calendar file.
import { formatDateLong, formatDateShort, formatRangeEt, formatTime } from "../../../../shared/datetime";
import { escapeHtml, sanitizeHeader } from "../sender";
import type { EmailContext, Rendered } from "./common";

export function renderAdminNewBooking(ctx: EmailContext): Rendered {
  const { booking: b, config } = ctx;
  const isRequest = b.status === "requested";
  const name = sanitizeHeader(b.contact?.fullName ?? "A client", 60);
  const link = `${ctx.baseUrl}/admin/#/bookings/${encodeURIComponent(b.id)}`;
  const subject = isRequest
    ? `New event request — needs your approval — ${b.id}`
    : sanitizeHeader(`New booking: ${name}, ${b.sessionTypeName}, ${formatDateShort(b.startUtc)} ${formatTime(b.startUtc)}`);
  const lines = [
    isRequest ? "New event request. Approve or decline in admin." : b.status === "confirmed" ? "New booking, confirmed." : "New booking, pending deposit.",
    "",
    `Reference: ${b.id}`,
    `Client: ${name}`,
    `Session: ${b.sessionTypeName} (${b.durationMin} min)`,
    `When: ${formatDateLong(b.startUtc)}, ${formatRangeEt(b.startUtc, b.endUtc)}`,
    "",
    `${isRequest ? "Review this request" : "Open in admin"}: ${link}`,
    "",
    "Contact details and answers are in admin, behind your sign-in.",
  ];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title></title></head><body style="font-family:Georgia,serif;font-size:17px;line-height:1.5;color:#222;max-width:600px;margin:0 auto;padding:24px 16px"><p>${escapeHtml(lines[0] as string)}</p><p>${lines.slice(2, 6).map(escapeHtml).join("<br>")}</p><p><a href="${escapeHtml(link)}">${escapeHtml(isRequest ? "Review this request" : "Open in admin")}</a></p><p style="font-size:14px">${escapeHtml(lines[lines.length - 1] as string)}</p><p style="font-size:12px;color:#666">${escapeHtml(config.business.name)}</p></body></html>`;
  return { subject, text: lines.join("\n"), html };
}
