// GET /api/config and GET /api/policies/:version (public, cacheable for 60 s).
import type { Config } from "@netlify/functions";
import { getPolicy } from "../lib/config";
import { buildPublicConfig } from "../lib/domain/public-config";
import { HttpError } from "../lib/errors";
import { defineFunction, dispatch, json } from "../lib/http";

const CACHE = { "cache-control": "public, max-age=60" };

export default defineFunction("config", (req, rc) =>
  dispatch(
    [
      { method: "GET", pattern: "/api/config", handler: async () => json(200, await buildPublicConfig(rc.svc), CACHE) },
      {
        method: "GET",
        pattern: "/api/policies/:version",
        handler: async (_req, params) => {
          const version = params.version ?? "";
          const policy = /^[A-Za-z0-9._-]{1,40}$/.test(version) ? getPolicy(version) : null;
          if (!policy) throw new HttpError("NOT_FOUND", "We couldn't find that policy version.");
          return json(200, { ...policy, isCurrent: policy.version === rc.svc.config.policyVersion }, CACHE);
        },
      },
    ],
    req,
    rc,
  ),
);

export const config: Config = { path: ["/api/config", "/api/policies/:version"], method: ["GET"] };
