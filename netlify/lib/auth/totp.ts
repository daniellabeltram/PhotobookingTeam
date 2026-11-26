// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) with node:crypto. Constant-time comparison (review M2).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const offset = (h[h.length - 1] as number) & 15;
  const code = (h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}
export const totpStep = (nowMs: number): number => Math.floor(nowMs / 30_000);
export const totpCode = (secretB32: string, nowMs: number): string => hotp(base32Decode(secretB32), totpStep(nowMs));

/**
 * Returns the matching step (current, previous or next) or null. Every candidate is compared without
 * an early exit so the time taken does not say which step matched.
 */
export function verifyTotp(secretB32: string, submitted: string, nowMs: number): number | null {
  const secret = base32Decode(secretB32);
  const wellFormed = /^\d{6}$/.test(submitted);
  const given = Buffer.from(wellFormed ? submitted : "000000");
  const step = totpStep(nowMs);
  let matched: number | null = null;
  for (const s of [step - 1, step, step + 1]) {
    const expected = Buffer.from(hotp(secret, s));
    if (timingSafeEqual(expected, given) && wellFormed) matched = matched ?? s;
  }
  return matched;
}
