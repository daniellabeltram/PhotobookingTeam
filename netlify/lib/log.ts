// Structured logs with a key allowlist (architecture section 11). The ONLY file that may use console.
// Nothing here ever receives a name, email, phone, intake text, payment detail, full IP or err.message.
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Typed reasons: a closed union keeps free text (and so personal details) out of the logs. */
export type LogReason =
  | "honeypot"
  | "rate_limited"
  | "global_cap"
  | "login_limited"
  | "login_failed"
  | "login_ok"
  | "slot_taken"
  | "busy"
  | "validation_failed"
  | "idempotent_replay"
  | "email_failed"
  | "email_sent"
  | "release_failed"
  | "orphan_pruned"
  | "unauthorized"
  | "forbidden_origin"
  | "version_conflict"
  | "invalid_transition"
  | "env_invalid"
  | "unhandled"
  | "store_error"
  | "created"
  | "transition"
  | "reschedule"
  | "pii_deleted"
  | "block_created"
  | "mini_slots_created";

interface LogFields {
  requestId?: string;
  fn?: string;
  route?: string;
  status?: number;
  code?: string;
  bookingId?: string;
  durationMs?: number;
  count?: number;
  reason?: LogReason;
  driver?: string;
  kind?: string;
  honeypot?: number;
  providerStatus?: number;
  errorName?: string;
  rule?: string;
}

const ALLOWED = new Set([
  "requestId", "fn", "route", "status", "code", "bookingId", "durationMs", "count", "reason", "driver", "kind",
  "honeypot", "providerStatus", "errorName", "rule",
]);
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let minLevel: LogLevel = "info";
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export type LogSink = (line: string) => void;
let sink: LogSink | null = null;
/** Tests capture logs here. Pass null to restore console output. */
export function setLogSink(next: LogSink | null): void {
  sink = next;
}

function clean(value: unknown): string | number | boolean | undefined {
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  // defence in depth: an address or a long free-text string never gets through, whatever the caller passes
  if (value.includes("@") || value.length > 120) return "[dropped]";
  return value;
}

export function log(level: LogLevel, msg: string, fields: LogFields = {}): void {
  if (ORDER[level] < ORDER[minLevel]) return;
  const out: Record<string, unknown> = { level, msg: clean(msg) ?? "", ts: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) {
    if (!ALLOWED.has(k)) continue;
    const c = clean(v);
    if (c !== undefined) out[k] = c;
  }
  const line = JSON.stringify(out);
  if (sink) return sink(line);
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}
