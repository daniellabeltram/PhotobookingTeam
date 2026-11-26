// Shared pieces for the email templates (docs/design/emails.md). Every message has a text and an HTML part.
// All interpolated values go through escapeHtml in HTML. Client text is never turned into a link.
import type { BookingConfig, SessionType } from "../../../../shared/config-schema";
import { formatDateLong, formatRangeEt } from "../../../../shared/datetime";
import type { Booking } from "../../../../shared/models";
import { locationText } from "../ics";
import { escapeHtml, sanitizeHeader } from "../sender";

export interface EmailContext {
  config: BookingConfig;
  booking: Booking;
  type: SessionType;
  baseUrl: string;
}
export interface Rendered {
  subject: string;
  text: string;
  html: string;
}

export interface Block {
  title?: string;
  paragraphs?: string[];
  lines?: string[];
  bullets?: string[];
  link?: { label: string; url: string };
}

export function compose(opts: { preheader: string; greeting: string; intro: string[]; blocks: Block[]; signoff?: string[] }, config: BookingConfig): { text: string; html: string } {
  const sign = opts.signoff ?? ["See you soon,", "Daniella", config.business.name, "West Palm Beach, Florida", new URL(config.business.siteUrl).hostname];
  const t: string[] = [opts.greeting, "", ...opts.intro.flatMap((p) => [p, ""])];
  const h: string[] = [`<p style="margin:0 0 16px">${escapeHtml(opts.greeting)}</p>`, ...opts.intro.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`)];
  for (const b of opts.blocks) {
    if (b.title) {
      t.push(b.title.toUpperCase());
      h.push(`<h2 style="font-size:16px;letter-spacing:.04em;margin:24px 0 8px">${escapeHtml(b.title.toUpperCase())}</h2>`);
    }
    for (const p of b.paragraphs ?? []) {
      t.push(p, "");
      h.push(`<p style="margin:0 0 12px">${escapeHtml(p)}</p>`);
    }
    if (b.lines?.length) {
      t.push(...b.lines, "");
      h.push(`<p style="margin:0 0 12px">${b.lines.map(escapeHtml).join("<br>")}</p>`);
    }
    if (b.bullets?.length) {
      t.push(...b.bullets.map((x) => `- ${x}`), "");
      h.push(`<ul style="margin:0 0 12px;padding-left:20px">${b.bullets.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`);
    }
    if (b.link) {
      t.push(`${b.link.label}: ${b.link.url}`, "");
      h.push(`<p style="margin:0 0 12px"><a href="${escapeHtml(b.link.url)}" style="color:#1a4d5c">${escapeHtml(b.link.label)}</a><br><span style="font-size:14px">${escapeHtml(b.link.url)}</span></p>`);
    }
  }
  t.push(...sign);
  h.push(`<p style="margin:24px 0 0">${sign.map(escapeHtml).join("<br>")}</p>`);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title></title></head><body style="margin:0;padding:0;background:#faf7f2"><span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span><div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.5;color:#222">${h.join("")}</div></body></html>`;
  return { text: t.join("\n"), html };
}

export function sessionLines(ctx: EmailContext): string[] {
  const b = ctx.booking;
  const out = [
    `${b.sessionTypeName} (${b.durationMin} min)`,
    `${formatDateLong(b.startUtc)}, ${formatRangeEt(b.startUtc, b.endUtc)}`,
  ];
  const where = locationText(b);
  if (where) out.push(`Where: ${where}`);
  out.push(`Booking reference: ${b.id}`);
  return out;
}

export const weatherParagraph = "Weather reschedules are always free. I decide by 9:00 AM on the day and will email you.";
export const changeParagraph = (cfg: BookingConfig, version: string, baseUrl: string): string =>
  `Need to change something? Just reply to this email or write ${cfg.email.replyTo}. Policies you agreed to (version ${version}): ${baseUrl}/policies.html?version=${encodeURIComponent(version)}`;

export const tipBullets = (type: SessionType): string[] => type.whatToBringText.split("\n").map((s) => s.trim()).filter(Boolean);

/** Short header-safe date for subjects: "Wed, Dec 9". */
export const subj = (value: string): string => sanitizeHeader(value);
