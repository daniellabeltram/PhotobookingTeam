// GET /api/availability?type=&from=&to=&durationMin= (public, rate limited per IP).
import type { Config } from "@netlify/functions";
import { runAvailability } from "../lib/domain/availability-endpoint";
import { defineFunction, dispatch, json } from "../lib/http";

export default defineFunction("availability", (req, rc) =>
  dispatch(
    [{ method: "GET", pattern: "/api/availability", handler: async (r) => json(200, await runAvailability(new URL(r.url), rc, false)) }],
    req,
    rc,
  ),
);

export const config: Config = { path: "/api/availability", method: ["GET"] };
