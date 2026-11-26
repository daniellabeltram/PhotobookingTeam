// File email driver for local development: each message becomes a folder in the outbox (ADR 0004).
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { log } from "../log";
import type { EmailSender, OutgoingEmail } from "./sender";

export class FileEmailSender implements EmailSender {
  private readonly root: string;
  constructor(dir: string) {
    this.root = resolve(dir);
  }

  async send(msg: OutgoingEmail): Promise<{ providerId: string }> {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `${stamp}-${msg.bookingId}-${msg.kind}`;
    const dir = join(this.root, name);
    await mkdir(dir, { recursive: true });
    const { text, html, attachments, ...headers } = msg;
    await writeFile(join(dir, "message.json"), JSON.stringify(headers, null, 2), "utf8");
    await writeFile(join(dir, "body.txt"), text, "utf8");
    await writeFile(join(dir, "body.html"), html, "utf8");
    for (const a of attachments ?? []) {
      await writeFile(join(dir, a.filename.replace(/[^A-Za-z0-9._-]/g, "_")), Buffer.from(a.contentBase64, "base64"));
    }
    log("info", "email written to outbox", { kind: msg.kind, bookingId: msg.bookingId, driver: "file" });
    return { providerId: name };
  }
}
