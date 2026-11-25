// Resend driver: POST https://api.resend.com/emails with fetch (ADR 0004). No SDK.
// Failures keep only the HTTP status (review M3): the provider's reply can echo the recipient's address.
import { EmailSendError, type EmailSender, type OutgoingEmail } from "./sender";

export interface ResendOptions {
  apiKey: string;
  fromName: string;
  fromAddress: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class ResendEmailSender implements EmailSender {
  private readonly opts: ResendOptions;
  constructor(opts: ResendOptions) {
    this.opts = opts;
  }

  async send(msg: OutgoingEmail): Promise<{ providerId: string }> {
    const doFetch = this.opts.fetchImpl ?? fetch;
    let res: Response;
    try {
      res = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.opts.apiKey}`,
          "content-type": "application/json",
          "idempotency-key": msg.idempotencyKey,
        },
        body: JSON.stringify({
          from: `${this.opts.fromName.replace(/[<>"\r\n]/g, "")} <${this.opts.fromAddress}>`,
          to: [msg.to],
          reply_to: msg.replyTo,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
          attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: a.contentBase64, content_type: a.contentType })),
        }),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 10_000),
      });
    } catch {
      throw new EmailSendError(null); // network error or timeout
    }
    if (!res.ok) throw new EmailSendError(res.status);
    let id = "";
    try {
      id = String(((await res.json()) as { id?: string }).id ?? "");
    } catch {
      /* a 2xx without a JSON body still counts as sent */
    }
    return { providerId: id || "resend" };
  }
}
