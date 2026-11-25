// Booking references: "DBP-" + 6 random characters, no look-alikes, not sequential (story 007 #2).
export const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const REFERENCE_RE = /^DBP-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;

export function generateReference(): string {
  const n = REFERENCE_ALPHABET.length;
  const limit = 256 - (256 % n); // rejection sampling keeps the distribution uniform
  let out = "";
  while (out.length < 6) {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    for (const b of bytes) {
      if (b < limit && out.length < 6) out += REFERENCE_ALPHABET[b % n];
    }
  }
  return `DBP-${out}`;
}
/** Upper-cases and validates. Returns null for anything malformed. */
export function normalizeReference(input: string): string | null {
  const up = input.trim().toUpperCase();
  return REFERENCE_RE.test(up) ? up : null;
}
