// EmailSender adapter (ADR 0004). Drivers: memory (tests), file (local), resend (preview, production).
import type { EmailKind } from "../../../shared/models";

export interface OutgoingEmail {
  kind: EmailKind;
  bookingId: string;
  /** Always a bare address ("a@b.com"), never "Name <a@b.com>" (review M5). */
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; contentType: string; contentBase64: string }[];
  /** `${bookingId}:${kind}:${icsSequence}:${attempt}` */
  idempotencyKey: string;
}

export interface EmailSender {
  send(msg: OutgoingEmail): Promise<{ providerId: string }>;
}

/** Thrown by drivers. Carries an HTTP status at most, never the provider's body (it can echo the address). */
export class EmailSendError extends Error {
  readonly providerStatus: number | null;
  constructor(providerStatus: number | null) {
    super("Email send failed");
    this.name = "EmailSendError";
    this.providerStatus = providerStatus;
  }
}

/** Header-safe single line: no control characters, no line or paragraph separators, at most 80 characters. */
export function sanitizeHeader(value: string, max = 80): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trimEnd()}…` : cleaned;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Greeting name: the first token only, at most 30 characters. Anything that looks like a link, an
 * address or a path is dropped ("there" is used) so the relay can't carry a message (review M5).
 */
export function firstNameOf(fullName: string | null | undefined): string {
  const token = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  // eslint-disable-next-line no-control-regex
  const clean = token.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029<>"]/g, "");
  if (!clean || /[/\\:@]|www\.|https?|\.[a-z]{2,}$/i.test(clean)) return "there";
  return clean.slice(0, 30);
}

/** Wraps a sender so that every message goes to one test inbox (previews, ADR 0004). */
export class RedirectingSender implements EmailSender {
  private readonly inner: EmailSender;
  private readonly redirectTo: string;
  constructor(inner: EmailSender, redirectTo: string) {
    this.inner = inner;
    this.redirectTo = redirectTo;
  }
  send(msg: OutgoingEmail): Promise<{ providerId: string }> {
    return this.inner.send({ ...msg, to: this.redirectTo, subject: `[preview → original recipient hidden] ${msg.subject}` });
  }
}
