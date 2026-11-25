// HTTP helpers shared by every function: JSON responses, the error body, safe body reading, the route
// dispatcher and the top-level wrapper that never leaks an internal error (review M3).
import type { ZodError } from "zod";
import { ERROR_STATUS } from "../../shared/errors";
import { EnvError } from "./env";
import { HttpError } from "./errors";
import { clientIp } from "./ip";
import { log } from "./log";
import { matchRoute, type Params, type RouteDef } from "./route";
import { getServices, setPlatformContext, type Services } from "./services";

export const MAX_BODY_BYTES = 32 * 1024;

export interface RequestContext {
  requestId: string;
  svc: Services;
  ip: string;
  fn: string;
}
type NetlifyContextLike = { ip?: string; deploy?: { context?: string } } | undefined;

export function json(status: number, data: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ data }), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}
export function noContent(headers: Record<string, string> = {}, cookies: string[] = []): Response {
  const h = new Headers(headers);
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(null, { status: 204, headers: h });
}
export function errorResponse(err: HttpError): Response {
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8", ...(err.headers ?? {}) };
  const body = { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } };
  return new Response(JSON.stringify(body), { status: ERROR_STATUS[err.code], headers });
}

/** { "contact.email": "message" } with the first message per path. Unknown keys are reported as "Unknown field". */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const base = issue.path.map(String);
    if (issue.code === "unrecognized_keys") {
      for (const k of issue.keys) out[[...base, k].join(".")] ??= "Unknown field";
      continue;
    }
    out[base.join(".") || "body"] ??= issue.message;
  }
  return out;
}
export function validationFailed(fields: Record<string, string>, message = "Please check the highlighted fields."): HttpError {
  return new HttpError("VALIDATION_FAILED", message, { fieldErrors: fields });
}

/** Reads a JSON object body: content-type, size cap before parsing, then parse. */
export async function readJsonBody(req: Request, opts: { required?: boolean } = {}): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new HttpError("PAYLOAD_TOO_LARGE", "That request is too large.");
  if (req.body === null) {
    if (opts.required === false) return {};
    throw validationFailed({ body: "Send a JSON body." }, "Send a JSON body.");
  }
  if (!/^application\/json(\s*;|$)/i.test(type)) throw validationFailed({ body: "Use Content-Type: application/json." }, "Use Content-Type: application/json.");
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new HttpError("PAYLOAD_TOO_LARGE", "That request is too large.");
  if (text.trim() === "") {
    if (opts.required === false) return {};
    throw validationFailed({ body: "Send a JSON body." }, "Send a JSON body.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw validationFailed({ body: "The request body isn't valid JSON." }, "The request body isn't valid JSON.");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw validationFailed({ body: "The request body must be a JSON object." }, "The request body must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

export interface FunctionOptions {
  /** Extra headers on every response (admin: X-Robots-Tag). */
  headers?: Record<string, string>;
}

export type Handler = (req: Request, rc: RequestContext) => Promise<Response>;

/**
 * The outer shell of every function. It assigns the request id, validates the environment (fail closed),
 * logs one line, and turns ANY unexpected error into a generic 500 that logs only the error class name.
 */
export function defineFunction(name: string, handler: Handler, options: FunctionOptions = {}) {
  return async (req: Request, context?: unknown): Promise<Response> => {
    const started = Date.now();
    const requestId = crypto.randomUUID();
    const ctx = context as NetlifyContextLike;
    const route = new URL(req.url).pathname;
    let res: Response;
    try {
      setPlatformContext(ctx?.deploy?.context);
      const svc = getServices();
      res = await handler(req, { requestId, svc, ip: clientIp(req, ctx), fn: name });
    } catch (err) {
      if (err instanceof HttpError) {
        res = errorResponse(err);
      } else if (err instanceof EnvError) {
        log("error", "environment rejected", { requestId, fn: name, code: "INTERNAL", reason: "env_invalid", rule: err.rule });
        res = errorResponse(new HttpError("INTERNAL", "Something went wrong on our side. Please try again."));
      } else {
        log("error", "unhandled error", { requestId, fn: name, code: "INTERNAL", reason: "unhandled", errorName: err instanceof Error ? err.name : "NonError" });
        res = errorResponse(new HttpError("INTERNAL", "Something went wrong on our side. Please try again."));
      }
    }
    const headers = new Headers(res.headers);
    headers.set("x-request-id", requestId);
    if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
    for (const [k, v] of Object.entries(options.headers ?? {})) headers.set(k, v);
    log("info", "request", { requestId, fn: name, route: routeLabel(route), status: res.status, durationMs: Date.now() - started });
    return new Response(res.body, { status: res.status, headers });
  };
}

/** Booking references and ids in a path never reach the log: ":id" is logged instead. */
function routeLabel(path: string): string {
  return path.replace(/DBP-[A-Z0-9]{6}/gi, ":id").replace(/blk_[a-z0-9]{8}/g, ":id").replace(/ms_\d{4}-\d{2}-\d{2}_\d{4}/g, ":slot");
}

/** Matches method and path against a table. 405 when the path exists with another method, else 404. */
export async function dispatch(routes: RouteDef<RequestContext>[], req: Request, rc: RequestContext): Promise<Response> {
  const path = new URL(req.url).pathname;
  const method = req.method.toUpperCase();
  let pathMatched = false;
  for (const r of routes) {
    const params: Params | null = matchRoute(r.pattern, path);
    if (!params) continue;
    pathMatched = true;
    if (r.method === method) return r.handler(req, params, rc);
  }
  if (pathMatched) throw new HttpError("METHOD_NOT_ALLOWED", "That method isn't allowed here.");
  throw new HttpError("NOT_FOUND", "We couldn't find that.");
}

export function setCookieHeaders(res: Response, cookies: string[]): Response {
  const headers = new Headers(res.headers);
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(res.body, { status: res.status, headers });
}
