import { pbkdf2Sync } from "node:crypto";
import { ADMIN_PASSWORD } from "./seed";

/** ADR 0003 format: pbkdf2-sha256$600000$<salt b64url 16B>$<key b64url 32B>. Fixed salt: test-only. */
export function adminPasswordHash(password = ADMIN_PASSWORD): string {
  const salt = Buffer.from("qa-fixed-salt-16"); // 16 bytes
  const key = pbkdf2Sync(password, salt, 600000, 32, "sha256");
  return `pbkdf2-sha256$600000$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
