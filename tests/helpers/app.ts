// Calls the real Netlify function handlers in-process (docs/api.md "Tests call handlers directly").
// Each freshApp() resets modules so every test gets an empty memory store, email outbox and rate limits.
import { vi } from "vitest";
import { applyTestEnv } from "./env";
import { Api, type Transport } from "./builders";

type Handler = (req: Request, ctx?: unknown) => Promise<Response> | Response;

/** Route table from docs/architecture.md section 7. Order matters (specific before general). */
const ROUTES: [RegExp, string][] = [
  [/^\/api\/config$|^\/api\/policies\//, "config"],
  [/^\/api\/availability$/, "availability"],
  [/^\/api\/bookings$/, "bookings-create"],
  [/^\/api\/admin\/(login|logout|session)$/, "admin-auth"],
  [/^\/api\/admin\/availability$/, "admin-availability"],
  [/^\/api\/admin\/blocks/, "admin-blocks"],
  [/^\/api\/admin\/mini-days/, "admin-mini-days"],
  [/^\/api\/admin\/export\.csv$/, "admin-export"],
  [/^\/api\/admin\/bookings/, "admin-bookings"],
];

/** One sample request per admin route in docs/api.md (story 010 #2, must-have 7). */
export const ADMIN_ROUTE_SAMPLES: { method: string; path: string; body?: unknown }[] = [
  { method: "GET", path: "/api/admin/session" },
  { method: "GET", path: "/api/admin/bookings" },
  { method: "GET", path: "/api/admin/bookings/DBP-AAAAAA" },
  { method: "PATCH", path: "/api/admin/bookings/DBP-AAAAAA", body: { action: "approve", expectedVersion: 1 } },
  { method: "POST", path: "/api/admin/bookings/DBP-AAAAAA/reschedule", body: { expectedVersion: 1, startUtc: "2026-12-10T14:00:00.000Z", reason: "weather" } },
  { method: "POST", path: "/api/admin/bookings/DBP-AAAAAA/resend-email", body: {} },
  { method: "POST", path: "/api/admin/bookings/DBP-AAAAAA/delete-client-data", body: { confirmReference: "DBP-AAAAAA", expectedVersion: 1 } },
  { method: "GET", path: "/api/admin/availability?type=portraits" },
  { method: "GET", path: "/api/admin/blocks" },
  { method: "POST", path: "/api/admin/blocks", body: { kind: "all_day", startDate: "2026-12-24", endDate: "2026-12-24", label: null, confirmOverlaps: false } },
  { method: "DELETE", path: "/api/admin/blocks/blk_00000000" },
  { method: "GET", path: "/api/admin/mini-days" },
  { method: "POST", path: "/api/admin/mini-days/2026-12-12/slots", body: { location: "X", theme: null, startTimes: ["08:00"] } },
  { method: "DELETE", path: "/api/admin/mini-days/2026-12-12/slots/ms_2026-12-12_0800" },
  { method: "DELETE", path: "/api/admin/mini-days/2026-12-12" },
  { method: "GET", path: "/api/admin/export.csv" },
];

export async function freshApp(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  applyTestEnv(env);
  const cache = new Map<string, Handler>();
  const load = async (name: string): Promise<Handler> => {
    if (!cache.has(name)) cache.set(name, (await import(/* @vite-ignore */ `../../netlify/functions/${name}`)).default);
    return cache.get(name)!;
  };
  const transport: Transport = async (req) => {
    const path = new URL(req.url).pathname;
    const hit = ROUTES.find(([re]) => re.test(path));
    if (!hit) return new Response("no route in QA table", { status: 599 });
    return (await load(hit[1]))(req);
  };
  const api = () => new Api(transport);
  return { api, transport, load };
}

function safeJson(x: unknown) {
  try { return JSON.stringify(x); } catch { return String(x); }
}

/** Capture everything the code logs, to assert no PII leaks (story 017 #6, must-have 10). */
export function captureLogs() {
  const lines: string[] = [];
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      lines.push(a.map((x) => (typeof x === "string" ? x : safeJson(x))).join(" "));
    }),
  );
  const stdout = vi.spyOn(process.stdout, "write").mockImplementation(((c: unknown) => { lines.push(String(c)); return true; }) as never);
  return { lines, text: () => lines.join("\n"), restore: () => { spies.forEach((s) => s.mockRestore()); stdout.mockRestore(); } };
}

/** Sent emails from the memory driver (ADR 0004). Throws a clear message if the shape differs. */
export async function sentEmails(): Promise<any[]> {
  const p = "../../netlify/lib/services";
  const mod: any = await import(/* @vite-ignore */ p);
  const svc = typeof mod.getServices === "function" ? await mod.getServices() : mod.services;
  const email = svc?.email;
  const list = email?.sent ?? email?.messages ?? email?.outbox;
  if (!Array.isArray(list)) throw new Error("QA helper sentEmails(): memory email driver exposes no `sent` array; adapt tests/helpers/app.ts");
  return list;
}
