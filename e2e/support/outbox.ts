// Reads the local file email driver's outbox (EMAIL_OUTBOX_DIR, set by playwright.config.ts).
// File format is owned by the back end; we only search file contents, so any text format works.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = () => join(process.cwd(), process.env.PW_E2E_DATA ?? ".data/e2e", "outbox");

function walk(d: string): string[] {
  try {
    return readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  } catch {
    return [];
  }
}

/** Every outbox file whose content mentions `needle` (a reference like DBP-XXXXXX). */
export function emailsMentioning(needle: string): { file: string; text: string }[] {
  return walk(dir()).map((file) => ({ file, text: readFileSync(file, "utf8") })).filter((e) => e.text.includes(needle));
}

/** .ics attachments written for emails of `kind` (e.g. "booking_received", "request_received") about `reference`. */
export function icsFor(reference: string, kind: string): string[] {
  return walk(dir())
    .filter((f) => f.includes(reference) && f.includes(`${kind}/`) && f.endsWith(".ics"))
    .map((f) => readFileSync(f, "utf8"));
}

/** Email folders for `reference` and `kind`, whether or not they carry an attachment. */
export function emailFolders(reference: string, kind: string): string[] {
  return [...new Set(walk(dir()).filter((f) => f.includes(reference) && f.includes(`${kind}/`)).map((f) => f.slice(0, f.lastIndexOf("/"))))];
}
