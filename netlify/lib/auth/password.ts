// PBKDF2-HMAC-SHA256 password hashing (ADR 0003). Self-contained (node:crypto only) so that
// `node scripts/admin-hash.ts` can import it with Node's type stripping.
import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";

export const DEFAULT_ITERATIONS = 600_000;
const KEY_BYTES = 32;

/** Counts derivations. The login-limiter concurrency test asserts how many ran. */
export const passwordStats = { runs: 0 };

function derive(password: string, salt: Buffer, iterations: number): Promise<Buffer> {
  passwordStats.runs++;
  return new Promise((resolve, reject) => {
    pbkdf2(password.normalize("NFKC"), salt, iterations, KEY_BYTES, "sha256", (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

interface Parsed {
  iterations: number;
  salt: Buffer;
  key: Buffer;
}
export function parseHash(stored: string): Parsed | null {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return null;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 5_000_000) return null;
  const salt = Buffer.from(parts[2] as string, "base64url");
  const key = Buffer.from(parts[3] as string, "base64url");
  if (salt.length < 8 || key.length !== KEY_BYTES) return null;
  return { iterations, salt, key };
}

/** Always performs the derivation, so timing does not reveal anything. False for a malformed stored hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) {
    await derive(password, randomBytes(16), DEFAULT_ITERATIONS);
    return false;
  }
  const key = await derive(password, parsed.salt, parsed.iterations);
  return timingSafeEqual(key, parsed.key);
}
