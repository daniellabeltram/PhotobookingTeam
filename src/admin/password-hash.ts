// Offline helpers for the password tool (ADR 0003). WebCrypto only, no network, nothing stored.
// The hash format matches netlify/lib/auth/password.ts: pbkdf2-sha256$<iterations>$<salt>$<key>.

export const MIN_PASSPHRASE = 14;
export const ITERATIONS = 600_000;

export function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
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

export function checkPassphrase(pass: string, confirm: string): string | null {
  if (pass.length < MIN_PASSPHRASE) return `Please use at least ${MIN_PASSPHRASE} characters. A few random words works well.`;
  if (pass !== confirm) return "The two passphrases don't match.";
  return null;
}

export async function hashPassphrase(
  pass: string,
  iterations = ITERATIONS,
  saltBytes: Uint8Array = crypto.getRandomValues(new Uint8Array(16)),
): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltBytes);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256);
  return `pbkdf2-sha256$${iterations}$${base64url(salt)}$${base64url(new Uint8Array(bits))}`;
}

export function generateTotpSecret(bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(20))): string {
  return base32(bytes);
}

export function otpauthUri(secret: string, account: string, issuer = 'Daniella Beltram Photography'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account || 'admin')}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
