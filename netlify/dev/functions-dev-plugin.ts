// Vite plugin: serves every Netlify Function in netlify/functions/ at its config.path, on the same
// origin as the front end (ADR 0001). No Netlify CLI, no accounts. Also loads .env for the functions.
import { readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin, type ViteDevServer } from "vite";
import { matchAny } from "../lib/route";

interface FunctionModule {
  default: (req: Request, context?: unknown) => Promise<Response> | Response;
  config?: { path?: string | string[]; method?: string | string[] };
}
interface Entry {
  file: string;
  paths: string[];
  methods: string[] | null;
}

const MAX_BODY_BYTES = 64 * 1024; // the API limit is 32 KB; leave room so the handler can answer 413 itself

export function functionsDevPlugin(options: { functionsDir?: string } = {}): Plugin {
  const root = process.cwd();
  const dir = resolve(root, options.functionsDir ?? "netlify/functions");
  let table: Entry[] | null = null;

  async function buildTable(server: ViteDevServer): Promise<Entry[]> {
    const entries: Entry[] = [];
    for (const name of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))) {
      const file = join(dir, name);
      const mod = (await server.ssrLoadModule(file)) as FunctionModule;
      const path = mod.config?.path;
      if (!path) continue;
      const method = mod.config?.method;
      entries.push({
        file,
        paths: Array.isArray(path) ? path : [path],
        methods: method ? (Array.isArray(method) ? method : [method]).map((m) => m.toUpperCase()) : null,
      });
    }
    return entries;
  }

  async function readBody(req: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      const buf = chunk as Buffer;
      size += buf.length;
      if (size > MAX_BODY_BYTES) break;
      chunks.push(buf);
    }
    return Buffer.concat(chunks);
  }

  return {
    name: "dbp-netlify-functions-dev",
    apply: "serve",
    config(_config, env) {
      // Vite only exposes VITE_* to the browser; the functions read process.env, so load .env here.
      const loaded = loadEnv(env.mode, root, "");
      for (const [k, v] of Object.entries(loaded)) if (process.env[k] === undefined) process.env[k] = v;
      process.env.APP_ENV ||= "local";
    },
    configureServer(server) {
      server.watcher.on("add", () => (table = null));
      server.watcher.on("unlink", () => (table = null));
      server.watcher.on("change", (f) => {
        if (f.startsWith(dir)) table = null;
      });

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost:5173"}`);
        if (!url.pathname.startsWith("/api/")) return next();
        try {
          table ??= await buildTable(server);
          const method = (req.method ?? "GET").toUpperCase();
          const hit = table.find((e) => matchAny(e.paths, url.pathname));
          if (!hit) {
            res.statusCode = 404;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found." } }));
            return;
          }
          if (hit.methods && !hit.methods.includes(method)) {
            res.statusCode = 405;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }));
            return;
          }
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (v === undefined) continue;
            if (k.toLowerCase() === "x-nf-client-connection-ip") continue; // never trust a client-sent value
            headers.set(k, Array.isArray(v) ? v.join(", ") : v);
          }
          headers.set("x-nf-client-connection-ip", req.socket.remoteAddress ?? "127.0.0.1");
          const hasBody = !["GET", "HEAD"].includes(method);
          const body = hasBody ? await readBody(req) : null;
          const request = new Request(url, {
            method,
            headers,
            body: body && body.length > 0 ? new Uint8Array(body) : undefined,
          });
          const mod = (await server.ssrLoadModule(hit.file)) as FunctionModule;
          const response = await mod.default(request, { ip: req.socket.remoteAddress ?? "127.0.0.1" });
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() !== "set-cookie") res.setHeader(key, value);
          });
          const cookies = response.headers.getSetCookie();
          if (cookies.length > 0) res.setHeader("set-cookie", cookies);
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.config.logger.error(`[functions] ${(err as Error).message}`);
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: { code: "INTERNAL", message: "Something went wrong on our side." } }));
        }
      });
    },
  };
}
