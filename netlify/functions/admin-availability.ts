// GET /api/admin/availability: the same as the public endpoint, minus notice, horizon and rate limit (story 014).
import type { Config } from "@netlify/functions";
import { withAdmin } from "../lib/auth/guard";
import { runAvailability } from "../lib/domain/availability-endpoint";
import { json } from "../lib/http";

export default withAdmin("admin-availability", [
  { method: "GET", pattern: "/api/admin/availability", handler: async (req, _p, rc) => json(200, await runAvailability(new URL(req.url), rc, true)) },
]);

export const config: Config = { path: "/api/admin/availability", method: ["GET"] };
