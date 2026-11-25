// Memory email driver for tests. Messages are kept in `sent`; failNext(n) simulates an outage.
import { EmailSendError, type EmailSender, type OutgoingEmail } from "./sender";

export class MemoryEmailSender implements EmailSender {
  readonly sent: OutgoingEmail[] = [];
  private failures = 0;
  private counter = 0;

  failNext(n = 1): void {
    this.failures = n;
  }
  clear(): void {
    this.sent.length = 0;
  }

  async send(msg: OutgoingEmail): Promise<{ providerId: string }> {
    await new Promise<void>((r) => setImmediate(r));
    if (this.failures > 0) {
      this.failures--;
      throw new EmailSendError(503);
    }
    this.sent.push(msg);
    return { providerId: `mem_${++this.counter}` };
  }
}
