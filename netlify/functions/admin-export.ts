// GET /api/admin/export.csv: every booking matching the list filters (no paging).
import type { Config } from "@netlify/functions";
import { todayEt } from "../../shared/datetime";
import { listQuerySchema } from "../../shared/schemas/admin";
import { withAdmin } from "../lib/auth/guard";
import { filterBookings, flagSettings } from "../lib/domain/admin-list";
import { bookingsToCsv } from "../lib/domain/csv-export";
import { fieldErrors, validationFailed } from "../lib/http";
import { listBookings } from "../lib/repos/bookings";

export default withAdmin("admin-export", [
  {
    method: "GET",
    pattern: "/api/admin/export.csv",
    handler: async (req, _p, rc) => {
      const parsed = listQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
      if (!parsed.success) throw validationFailed(fieldErrors(parsed.error));
      const now = rc.svc.clock.now();
      const rows = filterBookings(await listBookings(rc.svc.store), parsed.data, now, flagSettings(rc.svc));
      return new Response(bookingsToCsv(rows), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="bookings-${todayEt(now)}.csv"`,
        },
      });
    },
  },
]);

export const config: Config = { path: "/api/admin/export.csv", method: ["GET"] };
