// Client IP: ONLY from the platform header or the function context, never from x-forwarded-for (H3).
import { createHmac } from "node:crypto";

export function clientIp(req: Request, context?: { ip?: string } | null): string {
  const h = req.headers.get("x-nf-client-connection-ip")?.trim();
  return h || context?.ip || "127.0.0.1";
}

/** IPv6 addresses are bucketed by /64 (the first four hextets), so a rotating host suffix doesn't evade limits. */
export function ipBucket(ip: string): string {
  if (!ip.includes(":")) return ip;
  let addr = ip.toLowerCase().split("%")[0] as string;
  const v4mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return v4mapped[1] as string;
  if (addr.includes("::")) {
    const [head = "", tail = ""] = addr.split("::");
    const h = head ? head.split(":") : [];
    const t = tail ? tail.split(":") : [];
    addr = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t].join(":");
  }
  return addr
    .split(":")
    .slice(0, 4)
    .map((x) => x.padStart(4, "0"))
    .join(":") + "::/64";
}

/** HMAC of the bucketed address, keyed from the session secret, so stored keys never hold an IP. */
export function hashIp(ip: string, secret: string): string {
  const key = createHmac("sha256", secret).update("dbp-ip-v1").digest();
  return createHmac("sha256", key).update(ipBucket(ip)).digest("hex").slice(0, 32);
}

/** HMAC of any identifier (a device id, for example), so stored limiter keys never hold the raw value. */
export function hashKey(value: string, secret: string): string {
  const key = createHmac("sha256", secret).update("dbp-key-v1").digest();
  return createHmac("sha256", key).update(value).digest("hex").slice(0, 32);
}
